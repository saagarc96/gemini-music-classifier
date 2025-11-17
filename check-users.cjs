const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });
    
    console.log('Users in database:', users.length);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.name}) - ${user.role} - Active: ${user.active}`);
    });
    
    if (users.length === 0) {
      console.log('\nNo users found! You need to create a user first.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
