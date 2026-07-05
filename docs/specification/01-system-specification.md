<div dir="rtl">

# المواصفات الموحّدة لنظام TFTSP

> وثيقة مرجعية تصف النظام كما بُني فعليًا عبر المراحل M1–M5. المصادر: `apps/api/prisma/schema.prisma`، عقود `docs/API_CONTRACT.M1..M5.md`، `apps/api/src/common/rbac/permissions.ts`، ومتحكّمات `apps/api/src/modules/**`، و`DECISIONS.md`.

## 1. نظرة عامة

TFTSP منصة **SaaS متعددة المستأجرين (Multi-Tenant)** لإدارة أشجار العائلات والقبائل العربية. بنية واحدة تخدم آلاف القبائل مع **عزل صارم للبيانات على مستوى قاعدة البيانات**، ودعم كامل للعربية (RTL) والإنجليزية (LTR) بتبديل فوري. الإدارة تجري على لوحتَي الويب في v1، بينما يخدم تطبيق الموبايل الأعضاء والمساهمين والزوّار.

**المبدأ الحاكم:** كل ما هو غير منصوص عليه يُحسم لصالح البساطة القابلة للتوسّع، لا التعقيد الاستباقي.

**واجهة برمجية واحدة** بإصدار `/api/v1` تخدم كل العملاء (اللوحتان + الموبايل) — لا BFF منفصل — لأن **Visibility Resolver** يعمل في الخادم فيضمن أمنًا متطابقًا لكل العملاء. المصادقة `Authorization: Bearer <access>`. كل أخطاء الـ API بمفاتيح i18n بالصيغة:
`{ "statusCode": number, "messageKey": "errors.xxx", "details"?: object }`.

## 2. المكوّنات الأربعة

| # | المكوّن | الحزمة | التقنية | المسؤولية |
|---|---|---|---|---|
| ① | Backend API | `apps/api` | NestJS 10، TypeScript strict، Prisma، PostgreSQL 16 + RLS، Redis 7، BullMQ، Socket.IO، MinIO، Swagger | مصدر الحقيقة والأمن؛ يستضيف كل منطق النطاق والتفويض والرؤية ويخدم كل العملاء |
| ② | Tribe Admin Panel | `apps/admin-web` | Angular (Standalone + Signals)، PrimeNG، Tailwind، ngx-translate، d3.js v7 | إدارة القبيلة: الأشخاص، الوحدات القبلية، الموافقات، الاستيراد، سياسات الرؤية، الوثائق، التصدير، الإحصاءات، السمعة |
| ③ | SaaS Platform Panel | `apps/platform-web` | Angular (نفس مكدّس ②) | إدارة المنصة للـ Super/Platform Admin على نطاق منفصل: إنشاء القبائل وتعليقها، الاشتراكات، لوحة إحصاءات المنصة |
| ④ | Members App | `apps/mobile` | Flutter (Stable)، Riverpod، dio + retrofit، flutter_secure_storage، easy_localization، firebase_messaging | تطبيق الأعضاء (Android API 26+ / iOS 15+): الشجرة بـ CustomPainter، بطاقة الشخص، الطلبات والمساهمات، التنبيهات (FCM)، الوضع غير المتصل للقراءة |

المكوّنان ② و③ **تطبيقان منفصلان** (لا مشروع واحد بمنفذين) لأنهما جمهوران وأمنان مختلفان وينشران على نطاقين — قرار `D-003`. البنية التحتية للتطوير تُشغَّل بأمر `docker compose up` واحد (PostgreSQL، Redis، MinIO، MailHog، الخادم، اللوحتان).

## 3. القرارات المعمارية المحسومة

هذه القرارات نهائية (القسم 2 من البرومبت الأصلي) ومنفَّذة في الكود:

