import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { app as fbApp, messaging as fbMessaging } from 'firebase-admin';

export interface FcmMessage {
  /** Notification type (e.g. change_request_approved) — drives deep-open on tap. */
  type: string;
  title: string;
  body: string;
  /** Arbitrary JSON payload from the notification, serialized into the data block. */
  payload: Record<string, unknown>;
}

export interface FcmSendResult {
  successCount: number;
  /** Tokens FCM reported as unregistered — the caller prunes these. */
  invalidTokens: string[];
}

/**
 * Thin firebase-admin wrapper. Credentials come from env; when ANY are missing
 * (dev / CI) the service is permanently disabled and every call is a safe no-op —
 * it never throws on bootstrap or send (Spec §3·M5, FCM-disabled requirement).
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly enabled: boolean;
  private app: fbApp.App | null = null;
  private messaging: fbMessaging.Messaging | null = null;
  private initFailed = false;

  constructor(private readonly config: ConfigService) {
    this.enabled = Boolean(
      this.config.get<string>('FCM_PROJECT_ID') &&
      this.config.get<string>('FCM_CLIENT_EMAIL') &&
      this.config.get<string>('FCM_PRIVATE_KEY'),
    );
    if (!this.enabled) {
      this.logger.log('FCM disabled (credentials absent) — push notifications are a no-op.');
    }
  }

  isEnabled(): boolean {
    return this.enabled && !this.initFailed;
  }

  /**
   * Send a multicast push. Returns which tokens are dead so the caller can prune.
   * Any failure (init, network, bad creds) is swallowed → empty result; never throws.
   */
  async send(tokens: string[], message: FcmMessage): Promise<FcmSendResult> {
    const empty: FcmSendResult = { successCount: 0, invalidTokens: [] };
    if (!this.isEnabled() || tokens.length === 0) {
      return empty;
    }
    try {
      const messaging = this.getMessaging();
      if (!messaging) {
        return empty;
      }
      const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: message.title, body: message.body },
        data: {
          type: message.type,
          payload: JSON.stringify(message.payload ?? {}),
        },
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      });
      const invalidTokens: string[] = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            invalidTokens.push(tokens[i]);
          } else {
            this.logger.debug(`FCM send error for a token: ${code ?? 'unknown'}`);
          }
        }
      });
      return { successCount: res.successCount, invalidTokens };
    } catch (err) {
      this.logger.debug(`FCM send skipped/failed: ${String(err)}`);
      return empty;
    }
  }

  /** Lazily initialize a dedicated firebase-admin app the first time it's needed. */
  private getMessaging(): fbMessaging.Messaging | null {
    if (this.messaging) {
      return this.messaging;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require('firebase-admin') as typeof import('firebase-admin');
      const appName = 'tftsp-fcm';
      const existing = admin.apps.find((a) => a?.name === appName);
      this.app =
        existing ??
        admin.initializeApp(
          {
            credential: admin.credential.cert({
              projectId: this.config.get<string>('FCM_PROJECT_ID'),
              clientEmail: this.config.get<string>('FCM_CLIENT_EMAIL'),
              // Env-encoded private keys carry literal "\n" — restore real newlines.
              privateKey: (this.config.get<string>('FCM_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n'),
            }),
          },
          appName,
        );
      this.messaging = this.app.messaging();
      this.logger.log('FCM initialized.');
      return this.messaging;
    } catch (err) {
      // Disable permanently so we don't retry a broken init on every notification.
      this.initFailed = true;
      this.logger.warn(`FCM initialization failed — disabling push: ${String(err)}`);
      return null;
    }
  }
}
