require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSong() {
  const song = await prisma.song.findFirst({
    where: { 
      isrc: 'USAT20200542' // Ben E. King - Supernatural Thing
    }
  });
  
  console.log('Song data from database:');
  console.log(JSON.stringify({
    artist: song.artist,
    title: song.title,
    ai_accessibility: song.aiAccessibility,
    ai_accessibility_type: typeof song.aiAccessibility,
    ai_accessibility_length: song.aiAccessibility?.length,
    ai_accessibility_trimmed: song.aiAccessibility?.trim(),
  }, null, 2));
  
  await prisma.$disconnect();
}

checkSong();
