<div dir="rtl">

# كتالوج وظائف نظام TFTSP

> **الإجمالي: ٨٩ وظيفة** منظّمة في **١٤ مجالًا**. مستخرجة من عقود `docs/API_CONTRACT.M1..M5.md`، ومتحكّمات `apps/api/src/modules/**`، ومصفوفة الصلاحيات `permissions.ts`.
>
> **قراءة الجدول:** كل الوظائف ذات المسار تحت الجذر `/api/v1`. «الدور المطلوب» هو صلاحية `@RequirePermission` والأدوار الحاملة لها، أو `SuperAdmin` لمسارات المنصة، أو `Public` للمسارات العامة، أو `داخلي` للوظائف التي لا تُستدعى مباشرةً كـ endpoint (خدمات/مهام/بوابات WebSocket). كل قراءة لشخص تمر عبر **Visibility Resolver**، وكل كتابة تُسجَّل في **Audit**.

## المجال ١ — المصادقة والهوية (Auth & Identity)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 1 | تسجيل الدخول | مصادقة بالبريد وكلمة المرور (+`tenantSlug?`)؛ تُعيد `accessToken/refreshToken/user/tenants[]` | `POST /auth/login` | Public |
| 2 | تجديد التوكن | تدوير Refresh Token؛ إعادة استخدام توكن مدوَّر تُبطل السلسلة كاملة | `POST /auth/refresh` | Public |
| 3 | تسجيل الخروج | إبطال الجلسة (عائلة الـ Refresh Token كاملة) — `204` | `POST /auth/logout` | Public |
| 4 | المستخدم الحالي | المستخدم + `roleAssignments[]` تحت القبيلة النشطة + `activeTenant` | `GET /auth/me` | مصادَق |
| 5 | قفل الحساب | قفل تلقائي 15 دقيقة بعد 5 محاولات فاشلة (`failedLoginAttempts`/`lockedUntil`) | داخلي (ضمن login) | داخلي |
| 6 | كشف إعادة استخدام التوكن | تدوير مع كشف إعادة الاستخدام عبر `familyId` وإبطال السلسلة | داخلي (`token.service.ts`) | داخلي |

## المجال ٢ — المنصة والمستأجرون وإعدادات القبيلة (Platform & Tenants)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 7 | قائمة القبائل | سرد المستأجرين مع العدّادات | `GET /platform/tenants` | SuperAdmin |
| 8 | إنشاء قبيلة | إنشاء مستأجر + تعيين أول Tribe Admin (`nameAr/nameEn/slug/admin`) | `POST /platform/tenants` | SuperAdmin |
| 9 | تعليق قبيلة | Suspend لمستأجر | `POST /platform/tenants/:id/suspend` | SuperAdmin |
| 10 | تفعيل قبيلة | إعادة تفعيل مستأجر معلّق | `POST /platform/tenants/:id/activate` | SuperAdmin |
| 11 | إحصاءات المنصة الأساسية | `{ tribes, persons, users }` | `GET /platform/stats` | SuperAdmin |
| 12 | قراءة إعدادات القبيلة | الأسماء والشعار واللون (`logoKey/primaryColor` nullable) — المستأجر من الـ JWT فقط | `GET /tenant/settings` | `tenant.read` (tribe/deputy) |
| 13 | تحديث إعدادات القبيلة | تعديل الأسماء واللون (`#RRGGBB`) والشعار — `slug` غير قابل للتعديل | `PATCH /tenant/settings` | `tenant.update` (tribe/deputy) |
| 14 | رفع الشعار (Presign) | رابط MinIO موقّع للرفع (PUT، صلاحية 15 دقيقة) + `logoKey` | `POST /tenant/settings/logo-upload` | `tenant.update` (tribe/deputy) |

## المجال ٣ — الوحدات القبلية (Tribal Units)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 15 | قائمة الوحدات | سرد الوحدات (tribe/branch/clan/family) | `GET /tribal-units` | `tribalUnit.read` |
| 16 | تفاصيل وحدة | وحدة واحدة | `GET /tribal-units/:id` | `tribalUnit.read` |
| 17 | إنشاء وحدة | إضافة وحدة في الهرم القبلي | `POST /tribal-units` | `tribalUnit.write` (tribe/deputy) |
| 18 | تعديل وحدة | تحديث بيانات الوحدة | `PATCH /tribal-units/:id` | `tribalUnit.write` (tribe/deputy) |
| 19 | حذف وحدة | حذف الوحدة (فحص نطاق) | `DELETE /tribal-units/:id` | `tribalUnit.write` (tribe/deputy) |

