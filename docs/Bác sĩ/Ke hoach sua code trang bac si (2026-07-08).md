# Kế hoạch sửa code — Trang Bác sĩ

> **Cho người thực thi:** Thực hiện từng Phase theo đúng thứ tự, mỗi Phase là 1 lần commit/PR riêng. Dùng checkbox (`- [ ]`) để theo dõi tiến độ trong từng Phase.

**Mục tiêu:** Sửa trang bác sĩ (`/doctor/*`) cho đúng nghiệp vụ đã audit, theo từng bước nhỏ, không đụng admin/patient/nurse nếu không bắt buộc.

**Dựa trên:** 12 file audit trong `docs/Bác sĩ/Audit - *.md` (2026-07-08). Mỗi Phase dưới đây dẫn lại đúng file audit làm căn cứ — không lặp lại phân tích, chỉ tóm tắt việc cần làm.

**Chưa sửa code nào ở bước này — đây là kế hoạch, không phải thực thi.**

## Ràng buộc chung (áp dụng cho mọi Phase)

- Chỉ sửa file trong phạm vi trang bác sĩ: `frontend/src/pages/doctor/*`, `components/doctor/*`, `layouts/DoctorLayout.tsx`, `services/doctor-*.service.ts` + `schedule.service.ts` + `examination.service.ts`, phần `Doctor*` trong `types/index.ts`, `routes/doctorMenu.ts`, khối `/doctor` trong `routes/AppRoutes.tsx`, `backend/src/routes/doctor/*`, `backend/src/controllers/doctor/*`.
- Giữ nguyên quy ước hiện tại của dự án: viết đầy đủ backend route/controller thật, nhưng **frontend service vẫn trả mock data** kèm comment `// Real API` — khớp cách 4 service doctor hiện tại đang làm (xem `Audit - Service va API trang bac si`). Không tự ý bật API thật cho UI ở bất kỳ Phase nào trừ khi được yêu cầu riêng.
- Mỗi Phase chỉ sửa đúng 1 nhóm chức năng — không gộp 2 Phase vào 1 lần sửa.
- Không refactor toàn dự án, không đổi tên API/route dùng chung, không sửa `axiosInstance.ts`/`AuthContext.tsx`/`auth.middleware.js`.
- 2 model dùng chung bị đụng tới (`KetQuaKham.js` ở Phase 6, `NghiPhepBacSi.js` ở Phase 8) chỉ được sửa theo kiểu **thêm field/enum mới (additive)**, không đổi/xóa field cũ — xem phần Rủi ro cuối tài liệu.
- **"Y tá hỗ trợ"** xuất hiện lặp lại trong nhiều yêu cầu (Dashboard, Lịch làm việc, Danh sách/Chi tiết lịch hẹn) nhưng **bị loại khỏi toàn bộ kế hoạch này** — việc gán y tá vào ca/lịch hẹn là quyết định thuộc admin + cần thiết kế module y tá (ngoài phạm vi "chỉ trang bác sĩ" theo đúng yêu cầu). Đề xuất: làm thành 1 kế hoạch riêng sau khi module y tá được xác định.

---

### Phase 1: Route và layout doctor

**Căn cứ:** `Audit - Route va phan quyen trang bac si`

**Kết luận từ audit: không có lỗi cần sửa.** Route (`/doctor`, `/doctor/appointments`, `/doctor/schedule`, `/doctor/profile`), layout (`DoctorLayout.tsx`), guard 2 lớp (`ProtectedRoute` + `requireRole('doctor')`) đều đúng chuẩn, không lẫn admin.

- [ ] Không có việc gì để sửa ở Phase này. Chỉ cần bổ sung route mới **khi các Phase sau cần** (Phase 6/7 thêm `/doctor/medical-records/pending`, Phase 8 thêm `/doctor/leave-requests`) — sẽ ghi rõ trong từng Phase đó, không làm trước ở đây.

**File sẽ sửa:** Không có.

**Rủi ro:** Không có.

---

### Phase 2: Dashboard bác sĩ

**Căn cứ:** `Audit - Dashboard bac si`

