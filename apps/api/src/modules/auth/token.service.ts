import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from '@prisma/client';
import { parseDurationMs } from '../../common/util/duration';
import { AuthRepository } from './auth.repository';
import { AccessTokenPayload } from './jwt.strategy';

export interface RawTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface IssuedRefreshToken {
  raw: string;
  record: RefreshToken;
}

/**
 * Access-token signing + refresh-token rotation with reuse detection (Spec §4).
 * Refresh tokens are high-entropy opaque strings; only their SHA-256 hash is
 * stored, so a DB leak does not expose usable tokens. Rotation links tokens by
 * `familyId`; presenting an already-rotated token revokes the whole family.
 */
@Injectable()
export class TokenService {
  private readonly accessTtl: string;
  private readonly refreshTtlMs: number;
  private readonly accessSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly repo: AuthRepository,
  ) {
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtlMs = parseDurationMs(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d');
    this.accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
  }

  static hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Issue a fresh refresh token, optionally continuing an existing family. */
  async issueRefreshToken(
    userId: string,
    tenantId: string | undefined,
    familyId?: string,
  ): Promise<IssuedRefreshToken> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = TokenService.hashToken(raw);
    const record = await this.repo.createRefreshToken({
      userId,
      familyId: familyId ?? uuidv4(),
      tokenHash,
      tenantId: tenantId ?? null,
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    });
    return { raw, record };
  }
}
