const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding curator accounts...\n');

  // Curator accounts to create
  const curators = [
    {
      email: 'kristine@rainamusic.com',
      name: 'Kristine Barilli',
      role: 'CURATOR',
    },
    {
      email: 'djdyllemma@gmail.com',
      name: 'Dylan Cole',
      role: 'CURATOR',
    },
    {
      email: 'nickmarc68@gmail.com',
      name: 'Nick Marc',
      role: 'CURATOR',
    },
    {
      email: 'vikas@rainamusic.com',
      name: 'Vikas Sapra',
      role: 'CURATOR',
    },
  ];

  // Shared password for all curators
  const password = 'TeamRaina123@';
  const passwordHash = await bcryptjs.hash(password, 10);

  const createdUsers = [];

  for (const curator of curators) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: curator.email }
      });

      if (existingUser) {
        console.log(`⚠️  User already exists: ${curator.email}`);
        createdUsers.push({
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          status: 'already exists',
        });
        continue;
      }

      // Insert new user (cast role to enum type)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "users" (id, email, password_hash, name, role, active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"Role", true, CURRENT_TIMESTAMP)`,
        curator.email,
        passwordHash,
        curator.name,
        curator.role
      );

      // Fetch the created user
      const user = await prisma.user.findUnique({
        where: { email: curator.email }
      });

      if (user) {
        createdUsers.push({
          email: user.email,
          name: user.name,
          role: user.role,
          status: 'created',
        });
        console.log(`✅ Created: ${user.name} (${user.email})`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${curator.email}:`, error.message);
    }
  }

  console.log('\n📋 SUMMARY\n');
  console.log('─'.repeat(60));

  createdUsers.forEach((user) => {
    const statusIcon = user.status === 'created' ? '✅' : '⚠️';
    console.log(`${statusIcon} ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role:  ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log('');
  });

  console.log('─'.repeat(60));
  console.log(`\n🔐 Password for all new accounts: ${password}`);
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
