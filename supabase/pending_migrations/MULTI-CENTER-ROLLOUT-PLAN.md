# خطة تفعيل تعدد المراكز التدريجية والقابلة للتراجع (غير مطبّقة على الإنتاج بعد)

## 1. الحالة الحالية
- **موجود ومطبّق**: جدول `branches` (3 فروع)، `sections.branch_id`، `children.branch_id`، `attendance.branch_id`، عمود `admins.branch_id` (`NULL` = مدير عام)، ودالتا `can_access_branch(uuid)` و`current_admin_branch_id()`.
- **غير مفعّل بعد**: عزل RLS على الجداول التشغيلية، حفاظاً على استقرار المركز الحالي.

## 2. تصنيف الجداول حسب الارتباط بالمركز
| الجدول | طريقة الربط بالمركز | هل يحتاج `branch_id` مباشر؟ |
| :--- | :--- | :--- |
| `branches`, `sections`, `children`, `attendance`, `admins` | `branch_id` مباشر موجود مسبقاً | نعم (موجود) |
| `progress_reports`, `appointments`, `documents`, `attachments`, `registration_codes`, `whatsapp_logs`, `whatsapp_messages` | عبر علاقة `child_id -> children.branch_id` | لا (يُشتق موثوقاً من `children`) |
| `parent_profiles`, `parent_children` | عبر علاقة `parent_children -> children.branch_id` | لا (الولي قد يكون له أطفال في أكثر من فرع) |
| `messages`, `notification_outbox` | عبر `target_child_id` أو `target_section_id` أو إضافة `branch_id` اختياري للإعلانات الخاصة بفرع | اختياري (عمود nullable لرسائل الفرع) |
| `educational_programs` | عبر `section_id -> sections.branch_id` | لا |
| `storage.objects` (`private-docs`) | المسار `children/<child_uuid>/...` يُربط بـ `children.branch_id` | لا |

## 3. مراحل التفعيل الآمن (عند الحاجة الفعلية وموافقة الإدارة)
1. التحقق من أن جميع صفوف `children` و`sections` و`attendance` تملك `branch_id IS NOT NULL`.
2. إبقاء حسابات الإدارة العامة على `admins.branch_id IS NULL` (ترجع `can_access_branch()` لهم `true` دائماً).
3. تحديث سياسات RLS في بيئة Staging أولاً لاستبدال `can_manage_families()` بـ `can_manage_families() AND can_access_branch(branch_id)`، واختبار عزل مدير الفرع أ عن الفرع ب.
4. **التراجع (Rollback)**: إعادة السياسات إلى `can_manage_families()` في ترحيل فوري دون فقدان أي بيانات.