## المجال ٤ — الأشخاص (Persons)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 20 | قائمة وبحث الأشخاص | صفحات `{ data, page, pageSize, total }` + بحث `?q=` (trigram على `name_normalized`) | `GET /persons` | `person.read` |
| 21 | تفاصيل شخص | الشخص الكامل (عبر Visibility Resolver؛ خارج النطاق ⇐ 404) | `GET /persons/:id` | `person.read` |
| 22 | إنشاء شخص | إنشاء مع فحص تكرار مسبق؛ تعارض ⇐ `409 duplicate_candidates`؛ متابعة بـ `confirmDuplicate:true` | `POST /persons` | `person.create` (`ScopeCheck.TribalUnit`) |
| 23 | تعديل شخص | تحديث بقفل تفاؤلي عبر `version`؛ عدم تطابق ⇐ `409 version_conflict` | `PATCH /persons/:id` | `person.update` (`ScopeCheck.TribalUnit`) |
| 24 | حذف شخص | حذف ناعم (`deleted_at`) + تحديث Closure Table | `DELETE /persons/:id` | `person.delete` (tribe/deputy) |
| 25 | فحص التكرار المسبق | استعلام similarity على (الاسم المطبّع + اسم الأب + الفخذ) بعتبة 0.6 قبل الإنشاء | داخلي (§8) | داخلي |

## المجال ٥ — الزيجات (Unions)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 26 | قائمة الزيجات | سرد كيانات Union | `GET /unions` | `union.read` |
| 27 | تفاصيل زواج | Union واحد | `GET /unions/:id` | `union.read` |
| 28 | إنشاء زواج | إنشاء Union (زوج/زوجة/تاريخ) | `POST /unions` | `union.write` (write roles) |
| 29 | طلاق | تحويل الحالة إلى `divorced` (+`end_date/end_reason`) | `POST /unions/:id/divorce` | `union.write` |
| 30 | ترمّل | تحويل الحالة إلى `widowed` عند وفاة أحد الطرفين | `POST /unions/:id/widow` | `union.write` |
| 31 | زواج لاحق | تسجيل زواج جديد بعد طلاق/ترمّل | `POST /unions/:id/remarry` | `union.write` |

## المجال ٦ — الأنساب والشجرة (Lineage & Tree)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 32 | جلب الشجرة | بنية مسطّحة `{ nodes[], edges[] }` (id/name/gender/isDeceased/childrenCount) بعد Visibility Resolver؛ تحميل تدريجي `?rootId=&generations=` | `GET /tree` | `tree.read` |
| 33 | الأسلاف | مسار الأصول عبر Closure Table | `GET /persons/:id/ancestors` | `person.read` |
| 34 | الأحفاد | الذرّية عبر Closure Table | `GET /persons/:id/descendants` | `person.read` |
| 35 | صيانة Closure Table | تحديث ذري لصفوف depth عند إضافة/تغيير أب أو أم/حذف؛ إعادة بناء لقبيلة عبر BullMQ | داخلي | داخلي |

