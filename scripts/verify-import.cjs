require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const total = await prisma.song.count();
  const reviewed = await prisma.song.count({ where: { reviewed: true } });
  const withAudio = await prisma.song.count({ where: { sourceFile: { not: null } } });
  const withArtwork = await prisma.song.count({ where: { artwork: { not: null } } });
  
  console.log('Database Verification:');
  console.log(`  Total songs: ${total}`);
  console.log(`  Reviewed (curator): ${reviewed}`);
  console.log(`  With audio link: ${withAudio}`);
  console.log(`  With artwork: ${withArtwork}`);
  
  const sample = await prisma.song.findFirst({ 
    where: { reviewed: true },
    select: {
      artist: true,
      title: true,
      isrc: true,
      sourceFile: true,
      artwork: true,
      aiSubgenre1: true,
      aiSubgenre2: true,
      aiAccessibility: true,
      aiExplicit: true,
      reviewed: true,
      reviewedBy: true
    }
  });
  
  console.log('\nSample reviewed song:');
  console.log(JSON.stringify(sample, null, 2));
  
  await prisma.$disconnect();
}

verify();