| القرار | الاختيار المنفَّذ | الأثر في الكود |
|---|---|---|
| **نموذج العزل (Tenancy)** | Shared Schema + **PostgreSQL Row-Level Security (RLS)** مع عمود `tenant_id UUID NOT NULL` وفهرس مركّب يبدأ به `(tenant_id, …)` على كل جدول tenant-scoped | سياسات RLS في migration SQL مخصص؛ فهارس `@@index([tenantId, …])` في المخطط |
| **دور قاعدة البيانات** | التطبيق يتصل بدور `tftsp_app` **بلا `BYPASSRLS`**؛ الترحيلات تُشغَّل بدور المالك `tftsp` | `D-005` — العزل لا يعتمد على انضباط كود التطبيق |
| **حقن المستأجر** | Interceptor يستخرج `tenant_id` من الـ JWT، وإضافة Prisma Client Extension تُنفّذ `SET LOCAL app.current_tenant` في بداية كل معاملة | `common/tenant/tenant-context.interceptor.ts`، `common/prisma/prisma.extension.ts` — **ممنوع تمرير `tenant_id` من أي مدخل مستخدم** |
| **المصادقة** | **JWT** (Access 15 دقيقة + Refresh 30 يومًا مع **Rotation** وكشف إعادة الاستخدام) داخل NestJS عبر Passport — بلا Keycloak | وحدة `modules/auth`؛ نموذج `RefreshToken` بحقل `familyId` يُبطل السلسلة كاملة عند إعادة الاستخدام |
| **كلمات المرور** | **Argon2id**، حد أدنى 12 حرفًا، قفل الحساب بعد 5 محاولات فاشلة لمدة 15 دقيقة | `modules/auth/password.service.ts`؛ `User.failedLoginAttempts` + `User.lockedUntil` |
| **التفويض** | RBAC عبر `role_assignments`؛ حارس مركزي واحد **`PolicyGuard`** يقرأ `@RequirePermission(...)` — **ممنوع فحص الأدوار يدويًا في الـ Services** | `common/guards/policy.guard.ts`، `common/rbac/permissions.ts` (مصفوفة `PERMISSION_MATRIX`) |
| **تخزين الأنساب** | **Adjacency List (مصدر الحقيقة) + Closure Table (للاستعلامات)** يُحدَّث ذريًا داخل نفس معاملة تعديل النسب | نموذج `PersonClosure(tenant_id, ancestor_id, descendant_id, depth)`، `depth 0` = صف الذات |
| **الزواج** | كيان مستقل **Union** — لا علاقة مباشرة بين شخصين — يدعم التعدّد والطلاق والترمّل والزواج اللاحق بتواريخ لكل حالة | نموذج `Union` بحالات `active\|divorced\|widowed` |
| **البحث ومنع التكرار** | عمود مولّد `name_normalized` (توحيد الهمزات/التاء المربوطة/الياء وإزالة التشكيل) + فهرس `pg_trgm` GIN؛ فحص تكرار قبل الإنشاء بعتبة تشابه **0.6** | العمود المولّد وفهرس trigram في migration SQL؛ البحث عبر `$queryRaw`؛ منطق التطبيع في `common/util/arabic.ts` |
| **التخزين** | **MinIO** (S3-compatible) مع Presigned URLs بصلاحية 15 دقيقة | `common/minio/minio.service.ts` |
| **ORM والترحيلات** | **Prisma** + Prisma Migrate حصريًا؛ سياسات RLS والأعمدة المولّدة في migration SQL مخصص | `apps/api/prisma` |
| **CQRS** | **لا يُستخدم** — Services + Repositories فقط؛ الـ Controllers رقيقة | بنية كل وحدة: `controller / service / repository / dto` |
| **المهام الخلفية** | **BullMQ** على Redis: البريد، تحليل الاستيراد، مسح الطلبات المنتهية، تحديث Materialized Views | `modules/jobs/**` |
| **التنبيهات** | داخل النظام (**Socket.IO** namespace `/notifications`) + **بريد** (قوالب **MJML** ثنائية اللغة عبر MailHog محليًا) خلف تجريد `NotificationChannel`؛ **FCM** كقناة ثالثة في M5 | `modules/notifications/**`، إضافة `firebase-admin` (تتعطّل بسلاسة بلا اعتمادات) |
| **عرض الشجرة (ويب)** | **d3.js v7** داخل Angular — رسم **Canvas + Level-of-Detail** فوق 1,500 عقدة ظاهرة، وSVG لما دونها | يستهلك `GET /tree` المسطّح بعد مروره بـ Visibility Resolver |
| **عرض الشجرة (موبايل)** | **Flutter CustomPainter** بنفس Endpoint المسطّح (nodes/edges) — عمودي مع pinch-zoom/pan | لا d3 في Flutter؛ نفس الـ API يخدم الويب والموبايل |
| **الدفع في v1** | **تفعيل يدوي (تحويل بنكي)** عبر لوحة المنصة خلف تجريد `PaymentGateway` (بلا بوابة حقيقية) | `modules/subscriptions` |
| **الموبايل** | **Flutter واحد** لـ Android + iOS؛ عميل الـ API يُولَّد من OpenAPI؛ الإدارة تبقى ويب في v1 | `apps/mobile` (بنية Feature-First) |

