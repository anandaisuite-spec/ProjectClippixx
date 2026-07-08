const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter, adminLimiter } = require('./middleware/rateLimiter');
const { startOtpCleanupJob } = require('./jobs/otpCleanup');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Reverse proxy / Docker awareness ───────────────────
// In production the app runs behind CasaOS / a reverse proxy, so the real client
// IP and protocol arrive in X-Forwarded-For / X-Forwarded-Proto. Trust the first
// proxy hop so req.ip, the rate limiter, and the Turnstile remoteip use the real
// client IP (not the proxy's), and req.protocol reflects https.
app.set('trust proxy', 1);

// ─── Security Middleware ────────────────────────────────
// CSP: base policy is self-only; each extra origin below exists because a
// live feature needs it (removing one WILL break that feature in production):
//   - challenges.cloudflare.com → Turnstile widget (script + iframe + verify)
//   - *.googleapis.com          → Firebase Auth REST (identitytoolkit/securetoken)
//   - *.firebaseapp.com         → Firebase auth helper iframe (signInWithPopup)
//   - fonts.googleapis.com/gstatic.com → Google Fonts (index.css @import)
//   - img/media https:          → R2 media, OAuth avatar URLs
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            mediaSrc: ["'self'", 'https:'],
            connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseapp.com', 'https://challenges.cloudflare.com'],
            frameSrc: ['https://challenges.cloudflare.com', 'https://*.firebaseapp.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"],
        },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: {
        maxAge: 15552000,        // 180 days
        includeSubDomains: true,
        preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
}));

// Hide framework fingerprint.
app.disable('x-powered-by');

// ─── CORS ───────────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

app.use(cors({
    // Strict allowlist: reject unknown origins instead of reflecting them.
    // Requests with no Origin header (curl, server-to-server, same-origin) pass.
    origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-mfa-token'],
    maxAge: 86400,
}));

// ─── Body Parser ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── General Rate Limiter ───────────────────────────────
app.use('/api/', generalLimiter);

// ─── Request Logger ─────────────────────────────────────
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ─── Routes ─────────────────────────────────────────────
const starsRoutes = require('./routes/stars');
const suggestionsRoutes = require('./routes/suggestions');
const applicationsRoutes = require('./routes/applications');
const feedbackRoutes = require('./routes/feedback');
const profilesRoutes = require('./routes/profiles');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
const ordersRoutes = require('./routes/orders');
const reviewsRoutes = require('./routes/reviews');
const verificationRoutes = require('./routes/verification');
const mfaRoutes = require('./routes/mfa');
const authRoutes = require('./routes/auth');
const creatorOnboardingRoutes = require('./routes/creatorOnboarding');
const creatorDashboardRoutes = require('./routes/creatorDashboard');
const bookingReviewsRoutes = require('./routes/bookingReviews');
const bookingsRoutes = require('./routes/bookings');
const fanDashboardRoutes = require('./routes/fanDashboard');
const exploreRoutes = require('./routes/explore');

app.use('/api/stars', starsRoutes);
// publicFormLimiter is applied per-route on the public POST handlers inside
// these routers, so it doesn't throttle admin GET/review endpoints sharing the prefix.
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/creator/dashboard', creatorDashboardRoutes);
app.use('/api/creator', creatorOnboardingRoutes);
app.use('/api/booking-reviews', bookingReviewsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/fan/dashboard', fanDashboardRoutes);
app.use('/api/explore', exploreRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/api/health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW() as server_time');
        res.json({
            status: 'ok',
            server: 'running',
            database: 'connected',
            server_time: dbResult.rows[0].server_time,
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            server: 'running',
            database: 'disconnected',
            error: error.message,
        });
    }
});

// ─── Serve Frontend in Production ───────────────────────
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));

    // Handle SPA Routing - Redirect non-API requests to index.html
    app.get('{*path}', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ─── API 404 Handler ────────────────────────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ─── General 404 Handler ─────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist`,
    });
});

// ─── Centralized Error Handler ──────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────
let server;
if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        startOtpCleanupJob();
        console.log(`\n🚀 Clipixx Backend Server`);
        console.log(`   ├── Running on: http://localhost:${PORT}`);
        console.log(`   ├── Health:     http://localhost:${PORT}/api/health`);
        console.log(`   ├── Stars API:  http://localhost:${PORT}/api/stars`);
        console.log(`   ├── Admin API:  http://localhost:${PORT}/api/admin`);
        console.log(`   ├── Users API:  http://localhost:${PORT}/api/users`);
        console.log(`   ├── Orders API: http://localhost:${PORT}/api/orders`);
        console.log(`   ├── Reviews API: http://localhost:${PORT}/api/reviews`);
        console.log(`   ├── Verify API: http://localhost:${PORT}/api/verification`);
        console.log(`   ├── CORS:       ${corsOrigins.join(', ')}`);
        console.log(`   └── Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
}

module.exports = app;

// ─── Graceful Shutdown ──────────────────────────────────
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('Database pool closed.');
        } catch (err) {
            console.error('Error closing pool:', err.message);
        }
        process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
