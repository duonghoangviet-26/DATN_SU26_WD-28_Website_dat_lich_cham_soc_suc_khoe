# Agent Handoff - VitaFamily Admin

## Mục đích

File này là điểm vào nhanh cho AI agent hoặc người mới tiếp quản phần việc admin của VitaFamily.

Mục tiêu:

- nắm đúng phần nào đã làm xong thật
- biết báo cáo nào phải đọc trước
- biết những gì đã PASS bằng test/runtime
- biết phần nào cố ý chưa làm hoặc ngoài phạm vi
- tránh làm lại việc cũ hoặc mở rộng sai hướng

## Đọc theo thứ tự này

1. [admin-refactor-summary.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-summary.md)
2. [admin-refactor-fix-log.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-fix-log.md)
3. [admin-service-specialty-appointment-fix.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-service-specialty-appointment-fix.md)
4. [admin-appointments-deep-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-appointments-deep-audit.md)
5. [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md)
6. [admin-id-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-id-audit.md)
7. [admin-routes-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-routes-audit.md)

Nếu làm tiếp code, chỉ sau khi đọc xong các file trên mới đối chiếu lại code và test hiện tại trong repo.

## Ảnh chụp trạng thái hiện tại

### Khối admin refactor gốc

- 7 domain admin đã được rà và khóa tương đối:
  - `admin/clinics`
  - `admin/specialties`
  - `admin/services`
  - `admin/appointments`
  - `admin/payments`
  - `admin/reviews`
  - `admin/notifications`
- Chuỗi bước refactor admin trước đó đã được tổng hợp lại trong `summary` và `fix-log`.

### Đợt cập nhật mới nhất đã hoàn tất

Đợt mới nhất đã xử lý xong nhóm việc:

- gộp chuyên khoa Tai/Mũi/Họng
- thêm `Nhi khoa`, `Da liễu`
- chuẩn hóa admin CRUD chuyên khoa
- mở rộng `DichVu` để hỗ trợ gói dịch vụ
- seed gói dịch vụ mẫu theo chuyên khoa
- chuẩn hóa admin CRUD dịch vụ có gói
- xác nhận nền dữ liệu đặt hộ gia đình ở mức model/data/admin appointments
- xác nhận `BacSi.tuoi_nhan_kham_tu` tồn tại ở tầng model/data
- test tổng backend + build frontend và ghi báo cáo

Báo cáo chốt của đợt này là:

- [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md)

## Những gì đã PASS thật

### PASS từ đợt admin refactor trước

- backend full suite đã từng PASS cho mốc trước
- frontend admin build PASS
- runtime HTTP/admin route đã được kiểm tra cho các route trong phạm vi
- dashboard admin đã dùng API thật
- các route admin trong phạm vi đã có test auth/token tương ứng

### PASS từ đợt `specialty/service/family`

- `backend npm test`: `89/89 PASS`
- `frontend npm run build`: PASS
- API admin specialties active trả đúng:
  - `Tai Mũi Họng`
  - `Nhi khoa`
  - `Da liễu`
- reference cũ tới các chuyên khoa Tai/Mũi/Họng đã hidden không còn tồn tại ở các collection liên quan đã kiểm
- API admin services hỗ trợ filter `la_goi`
- seed 7 gói dịch vụ mẫu đã tồn tại đúng chuyên khoa
- admin UI đã tạo/sửa được gói dịch vụ với:
  - `la_goi`
  - `doi_tuong_ap_dung`
- admin appointments đã hiển thị tách biệt:
  - người được khám
  - người đặt hộ

## File code chính đã thay đổi ở đợt mới nhất

- `backend/src/models/DichVu.js`
- `backend/src/controllers/admin/services.controller.js`
- `backend/src/controllers/admin/appointment.controller.js`
- `frontend/src/types/index.ts`
- `frontend/src/services/service.service.ts`
- `frontend/src/components/admin/services/ServiceFormModal.tsx`
- `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`

## Script đã thêm ở đợt mới nhất

- `backend/scripts/admin/step1-merge-ent-specialties.js`
- `backend/scripts/admin/step2-seed-new-specialties.js`
- `backend/scripts/admin/step4-backfill-service-package-fields.js`
- `backend/scripts/admin/step5-seed-package-services.js`

