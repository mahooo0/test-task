import { Prisma } from '@prisma/client';

/** True when `err` is a unique-constraint violation surfaced by Prisma (Postgres, code P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
