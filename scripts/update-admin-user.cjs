const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Updating admin user and removing curators...\n');

  // Delete curator users using raw query
  const result = await prisma.$executeRaw`DELETE FROM users WHERE role = 'CURATOR'`;

  console.log(`✅ Deleted ${result} curator users\n`);

  // Update admin password
  const newPassword = 'Lane388Furong@';
  const passwordHash = await bcryptjs.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { email: 'saagar@rainamusic.com' },
    data: { passwordHash }
  });

  console.log('✅ Updated admin user password\n');
  console.log('📋 Admin Credentials:');
  console.log('─'.repeat(50));
  console.log(`Email:    ${updatedUser.email}`);
  console.log(`Name:     ${updatedUser.name}`);
  console.log(`Role:     ${updatedUser.role}`);
  console.log(`Password: ${newPassword}`);
  console.log('─'.repeat(50));
  console.log('\n✅ Done!\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
