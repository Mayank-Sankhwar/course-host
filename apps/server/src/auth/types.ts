import type { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};

export type AuthUserRecord = AuthenticatedUser & {
  passwordHash: string;
};

export type AuthUserRepository = {
  create(input: { email: string; passwordHash: string; role: Role }): Promise<AuthenticatedUser>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthenticatedUser | null>;
};
