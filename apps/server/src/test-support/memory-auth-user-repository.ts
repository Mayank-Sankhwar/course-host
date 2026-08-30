import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import type { AuthUserRecord, AuthUserRepository, AuthenticatedUser } from '../auth/types.js';

export class MemoryAuthUserRepository implements AuthUserRepository {
  private readonly users = new Map<string, AuthUserRecord>();

  async create(input: { email: string; passwordHash: string; role: Role }): Promise<AuthenticatedUser> {
    if (await this.findByEmail(input.email)) {
      throw Object.assign(new Error('Duplicate email'), { code: 'P2002' });
    }
    const user = { id: randomUUID(), ...input };
    this.users.set(user.id, user);
    return this.safeUser(user);
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const user = this.users.get(id);
    return user ? this.safeUser(user) : null;
  }

  private safeUser(user: AuthUserRecord): AuthenticatedUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
