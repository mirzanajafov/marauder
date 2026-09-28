const { PrismaClient } = require('@prisma/client');
const { DEFAULT_RECEIVERS } = require('@marauder/shared');

async function main() {
  const prisma = new PrismaClient();
  for (const r of DEFAULT_RECEIVERS) {
    await prisma.receiver.upsert({
      where: { id: r.id },
      update: { name: r.name, x: r.x, y: r.y, floor: r.floor },
      create: r,
    });
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
