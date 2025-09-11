// Server-side script for Mood Playlist Generator
import 'dotenv/config';
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
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import { webcrypto as crypto } from 'crypto';
import adminRoutes from './routes/admin-routes.js';
import { nonceMiddleware } from './middleware/nonce.js';
import { setCredentials } from './spotify-api.js';

// Define public path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

// Initialize Express app
const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Generate a nonce for CSP
const generateNonce = () => {
  const array = new Uint8Array(16);
  return crypto.getRandomValues(array).reduce((acc, byte) => {
    return acc + byte.toString(16).padStart(2, '0');
  }, '');
};

// Add nonce to all responses and setup nonce middleware
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;
  
  // Set CSP header with nonce and required directives
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `script-src-elem 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' https: data:`,
    `connect-src 'self'`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `frame-src 'self'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `upgrade-insecure-requests`
  ].join('; ');
  
  // Set CSP header
  res.setHeader('Content-Security-Policy', csp);
  
  // For debugging
  console.log('CSP Header Set:', csp.split(';').join(';\n  '));
  
  next();
});

// Use nonce middleware
app.use(nonceMiddleware());

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
        'https://cdn.jsdelivr.net'
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

// Import routes
import weatherRouter from './routes/weather.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin-routes.js';

// Initialize routes
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/weather', weatherRouter);
app.use('/admin', adminRouter);

// Serve weather page at the root
app.use('/weather', weatherRouter);

function initializeRoutes() {
  console.log('Routes initialized successfully');
  return true;
}

// Validate required environment variables
const requiredEnvVars = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'OPENWEATHER_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Set environment to production if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Log environment configuration
console.log(`Starting server in ${process.env.NODE_ENV} mode`);
console.log('Server configuration:');
console.log(`- Port: ${process.env.PORT || '3000'}`);
console.log(`- Spotify Client ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Missing'}`);
console.log(`- OpenWeather API Key: ${process.env.OPENWEATHER_API_KEY ? 'Set' : 'Missing'}`);

// Initialize routes
initializeRoutes();

// Mount admin routes
app.use('/api/admin', adminRoutes);

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Development logging
if (process.env.NODE_ENV === 'development') {
  import('morgan').then(morgan => {
    app.use(morgan.default('dev'));
  }).catch(err => {
    console.error('Failed to load morgan:', err);
  });
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'
  ]
}));

// Compress all responses
app.use(compression());

// MIME type mapping
const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Configure static file serving with proper MIME types
const staticOptions = {
  setHeaders: (res, path) => {
    // Set proper MIME type based on file extension
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Disable caching for development
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
};

app.get('/favicon.ico', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'favicon.ico'));
});

// Serve static files from public directory
app.use(express.static(publicPath, {
  setHeaders: (res, path) => {
    // Set CSP header for all responses
    const nonce = generateNonce();
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `script-src-elem 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: blob:`,
      `font-src 'self' https: data:`,
      `connect-src 'self'`,
      `media-src 'self' blob:`,
      `object-src 'none'`,
      `frame-src 'self'`,
      `frame-ancestors 'self'`,
      `form-action 'self'`,
      `base-uri 'self'`,
      `upgrade-insecure-requests`
    ].join('; ');
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
  }
}));

// Handle admin route - must be after static file serving
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

// Serve admin files directly
app.use('/admin', express.static(join(publicPath, 'admin'), {
  setHeaders: (res, path) => {
    const nonce = generateNonce();
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `script-src-elem 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: blob:`,
      `font-src 'self' https: data:`,
      `connect-src 'self'`,
      `media-src 'self' blob:`,
      `object-src 'none'`,
      `frame-src 'self'`,
      `frame-ancestors 'self'`,
      `form-action 'self'`,
      `base-uri 'self'`,
      `upgrade-insecure-requests`
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (path.endsWith('.html')) {
      res.locals.nonce = nonce;
    }
  }
}));

// Handle admin index route with nonce injection
app.get('/admin', (req, res) => {
  const nonce = generateNonce();
  const filePath = join(publicPath, 'admin', 'index.html');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading admin template:', err);
      return res.status(500).send('Error loading admin interface');
    }
    
    const processedHtml = data.replace(/<%= nonce %>/g, nonce);
    res.set('Content-Type', 'text/html; charset=UTF-8');
    res.send(processedHtml);
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

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 2) ROUTES
// (Routes are already mounted at the top level)

// 3) ERROR HANDLING MIDDLEWARE
// Handle 404 - Not Found
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('ERROR 💥', err);
  
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { error: err, stack: err.stack })
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
  
  // Initialize Spotify credentials
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    setCredentials(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);
    console.log('Spotify credentials initialized');
  } else {
    console.warn('Missing Spotify credentials. Some features may not work.');
  }
});

// Error handling and process management
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
