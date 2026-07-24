# Audit: Xác minh loại bỏ hoàn toàn Nurse (Y tá) khỏi hệ thống

> Ngày kiểm tra: 2026-07-24
> Vai trò: Senior Software Architect + Fullstack Reviewer + QA Lead
> Phạm vi: toàn bộ `frontend/src`, `backend/src`, `docs/`, seed/scripts

## Kết luận cuối cùng

# ❌ FAIL — Nurse vẫn là một subsystem sống, được mount đầy đủ trong kiến trúc

Đây **không phải** vài dòng code sót lại. Nurse vẫn là một role hoạt động đầy đủ:
có route riêng, layout riêng, DB fields riêng, seed user riêng, và business logic
doctor vẫn phụ thuộc vào nó. Việc "xóa Nurse" **chưa được bắt đầu** ở tầng kiến trúc —
mới chỉ có ý định nghiệp vụ (nêu trong prompt), chưa có refactor thực tế nào diễn ra.

---

## 1. Tổng số file đã kiểm tra

- Full-text scan case-insensitive `nurse` trên toàn repo: **139 file** khớp.
- Full-text scan `y tá` (tiếng Việt): **128 file** khớp (phần lớn trùng với trên).
- Chỉ tính code thực thi (`backend/src` + `frontend/src`, loại trừ `docs/`): **54 file** còn tham chiếu `nurse`.
- Còn lại là tài liệu trong `docs/Y tá/` (~40 file lịch sử) và `docs/Bác sĩ/` (tài liệu chéo).

## 2. Danh sách file còn tham chiếu Nurse (trọng yếu)

