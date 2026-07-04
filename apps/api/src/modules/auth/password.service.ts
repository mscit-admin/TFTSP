import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';

/** Argon2id hashing + password policy enforcement (Spec §3 / M1). */
@Injectable()
export class PasswordService {
  private readonly minLength: number;

  constructor(config: ConfigService) {
    this.minLength = config.get<number>('auth.minPasswordLength') ?? 12;
  }

  assertPolicy(password: string): void {
    if (!password || password.length < this.minLength) {
      throw AppException.badRequest(ErrorKeys.WEAK_PASSWORD, { minLength: this.minLength });
    }
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