## 4. نموذج البيانات الجوهري

الكيانات كما في `schema.prisma`. **جداول المنصة (خارج RLS):** `Tenant`، `User`، `RefreshToken`، `RoleAssignment`، `TenantSubscription`، `SubscriptionActivation`. **بقية الجداول tenant-scoped تحت RLS.**

### Person (`persons`)
`id, tenant_id, full_name, first_name, father_name, grandfather_name, family_name, laqab, gender(male|female), birth_date, birth_place, death_date, death_place, is_deceased, father_id (FK nullable), mother_id (FK nullable), tribal_unit_id (FK nullable), profession, photo_key, biography, status(draft|published|archived), version (قفل تفاؤلي), created_by, import_batch_id, created_at, updated_at, deleted_at (حذف ناعم)`
إضافةً إلى عمود مولّد `name_normalized` (يوجد في migration SQL فقط؛ Prisma لا يقرأه/يكتبه).

**قواعد سلامة النسب (في Service Layer + قيود قاعدة البيانات):** استحالة أن يكون الشخص سلفًا لنفسه (فحص عبر Closure Table)؛ الأب `male` والأم `female`؛ تحذير قابل للتجاوز إن سبق ميلاد الابن ميلاد الأب + 12 سنة؛ `father_id`/`mother_id` قد يكونان `NULL` (جذور متعددة).

### Union (`unions`)
`id, tenant_id, husband_id, wife_id, marriage_date?, status(active|divorced|widowed), end_date?, end_reason?` — يدعم التعدّد والطلاق والترمّل والزواج اللاحق.

### PersonClosure (`person_closures`)
`tenant_id, ancestor_id, descendant_id, depth` — مفتاح مركّب `(ancestor_id, descendant_id)`؛ `depth 0` = صف الذات لكل شخص. يُصان ذريًا مع تعديلات النسب، ويُعاد بناؤه لقبيلة كاملة عبر مهمة BullMQ عند الحاجة.

### TribalUnit (`tribal_units`)
`id, tenant_id, parent_id (ذاتي المرجع), unit_type(tribe|branch|clan|family), name_ar, name_en` — الهرم: قبيلة ← فرع ← فخذ ← عائلة.

### RoleAssignment (`role_assignments`)
`id, tenant_id, user_id, role, tribal_unit_id? (يقيّد branch_admin وما دونه), member_scope? (M3), anchor_person_id? (M3), valid_from, valid_to?` — الصلاحية المؤقتة والنائب يُنفَّذان بحقلي التاريخ لا بأدوار خاصة.

### ChangeRequest (`change_requests`) + ChangeRequestReview
`id, tenant_id, target_type(person|union|tribal_unit|import_batch), target_id?, operation(create|update|delete), patch (JSON Patch RFC-6902), status, base_version? (لإعادة فحص التعارض), contribution_type? (M4), created_by, expires_at, published_at?`. المراجعات: `(change_request_id, reviewer_id)` فريد — كل مراجع يُحسب مرة.

### كيانات أخرى محورية
`WorkflowSettings` (approvalsRequired 1–3، expiryDays، reviewerCanEdit) · `Notification` (النوع + payload + readAt) · `ImportBatch` + `ImportRow` (Staging) · `VisibilitySettings` (المستوى + سياسات الحقول + نطاق العضو الافتراضي) · `ViewRequest` (طلب المشاهدة) · `PersonDocument` (image|pdf) · `ContributorReputation` + `ReputationThresholds` · `TenantSubscription` + `SubscriptionActivation` · `DeviceRegistration` (FCM) · `AuditLog` (من/ماذا/متى/IP + before/after JSON).

## 5. الأدوار والصلاحيات

**الأدوار** (enum `Role`): `super_admin`، `platform_admin` (منصة) · `tribe_admin`، `deputy_admin`، `branch_admin` (مقيّد بوحدة قبلية وما تحتها)، `reviewer`، `contributor`، `viewer`، `guest` (قبيلة).

