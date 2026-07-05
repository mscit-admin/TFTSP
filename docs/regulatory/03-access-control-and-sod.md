<div dir="rtl">

# 03 — التحكم بالوصول وفصل المهام

## 1. نظرة عامة

يقوم التحكم بالوصول في TFTSP على أربع طبقات متكاملة:
1. **المصادقة (Authentication)** — من أنت؟ (JWT).
2. **العزل متعدد المستأجرين (RLS)** — أي بيانات مستأجر يمكنك رؤيتها أصلاً؟ (طبقة قاعدة البيانات).
3. **التفويض (RBAC)** — ماذا يُسمح لك بفعله؟ (`PolicyGuard` مركزي).
4. **الرؤية (Visibility Resolver)** — أي أشخاص/حقول ضمن مستأجرك مسموح لك بمشاهدتها؟

## 2. العزل متعدد المستأجرين (Row-Level Security)

هذا أخطر ضابط في النظام (المواصفة، القسم 4).

| العنصر | التطبيق | الموضع |
|---|---|---|
| دور التطبيق | `tftsp_app` بخاصية **`NOBYPASSRLS`** — فلا يتجاوز RLS أبداً | `migrations/0002_rls_and_search/migration.sql` |
| فصل الأدوار | الهجرات تُشغَّل بدور المالك `tftsp`؛ التشغيل بدور `tftsp_app` | القرار D-005 |
| سياسة العزل | `USING/WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)` على كل جدول tenant-scoped | migration SQL |
| حقن المستأجر | امتداد Prisma ينفّذ `SET LOCAL app.current_tenant` (عبر `set_config(name, value, true)`) في بداية كل معاملة | `prisma.extension.ts` |
| مصدر الهوية | `tenant_id` من الـ JWT المُتحقَّق منه **فقط** — ممنوع من مدخلات المستخدم | `prisma.extension.ts`, المواصفة §4.3 |
| المعاملات متعددة العبارات | عدّاد عمق (`txDepth`) آمن للتزامن يمنع إعادة تغليف العمليات داخل معاملة مستأجر قائمة | `prisma.service.ts` |
| جداول المنصة | `tenants, users, role_assignments, tenant_subscriptions` خارج RLS، تُدار خلف `SuperAdminGuard` | القرارات D-101/D-102 |

> **ملاحظة تصميمية مهمة:** `current_setting(..., true)` يعيد `NULL` عند غياب الضبط، فتُقيَّم السياسة إلى `NULL` (لا صفوف) بدل الخطأ — أي الافتراض هو **عدم كشف أي صف** لا كشف الكل.

## 3. المصادقة والصلاحيات المؤقتة

- **JWT** برمز وصول 15 دقيقة + رمز تحديث 30 يوماً بتدوير وكشف إعادة استخدام (راجع `02`، البند 4.2).
- **قفل الحساب:** بعد **5 محاولات فاشلة** يُقفَل الحساب **15 دقيقة** (`auth.service.ts`، `maxFailedAttempts`/`lockMinutes`).
- **الصلاحيات المؤقتة والنيابة:** تُنفَّذ بحقلي `valid_from`/`valid_to` في `role_assignments` لا بأدوار خاصة (المواصفة، القسم 6). يقرأ `PolicyGuard` التعيينات ضمن نافذة الصلاحية فقط؛ والتعيين المنتهي يُنتج **401 برسالة انتهاء (`GRANT_EXPIRED`)** تمييزاً له عن 403 (`policy.guard.ts` → `throwIfExpiredGrant`).

## 4. جدار الحماية المركزي (PolicyGuard)

طبقة التفويض الوحيدة (المواصفة، القسم 6؛ `apps/api/src/common/guards/policy.guard.ts`). **لا خدمة تفحص الأدوار يدوياً.**

- يقرأ الموسِّمات (Decorators): `@Public`، `@SuperAdminOnly`، و`@RequirePermission('permission', ScopeCheck?)`.
- يقرأ `role_assignments` عبر عميل المنصة بفلترة صريحة `(tenantId, userId)` وضمن نافذة الصلاحية.
- يطابق دور المستخدم مقابل `PERMISSION_MATRIX`؛ عدم التطابق ⇒ 403.
- **فحص النطاق (`ScopeCheck.TribalUnit`):** يُقيَّد `branch_admin` بوحدته المُسندة **وسلالتها**؛ يُحسب ذلك بالمشي على شجرة `tribal_units` (parent chain)، بينما الأدوار الإدارية غير المقيّدة (`tribe_admin`/`deputy_admin`) تمرّ دون قيد.

## 5. فصل المهام (Segregation of Duties)

