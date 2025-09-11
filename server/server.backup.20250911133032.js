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
import { dirname, join, extname } from 'path';
import { nonceMiddleware } from './middleware/nonce.js';
import { setCredentials } from './spotify-api.js';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Generate a nonce for CSP
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// Add nonce to all responses and setup nonce middleware
app.use((req, res, next) => {
  res.locals.nonce = generateNonce();
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

// Initialize routes
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/weather', weatherRouter);

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

// Configure static file serving with proper MIME types
const staticOptions = {
  setHeaders: (res, path) => {
    // Set proper MIME types
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.woff')) {
      res.setHeader('Content-Type', 'font/woff');
    } else if (path.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    } else if (path.endsWith('.ttf')) {
      res.setHeader('Content-Type', 'font/ttf');
    } else if (path.endsWith('.eot')) {
      res.setHeader('Content-Type', 'application/vnd.ms-fontobject');
    }
    
    // Disable caching for development
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
};

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