| File | Dòng | Loại | Mức độ | Cần xử lý |
|---|---|---|---|---|
| `backend/src/models/NguoiDung.js` | 29 | Enum role | 🔴 Nghiêm trọng | Có — `enum: ['user','patient','doctor','admin','receptionist','nurse']` |
| `backend/src/routes/index.js` | 11, 24 | Route mount | 🔴 Nghiêm trọng | Có — `router.use('/nurse', nurseRoutes)` |
| `backend/src/routes/nurse/index.js` | toàn file | Route group | 🔴 Nghiêm trọng | Có — `requireRole('nurse')` bảo vệ toàn bộ `/api/nurse/*` |
| `backend/src/routes/nurse/{dashboard,appointments,medical-records,room-status,queue,schedule}.routes.js` | toàn file | Route | 🔴 Nghiêm trọng | Có — 6 file route |
| `backend/src/controllers/nurse/{dashboard,appointments,medical-records,room-status,queue,schedule}.controller.js` | toàn file | Controller | 🔴 Nghiêm trọng | Có — 6 controller đầy đủ logic |
| `backend/src/utils/nurse-scope.js` | toàn file | Util | 🔴 Nghiêm trọng | Có — scoping theo nurse đăng nhập |
| `backend/src/models/NghiPhepYTa.js` | toàn file | Model | 🔴 Nghiêm trọng | Có — collection nghỉ phép riêng cho y tá |
| `backend/src/models/LichHen.js` | 8-10, 47 | Field + Enum | 🔴 Nghiêm trọng | Có — `nurse_id` field, status `waiting_record`/`waiting_doctor_confirm` |
| `backend/src/models/LichLamViec.js` | nhiều dòng | Field | 🔴 Nghiêm trọng | Có — `nurse_id` gán ca cho y tá |
| `backend/src/models/TrangThaiPhongKham.js` | nhiều dòng | Field | 🔴 Nghiêm trọng | Có |
| `backend/src/models/NhatKyThaoTac.js` | nhiều dòng | Field | 🟡 Trung bình | Có |
| `backend/src/controllers/doctor/appointments.controller.js` | 440, 573 | Business logic | 🔴 Nghiêm trọng | Có — comment xác nhận luồng "doctor–nurse bắt buộc" |
| `backend/src/controllers/doctor/stats.controller.js`, `schedule.controller.js` | nhiều dòng | Business logic | 🔴 Nghiêm trọng | Có — dashboard bác sĩ đọc `nurse` hỗ trợ |
| `backend/src/scripts/seed-all.js` | 208-211, 276, 1031-1168 | Seed | 🔴 Nghiêm trọng | Có — tạo user `nurse@vitafamily.vn`, dùng làm `nguoi_nhap_id`/`nguoi_do_id` cho hồ sơ khám |
| `backend/src/scripts/{seed-nurse-test-data,seed-khang-nurse-live-flow,seed-khang-nurse-history,link-nurse-to-khang-data,verify-khang-nurse-live-flow}.js` | toàn file | Script | 🟡 Trung bình | Có — script test/demo riêng cho nurse |
| `frontend/src/types/index.ts` | 4, 636-637, 728-729, 752, 888, 1020-1265 | Type | 🔴 Nghiêm trọng | Có — `Role` union có `"nurse"`, ~15 interface `Nurse*` |
| `frontend/src/routes/AppRoutes.tsx` | 5, 47-52, 147-161 | Router | 🔴 Nghiêm trọng | Có — nhánh `/nurse` với `ProtectedRoute roles={['nurse']}` |
| `frontend/src/routes/nurseMenu.ts` | toàn file | Menu | 🔴 Nghiêm trọng | Có |
| `frontend/src/layouts/NurseLayout.tsx` | toàn file | Layout | 🔴 Nghiêm trọng | Có |
| `frontend/src/components/nurse/{NurseSidebar,NurseHeader}.tsx` | toàn file | Component | 🔴 Nghiêm trọng | Có |
| `frontend/src/pages/nurse/{NurseDashboard,NurseSchedule,NurseQueue,NursePendingRecords,NurseAppointmentDetail,NurseRevisions}.tsx` | toàn file | Page | 🔴 Nghiêm trọng | Có — 6 trang đầy đủ UI |
| `frontend/src/services/nurse.service.ts` | toàn file | Service | 🔴 Nghiêm trọng | Có |
| `frontend/src/pages/auth/Login.tsx` | 11, 43-44 | Business logic | 🔴 Nghiêm trọng | Có — redirect `role === 'nurse'` → `/nurse`; demo account `role: 'Y tá'` |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | 164 | UI text | 🔴 Nghiêm trọng | Có — hiển thị `"Y tá hỗ trợ: {detail.nurse}"` |
| `frontend/src/pages/doctor/DoctorDashboard.tsx` | 142-144 | UI text | 🔴 Nghiêm trọng | Có — `"Y tá hỗ trợ"`, `overview.y_ta_ho_tro.ho_ten` |
| `frontend/src/pages/doctor/{DoctorExamQueue,DoctorAppointments}.tsx` | nhiều dòng | UI/logic | 🟡 Trung bình | Có |
| `frontend/src/components/doctor/ExamResultModal.tsx` | nhiều dòng | UI | 🟡 Trung bình | Có |
| `frontend/src/services/doctor-appointment.service.ts` | nhiều dòng | Service | 🟡 Trung bình | Có |
| `frontend/src/pages/admin/ManageNotifications/SendNotificationTab.tsx` | nhiều dòng | UI | 🟡 Trung bình | Có — nurse vẫn là 1 nhóm đối tượng nhận thông báo |
| `frontend/src/utils/constants.ts` | nhiều dòng | Constant | 🟡 Trung bình | Có |
| `frontend/src/__tests__/services/{nurse.service.test.ts,schedule.service.test.ts}` | toàn file | Test | 🟡 Trung bình | Có |
| `backend/src/utils/validators.js`, `backend/src/services/notification.service.js` | nhiều dòng | Validation/Service | 🟡 Trung bình | Có |
| `docs/Y tá/*.md` (~40 file), `docs/Bác sĩ/*.md` (nhiều file), `docs/NURSE_DOCTOR_WORKFLOW.md`, `docs/doctor-schedule-*.md`, `docs/reviews/*.md` | — | Tài liệu | 🟢 Thấp (lịch sử, không phải code) | Không bắt buộc xóa nhưng nên đổi trạng thái "archived" nếu Nurse thật sự bị loại bỏ |

