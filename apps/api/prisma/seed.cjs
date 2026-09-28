const { PrismaClient } = require('@prisma/client');
const { DEFAULT_RECEIVERS, FLOOR, DEFAULT_FLOORPLAN_ID } = require('@marauder/shared');

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
    create: { id: DEFAULT_FLOORPLAN_ID, imageUrl: '/floorplan.svg', width: FLOOR.width, height: FLOOR.height, floor: 0 },
  });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