التفويض **بيانيّ** عبر مصفوفة `PERMISSION_MATRIX` في `permissions.ts`، يفرضه `PolicyGuard` وحده. جداول المنصة يحرسها `@SuperAdminOnly()`. استراتيجية النطاق `ScopeCheck.TribalUnit` تقيّد `branch_admin` بوحدته وذرّيّتها.

| الصلاحية | الأدوار الحاملة |
|---|---|
| `person.read` / `union.read` / `tribalUnit.read` / `tree.read` / `changeRequest.read` / `notification.read` / `document.read` / `export.read` / `reputation.read` / `device.manage` | جميع أدوار القراءة (tribe/deputy/branch admin، reviewer، contributor، viewer) |
| `person.create` / `person.update` / `union.write` (كتابة مباشرة في M1) | tribe_admin، deputy_admin، branch_admin |
| `person.delete` / `tribalUnit.write` / `tenant.*` / `workflowSettings.*` / `audit.read` / `visibilitySettings.*` / `viewRequest.manage` / `import.rollback` / `stats.read` / `reputation.manage` | tribe_admin، deputy_admin |
| `import.read` / `import.create` / `document.write` | tribe_admin، deputy_admin، branch_admin |
| `changeRequest.create` | tribe/deputy/branch admin، reviewer، contributor، **viewer** (يصل للـ endpoint، والخدمة تقصر الـ viewer على `edit_data`/`add_source` وفق إعداد القبيلة) |
| `changeRequest.review` | tribe_admin، deputy_admin، reviewer |
| صلاحيات المنصة (`/platform/*`) | super_admin (عبر `SuperAdminGuard`، خارج RLS) |

نقل مسؤولية القبيلة عملية موثّقة تتطلب تأكيد كلمة مرور الناقل وسجل Audit من نوع `ownership_transfer`.

## 6. المتطلبات غير الوظيفية

| المتطلب | الهدف |
|---|---|
| السعة التصميمية | 5,000 قبيلة، حتى 100,000 شخص للقبيلة، 500 مستخدم متزامن |
| زمن استجابة API (p95) | ≤ 300ms للقراءة، ≤ 800ms للكتابة |
| جلب شجرة 3 أجيال (p95) | ≤ 500ms (ويب) / ≤ 2s رسمًا على الموبايل |
| بحث ضبابي على 100K شخص (p95) | ≤ 700ms |
| الرفع | ملفات حتى 10MB دون حجب Event Loop (Streaming إلى MinIO)؛ ملف الاستيراد حتى 50MB |
| الأمن | عزل RLS على مستوى قاعدة البيانات؛ **اختبار عزل إلزامي في CI** (وصول عابر للمستأجرين ⇐ `403/404`)؛ فحص magic bytes للملفات ورفض SVG نهائيًا |
| الأداء (شجرة كبيرة) | 10,000 عقدة: تحميل ≤ 3s، سحب/تكبير ≥ 30fps؛ الموبايل ≥ 30fps حتى 2,000 عقدة |
| الموبايل | Cold Start ≤ 3s، حجم التنزيل ≤ 40MB، استجابة شجرة 3 أجيال ≤ 200KB (gzip) |
| السجلات | Structured JSON (pino) مع `tenant_id` و`request_id` في كل سطر |
| النسخ الاحتياطي | `pg_dump` يومي + استرجاع موثّق؛ تصدير tenant-scoped لاسترجاع قبيلة واحدة |
| الاستيراد الضخم | 100,000 صف عبر Streaming دون تجاوز 512MB ذاكرة للـ Worker |

## 7. النطاق خارج v1 (Backlog)

غير مبني الآن ويُذكر للتوثيق فقط: قنوات SMS/WhatsApp/Telegram؛ ميزات AI (كشف التكرار الدلالي، اقتراح الربط)؛ MFA وإدارة الأجهزة المتقدمة؛ الشجرة الشعاعية والزمنية؛ بوابات الدفع الإلكترونية؛ تصدير GEDCOM واستيراد ODS؛ إدارة القبيلة من الموبايل؛ تسجيل الدخول البيومتري وDeep Links؛ الترقية الآلية للصلاحيات في نظام السمعة (تبقى يدوية في v1).

</div>
