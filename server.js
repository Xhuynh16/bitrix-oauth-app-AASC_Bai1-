require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.bitrix24.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "*.bitrix24.com"],
      connectSrc: ["'self'", "*.bitrix24.com"],
      frameSrc: ["'self'", "*.bitrix24.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const logFormat = process.env.NODE_ENV === 'production'
  ? 'combined'
  : 'dev';

if (process.env.NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
  
  const accessLogStream = require('fs').createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan(logFormat, { stream: accessLogStream }));
} else {
  app.use(morgan(logFormat));
}

app.use((req, res, next) => {
  const allowedOrigins = [
    /^https:\/\/[^/]+\.bitrix24\.com$/,
    /^https:\/\/[^/]+\.bitrix24\.[a-z]+$/
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.some(pattern => pattern.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bitrix-Domain');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bitrix24 OAuth App API',
    endpoints: {
      auth: '/auth',
      api: '/api'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'The requested resource was not found'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
