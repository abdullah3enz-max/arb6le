# اربط لي يا حب ❤️ (ERBOTLI) — Architecture

## 1. المبدأ الأساسي

النظام لا يهدف لتوليد تشبيهات. يهدف لإيجاد **علاقة حقيقية قابلة للتحقق** بين معلومة أكاديمية
وعالم يحبه المستخدم، ثم شرحها بطريقة تساعد الذاكرة. إذا لم توجد علاقة حقيقية بمستوى ثقة كافٍ،
النظام يصرّح بذلك بدل الاختراع:

> "ما لقيت ربط قوي وصادق للمعلومة هذه، لذلك ما راح أخترع لك واحد."

هذا القيد مطبّق على مستوى الـ **schema** (حقل `claimType`: `FACT | ANALOGY | INTERPRETATION`)
وعلى مستوى الـ **pipeline** (Connection Critic + Quality Gate + Score Threshold) وليس فقط كتعليمة
prompt يمكن تجاوزها.

## 2. Multi-Agent Pipeline (لا LLM واحد يفعل كل شيء)

كل عنصر في القائمة أدناه هو agent منفصل بمدخل/مخرج محدد (`src/lib/ai/agents/*`)، منسّق عبر
`src/lib/ai/pipeline.ts`. الفصل مهم لأنه يسمح بـ:
- Model routing (نموذج رخيص للاستخراج، نموذج قوي للنقد والتحقق من الحقائق)
- إعادة تنفيذ خطوة واحدة فقط بدون إعادة كل شيء
- Caching لكل خطوة بشكل مستقل (مبني على `contentHash` للوثيقة)

```
1.  Document Parser        → نص + جداول + عناوين خام لكل صفحة
2.  (OCR إذا احتاج)         → مدمج داخل Document Parser، يفعّل تلقائيًا عند نص فارغ
3.  Concept Extractor      → يقسم المحتوى إلى Concepts مع أهمية كل concept
4.  Knowledge Mapper       → علاقات بين Concepts (سبب/نتيجة، تسلسل، مصطلحات متشابهة)
5.  User Preference Retriever → يبني/يحدّث User Memory Profile من DB
6.  Connection Finder      → يبحث عن روابط محتملة من عوالم المستخدم (KB محلي + Live Search)
7.  Fact Checker           → يتحقق من كل حقيقة خارجية (فيلم/لاعب/حدث) قبل قبولها
8.  Connection Critic      → 8 أسئلة رفض/قبول (انظر §5) — قد يرفض ويعيد للخطوة 6
9.  Memory Hook Generator  → يكتب "احفظها كذا" فقط بعد قبول الرابط
10. Quiz Generator         → أسئلة متعددة الأنواع من الـ Concepts
11. Personalization Engine → يحدّث أوزان التفضيلات من التفاعل (❤️👎🔄⭐)
Final Quality Gate         → لا يُعرض شيء للمستخدم قبل عبوره (score ≥ threshold + claimType صريح)
```

كل خطوة، حالتها، ومدتها مرئية للمستخدم في UI المعالجة (`ProcessingSteps`) — لا نعرض خطوات
لا تُنفَّذ فعليًا.

## 3. Fact Grounding

- `SourceType.KNOWLEDGE_BASE`: أعمال/شخصيات/أحداث ثابتة تاريخيًا (مسلسل قديم، فيلم كلاسيكي).
  يُسمح فيها بالاعتماد على قاعدة معرفة مُنسّقة داخليًا.
- `SourceType.LIVE_SEARCH`: أي شيء حديث أو رقمي (نتائج مباريات، إحصائيات، أحداث أخيرة).
  **ممنوع** الاعتماد على ذاكرة الـ LLM لهذه الفئة — يجب استدعاء `SearchProvider` الحقيقي
  (`SEARCH_API_KEY`). في غياب المفتاح، `Connection Finder` يعمل في **DEGRADED MODE**:
  لا يُنتج روابط من فئة `LIVE_SEARCH` إطلاقًا، ويوضّح ذلك بدل التزييف.
- كل `Connection` يحمل `ConnectionSource[]` بحقول `sourceType, confidence, evidenceSnippet`.
  لا تُعرض معلومة بدون هذه الحقول.

## 4. FACT vs ANALOGY vs INTERPRETATION