| الضابط | القاعدة | التطبيق | الحالة |
|---|---|---|---|
| منشئ الطلب ≠ المُعتمِد | لا يمكن لمن أنشأ طلب تغيير أن يراجعه | `if (cr.createdBy === user.id) throw CR_CANNOT_REVIEW_OWN` (403) | **مطبَّق** — `change-request.service.ts:210` |
| لا موافقة ذاتية | المُنشئ مُستبعَد حتى من إشعارات المراجعة | `reviewerIds.filter(rid => rid !== user.id)` | **مطبَّق** |
| نصاب الموافقات | لا يُنشَر التغيير إلا ببلوغ عدد الموافقات المطلوب | `approvals >= settings.approvalsRequired` | **مطبَّق** — `WorkflowSettings.approvalsRequired` |
| تحرير المراجِع مقيَّد | يمكن للمراجِع التحرير إن سمح المستأجر، لكن **ليس على طلبه** | `reviewerCanEdit && ... && !isOwner` | **مطبَّق** |
| فصل صلاحية الاسترجاع | تراجُع الاستيراد الجماعي مقصور على Tribe/Deputy Admin وحدهما | `import.rollback` | **مطبَّق** |
| نقل ملكية القبيلة الموثّق | نقل Tribe Admin يتطلب تأكيد كلمة مرور الناقل + تدقيق `ownership_transfer` | — | **غير مطبَّق / Backlog** (منصوص عليه في المواصفة §6؛ لا نقطة نهاية ولا إجراء تدقيق `ownership_transfer` في الكود الحالي) |

## 6. مصفوفة الأدوار × الصلاحيات

مستمدّة حرفياً من `PERMISSION_MATRIX` في `apps/api/src/common/rbac/permissions.ts`. الرمز ✓ = الدور يملك الصلاحية.

| الصلاحية | Tribe Admin | Deputy Admin | Branch Admin | Reviewer | Contributor | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `person.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `person.create` | ✓ | ✓ | ✓ | | | |
| `person.update` | ✓ | ✓ | ✓ | | | |
| `person.delete` | ✓ | ✓ | | | | |
| `union.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `union.write` | ✓ | ✓ | ✓ | | | |
| `tribalUnit.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tribalUnit.write` | ✓ | ✓ | | | | |
| `tree.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audit.read` | ✓ | ✓ | | | | |
| `tenant.read` / `tenant.update` | ✓ | ✓ | | | | |
| `changeRequest.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* |
| `changeRequest.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `changeRequest.review` | ✓ | ✓ | | ✓ | | |
| `workflowSettings.read` / `.update` | ✓ | ✓ | | | | |
| `import.read` / `import.create` | ✓ | ✓ | ✓ | | | |
| `import.rollback` | ✓ | ✓ | | | | |
| `visibilitySettings.read` / `.update` | ✓ | ✓ | | | | |
| `viewRequest.manage` | ✓ | ✓ | | | | |
| `document.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `document.write` | ✓ | ✓ | ✓ | | | |
| `export.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `stats.read` | ✓ | ✓ | | | | |
| `reputation.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reputation.manage` | ✓ | ✓ | | | | |
| `device.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* **Viewer** يصل إلى نقطة `changeRequest.create` لكن طبقة الخدمة تُقيّده بأنواع `edit_data/add_source` وفقط إذا فعّلت القبيلة ذلك (M4 §13).

**ملاحظات:**
- `super_admin` / `platform_admin` أدوار منصة تُدار عبر `@SuperAdminOnly` خارج هذه المصفوفة؛ ويمكن للـ Super Admin العمل داخل أي مستأجر يختاره.
- `guest` غير مُمثَّل في المصفوفة (سياق طلبات المشاهدة العامة فقط).

## 7. الرؤية داخل المستأجر (Visibility Resolver)

بعد اجتياز RLS وRBAC، تمر كل قراءة لشخص عبر `VisibilityResolver` (`visibility.resolver.ts`):
- **بوابة الوجود (`isVisible`):** تُخفي المتوفَّين/القُصَّر (<18)/النساء حسب سياسة المستأجر؛ غير المرئي ⇒ 404 أو غياب من القوائم.
- **حجب الحقول (`redact`):** تُحذف مفاتيح مثل `photoKey`/`birthDate` بحسب `VisibilitySettings` (تُحذف المفاتيح، لا تُجعل `null`).
- **النطاقات:** `tribe` (كامل القبيلة)، `unit` (الفخذ/الفرع وسلالته)، `direct` (الأقارب المباشرون عبر جدول الإغلاق)، `none`.
- الأدوار الإدارية (`tribe_admin`/`deputy_admin`/`branch_admin`) تتجاوز سياسات الحجب (`bypassPolicies`).

</div>
