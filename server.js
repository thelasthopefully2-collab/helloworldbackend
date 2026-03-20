const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const {
    rateLimiter,
    sanitizeInput,
    requestLogger,
    securityHeaders
} = require('./middleware/security');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet()); // Adds various HTTP security headers
app.use(securityHeaders);
app.use(requestLogger);
app.use(rateLimiter);

// CORS Configuration - Allow all origins in development
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
    origin: isDev ? true : (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5500']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-admin-key']
}));

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(sanitizeInput);

// MongoDB Connection
const changeStreamWatcher = require('./services/changeStreamWatcher');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Start Change Stream watcher for real-time Telegram notifications
    await changeStreamWatcher.start();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  await changeStreamWatcher.stop();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await changeStreamWatcher.stop();
  await mongoose.disconnect();
  process.exit(0);
});

// Import Routes
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

// API Routes with /api/v1 prefix for versioning
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);

// Legacy routes (for backwards compatibility) - can be removed later
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// Health check endpoint (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Note: static HTML files are served directly by the hosting environment

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: 'The requested resource does not exist'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message;
    
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {  // 👈 add '0.0.0.0'
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔒 Security middleware enabled`);
});
