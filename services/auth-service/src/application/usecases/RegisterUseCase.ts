import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { RegisterDTO, AuthResponseDTO } from '../dto/AuthDTO';

const logger = new Logger('RegisterUseCase');

export class RegisterUseCase {
  constructor(
    private userRepository: IUserRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(registerData: RegisterDTO): Promise<AuthResponseDTO> {
    logger.debug(`Registration attempt for email: ${registerData.email}`);

    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(registerData.email);

    if (existingUser) {
      logger.warn(`Registration failed - email already exists: ${registerData.email}`);
      throw new Error('Email already registered');
    }

    // Create user
    const user = await this.userRepository.create({
      email: registerData.email,
      password: registerData.password,
      firstName: registerData.firstName,
      lastName: registerData.lastName,
      isActive: true,
    });

    // Publish Kafka event (non-fatal — registration succeeds even if event fails)
    try {
      await this.kafkaProducer.publish('user.registered', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timestamp: new Date(),
      });
    } catch (kafkaError) {
      logger.warn(`Failed to publish user.registered event: ${(kafkaError as Error).message}`);
    }

    logger.info(`User registered: ${user.email}`);

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