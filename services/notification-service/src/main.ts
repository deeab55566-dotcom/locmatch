import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { KafkaConsumer } from '../../../shared/adapters/kafka/KafkaConsumer';
import { Logger } from '../../../shared/utils/logger';
import { RedisNotificationRepository } from './infrastructure/adapters/database/RedisNotificationRepository';
import { SocketIOAdapter } from './infrastructure/adapters/websocket/SocketIOAdapter';
import { GetNotificationsUseCase } from './application/usecases/GetNotificationsUseCase';
import { MarkAsReadUseCase } from './application/usecases/MarkAsReadUseCase';
import { SendNotificationUseCase } from './application/usecases/SendNotificationUseCase';
import { UserEventHandler } from './application/handlers/UserEventHandler';
import { ProfileEventHandler } from './application/handlers/ProfileEventHandler';
import { LocationEventHandler } from './application/handlers/LocationEventHandler';
import { NotificationController } from './presentation/controllers/NotificationController';
import { createNotificationRoutes } from './presentation/routes/notification.routes';
import { errorHandler, notFoundHandler, authMiddleware } from './presentation/middleware/errorHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);
const logger = new Logger('NotificationService');
const PORT = process.env.PORT || 3004;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Repository
const notificationRepository = new RedisNotificationRepository(process.env.REDIS_URL);

// Initialize WebSocket Adapter
const socketIOAdapter = new SocketIOAdapter(server, notificationRepository);

// Initialize Use Cases
const getNotificationsUseCase = new GetNotificationsUseCase(notificationRepository);
const markAsReadUseCase = new MarkAsReadUseCase(notificationRepository);
const sendNotificationUseCase = new SendNotificationUseCase(notificationRepository);

// Initialize Event Handlers
const userEventHandler = new UserEventHandler(sendNotificationUseCase);
const profileEventHandler = new ProfileEventHandler(sendNotificationUseCase);
const locationEventHandler = new LocationEventHandler(sendNotificationUseCase);

// Initialize Controller
const notificationController = new NotificationController(
  getNotificationsUseCase,
  markAsReadUseCase,
  sendNotificationUseCase
);

app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'];
  next();
});

// Routes
app.use('/', createNotificationRoutes(notificationController));

// Conversations list endpoint
app.get('/conversations', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
  try {
    const conversations = await socketIOAdapter.getConversations(userId, limit);
    res.json({ conversations });
  } catch {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Chat history endpoint
app.get('/chat/:toUserId', async (req, res) => {
  const fromUserId = (req as any).userId;
  const { toUserId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  if (!fromUserId) return res.status(401).json({ error: 'Unauthorized' });
  const messages = await socketIOAdapter.getChatHistory(fromUserId, toUserId, limit);
  res.json({ messages });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'Notification Service is running',
    connectedUsers: socketIOAdapter.getConnectedUsersCount(),
    timestamp: new Date(),
  });
});

// Initialize Kafka Consumer
const kafkaConsumer = new KafkaConsumer('notification-service', 'notification-service-group');

// Event Handlers
async function setupEventHandlers() {
  try {
    // User Service Events
    await kafkaConsumer.subscribe('user.registered', async (message) => {
      logger.info(`Received user.registered event`);
      await userEventHandler.handleUserRegistered(message);
      
      // Send real-time notification via WebSocket
      await socketIOAdapter.sendToUser(message.userId, 'notification:received', {
        title: 'Welcome!',
        message: 'Welcome to our platform!',
      });
    });

    await kafkaConsumer.subscribe('user.logged-in', async (message) => {
      logger.info(`Received user.logged-in event`);
      await userEventHandler.handleUserLoggedIn(message);
    });

    // Profile Service Events
    await kafkaConsumer.subscribe('user.followed', async (message) => {
      logger.info(`Received user.followed event`);
      await profileEventHandler.handleUserFollowed(message);

      const followerName = message.followerFirstName
        ? `${message.followerFirstName}${message.followerLastName ? ' ' + message.followerLastName : ''}`
        : 'Someone';

      await socketIOAdapter.sendToUser(message.userId, 'notification:received', {
        title: 'New Friend Request!',
        message: `${followerName} added you as a friend.`,
        type: 'user_followed',
        data: {
          fromUserId: message.followerId,
          fromName: followerName,
        },
      });
    });

    await kafkaConsumer.subscribe('user.unfollowed', async (message) => {
      logger.info(`Received user.unfollowed event`);
      await profileEventHandler.handleUserUnfollowed(message);
    });

    await kafkaConsumer.subscribe('user.profile.updated', async (message) => {
      logger.info(`Received user.profile.updated event`);
      await profileEventHandler.handleProfileUpdated(message);
    });

    // Location Service Events
    await kafkaConsumer.subscribe('location.updated', async (message) => {
      logger.info(`Received location.updated event`);
      await locationEventHandler.handleLocationUpdated(message);
    });

    await kafkaConsumer.subscribe('user.nearby.found', async (message) => {
      logger.info(`Received user.nearby.found event`);
      await locationEventHandler.handleNearbyUserFound(message);
      
      if (message.nearbyUsers && message.nearbyUsers.length > 0) {
        await socketIOAdapter.sendToUser(message.userId, 'location:nearby-users', {
          nearbyUsers: message.nearbyUsers,
          distance: message.radius,
        });
      }
    });

    await kafkaConsumer.run();
    logger.info('Kafka event handlers set up successfully');
  } catch (error) {
    logger.error(`Error setting up event handlers: ${(error as Error).message}`);
  }
}

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
async function startServer() {
  try {
    // Connect to Kafka
    await kafkaConsumer.connect();
    logger.info('Connected to Kafka Consumer');

    // Setup event handlers
    await setupEventHandlers();

    server.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
      logger.info(`WebSocket server enabled`);
    });
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;