**Không phải false-positive**: đã loại các match ngẫu nhiên kiểu `ngay_tao` khớp regex `y_ta` khi kiểm tra thủ công (ví dụ `NewPatientsChart.tsx`, `ReviewTable.tsx`) — các file đó **không** liên quan Nurse.

## 3. Các Model/Schema còn sót

- `NguoiDung` (User): `role` enum vẫn chứa `'nurse'`.
- `NghiPhepYTa`: toàn bộ collection dành riêng cho nghỉ phép y tá — chưa gộp/xóa.
- `LichHen`: field `nurse_id` (copy từ `LichLamViec.nurse_id` lúc đặt lịch) + 2 status `waiting_record`, `waiting_doctor_confirm` gắn liền quy trình y tá nhập hồ sơ → bác sĩ xác nhận.
- `LichLamViec`: field `nurse_id` gán ca làm việc cho y tá (song song với `doctor_id`).
- `TrangThaiPhongKham`, `NhatKyThaoTac`: field liên quan nurse.
- `KetQuaKham`: **không** có field `nurse` trực tiếp (điểm sạch duy nhất tìm thấy ở tầng model khám bệnh), nhưng seed vẫn gán `nguoi_nhap_id`/`nguoi_do_id`/`nguoi_sua_id` = user nurse.

## 4. Các API còn sót

Toàn bộ nhóm `/api/nurse/*` vẫn tồn tại và được bảo vệ bởi `requireRole('nurse')`:

```
GET/POST  /api/nurse/dashboard
GET       /api/nurse/schedule
GET/PATCH /api/nurse/appointments...
GET/POST  /api/nurse/medical-records...
GET       /api/nurse/room-status
GET/POST/PATCH /api/nurse/queue... (bao gồm /queue/checkin)
```

Đây là một luồng check-in **riêng biệt** với luồng check-in của `receptionist`
(`backend/src/controllers/nurse/queue.controller.js` có `checkin()` độc lập với
`backend/src/controllers/receptionist/*`). Điều này còn **mâu thuẫn với rule đã chốt**
trong `.claude/rules/lich-lam-viec-bac-si.md` mục 6: *"Lễ tân & y tá dùng chung 1
service check-in — không mỗi vai trò một luồng."* — hiện tại là 2 luồng riêng, không
chung 1 service. Đây là lỗi kiến trúc tồn tại độc lập với việc xóa Nurse, cần lưu ý
khi xóa: xóa nurse controller không được phá luồng check-in chung nếu sau này hợp nhất.

## 5. Các Route còn sót

- Backend: `router.use('/nurse', nurseRoutes)` tại `backend/src/routes/index.js:24`.
- Frontend: nhánh `<Route path="/nurse" element={<ProtectedRoute roles={['nurse']}><NurseLayout /></ProtectedRoute>}>` với 6 route con (`schedule`, `queue`, `pending-records`, `appointments/:id`, `revisions`) tại `frontend/src/routes/AppRoutes.tsx:147-161`.

## 6. Các Component còn sót

`NurseLayout`, `NurseSidebar`, `NurseHeader`, `NurseDashboard`, `NurseSchedule`,
`NurseQueue`, `NursePendingRecords`, `NurseAppointmentDetail`, `NurseRevisions` —
toàn bộ 9 component/page còn nguyên vẹn, không phải dead code (được import và
route tới trong `AppRoutes.tsx`).

## 7. Các Business Logic còn sót

Đây là phần nghiêm trọng nhất — **luồng "Doctor chờ Nurse" vẫn là logic đang hoạt động**:

