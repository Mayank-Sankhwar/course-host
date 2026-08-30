import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../apps/server/src/auth/password.js';

const prisma = new PrismaClient();
const developmentInstructorPassword = 'CourseHostDev123!';

const instructors = [
  'instructor.a@coursehost.local',
  'instructor.b@coursehost.local'
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development instructor seed cannot run in production.');
  }

  const passwordHash = await hashPassword(developmentInstructorPassword);
  await Promise.all(instructors.map((email) => prisma.user.upsert({
    where: { email },
    update: { role: Role.INSTRUCTOR, passwordHash },
    create: { email, role: Role.INSTRUCTOR, passwordHash }
  })));

  console.log('Development instructor accounts are ready.');
}

main()
  .catch((error: unknown) => {
    console.error('Development instructor seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
