import { PrismaClient, UserRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create default workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo',
    },
  });
  console.log(`  ✓ Workspace: ${workspace.name} (${workspace.id})`);

  // 2. Create admin user
  const adminEmail = 'admin@telumi.dev';
  const adminPassword = hashPassword('admin123');

  const admin = await prisma.user.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: adminEmail,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: adminEmail,
      passwordHash: adminPassword,
      name: 'Admin',
      role: UserRole.ADMIN,
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (${admin.id})`);
  console.log(`    Password: admin123`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
