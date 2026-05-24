import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { RedisCache } from '../../../shared/utils/RedisCache';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../shared/utils/logger';
import { PostgresUserRepository } from './infrastructure/adapters/database/PostgresUserRepository';
import { LoginUseCase } from './application/usecases/LoginUseCase';
import { RegisterUseCase } from './application/usecases/RegisterUseCase';
import { GoogleAuthUseCase } from './application/usecases/GoogleAuthUseCase';
import { ChangePasswordUseCase } from './application/usecases/ChangePasswordUseCase';
import { AuthController } from './presentation/controllers/AuthController';
import { createAuthRoutes } from './presentation/routes/auth.routes';
import { errorHandler, notFoundHandler } from './presentation/middleware/errorHandler';

dotenv.config();

const app = express();
const logger = new Logger('AuthService');
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (needed for OAuth state management only — not for auth state)
app.use(session({
  secret: process.env.SESSION_SECRET || 'oauth-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 10 * 60 * 1000 }, // 10 min — only needed for OAuth handshake
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport stubs required by passport even when session: false on callback
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

// Initialize Database
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Redis
const redis = new RedisCache(process.env.REDIS_URL);

// Initialize Kafka
const kafkaProducer = new KafkaProducer('auth-service');

// Initialize Repository
const userRepository = new PostgresUserRepository(db, redis);

// Initialize Use Cases
const loginUseCase = new LoginUseCase(userRepository, kafkaProducer);
const registerUseCase = new RegisterUseCase(userRepository, kafkaProducer);
const googleAuthUseCase = new GoogleAuthUseCase(userRepository, kafkaProducer);
const changePasswordUseCase = new ChangePasswordUseCase(userRepository);

// Google OAuth Strategy
if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const result = await googleAuthUseCase.execute({
          googleId: profile.id,
          email: profile.emails?.[0]?.value || '',
          firstName: profile.name?.givenName || profile.displayName || '',
          lastName: profile.name?.familyName || '',
          profilePicture: profile.photos?.[0]?.value,
        });
        done(null, result);
      } catch (error) {
        done(error as Error);
      }
    }
  ));
  logger.info('Google OAuth strategy registered');
} else {
  logger.warn('Google OAuth not configured — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
}

// Initialize Controller
const authController = new AuthController(loginUseCase, registerUseCase, changePasswordUseCase);

// Routes
app.use('/', createAuthRoutes(authController));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'Auth Service is running', timestamp: new Date() });
});

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
async function startServer() {
  try {
    await db.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    await redis.get('ping');
    logger.info('Connected to Redis');

    await kafkaProducer.connect();
    logger.info('Connected to Kafka');

    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;
