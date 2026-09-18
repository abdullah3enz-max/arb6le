import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_DEFAULTS } from '../src/lib/rbac/permissions';

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

  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, category: p.category, descriptionAr: p.descriptionAr },
      update: { category: p.category, descriptionAr: p.descriptionAr }
    });
  }

  for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
    for (const key of keys ?? []) {
      const permission = await db.permission.findUniqueOrThrow({ where: { key } });
      await db.rolePermission.upsert({
        where: { role_permissionId: { role: role as never, permissionId: permission.id } },
        create: { role: role as never, permissionId: permission.id },
        update: {}
      });
    }
  }

  console.log('Seeded permission catalog + role defaults.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