**Việc cần làm:**
1. Thêm `.catch()` cho `Promise.all([getStats(), getReviews()])` — hiện lỗi API bị nuốt lặng lẽ, ưu tiên cao vì rẻ và đang "làm hỏng luồng" theo đúng tinh thần ưu tiên bạn nêu.
2. Thêm API "tổng quan hôm nay" (ca làm việc, phòng khám hôm nay, tổng lịch hẹn hôm nay, đếm theo trạng thái chờ khám/đang khám/hoàn thành, danh sách lịch hẹn gần nhất) — mở rộng `stats.controller.js`, không cần file mới.
3. Thêm block "Thông tin hôm nay" lên đầu `DoctorDashboard.tsx`, giữ nguyên phần thống kê hành nghề hiện có ở dưới.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `backend/src/controllers/doctor/stats.controller.js` | Thêm hàm/field trả dữ liệu "hôm nay" (truy vấn `LichLamViec` + `LichHen` lọc theo `doctor_id` + ngày hôm nay) |
| `frontend/src/services/doctor-profile.service.ts` | Thêm hàm gọi API mới (mock trước), thêm `.catch()` không áp dụng ở service — sửa ở page |
| `frontend/src/pages/doctor/DoctorDashboard.tsx` | Thêm `.catch()`, thêm block "hôm nay", sắp xếp lại bố cục |
| `frontend/src/types/index.ts` | Thêm type `DoctorDashboardOverview` (chỉ phần `Doctor*`) |
| `frontend/src/mock/doctor-stats.ts` | Thêm mock data "hôm nay" |

**Rủi ro:** Không có — toàn bộ file chỉ doctor page dùng, đã xác nhận ở `Audit - Service va API trang bac si` mục 3.

---

### Phase 3: Lịch làm việc bác sĩ

**Căn cứ:** `Audit - Lich lam viec bac si`, `Audit - Logic 6 ngay lam viec`, `Audit - Bao mat du lieu trang bac si`

**Việc cần làm:**
1. Bỏ khả năng bác sĩ tự gán phòng khám: xóa nhánh xử lý `phong_kham` trong `updateSlot` (backend) + xóa modal "Chọn phòng khám" (frontend).
2. Bỏ khả năng bác sĩ tự khóa/mở ca tức thời: xóa nhánh xử lý `status` active↔locked trong `updateSlot` (backend) + xóa nút "Tạm nghỉ"/"Mở lại" (frontend). **Chưa thay thế bằng gì ở Phase này** — nút thay thế "Gửi yêu cầu xin nghỉ" sẽ nối vào ở Phase 8 sau khi có API xin nghỉ. Trong lúc chờ Phase 8, chấp nhận tạm thời không có cách nào để bác sĩ báo bận qua trang lịch làm việc — đây là đánh đổi ngắn hạn hợp lý vì bỏ 1 chức năng sai còn hơn giữ nó chạy sai.
3. Giữ nguyên nút "Yêu cầu hủy" (đã đúng chuẩn, không đổi).
4. Thêm hàm lọc hiển thị "tối đa 6 ngày làm việc gần nhất" (bỏ Chủ nhật, bỏ ngày đã qua, cắt 6) ở tầng frontend page — không đụng `scheduleGenerator.service.js`.
5. Truyền `from`/`to` khi gọi `scheduleService.getAll()` thay vì tải hết.
6. Thêm `.catch()` cho tải dữ liệu ban đầu.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `backend/src/controllers/doctor/schedule.controller.js` | Xóa nhánh set `phong_kham`/`status` trong `updateSlot` — đóng lỗ hổng vượt quyền đã xác nhận ở `Audit - Bao mat du lieu` |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Xóa modal chọn phòng, xóa nút Tạm nghỉ/Mở lại, thêm hàm lọc 6 ngày, thêm `.catch()`, truyền `from`/`to` |
| `frontend/src/services/schedule.service.ts` | Xóa `updatePhongKham()`, `lockSlot()`, `unlockSlot()` (không còn nơi gọi sau khi sửa UI) |
| `frontend/src/mock/doctor-schedule.ts` | Không cần sửa — mock đã tự sinh đúng 6 ngày sẵn (xem `Audit - Logic 6 ngay lam viec` mục 1), chỉ cần đảm bảo không có mock nào dựa vào 2 hành động vừa xóa |

