/**
 * Add Michaela as a curator user
 */

const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('👤 Adding Michaela as curator...\n');

  const email = 'michaela@rainamusic.com';
  const password = 'TeamRaina123@';
  const name = 'Michaela';
  const role = 'CURATOR';

  // Hash the password
  const passwordHash = await bcryptjs.hash(password, 10);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('⚠️  User already exists, updating password...');

      // Update existing user
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          name,
          role,
          active: true
        }
      });

      console.log('✅ Updated existing user\n');
    } else {
      // Create new user using raw SQL to avoid enum issues
      await prisma.$executeRawUnsafe(
        `INSERT INTO "users" (id, email, password_hash, name, role, active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, CURRENT_TIMESTAMP)`,
        email,
        passwordHash,
        name,
        role
      );

      console.log('✅ Created new user\n');
    }

    console.log('📋 User Credentials:');
    console.log('──────────────────────────────────────────────────');
    console.log(`Email:    ${email}`);
    console.log(`Name:     ${name}`);
    console.log(`Role:     ${role}`);
    console.log(`Password: ${password}`);
    console.log('──────────────────────────────────────────────────\n');

    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
