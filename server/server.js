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
import { setCredentials } from './spotify-api.js';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();

// Import routes
import weatherRouter from './routes/weather.js';
import usersRouter from './routes/users.js';

// Initialize routes
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/weather', weatherRouter);

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

// Serving static files from the public directory
const publicPath = join(__dirname, '../public');
app.use(express.static(publicPath));

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