**Rủi ro:**
- `mock/rooms.ts` bị **bỏ import** khỏi `DoctorSchedule.tsx` (không sửa file `rooms.ts`, chỉ ngừng dùng ở trang bác sĩ) — không ảnh hưởng ai khác vì file này chỉ được doctor page import (đã xác nhận ở `Audit - Service va API trang bac si`).
- Bác sĩ tạm thời mất khả năng "báo bận" cho tới khi Phase 8 xong — nếu đây là vấn đề với người dùng thực tế/demo, có thể đảo thứ tự làm Phase 8 trước Phase 3, hoặc gộp 2 Phase làm cùng lúc. Nêu ra để bạn quyết định trước khi thực thi.

---

### Phase 4: Danh sách lịch hẹn

**Căn cứ:** `Audit - Danh sach lich hen bac si`

**Việc cần làm:**
1. Thêm option `completed` vào dropdown lọc trạng thái + sửa type `filterStatus`.
2. Truyền `status`/`date` khi gọi `doctorAppointmentService.getAll()` thay vì tải hết rồi lọc client-side — **lưu ý**: backend `list()` hiện chỉ hỗ trợ lọc theo `date` chính xác 1 ngày, không hỗ trợ khoảng ngày (`from`/`to`) như bên lịch làm việc, nên các tab "Sắp tới"/"Đã qua" vẫn cần lọc client-side trên tập dữ liệu đã giới hạn hợp lý (ví dụ chỉ tải trong khoảng vài tuần) — nếu muốn lọc hoàn toàn ở server cho các tab này thì cần thêm `from`/`to` vào `list()` (việc phụ, có thể làm hoặc bỏ qua tùy mức ưu tiên).
3. Thêm `.catch()` cho tải dữ liệu ban đầu.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Thêm option `completed`, truyền tham số khi gọi `getAll()`, thêm `.catch()` |
| `frontend/src/services/doctor-appointment.service.ts` | Không bắt buộc sửa nếu chỉ dùng tham số đã có sẵn (`status`, `date`) |
| `frontend/src/types/index.ts` | Sửa type `filterStatus` (nội bộ trong page, không phải type export — có thể không cần sửa file `types/index.ts`) |
| `backend/src/controllers/doctor/appointments.controller.js` | (Tùy chọn) thêm hỗ trợ `from`/`to` cho `list()` nếu quyết định làm mục 2 đầy đủ |

**Rủi ro:** Không có — toàn bộ file chỉ doctor page dùng.

---

### Phase 5: Chi tiết lịch hẹn

**Căn cứ:** `Audit - Chi tiet lich hen bac si`

**Việc cần làm:**
1. Sửa bug hiển thị giới tính — tách điều kiện khỏi `tuoi !== undefined`.
2. Thêm "Mã lịch hẹn" vào khối chi tiết (dùng `appt.id`, chỉ cần hiển thị, không cần đổi kiểu dữ liệu).
3. Thêm "Chuyên khoa" — backend join thêm từ dịch vụ/bác sĩ liên quan vào `formatAppointment()` (chỉ đọc dữ liệu có sẵn, không sửa schema).
4. **Không** xây route `/doctor/appointments/:id` riêng ở Phase này — giữ nguyên dạng expand-row hiện có để tránh phình phạm vi (YAGNI); có thể làm sau như 1 Phase phụ nếu thật sự cần deep-link.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Sửa bug giới tính, thêm hiển thị mã lịch hẹn + chuyên khoa trong khối expand-row |
| `backend/src/controllers/doctor/appointments.controller.js` | Bổ sung field `chuyen_khoa` vào `formatAppointment()` (đọc từ `DichVu`/`BacSi.specialties` có sẵn, không sửa model) |
| `frontend/src/types/index.ts` | Thêm field `chuyen_khoa` vào `DoctorAppointmentDetail` |

**Rủi ro:** Không có — chỉ đọc thêm dữ liệu có sẵn từ model dùng chung (`DichVu`), không sửa model đó.

---

### Phase 6: Hồ sơ chờ xác nhận

