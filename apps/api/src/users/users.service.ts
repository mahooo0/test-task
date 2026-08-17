import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { ClerkService } from '../clerk/clerk.service';

const DEFAULT_ROOM_NAME = 'My Data Room';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new AppException('auth.userGone');
    }
    return user;
  }

  /**
   * Returns the local user for a Clerk id, creating them and their single
   * Data Room on first sight (JIT provisioning). The Clerk profile is fetched
   * only on creation, so returning users cost one indexed lookup.
   */
  async provisionFromClerk(clerkId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId } });
    if (existing) {
      return existing;
    }

    const profile = await this.clerk.getUserProfile(clerkId);
    try {
      return await this.prisma.user.create({
        data: {
          clerkId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          dataRoom: { create: { name: DEFAULT_ROOM_NAME } },
        },
      });
    } catch (error) {
      // Two concurrent first requests can race; the loser re-reads the winner's row.
      if (isUniqueViolation(error)) {
        const user = await this.prisma.user.findUnique({ where: { clerkId } });
        if (user) return user;
      }
      throw error;
    }
  }
}
