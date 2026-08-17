import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ClerkService } from '../../clerk/clerk.service';
import { UsersService } from '../../users/users.service';
import type { AuthUser } from '../types/auth-user';

/**
 * Verifies the Clerk session token from the `Authorization: Bearer` header,
 * provisions the local user on first sight, and attaches them to `req.user`.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly clerk: ClerkService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new AppException('auth.missingToken');
    }

    let clerkId: string;
    try {
      ({ clerkId } = await this.clerk.verifySessionToken(token));
    } catch {
      throw new AppException('auth.invalidSession');
    }

    const user = await this.users.provisionFromClerk(clerkId);
    request.user = { id: user.id, email: user.email, clerkId };
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length).trim() || null;
  }
}
