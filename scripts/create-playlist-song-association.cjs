const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const playlistId = 'cmic7w29k0000unq0a3mq0xh1';
  const songIsrc = 'USUG12101839';
  
  // First check if this association already exists
  const existing = await prisma.playlistSong.findUnique({
    where: {
      playlistId_songIsrc: {
        playlistId: playlistId,
        songIsrc: songIsrc
      }
    }
  });
  
  if (existing) {
    console.log('✓ PlaylistSong association already exists');
    return;
  }
  
  // Create the association
  const result = await prisma.playlistSong.create({
    data: {
      playlistId: playlistId,
      songIsrc: songIsrc,
      wasNew: false
    }
  });
  
  console.log('✓ Created PlaylistSong association:');
  console.log(`  Playlist ID: ${result.playlistId}`);
  console.log(`  Song ISRC: ${result.songIsrc}`);
  console.log(`  Was New: ${result.wasNew}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error:', e);
    prisma.$disconnect();
    process.exit(1);
  });