## المجال ٧ — سير الموافقات وطلبات التغيير (Change Requests & Workflow)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 36 | إنشاء طلب تغيير | مسودة `{ targetType, targetId?, operation, patch }` (تلتقط `baseVersion`) بصيغة JSON Patch | `POST /change-requests` | `changeRequest.create` |
| 37 | قائمة الطلبات | سرد بمرشّحات `?status=&mine=true&queue=true` | `GET /change-requests` | `changeRequest.read` |
| 38 | تفاصيل طلب | الطلب كاملًا مع `reviews[]` | `GET /change-requests/:id` | `changeRequest.read` |
| 39 | تعديل الطلب | تعديل الـ patch أثناء `draft`/`changes_requested` (أو تعديل المراجع إن سُمح) | `PATCH /change-requests/:id` | `changeRequest.create` |
| 40 | إرسال الطلب | `draft → submitted` | `POST /change-requests/:id/submit` | `changeRequest.create` |
| 41 | مراجعة الطلب | `{ decision: approve\|reject\|request_changes, comment? }`؛ لا يوافق المراجع على طلبه، وكل مراجع يُحسب مرة | `POST /change-requests/:id/review` | `changeRequest.review` (tribe/deputy/reviewer) |
| 42 | النشر التلقائي | عند بلوغ `approvalsRequired` ⇐ `approved` ثم نشر ذري + إعادة فحص التعارض ⇐ `published` أو `conflict` | داخلي (`change-request.publisher.ts`) | داخلي |
| 43 | قراءة إعدادات Workflow | `{ approvalsRequired, expiryDays, reviewerCanEdit }` | `GET /workflow-settings` | `workflowSettings.read` (tribe/deputy) |
| 44 | تحديث إعدادات Workflow | `approvalsRequired (1..3)`, `expiryDays`, `reviewerCanEdit` | `PATCH /workflow-settings` | `workflowSettings.update` (tribe/deputy) |
| 45 | مسح الطلبات المنتهية | مهمة BullMQ: الطلبات المتجاوزة لـ `expiresAt` ⇐ `expired` + إشعار صاحبها | داخلي (مجدولة) | داخلي |
| 46 | تحذير اقتراب الانتهاء | مهمة مجدولة تُشعر صاحب الطلب قبل الانتهاء (مثلًا 3 أيام) | داخلي (مجدولة) | داخلي |

## المجال ٨ — الاستيراد الجماعي (Bulk Import)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 47 | تنزيل القالب | قالب رسمي ثنائي اللغة `?format=xlsx\|csv&lang=ar\|en` | `GET /imports/template` | `import.read` |
| 48 | رفع دفعة | multipart (حقل `file`، ≤50MB، magic bytes) ⇐ Streaming إلى MinIO + مهمة تحليل ⇐ `ImportBatch` | `POST /imports` | `import.create` |
| 49 | قائمة الدفعات | سرد `{ data, page, pageSize, total }` | `GET /imports` | `import.read` |
| 50 | تفاصيل الدفعة | `counts` + `progress` + `status` | `GET /imports/:id` | `import.read` |
| 51 | صفوف المعاينة | صفوف Staging `?status=&page=` (أخطاء + مرشّحو تكرار) | `GET /imports/:id/rows` | `import.read` |
| 52 | قرار الصف | ضبط `decision` (new/merge/ignore)، هدف الدمج، حسم المراجع الغامضة | `PATCH /imports/:id/rows/:rowId` | `import.create` |
| 53 | إرسال الدفعة | تُنشأ **Change Request واحدة** إلى Workflow M2 (`partial` للاستيراد الجزئي) | `POST /imports/:id/submit` | `import.create` |
| 54 | التراجع عن الدفعة | Rollback على مستوى الدفعة؛ يُرفض إن اعتمدت سجلات لاحقة (`rollback_blocked`)؛ حذف ناعم + إعادة بناء Closure | `POST /imports/:id/rollback` | `import.rollback` (tribe/deputy) |
| 55 | تقدّم الاستيراد (WebSocket) | namespace `/imports` (JWT، غرفة `t:<tenant>:u:<user>`)؛ حدث `import_progress` (0..100) أثناء التحليل/التحقق/الحل/النشر | داخلي (`import.gateway.ts`) | داخلي |

## المجال ٩ — الرؤية والخصوصية (Visibility & Privacy)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 56 | قراءة سياسات الرؤية | `VisibilitySettings` (المستوى + سياسات الحقول + `defaultMemberScope` + `requireIdForViewRequest`) | `GET /visibility-settings` | `visibilitySettings.read` (tribe/deputy) |
| 57 | تحديث سياسات الرؤية | تعديل أي مجموعة جزئية (مستوى، `womenDisplay`، إظهار الصور/الهواتف/التواريخ/المتوفين/القُصّر/الوثائق) | `PATCH /visibility-settings` | `visibilitySettings.update` (tribe/deputy) |
| 58 | Visibility Resolver | خدمة مركزية تمر بها كل قراءة لشخص؛ تحذف الحقول المحجوبة (لا تُفرَّغ)؛ خارج النطاق ⇐ 404؛ نطاق العضو direct/clan/branch/tribe عبر Closure + شجرة الوحدات | داخلي | داخلي |

