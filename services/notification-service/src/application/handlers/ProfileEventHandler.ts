import { SendNotificationUseCase } from '../usecases/SendNotificationUseCase';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('ProfileEventHandler');

export class ProfileEventHandler {
  constructor(private sendNotificationUseCase: SendNotificationUseCase) {}

  async handleUserFollowed(event: any): Promise<void> {
    try {
      logger.info(`Processing user.followed event: ${event.followerId} followed ${event.userId}`);

      // Notify user they were followed
      await this.sendNotificationUseCase.execute({
        userId: event.userId,
        title: 'New Follower!',
        message: `A user started following you!`,
        type: 'user_followed',
        data: {
          followerId: event.followerId,
          timestamp: event.timestamp,
        },
      });
    } catch (error) {
      logger.error(`Error handling user followed: ${(error as Error).message}`);
    }
  }

  async handleUserUnfollowed(event: any): Promise<void> {
    try {
      logger.info(`Processing user.unfollowed event: ${event.followerId} unfollowed ${event.userId}`);

      // Could log this but don't send notification for unfollows
      logger.debug(`User ${event.followerId} unfollowed user ${event.userId}`);
    } catch (error) {
      logger.error(`Error handling user unfollowed: ${(error as Error).message}`);
    }
  }

  async handleProfileUpdated(event: any): Promise<void> {
    try {
      logger.debug(`Processing user.profile.updated event for user: ${event.userId}`);

      // Could send notifications to followers about profile updates
    } catch (error) {
      logger.error(`Error handling profile updated: ${(error as Error).message}`);
    }
  }
}