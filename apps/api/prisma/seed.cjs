const { PrismaClient } = require('@prisma/client');
const { DEFAULT_RECEIVERS, DEFAULT_FLOORPLAN, DEFAULT_FLOORPLAN_ID } = require('@marauder/shared');

async function main() {
  const prisma = new PrismaClient();
  for (const r of DEFAULT_RECEIVERS) {
    await prisma.receiver.upsert({
      where: { id: r.id },
      update: { name: r.name, x: r.x, y: r.y, floor: r.floor },
      create: r,
    });
  }
  await prisma.floorPlan.upsert({
    where: { id: DEFAULT_FLOORPLAN_ID },
    update: {},
    create: { id: DEFAULT_FLOORPLAN_ID, ...DEFAULT_FLOORPLAN },
  });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
