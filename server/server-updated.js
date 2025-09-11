import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import fs from 'fs/promises';
import adminRoutes from './routes/admin-routes.js';
import { setCredentials } from './spotify-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(cookieParser());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Set security HTTP headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Generate a nonce for CSP
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// Add nonce to all responses and setup nonce middleware
app.use((req, res, next) => {
  res.locals.nonce = generateNonce();
  next();
});

// Security headers with CSP configuration
app.use((req, res, next) => {
  const csp = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        `'nonce-${res.locals.nonce}'`,
        'https://cdnjs.cloudflare.com',
        'https://accounts.spotify.com',
        'https://*.spotify.com',
        'https://cdn.jsdelivr.net',
        'https://*.openweathermap.org'
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com',
        'https://accounts.spotify.com',
        'https://*.spotify.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://*.scdn.co',
        'https://i.scdn.co',
        'https://mosaic.scdn.co',
        'https://*.openweathermap.org',
        'https://*.spotify.com',
        'https://*.spotifycdn.com'
      ],
      fontSrc: [
        "'self'",
        'data:',
        'https://cdnjs.cloudflare.com',
        'https://fonts.gstatic.com',
        'https://*.spotifycdn.com'
      ],
      connectSrc: [
        "'self'",
        'https://accounts.spotify.com',
        'https://api.spotify.com',
        'https://api.openweathermap.org',
        'wss://*.spotify.com'
      ],
      frameSrc: [
        "'self'",
        'https://accounts.spotify.com',
        'https://sdk.scdn.com',
        'https://open.spotify.com'
      ],
      mediaSrc: [
        "'self'",
        'blob:',
        'https://*.spotifycdn.com',
        'https://*.scdn.co',
        'https://w.soundcloud.com'
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false,
    browserSniff: false
  };

  helmet.contentSecurityPolicy(csp)(req, res, next);
});

// Other security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Required for Spotify Web Playback SDK
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  originAgentCluster: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  strictTransportSecurity: {
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true
  }
}));

// API routes
app.use('/api/admin', adminRoutes);

// Spotify authentication callback
app.post('/api/auth/spotify/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        redirect_uri: process.env.NODE_ENV === 'production'
          ? 'https://mood-playlist-generator.onrender.com/callback'
          : 'http://localhost:10000/callback',
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(400).json({ error: tokenData.error_description || 'Failed to exchange authorization code' });
    }

    // Get user profile
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch user profile' });
    }

    const userData = await userResponse.json();

    // Here you would typically save the user data and tokens to your database
    // For now, we'll just return the tokens
    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      user: {
        id: userData.id,
        display_name: userData.display_name,
        email: userData.email
      }
    });
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files with proper MIME types and nonce injection
const publicPath = join(__dirname, '..', 'public');

// Custom static file handler with nonce injection
const staticHandler = express.static(publicPath, {
  setHeaders: (res, path) => {
    const ext = extname(path).toLowerCase();
    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Disable caching for development
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
});

// Serve all static files through our custom handler
app.use(staticHandler);

// Special handling for HTML files to inject nonce
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const filePath = join(publicPath, req.path);
    return fs.readFile(filePath, 'utf8')
      .then(html => {
        // Inject nonce into the HTML
        const nonce = res.locals.nonce;
        if (nonce) {
          html = html.replace(/<script\s*(?![^>]*?nonce=)([^>]*)>/g, (match, attrs) => {
            return `<script nonce="${nonce}" ${attrs}>`;
          });
        }
        res.set('Content-Type', 'text/html');
        res.send(html);
      })
      .catch(() => next()); // If file not found, continue to next middleware
  } else {
    next();
  }
});

// Handle admin route to serve index.html for any admin path
app.get('/admin*', (req, res) => {
  res.sendFile(join(publicPath, 'admin', 'index.html'), {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  });
});

// Handle signup page
app.get('/signup', (req, res) => {
  res.sendFile(join(publicPath, 'signup.html'), {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  });
});

// Serve the main page for the root route
app.get('/', (req, res) => {
  res.sendFile(join(publicPath, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(join(publicPath, '404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Set port and start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize Spotify API credentials
  setCredentials({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.NODE_ENV === 'production'
      ? 'https://mood-playlist-generator.onrender.com/callback'
      : 'http://localhost:10000/callback'
  });
});

export default app;
