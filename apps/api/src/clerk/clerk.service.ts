import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClerkClient,
  verifyToken,
  type ClerkClient,
} from '@clerk/backend';
import type { Env } from '../config/env.validation';

export interface ClerkClaims {
  /** Clerk user id (the JWT `sub`). */
  clerkId: string;
}

export interface ClerkProfile {
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** Thin wrapper over Clerk: verifies session tokens and reads user profiles. */
@Injectable()
export class ClerkService {
  private readonly client: ClerkClient;
  private readonly secretKey: string;

  constructor(config: ConfigService<Env, true>) {
    this.secretKey = config.get('CLERK_SECRET_KEY', { infer: true });
    this.client = createClerkClient({ secretKey: this.secretKey });
  }

  /** Verifies a Clerk session JWT (networkless, via cached JWKS). Throws if invalid/expired. */
  async verifySessionToken(token: string): Promise<ClerkClaims> {
    const payload = await verifyToken(token, { secretKey: this.secretKey });
    return { clerkId: payload.sub };
  }

  /** Fetches the canonical profile from Clerk — used once, when provisioning a new local user. */
  async getUserProfile(clerkId: string): Promise<ClerkProfile> {
    const user = await this.client.users.getUser(clerkId);
    const primary =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
      user.emailAddresses[0];
    const email = primary?.emailAddress ?? '';
    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const name = fullName || user.username || email || 'User';
    return { email, name, avatarUrl: user.imageUrl ?? null };
  }
}
