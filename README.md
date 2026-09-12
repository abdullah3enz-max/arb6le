# اربط لي يا حب ❤️ (ERBOTLI)

منصة تربط المعلومات الأكاديمية بعوالم يحبها الطالب (كرة القدم، مسلسلات، أفلام، أنمي، ...) —
لكن فقط عندما تكون العلاقة حقيقية ومنطقية، وليست تشبيهًا عشوائيًا. راجع
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) لفهم الـ pipeline كامل قبل التعديل.

## التشغيل محليًا

```bash
docker compose up -d          # يشغّل Postgres محليًا
cp .env.example .env.local    # عبّي DATABASE_URL / AUTH_SECRET على الأقل
npm install
npm run db:generate
npm run db:migrate            # ينشئ الجداول
npm run db:seed               # يزرع خطط FREE/PLUS/PRO
npm run dev                   # http://localhost:3000
```

بدون `ANTHROPIC_API_KEY`، النظام يعمل بـ Mock provider الذي **لا يخترع روابط أبدًا** — سترى
حالة "ما لقينا ربط قوي وصادق" لكل مفهوم، وهذا متعمد (راجع `src/lib/ai/providers/mock.ts`).
لتفعيل الربط الحقيقي، عبّي `ANTHROPIC_API_KEY` في `.env.local`. لتفعيل Live Search (كرة
القدم/الأحداث الحديثة)، عبّي `SEARCH_API_KEY`.

## الاختبارات

```bash
npm test         # unit tests: scoring, quality gate, file validation, parsing
npm run typecheck
npm run build
```

## الحالة الحقيقية مقابل الجاهزة للربط

راجع القسم الأخير من [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — الفرونت والباك والـ DB
والمصادقة ومحرك التقييم (Scoring/Critic/Quality Gate) شغّالة فعليًا. بوابة الدفع وLive Search
وOCR السحابي هي interfaces جاهزة تحتاج فقط مفتاح API حقيقي لتُفعَّل، وليست معطلة بشكل تعسفي.