## Phạm vi ngoài scope, chưa được phép hiểu nhầm là đã xong

- `backend/src/routes/doctor.routes.js`
- `backend/src/controllers/doctor.controller.js`
- `frontend/src/pages/admin/ManageDoctor*`
- patient/client booking UI
- user management
- y tá
- lễ tân

Lưu ý rất quan trọng:

- Bước 8 chỉ xác nhận `BacSi.tuoi_nhan_kham_tu` ở tầng model/data.
- Không có nghĩa `ManageDoctors` đã được làm.
- Bước 7 chỉ dựng nền dữ liệu đặt hộ gia đình và admin hiển thị đúng.
- Không có nghĩa UI đặt lịch phía khách hàng đã được triển khai.

## 4 tồn đọng cũ vẫn còn giữ nguyên

Đây là 4 mục đã được chốt trong summary cũ, chưa được đánh dấu hoàn tất:

1. `doctor.routes.js` vẫn thiếu `verifyToken` và `requireRole('admin')`
2. `doctor.controller.js` vẫn nhận `admin_id` từ body
3. `ManageDoctors` frontend chưa được dọn theo chuẩn refactor hiện tại
4. domain quản trị người dùng/y tá/lễ tân chưa được xử lý trong lộ trình này

## Những gì tuyệt đối không được hiểu sai

- Không được nói toàn bộ admin của dự án đã refactor xong.
- Không được nói domain doctor đã hoàn tất.
- Không được coi docs là nguồn duy nhất nếu code đã đổi tiếp sau thời điểm viết báo cáo.
- Không được bỏ qua `admin-refactor-fix-log.md` khi cần hiểu vì sao một bước từng FAIL rồi mới PASS.

## Nếu agent khác vào làm tiếp ngay

### Checklist khởi động

1. Đọc `agent-handoff.md` này.
2. Đọc `admin-refactor-summary.md`.
3. Đọc `admin-refactor-fix-log.md`.
4. Đọc báo cáo đúng domain mình sắp chạm:
   - `admin-service-specialty-appointment-fix.md`
   - `admin-appointments-deep-audit.md`
   - `specialty-service-family-update.md`
5. Kiểm tra `git status` để phân biệt file đã sửa với file đang dở.
6. Đối chiếu lại code thật trước khi kết luận docs còn đúng 100%.
7. Giữ kỷ luật `test -> sửa -> pass -> bước tiếp theo`.

### Nếu tiếp tục nhánh `specialty/service/family`

Ưu tiên đọc:

- [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md)

Sau đó kiểm tra nhanh:

- `backend/src/models/DichVu.js`
- `backend/src/controllers/admin/services.controller.js`
- `backend/src/controllers/admin/appointment.controller.js`
- `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`

### Nếu tiếp tục nhánh `appointments`

Ưu tiên đọc:

- [admin-appointments-deep-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-appointments-deep-audit.md)

Vì đây là báo cáo gần nhất mô tả kỹ rủi ro và hành vi thực tế của luồng lịch hẹn admin.

## Quy ước làm tiếp

- chỉ đánh PASS khi có output test/runtime thật
- nếu FAIL phải quay lại nguyên nhân gốc
- không nhảy cóc bước
- không tự mở rộng phạm vi nếu chưa chốt rõ
- sau mỗi đợt sửa đủ lớn phải cập nhật lại `docs/reviews`

## Thứ tự ưu tiên khi có mâu thuẫn thông tin

1. code và test hiện tại trong repo
2. `docs/reviews/admin-refactor-fix-log.md`
3. `docs/reviews/specialty-service-family-update.md`
4. `docs/reviews/admin-refactor-summary.md`
5. trao đổi cũ trong hội thoại

## Gợi ý câu mở đầu cho agent mới

Nếu muốn vào làm tiếp đúng mạch, nên bắt đầu bằng việc tự xác nhận:

- mình đang tiếp quản nhánh nào
- phạm vi hiện tại có bao gồm doctor hay không
- cần tiếp tục theo roadmap cũ hay theo báo cáo `specialty-service-family-update`
- tiêu chí PASS của bước sắp làm là gì

Sau đó mới sửa code.