## المجال ١٠ — طلبات المشاهدة (View Requests)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 59 | رفع مرفق الهوية | multipart (حقل `file` + `tenantSlug`) ⇐ MinIO؛ صور/PDF فقط، magic bytes، رفض SVG، ≤10MB ⇐ `idAttachmentKey` | `POST /view-requests/id-attachment` | Public |
| 60 | تقديم طلب مشاهدة | `CreateViewRequestDto` (الاسم الثلاثي، الهاتف، الفرع المزعوم، السبب، `idAttachmentKey?`) ⇐ إشعار المسؤولين | `POST /view-requests` | Public (عبر `tenantSlug`) |
| 61 | قائمة الطلبات | سرد الطلبات `?status=` | `GET /view-requests` | `viewRequest.manage` (tribe/deputy) |
| 62 | الموافقة على طلب | `{ validTo }` ⇐ إنشاء/ربط مستخدم Viewer + `role_assignment` بصلاحية مؤقتة منتهية بتاريخ | `POST /view-requests/:id/approve` | `viewRequest.manage` |
| 63 | رفض طلب | رفض الطلب | `POST /view-requests/:id/reject` | `viewRequest.manage` |

## المجال ١١ — التنبيهات (Notifications)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 64 | قائمة التنبيهات | `{ data[], unread, page, pageSize, total }` | `GET /notifications` | `notification.read` |
| 65 | تعليم كمقروء | تعليم تنبيه واحد مقروءًا | `POST /notifications/:id/read` | `notification.read` |
| 66 | تعليم الكل مقروءًا | تعليم كل التنبيهات مقروءة | `POST /notifications/read-all` | `notification.read` |
| 67 | بوابة داخل النظام (WebSocket) | Socket.IO namespace `/notifications` (JWT، غرفة `t:<tenant>:u:<user>`)؛ حدث `notification` خلال ≤2s من كل تغيّر حالة | داخلي | داخلي |
| 68 | قناة البريد | قوالب MJML ثنائية اللغة عبر `NotificationChannel` (MailHog محليًا): طلب جديد/موافقة/رفض/طلب تعديل/اقتراب انتهاء | داخلي | داخلي |

## المجال ١٢ — الاشتراكات والخطط (Subscriptions & Plans)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 69 | قراءة الاشتراك | `SubscriptionView` (الخطة، الحالة، `maxPersons`، `currentPersons`، تواريخ التفعيل/الانتهاء) | `GET /platform/tenants/:id/subscription` | SuperAdmin |
| 70 | ضبط الاشتراك | `SetSubscriptionDto { tier, expiresAt?, note? }` — تعيين خطة + تفعيل يدوي (تحويل بنكي)؛ يسجّل تفعيلًا | `PUT /platform/tenants/:id/subscription` | SuperAdmin |
| 71 | سجل التفعيلات | `SubscriptionActivation[]` (الأحدث أولًا) | `GET /platform/tenants/:id/subscription/activations` | SuperAdmin |
| 72 | فرض حد الخطة | حارس مركزي يفرض سقف الأشخاص عند الإنشاء/الاستيراد/النشر؛ التجاوز ⇐ `403 plan_limit_reached` (Free 500 / Basic 5,000 / Professional 25,000 / Enterprise بلا حد) | داخلي | داخلي |

## المجال ١٣ — الوثائق والتصدير (Documents & Export)

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 73 | Presign رفع وثيقة | `{ personId, filename, contentType, sizeBytes }` ⇐ `{ uploadUrl, objectKey }` (MinIO PUT 15 دقيقة)؛ صور/PDF فقط | `POST /documents/presign` | `document.write` (tribe/deputy/branch) |
| 74 | تأكيد الرفع | إعادة قراءة البايتات وفحص magic bytes ⇐ تسجيل `PersonDocument`؛ SVG مقنّع بـ .png يُرفض؛ ≤10MB | `POST /documents/confirm` | `document.write` |
| 75 | وثائق الشخص | `DocumentWithUrl[]` (روابط GET موقّعة 15 دقيقة) | `GET /persons/:id/documents` | `document.read` |
| 76 | حذف وثيقة | حذف ناعم للوثيقة | `DELETE /documents/:id` | `document.write` |
| 77 | تصدير PDF | Puppeteer server-side `{ rootId, layout, paper: A0..A4 }`، RTL صحيح | `POST /exports/tree/pdf` | `export.read` |
| 78 | تصدير PNG | PNG عالي الدقة `{ rootId, layout, scale: 2\|4 }` | `POST /exports/tree/png` | `export.read` |
| 79 | تصدير Excel | تصدير جدولي بأعمدة قالب الاستيراد (round-trip) | `GET /exports/persons.xlsx` | `export.read` |
| 80 | تصدير CSV | تصدير جدولي CSV بنفس أعمدة القالب | `GET /exports/persons.csv` | `export.read` |

