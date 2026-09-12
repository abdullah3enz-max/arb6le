import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/**
 * Seeds the three real subscription plans (item 25). Prices/limits are editable later from
 * the Admin Dashboard (Plan.priceMonthlyCents / Plan.limitsJson) — this seed just establishes
 * sane defaults, not marketing copy.
 */
async function main() {
  await db.plan.upsert({
    where: { code: 'FREE' },
    create: {
      code: 'FREE',
      nameAr: 'مجاني',
      nameEn: 'Free',
      priceMonthlyCents: 0,
      limitsJson: {
        maxDocuments: 3,
        maxPagesPerDoc: 20,
        maxConnectionsPerMonth: 15,
        maxQuizzesPerMonth: 3,
        studyMode: false,
        spacedRepetition: false,
        prioritySupport: false
      }
    },
    update: {}
  });

  await db.plan.upsert({
    where: { code: 'PLUS' },
    create: {
      code: 'PLUS',
      nameAr: 'بلَس',
      nameEn: 'Plus',
      priceMonthlyCents: 2900,
      limitsJson: {
        maxDocuments: 20,
        maxPagesPerDoc: 80,
        maxConnectionsPerMonth: 150,
        maxQuizzesPerMonth: 30,
        studyMode: true,
        spacedRepetition: true,
        prioritySupport: false
      }
    },
    update: {}
  });

  await db.plan.upsert({
    where: { code: 'PRO' },
    create: {
      code: 'PRO',
      nameAr: 'برو',
      nameEn: 'Pro',
      priceMonthlyCents: 7900,
      limitsJson: {
        maxDocuments: -1,
        maxPagesPerDoc: 400,
        maxConnectionsPerMonth: -1,
        maxQuizzesPerMonth: -1,
        studyMode: true,
        spacedRepetition: true,
        prioritySupport: true
      }
    },
    update: {}
  });

  console.log('Seeded plans: FREE, PLUS, PRO');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