| النوع | تعريف | مثال |
|---|---|---|
| FACT | حدث/معلومة وقعت بالفعل، قابلة للتحقق مباشرة | "حدث X في المباراة" |
| ANALOGY | استخدام حدث حقيقي كوسيلة تذكّر لمفهوم آخر | "يمكن استخدام هذا الحدث لتذكر مفهوم Y" |
| INTERPRETATION | ربط تفسيري بين نمطين، أقل قابلية للتحقق المباشر | "يساعد هذا على تذكر العلاقة بين A وB" |

النظام يعرض النوع صريحًا للمستخدم (badge على الكرت) ولا يخلط بينها أبدًا في نفس الجملة.

## 5. Connection Critic — 8 أسئلة (`src/lib/ai/agents/connectionCritic.ts`)

1. هل المعلومة الأكاديمية صحيحة؟
2. هل معلومة العالم الخارجي صحيحة؟
3. هل العلاقة بين الاثنين حقيقية (وليست تشابه أسماء فقط)؟
4. هل العلاقة مفيدة للذاكرة (نفس السلوك/التسلسل/الآلية، لا سطحية)؟
5. هل الرابط مباشر بدون قفزات منطقية؟
6. هل يوجد Hallucination؟
7. هل يستطيع المستخدم الاعتراض المنطقي على الربط؟
8. هل يوجد رابط أفضل من نفس العالم أو عالم آخر؟

فشل أي سؤال حاسم (2, 3, 6) → `REJECT` فوري، رجوع لـ Connection Finder برابط مختلف
(`regenerationOf` يمنع تكرار نفس الزاوية).

## 6. Connection Scoring (0–100، عرض فقط عند ≥ threshold، افتراضي 80)

`src/lib/ai/scoring.ts` — مجموع موزون من:
`semanticRelevance, factualAccuracy, relationshipStrength, memorability, preferenceMatch, contextMatch, specificity`.

## 7. LLM Provider Abstraction & Model Routing

`src/lib/ai/providers/` — واجهة `LlmProvider` واحدة، تطبيقات: `anthropic.ts` (حقيقي، يتطلب
`ANTHROPIC_API_KEY`)، `mock.ts` (dev/offline، يُصرّح بوضوح أنه mock في الـ metadata، ولا يُستخدم
كأنه حقيقة). `src/lib/ai/router.ts` يختار:
- **fast model** (`ANTHROPIC_MODEL_FAST`) لـ: Document Parser تنظيف، Concept Extractor، Quiz صياغة.
- **strong model** (`ANTHROPIC_MODEL_STRONG`) لـ: Fact Checker، Connection Critic، Connection Finder.
- **cache** لكل (documentId+pageHash+agent) — لا إعادة تحليل صفحة لم تتغيّر.

## 8. Multi-Tenancy & Security

كل جدول بيانات مستخدم يحمل `userId`؛ كل استعلام في `src/lib/db/*` يمرّر عبر دوال scoped
تفرض `where: { userId }` — لا مسار API يقرأ مستند بدون تطابق `session.userId`. راجع
`src/lib/auth.ts` و`src/middleware.ts`.

## 9. Billing Architecture (provider-agnostic)

`Plan` → `Subscription` → `Usage` → `Entitlements` منفصلة تمامًا عن أي بوابة دفع.
`src/lib/billing/entitlements.ts` يحسب الحدود من `Plan.limitsJson` + `Usage` الحالي، بدون أي
افتراض عن Stripe/Moyasar/غيره. `PAYMENT_PROVIDER=none` يجعل الترقية تُسجَّل يدويًا (admin) —
جاهزة للربط بأي بوابة عبر `src/lib/billing/providers/*`.

## 10. ما هو حقيقي الآن مقابل abstraction جاهز

| المكوّن | الحالة |
|---|---|
| DB schema, API routes, UI, Onboarding, Dashboard, Auth, Scoring, Quality Gate, Critic logic | **مبني ويعمل** |
| Anthropic LLM calls | **حقيقي** إذا توفر `ANTHROPIC_API_KEY`، وإلا Mock provider واضح |
| Live Search لكرة القدم/الأحداث الحديثة | **Interface جاهز** (`SearchProvider`)، يحتاج `SEARCH_API_KEY` فعلي |
| OCR | **Interface جاهز** (`OcrProvider`)، تطبيق tesseract بسيط + hooks لمزودين سحابيين |
| بوابة الدفع | **Interface جاهز فقط** — لا حساب حقيقي مربوط عمدًا |
| Vector search / embeddings | **Interface جاهز** (`EmbeddingProvider` + pgvector schema notes) — غير مفعّل بالكامل في MVP |