## المجال ١٤ — المساهمات والسمعة والإحصاءات والأجهزة (Crowdsourcing, Reputation, Stats & Devices)

> **المساهمات لا محرّك جديد لها:** المساهمة = Change Request (المجال ٧) بحقل `contributionType` (`add_person|edit_data|fix_relation|upload_document|add_source|add_biography`). Contributor يُنشئ، وViewer يقترح `edit_data`/`add_source` فقط وعند تفعيل القبيلة ذلك. حماية من الإغراق: حد 20 معلّقًا لكل مساهم.

| # | الوظيفة | الوصف | المسار/الطريقة | الدور |
|---|---|---|---|---|
| 81 | سمعتي | `ContributorReputation` للمستخدم في القبيلة النشطة (`totalContributions/accepted/rejected/accuracyRate/trustLevel`) | `GET /reputation/me` | `reputation.read` |
| 82 | ترتيب المساهمين | قائمة المساهمين مرتّبة بالدقة | `GET /reputation` | `reputation.manage` (tribe/deputy) |
| 83 | قراءة عتبات السمعة | `ReputationThresholds` (عتبات silver/gold، `allowViewerContributions`، `maxPending`) | `GET /reputation/thresholds` | `reputation.manage` |
| 84 | تحديث عتبات السمعة | تعديل العتبات وتفعيل مساهمات الزوّار | `PATCH /reputation/thresholds` | `reputation.manage` |
| 85 | إحصاءات القبيلة | `TribeStats` (إجماليات، أحياء/متوفون، أجيال، حسب الجيل، طلبات معلّقة…) عبر Materialized Views | `GET /stats/tribe` | `stats.read` (tribe/deputy) |
| 86 | لوحة المنصة | `PlatformDashboard` (القبائل، حسب الخطة، القرب من الانتهاء…) للـ Super Admin | `GET /platform/stats/dashboard` | SuperAdmin |
| 87 | تحديث الإحصاءات | فرض تحديث Materialized Views يدويًا (تُحدَّث آليًا كل ساعة عبر BullMQ) — للقبيلة وللمنصة | `POST /stats/refresh` · `POST /platform/stats/refresh` | `stats.read` / SuperAdmin |
| 88 | تسجيل/إلغاء الجهاز | Upsert بتوكن FCM (`{ token, platform }`) عند الدخول؛ إلغاء عند الخروج (idempotent) | `POST /devices` · `DELETE /devices/:token` | `device.manage` (أي عضو) |
| 89 | مُحوّل الدفع FCM | القناة الثالثة في `NotificationChannel`: دفع تنبيهات M2/M3 إلى أجهزة المستخدم مع `data.type`/`payload` لفتح العنصر؛ تتعطّل بسلاسة بلا اعتمادات، وتُقلّم التوكنات غير المسجّلة | داخلي (`firebase-admin`) | داخلي |

---

## الإجمالي

**٨٩ وظيفة** موزّعة على ١٤ مجالًا:

| المجال | العدد | المجال | العدد |
|---|:---:|---|:---:|
| ١ المصادقة والهوية | 6 | ٨ الاستيراد الجماعي | 9 |
| ٢ المنصة والمستأجرون | 8 | ٩ الرؤية والخصوصية | 3 |
| ٣ الوحدات القبلية | 5 | ١٠ طلبات المشاهدة | 5 |
| ٤ الأشخاص | 6 | ١١ التنبيهات | 5 |
| ٥ الزيجات | 6 | ١٢ الاشتراكات والخطط | 4 |
| ٦ الأنساب والشجرة | 4 | ١٣ الوثائق والتصدير | 8 |
| ٧ سير الموافقات | 11 | ١٤ المساهمات والسمعة والإحصاءات والأجهزة | 9 |
| | | **الإجمالي** | **89** |

</div>