**Căn cứ:** `Audit - Ho so kham bac si`, `Audit - Type va interface trang bac si`

⚠️ **Lưu ý quan trọng trước khi làm Phase này:** Phase 6 và Phase 7 phụ thuộc chặt vào nhau (danh sách "chờ xác nhận" cần field `status` mà Phase 7 mới thêm hành động dùng tới) — khuyến nghị làm gộp 2 Phase liên tiếp nhau, không tách rời quá xa. Ngoài ra: **không có module y tá** (đúng theo yêu cầu không sửa), nên chưa có ai tạo được bản ghi ở trạng thái "chờ xác nhận" trong thực tế cho tới khi module y tá được xây riêng — Phase này chuẩn bị sẵn phần phía bác sĩ (model + API + UI), nhưng sẽ chưa "chạy được đầu-cuối" cho tới khi có module y tá.

**Việc cần làm:**
1. Thêm field `status` vào model `KetQuaKham` (enum: `draft`/`waiting_doctor_confirm`/`confirmed`/`need_revision`) — **additive**, không đổi field cũ.
2. Set `bac_si_phu_trach_id` khi tạo hồ sơ (đóng luôn rủi ro tiềm ẩn đã nêu ở `Audit - Bao mat du lieu` mục 3).
3. Thêm route `GET /api/doctor/appointments/:id/result` mở rộng trả thêm `status` (đã có endpoint, chỉ thêm field).
4. Thêm route mới `GET /api/doctor/medical-records/pending` — danh sách hồ sơ `status: waiting_doctor_confirm` thuộc bác sĩ đăng nhập.
5. Trang mới `/doctor/medical-records/pending`.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `backend/src/models/KetQuaKham.js` | Thêm field `status` (additive) — **file dùng chung**, xem Rủi ro |
| `backend/src/controllers/doctor/appointments.controller.js` | `createResult` set thêm `bac_si_phu_trach_id`, `status` |
| `backend/src/controllers/doctor/medical-records.controller.js` *(mới)* | Controller cho danh sách hồ sơ chờ xác nhận |
| `backend/src/routes/doctor/medical-records.routes.js` *(mới)* | Route tương ứng |
| `backend/src/routes/doctor/index.js` | Mount router mới (thêm 1 dòng) |
| `frontend/src/pages/doctor/DoctorPendingRecords.tsx` *(mới)* | Trang danh sách hồ sơ chờ xác nhận |
| `frontend/src/services/examination.service.ts` | Thêm hàm `getPendingRecords()` |
| `frontend/src/types/index.ts` | Thêm `status` vào `ExaminationResult` (hoặc type `DoctorMedicalRecord` mới như đề xuất ở `Audit - Type va interface`) |
| `frontend/src/routes/AppRoutes.tsx` | Thêm route `/doctor/medical-records/pending` |
| `frontend/src/routes/doctorMenu.ts` | Thêm mục menu |
| `frontend/src/mock/examinations.ts` | Thêm `status` vào mock data |

**Rủi ro:**
- `KetQuaKham.js` **là model dùng chung** — `backend/src/controllers/admin/medical-read.controller.js` đọc collection này (chỉ đọc, không ghi). Thêm field mới không phá field cũ, về lý thuyết an toàn — nhưng **nên báo trước cho người phụ trách phần admin/hồ sơ y tế** trước khi merge, vì cùng chạm 1 model.

---

### Phase 7: Xác nhận hồ sơ / yêu cầu chỉnh sửa

**Căn cứ:** `Audit - Ho so kham bac si`, `Audit - UI trang thai trang bac si`

