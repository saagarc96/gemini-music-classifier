const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

// Generate a random password for seeding
function generatePassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function main() {
  console.log('🌱 Seeding users...\n');

  // Define users to seed
  const usersToCreate = [
    {
      email: 'saagar@rainamusic.com',
      name: 'Saagar',
      role: 'ADMIN',
    },
    {
      email: 'curator1@rainamusic.com',
      name: 'Curator One',
      role: 'CURATOR',
    },
    {
      email: 'curator2@rainamusic.com',
      name: 'Curator Two',
      role: 'CURATOR',
    },
    {
      email: 'curator3@rainamusic.com',
      name: 'Curator Three',
      role: 'CURATOR',
    },
    {
      email: 'curator4@rainamusic.com',
      name: 'Curator Four',
      role: 'CURATOR',
    },
  ];

  // Map roles
  const roleMap = {
    'ADMIN': 'ADMIN',
    'CURATOR': 'CURATOR'
  };

  const createdUsers = [];

  for (const userData of usersToCreate) {
    const password = generatePassword();
    const passwordHash = await bcryptjs.hash(password, 10);

    try {
      // Use raw query to avoid role enum issues
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      let user;
      if (existingUser) {
        user = existingUser;
      } else {
        // Use raw query to insert
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO "users" (id, email, password_hash, name, role, active, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, CURRENT_TIMESTAMP)
           RETURNING id, email, name, role`,
          userData.email,
          passwordHash,
          userData.name,
          userData.role
        );

        // Re-fetch the user with Prisma to get proper types
        user = await prisma.user.findUnique({
          where: { email: userData.email }
        });
      }

      if (user) {
        createdUsers.push({
          email: user.email,
          name: user.name,
          role: user.role,
          tempPassword: password,
          id: user.id,
        });

        console.log(`✅ ${user.role === 'ADMIN' ? '👑' : '👤'} Created: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${userData.email}:`, error.message);
    }
  }

  console.log('\n📋 TEMPORARY PASSWORDS (save these securely and share with users)\n');
  console.log('─'.repeat(80));
  createdUsers.forEach((user) => {
    console.log(`\nEmail:    ${user.email}`);
    console.log(`Name:     ${user.name}`);
    console.log(`Role:     ${user.role}`);
    console.log(`Password: ${user.tempPassword}`);
    console.log(`ID:       ${user.id}`);
  });
  console.log('\n' + '─'.repeat(80));
  console.log('\n⚠️  IMPORTANT: Users should change their password after first login');
  console.log('✅ Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