- `backend/src/controllers/doctor/appointments.controller.js:440`: *"Muốn sửa hồ sơ đã xác nhận phải qua luồng 'yêu cầu chỉnh sửa' (nurse) đã có sẵn."*
- `backend/src/controllers/doctor/appointments.controller.js:573`: *"...đây là điểm tích hợp doctor–nurse bắt buộc..."*
- Trang `pages/nurse/NursePendingRecords.tsx` + `NurseRevisions.tsx` hiện thực chính xác luồng "Nurse nhập hồ sơ → gửi bác sĩ xác nhận → bác sĩ yêu cầu sửa (revision) → nurse sửa lại".
- Dashboard bác sĩ (`DoctorDashboard.tsx:142-144`) hiển thị **"Y tá hỗ trợ"** lấy từ `overview.y_ta_ho_tro.ho_ten` — đúng dữ liệu bị cấm ở Giai đoạn 8 của yêu cầu audit.
- Trang lịch làm việc bác sĩ (`DoctorSchedule.tsx:164`) hiển thị **"Y tá hỗ trợ: {detail.nurse}"**.

→ Không phải sót vài dòng, đây là **toàn bộ mô hình cộng tác Doctor↔Nurse chưa được refactor sang mô hình Doctor tự làm hết**.

## 8. Các Status cũ còn tồn tại

`LichHen.status` enum (`backend/src/models/LichHen.js:47`) vẫn có:

```
'pending', 'confirmed', 'checked_in', 'in_progress',
'waiting_record', 'waiting_doctor_confirm',
'completed', 'cancelled', 'no_show', 'skipped'
```

`waiting_record` và `waiting_doctor_confirm` là 2 status bị yêu cầu xóa ở Giai đoạn 7
(tương ứng `WAITING_RECORD`/`WAITING_DOCTOR_CONFIRM` trong đề bài) — **vẫn còn nguyên**,
và vẫn được set/đọc trong `nurse/medical-records.controller.js` +
`doctor/appointments.controller.js` (luồng xác nhận/yêu cầu sửa).

`NursePendingStage` (`types/index.ts:1089`) cũng còn nguyên 4 giai đoạn:
`"chua_tao" | "ban_nhap" | "cho_xac_nhan" | "yeu_cau_chinh_sua"` — chính là
`WAITING_DOCTOR_CONFIRM`/`NEED_REVISION` ở dạng tiếng Việt.

## 9. Các Permission/Role còn tồn tại

- `NguoiDung.role` enum: `'nurse'` vẫn là giá trị hợp lệ.
- `Role` TypeScript union (`frontend/src/types/index.ts:4`): `"user" | "doctor" | "admin" | "receptionist" | "nurse"`.
- `requireRole('nurse')` gate toàn bộ `/api/nurse/*` — middleware RBAC coi nurse là role hợp lệ, không có cảnh báo deprecated.
- `ProtectedRoute roles={['nurse']}` ở frontend.
- Trang đăng nhập demo (`Login.tsx:11`) liệt kê tài khoản demo `{ role: 'Y tá', email: 'ducluong140606@gmail.com' }` — tài khoản y tá demo vẫn được quảng bá cho người dùng thử hệ thống.

Điểm sạch duy nhất: **admin sidebar/menu KHÔNG có mục "Quản lý y tá"** — kiểm tra
`frontend/src/routes/adminMenu.ts` và `components/admin/*` không thấy tham chiếu Nurse
thật (chỉ có false-positive từ chuỗi `ngay_tao`).

## 10. Dead Code phát hiện sau Refactor