**Việc cần làm:**
1. Thêm route `PATCH /api/doctor/appointments/:id/result/confirm` — set `status: confirmed`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`; chỉ cho phép khi `status` hiện tại là `waiting_doctor_confirm`.
2. Thêm route `PATCH /api/doctor/appointments/:id/result/request-revision` — bắt buộc body `ghi_chu`, set `status: need_revision`.
3. Trong `ExamModal` (`DoctorAppointments.tsx`): thêm nút "Xác nhận" + "Yêu cầu chỉnh sửa" (chỉ hiện khi `status === 'waiting_doctor_confirm'`), thêm ô nhập lý do bắt buộc cho yêu cầu chỉnh sửa, thêm confirm dialog trước cả 2 hành động (đúng yêu cầu UI trạng thái #6/#7).
4. Chặn bác sĩ sửa trực tiếp nội dung `chan_doan` khi hồ sơ đến từ luồng y tá (readonly khi có `nguoi_nhap_id` khác `null`) — giữ nguyên khả năng tự viết hiện tại **chỉ khi chưa có module y tá** (tương thích ngược).

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `backend/src/controllers/doctor/appointments.controller.js` (hoặc `medical-records.controller.js` từ Phase 6) | Thêm 2 handler confirm/request-revision |
| `backend/src/routes/doctor/appointments.routes.js` | Thêm 2 route |
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Thêm nút, ô lý do, confirm dialog trong `ExamModal` |
| `frontend/src/services/examination.service.ts` | Thêm `confirmMedicalRecord(id)`, `requestMedicalRecordRevision(id, note)` |
| `frontend/src/mock/examinations.ts` | Cập nhật mock phản ánh hành vi confirm/revision |

**Rủi ro:** Không có file dùng chung mới ngoài `KetQuaKham.js` đã nêu ở Phase 6.

---

### Phase 8: Xin nghỉ bác sĩ

**Căn cứ:** `Audit - Xin nghi bac si`

**Việc cần làm:**
1. Thêm `da_huy` vào enum `trang_thai` của `NghiPhepBacSi` — **additive**.
2. Route mới `GET/POST /api/doctor/leave-requests`, `PATCH /api/doctor/leave-requests/:id/cancel` (chỉ hủy khi `trang_thai === 'cho_duyet'`, chỉ chủ sở hữu).
3. Trang mới `/doctor/leave-requests`: form (ngày, ca, lý do bắt buộc, validate không chọn ngày quá khứ, validate không trùng yêu cầu), danh sách + trạng thái, nút hủy khi còn PENDING.
4. Nối lại Phase 3: thêm nút "Gửi yêu cầu xin nghỉ" trong `DoctorSchedule.tsx` trỏ sang trang mới, thay cho 2 nút đã xóa ở Phase 3.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `backend/src/models/NghiPhepBacSi.js` | Thêm `da_huy` vào enum — **file dùng chung**, xem Rủi ro |
| `backend/src/controllers/doctor/leave.controller.js` *(mới)* | List/create/cancel, scope theo `bac_si_id` từ JWT |
| `backend/src/routes/doctor/leave.routes.js` *(mới)* | Route tương ứng |
| `backend/src/routes/doctor/index.js` | Mount router mới (thêm 1 dòng) |
| `frontend/src/pages/doctor/DoctorLeaveRequests.tsx` *(mới)* | Trang xin nghỉ |
| `frontend/src/services/leave-request.service.ts` *(mới)* | Service mới |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Thêm nút liên kết sang trang xin nghỉ |
| `frontend/src/types/index.ts` | Thêm `DoctorLeaveRequest` |
| `frontend/src/routes/AppRoutes.tsx` | Thêm route |
| `frontend/src/routes/doctorMenu.ts` | Thêm mục menu |
| `frontend/src/mock/leave-requests.ts` *(mới)* | Mock data |

**Rủi ro:**
- `NghiPhepBacSi.js` **là model dùng chung** — `backend/src/controllers/admin/doctor-leaves.controller.js` dùng cùng model (approve/reject). Đã kiểm tra: hàm `formatDoctorLeave` phía admin trả thẳng `trang_thai` không qua switch-case đóng, nên thêm 1 giá trị enum mới **không làm hỏng code admin hiện có** — nhưng vẫn nên báo trước cho người phụ trách phần admin duyệt nghỉ.

---

### Phase 9: Profile bác sĩ

**Căn cứ:** `Audit - Ra soat trang bac si` mục 5

⚠️ **Ghi chú ưu tiên:** Đây là bug độc lập (không phụ thuộc Phase nào khác), đang **chặn build** (3 lỗi TypeScript đã xác nhận bằng `tsc --noEmit`, trang treo trắng khi vào `/doctor/profile`). Có thể cân nhắc làm sớm hơn vị trí #9 nếu muốn — không bắt buộc theo đúng thứ tự đã cho, chỉ nêu ra để bạn quyết định.

**Việc cần làm:**
1. Sửa `DoctorProfile.tsx` dòng 31: đổi destructure cho khớp shape phẳng mà `doctorProfileService.get()` thực sự trả về (không phải `{ profile, tieu_su }`).
2. Thêm hàm `submitForReview()` vào `doctor-profile.service.ts` (đang bị gọi nhưng không tồn tại).
3. Sửa `profile.phi_tu_van` → `profile.gia_kham` (đúng tên field trong type `DoctorProfile`).

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `frontend/src/pages/doctor/DoctorProfile.tsx` | Sửa 3 lỗi TS đã xác nhận |
| `frontend/src/services/doctor-profile.service.ts` | Thêm `submitForReview()` |

**Rủi ro:** Không có — 2 file này chỉ doctor page dùng. **Lưu ý riêng:** `DoctorProfile` (type) bị admin dùng chung ở `pages/admin/ManageServiceSpecialtyDetail.tsx` (đã ghi ở `Audit - Type va interface`) — nhưng Phase này **không sửa type**, chỉ sửa cách `DoctorProfile.tsx` (page) tiêu thụ type đã có, nên không ảnh hưởng admin.

---

### Phase 10: Dọn code thừa trong doctor page

**Căn cứ:** `Audit - Lich lam viec bac si`, `Audit - Service va API trang bac si`

**Việc cần làm:**
1. Xóa `create()` và `deleteSchedule()` khỏi `schedule.service.ts` (dead code, không route backend nào tương ứng, không nơi nào gọi sau Phase 3).
2. (Tùy chọn) Đổi tên `schedule.service.ts` → `doctor-schedule.service.ts`, `examination.service.ts` → `doctor-examination.service.ts` cho nhất quán tiền tố — chỉ 2 nơi import cần sửa theo (`DoctorSchedule.tsx`, `DoctorAppointments.tsx`), đã xác nhận không ai khác dùng.
3. Sửa lại 2 file test đang lỗi biên dịch: `src/__tests__/services/doctor-appointment.service.test.ts`, `src/__tests__/services/schedule.service.test.ts` (tham số `tab` không tồn tại, gọi `cancelSlot` tên cũ, kiểu `number`/`string` sai) — cập nhật theo signature thật hiện tại.

**File sẽ sửa:**
| File | Lý do |
|---|---|
| `frontend/src/services/schedule.service.ts` | Xóa dead code |
| `frontend/src/services/schedule.service.ts` → `doctor-schedule.service.ts` (nếu đổi tên) | Nhất quán naming |
| `frontend/src/services/examination.service.ts` → `doctor-examination.service.ts` (nếu đổi tên) | Nhất quán naming |
| `frontend/src/pages/doctor/DoctorSchedule.tsx`, `DoctorAppointments.tsx` | Cập nhật đường dẫn import nếu đổi tên file |
| `frontend/src/__tests__/services/doctor-appointment.service.test.ts` | Sửa lỗi biên dịch, khớp lại signature |
| `frontend/src/__tests__/services/schedule.service.test.ts` | Sửa lỗi biên dịch, khớp lại signature |

**Rủi ro:**
- Đổi tên file (`schedule.service.ts`, `examination.service.ts`) là thao tác dễ gây **merge conflict** nếu có thành viên khác đang sửa song song 2 file này ở nhánh khác — nên hỏi trước khi đổi tên, hoặc làm Phase này sau cùng khi các nhánh khác đã merge xong. Có thể bỏ qua bước đổi tên (mục 2) nếu rủi ro conflict cao hơn lợi ích, chỉ cần làm mục 1 và 3.

---

## Danh sách file TUYỆT ĐỐI KHÔNG được đụng

| File/thư mục | Lý do |
|---|---|
| `backend/src/routes/doctor.routes.js`, `backend/src/controllers/doctor.controller.js` | Đây là API **admin quản lý bác sĩ** (`/api/admin/doctors`), trùng tên "doctor" nhưng khác hoàn toàn phạm vi — dễ sửa nhầm |
| `backend/src/routes/admin/**`, `backend/src/controllers/admin/**` (toàn bộ) | Thuộc phạm vi admin, kể cả `admin/doctor-leaves.*` (duyệt nghỉ) và `admin/slots.controller.js` |
| `backend/src/services/scheduleGenerator.service.js` | Sinh lịch làm việc — thuộc admin/hệ thống, đúng nghiệp vụ không cho bác sĩ tự tạo lịch |
| `backend/src/cron/*` | Chạy nền cho toàn hệ thống, không riêng bác sĩ |
| `frontend/src/pages/admin/**`, `frontend/src/pages/client/**` | Ngoài phạm vi |
| `frontend/src/services/doctor.service.ts` | Service admin/client dùng để quản lý/duyệt/xem danh sách bác sĩ — khác với `doctor-profile.service.ts`/`doctor-appointment.service.ts` |
| `frontend/src/mock/rooms.ts`, `frontend/src/mock/doctors.ts` | Mock dùng chung, chỉ đọc không sửa |
| `frontend/src/services/axiosInstance.ts`, `frontend/src/context/AuthContext.tsx`, `backend/src/middlewares/auth.middleware.js` | Auth/axios chung toàn hệ thống, không có lý do nào trong kế hoạch này cần sửa |
| `frontend/src/pages/auth/Login.tsx` | File chung mọi role — gap nhỏ đã ghi ở `Audit - Route va phan quyen` (nhánh `else` thiếu kiểm tra `from.startsWith`) **không nằm trong kế hoạch này**, cần xử lý riêng ngoài phạm vi trang bác sĩ nếu muốn sửa |
| Mọi file/module y tá (chưa tồn tại) | Không tự tạo module y tá trong kế hoạch này — Phase 6/7 chỉ chuẩn bị phần phía bác sĩ |

## Tổng hợp rủi ro ảnh hưởng thành viên khác

| Rủi ro | Phase | Mức độ | Cách giảm thiểu |
|---|---|---|---|
| `KetQuaKham.js` thêm field `status`, `bac_si_phu_trach_id` | 6 | Thấp (additive) | Báo trước cho người phụ trách `admin/medical-read.controller.js` |
| `NghiPhepBacSi.js` thêm `da_huy` vào enum | 8 | Thấp (additive, đã xác nhận admin không có switch-case đóng) | Báo trước cho người phụ trách `admin/doctor-leaves.controller.js` |
| `routes/doctor/index.js` mount thêm router | 6, 8 | Rất thấp | Chỉ thêm dòng mới, không sửa dòng cũ |
| Đổi tên `schedule.service.ts`/`examination.service.ts` | 10 | Trung bình (merge conflict) | Hỏi trước, hoặc làm sau cùng khi nhánh khác đã merge, hoặc bỏ qua bước này |
| Bỏ nút tự khóa/mở ca ở Phase 3 trước khi Phase 8 có nút thay thế | 3 | Trung bình (UX tạm thời) | Cân nhắc gộp Phase 3+8 nếu có người dùng thực tế/demo đang phụ thuộc |

## Trạng thái thực hiện

Đây là **kế hoạch**, chưa thực thi Phase nào. Khi bắt đầu thực thi, làm từng Phase một, dừng lại xin xác nhận trước khi sang Phase tiếp theo — đúng nguyên tắc "không trộn nhiều chức năng trong 1 lần sửa" đã thống nhất từ đầu.

---

## Liên quan

Toàn bộ audit làm căn cứ cho kế hoạch này, cùng thư mục `docs/Bác sĩ/`:
`Audit - Ra soat trang bac si`, `Audit - Route va phan quyen trang bac si`, `Audit - Dashboard bac si`, `Audit - Lich lam viec bac si`, `Audit - Danh sach lich hen bac si`, `Audit - Chi tiet lich hen bac si`, `Audit - Ho so kham bac si`, `Audit - Xin nghi bac si`, `Audit - Logic 6 ngay lam viec`, `Audit - Service va API trang bac si`, `Audit - Type va interface trang bac si`, `Audit - UI trang thai trang bac si`, `Audit - Bao mat du lieu trang bac si` (tất cả `(2026-07-08).md`).
