import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { LoginDTO, AuthResponseDTO } from '../dto/AuthDTO';

const logger = new Logger('LoginUseCase');

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(loginData: LoginDTO): Promise<AuthResponseDTO> {
    logger.debug(`Login attempt for email: ${loginData.email}`);

    const user = await this.userRepository.findByEmail(loginData.email);

    if (!user) {
      logger.warn(`Login failed - user not found: ${loginData.email}`);
      throw new Error('Invalid credentials');
    }

    if (!user.password) {
      logger.warn(`Login failed - Google-only account: ${loginData.email}`);
      throw new Error('This account uses Google sign-in. Please continue with Google.');
    }

    const isValidPassword = await bcrypt.compare(loginData.password, user.password);

    if (!isValidPassword) {
      logger.warn(`Login failed - invalid password: ${loginData.email}`);
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      logger.warn(`Login failed - user inactive: ${loginData.email}`);
      throw new Error('User account is inactive');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Publish Kafka event (non-fatal)
    try {
      await this.kafkaProducer.publish('user.logged-in', {
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
      });
    } catch (kafkaError) {
      logger.warn(`Failed to publish user.logged-in event: ${(kafkaError as Error).message}`);
    }

    logger.info(`User logged in: ${user.email}`);

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRY || '24h') as any }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any }
    );
  }
}