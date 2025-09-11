import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// Import routes
import weatherRoutes from './routes/weather.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin-routes.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:",
        "https://i.scdn.co"
      ],
      connectSrc: [
        "'self'",
        "https://api.spotify.com",
        "https://accounts.spotify.com",
        "https://api.openweathermap.org"
      ],
      frameSrc: [
        "'self'",
        "https://accounts.spotify.com"
      ]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Define allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://moodplaylistgenerator-wrzn.onrender.com',
  'https://mood-playlist-generator-tau.vercel.app',
  'http://localhost:5500' // For live server
];

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, only allow specific origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
};

// Enable CORS with options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Parse cookies
app.use(cookieParser());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Trust first proxy (for production)
app.set('trust proxy', 1);

// CORS for specific routes
app.use('/api', cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mood-playlist-generator.onrender.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/weather', weatherRoutes);
app.use('/api/users', usersRoutes);

// Serve main application
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Verify and refresh Spotify access token
async function verifyAndRefreshToken(token) {
  try {
    // First, try to use the token to get user profile
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      return { valid: true, token };
    }

    // If token is invalid/expired, try to refresh it
    const errorData = await response.json();
    if (response.status === 401 && errorData.error?.message === 'The access token expired') {
      // In a real app, you'd implement token refresh logic here
      // For now, we'll just return invalid
      return { valid: false, error: 'Token expired' };
    }

    return { valid: false, error: errorData.error?.message || 'Invalid token' };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Failed to verify token' };
  }
}

// Authentication middleware
const checkAuth = async (req, res, next) => {
  // Skip auth check for public routes
  const publicRoutes = ['/', '/callback', '/login', '/favicon.ico'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Check for token in query params, headers, or cookies
  const token = req.query.token || 
               req.headers.authorization?.split(' ')[1] ||
               req.cookies?.spotify_access_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }
  
  // Verify the token
  const { valid, error, newToken } = await verifyAndRefreshToken(token);
  
  if (!valid) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Invalid or expired token', details: error });
    }
    return res.redirect('/');
  }
  
  // If we got a new token, set it in the response
  if (newToken) {
    res.cookie('spotify_access_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000 // 1 hour
    });
  }
  
  // Attach token to request
  req.token = newToken || token;
  next();
};

// API Routes
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/admin', adminRoutes);

// Apply auth middleware to protected routes
app.use(checkAuth);

// Serve app page (requires authentication)
app.get('/app', checkAuth, (req, res) => {
  res.sendFile(path.join(publicPath, 'app.html'), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    }
  });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin', 'index.html'));
});

// Serve callback page
app.get('/callback', (req, res) => {
  res.sendFile(path.join(publicPath, 'callback', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Static files served from: ${publicPath}`);
});

export default app;