Chưa refactor nên chưa phát sinh dead code kiểu "sót lại sau khi xóa" — toàn bộ code
Nurse liệt kê ở trên vẫn **đang được dùng chủ động** (không phải orphan). Điểm cần lưu ý
khi refactor thật sự diễn ra:
- `frontend/src/services/nurse.service.ts` + `__tests__/services/nurse.service.test.ts` sẽ thành dead code toàn bộ.
- 6 file route + 6 file controller backend/nurse/* sẽ thành dead code toàn bộ.
- 5 script seed/verify nurse (`seed-nurse-test-data.js`, `seed-khang-nurse-*.js`, `link-nurse-to-khang-data.js`, `verify-khang-nurse-live-flow.js`) sẽ mồ côi.
- `NghiPhepYTa` model sẽ mồ côi nếu không có collection Mongo nào khác tham chiếu.

## 11. Rủi ro nếu triển khai (deploy nguyên trạng, coi như đã "xóa Nurse")

- **Rủi ro nghiệp vụ nghiêm trọng**: hồ sơ khám bệnh (`KetQuaKham`) vẫn phụ thuộc vào
  một actor "nurse" nhập liệu/xác nhận riêng (`waiting_doctor_confirm`) — nếu tài khoản
  nurse bị vô hiệu hóa mà không refactor luồng, **bác sĩ sẽ không có cách tự nhập hồ sơ
  qua route hiện tại `/api/doctor/*`** (cần xác nhận riêng route `doctor` có API nhập
  hồ sơ trực tiếp hay không — hiện chỉ thấy route "xác nhận"/"yêu cầu sửa", chưa thấy
  route bác sĩ tự tạo hồ sơ từ đầu).
- **Rủi ro mất chức năng đặt lịch**: `LichLamViec.nurse_id` gán ca — nếu xóa field mà
  không có migration, các ca cũ mất thông tin phân công, dashboard bác sĩ hiển thị lỗi
  (đọc `nurse_id` null-unsafe cần kiểm tra thêm).
- **Rủi ro UI vỡ**: `DoctorDashboard`/`DoctorSchedule` đang render trực tiếp field
  `nurse`/`y_ta_ho_tro` — xóa backend field mà không sửa frontend sẽ gây hiển thị rỗng
  hoặc lỗi runtime nếu không có optional chaining (hiện có `?? 'Chưa phân công'` nên tạm an toàn).
- **Rủi ro seed/demo**: `seed-all.js` sẽ lỗi nếu xóa role `'nurse'` khỏi enum `NguoiDung`
  mà không sửa script (dòng 208-211, 1031-1168 tạo và dùng user nurse).

## 12. Đánh giá cuối cùng

# ❌ **FAIL**

Nurse **chưa hề được loại bỏ** — hệ thống vẫn phụ thuộc kiến trúc vào Nurse ở cả 4 tầng
(DB schema, API/route, permission/RBAC, UI). Đây là một refactor **chưa bắt đầu**, không
phải "gần xong, còn vài chỗ dọn dẹp". Business logic cốt lõi (luồng Doctor chờ Nurse
nhập hồ sơ → xác nhận → yêu cầu sửa) vẫn nguyên vẹn và là một trong những luồng lớn nhất
của trang bác sĩ hiện tại.

**Đề xuất bước tiếp theo** (không tự thực hiện — cần xác nhận từ người dùng vì đụng tới
nghiệp vụ đã có trong `.claude/rules/lich-lam-viec-bac-si.md`):
1. Xác nhận phạm vi: việc xóa Nurse có mâu thuẫn với rule "Lễ tân & y tá dùng chung 1
   service check-in" đang ghi trong `.claude/rules/` không — rule đó cần được cập nhật
   trước, vì đây là tài liệu quy tắc bất biến đã chốt.
2. Thiết kế migration cho `LichHen.nurse_id`, `LichLamViec.nurse_id`, 2 status
   `waiting_record`/`waiting_doctor_confirm`, và luồng nhập hồ sơ mới hoàn toàn do bác sĩ
   thực hiện (route mới ở `/api/doctor/*` để tạo/kết luận hồ sơ trực tiếp).
3. Xóa toàn bộ 6 route + 6 controller `backend/src/{routes,controllers}/nurse/*`,
   `NurseLayout`/`Nurse*` component & page, `nurse.service.ts`, `nurseMenu.ts`.
4. Cập nhật `Role` enum (backend + frontend) bỏ `'nurse'`.
5. Dọn seed/script nurse-specific, cập nhật `Login.tsx` bỏ tài khoản demo Y tá.
6. Archive (không cần xóa) tài liệu lịch sử `docs/Y tá/*.md` — giữ làm tham chiếu lịch sử,
   không phải action item.
