# Specialty, Service, Family Data Update

## Phạm vi đã làm

- Chỉ xử lý `model + MongoDB data + admin controller + admin frontend`.
- Không đụng `patient/client booking UI`.
- Không sửa `doctor.routes.js`, `doctor.controller.js`, `ManageDoctors`.
- Không xử lý y tá, lễ tân ngoài các phần test/admin route đã có sẵn trong suite.

## Kết quả theo bước

### Bước 1 — Gộp 3 chuyên khoa Tai/Mũi/Họng

- Chọn chuyên khoa gốc:
  - `_id=0000000000000000000000c9`
  - đổi tên thành `Tai Mũi Họng`
  - slug `tai-mui-hong`
- Đã dồn toàn bộ reference từ các ID cũ:
  - `0000000000000000000000ca` (`Mui`)
  - `0000000000000000000000cb` (`Hong`)
  - `0000000000000000000000cc` (`Tai Mui Hong tong quat`)
- Đã update reference ở:
  - `LichHen.specialty_id`
  - `BacSi.specialties[]`
  - `DichVu.specialty_id`
  - `HoaDon.specialty_id`
  - `LichLamViec.slots[].specialty_id`
- Đã set `status='hidden'` cho 3 document dư, không xóa vật lý.

PASS:

- Không còn record nào trỏ về 3 ID đã hidden ở các bảng liên quan phía trên.
- API `GET /api/admin/specialties?status=active` trả đúng 1 chuyên khoa active: `Tai Mũi Họng`.

### Bước 2 — Thêm `Nhi khoa`, `Da liễu`

- Đã seed:
  - `Nhi khoa` — `_id=6a4f248b46348ea59d0accb6`
  - `Da liễu` — `_id=6a4f248b46348ea59d0accba`
- Cả hai đều `status='active'`.

PASS:

- API admin specialties active trả đúng 3 mục:
  - `Tai Mũi Họng`
  - `Nhi khoa`
  - `Da liễu`

### Bước 3 — Admin CRUD chuyên khoa

- Rà lại `backend/src/controllers/admin/specialties.controller.js` và cụm `ManageClinics/*`.
- Không còn logic hardcode giả định 3 khoa `Tai/Mũi/Họng` tách rời ở phần admin specialties.
- Không cần sửa thêm logic CRUD chuyên khoa.

PASS runtime/UI:

- Đăng nhập admin thật trên frontend admin.
- Tạo 1 chuyên khoa test qua UI thành công.
- Sửa chuyên khoa test qua UI thành công.
- Ẩn chuyên khoa test qua UI thành công.
- Tab `Đã ẩn` cập nhật đúng ngay sau thao tác.

### Bước 4 — Thêm field gói dịch vụ vào `DichVu`

- Đã thêm vào model `backend/src/models/DichVu.js`:
  - `la_goi: Boolean, default false`
  - `doi_tuong_ap_dung: String | null`
- Giá trị hợp lệ cho `doi_tuong_ap_dung`:
  - `tre_em`
  - `nguoi_lon`
  - `gia_dinh`
  - `khong_gioi_han`
- Đã bổ sung đồng bộ counter `ma_dich_vu` để tránh phát lại `DV001/DV002` khi counter cũ bị lệch.

PASS:

- Dịch vụ cũ đọc lại có `la_goi=false`.
- Tạo dịch vụ mới với `la_goi=true`, `doi_tuong_ap_dung='gia_dinh'` lưu và đọc lại đúng.

### Bước 5 — Seed gói dịch vụ mẫu

- Đã seed 7 gói `la_goi=true`, `status='active'`, `loai='related'`:

Tai Mũi Họng:

- `Khám sức khỏe đầu năm học trẻ em`
- `Chăm sóc giọng nói`
- `Tầm soát viêm mũi xoang theo mùa`
- `Khám định kỳ người cao tuổi`
- `Gói gia đình theo năm`

Nhi khoa:

- `Khám tổng quát trẻ kết hợp TMH`

Da liễu:

- `Theo dõi định kỳ da liễu cơ bản`

PASS:

- API admin services với filter `la_goi=true` trả đúng 7 gói.
- `specialty_id` của từng gói khớp đúng chuyên khoa đã seed.

### Bước 6 — Admin CRUD dịch vụ hỗ trợ gói

- Backend:
  - `admin/services` create/update đã nhận và lưu:
    - `la_goi`
    - `doi_tuong_ap_dung`
  - `GET /api/admin/services` đã hỗ trợ filter `la_goi=true`
- Frontend admin:
  - form dịch vụ có checkbox `Đánh dấu là gói dịch vụ`
  - có select `Đối tượng áp dụng`
  - danh sách dịch vụ theo chuyên khoa hiển thị badge `Gói`
  - hiển thị thêm badge đối tượng áp dụng trên row khi có dữ liệu

PASS runtime/UI:

- Tạo 1 gói mới qua UI thành công.
- Sửa lại chính gói đó qua UI thành công.
- API đọc lại sau khi sửa trả đúng:
  - `la_goi=true`
  - `doi_tuong_ap_dung='nguoi_lon'`
  - giá đã cập nhật đúng.

### Bước 7 — Nền dữ liệu đặt hộ gia đình

- Xác nhận model đã có sẵn:
  - `GiaDinh`
  - `ThanhVien`
  - `LichHen.dat_ho`
  - `LichHen.nguoi_dat_ho_id`
  - snapshot `nguoi_dat_ho_ten`, `nguoi_dat_sdt`
- Đã bổ sung đúng tầng admin appointments:
  - controller trả thêm dữ liệu phân biệt người được khám và người đặt hộ
  - UI danh sách lịch hẹn hiển thị thêm dòng `Người đặt hộ: ...` khi `dat_ho=true`
- Không đụng client booking UI.

PASS runtime/UI:

- Seed 1 lịch hẹn test `dat_ho=true`.
- Trang admin appointments hiển thị:
  - dòng bệnh nhân riêng
  - dòng `Người đặt hộ: Nguyen Minh An` riêng
- Không gộp nhầm 2 người.
- Lịch hẹn test đã được xóa lại sau khi xác minh xong.

### Bước 8 — Xác nhận `BacSi.tuoi_nhan_kham_tu`

- Xác nhận field đã tồn tại trong model `backend/src/models/BacSi.js`.
- Query dữ liệu thật đọc được giá trị thực tế, ví dụ:
  - bác sĩ A: `tuoi_nhan_kham_tu=5`
  - bác sĩ B: `tuoi_nhan_kham_tu=5`
  - bác sĩ C: `tuoi_nhan_kham_tu=3`
- Không sửa `ManageDoctors`.

PASS:

- Field tồn tại và đọc được ở tầng model/data.
- Không có thay đổi nào được thực hiện vào `ManageDoctors`, `doctor.routes.js`, `doctor.controller.js`.

## File chính đã thay đổi

- `backend/src/models/DichVu.js`
- `backend/src/controllers/admin/services.controller.js`
- `backend/src/controllers/admin/appointment.controller.js`
- `frontend/src/components/admin/services/ServiceFormModal.tsx`
- `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`
- `frontend/src/services/service.service.ts`
- `frontend/src/types/index.ts`

## Script đã thêm

- `backend/scripts/admin/step1-merge-ent-specialties.js`
- `backend/scripts/admin/step2-seed-new-specialties.js`
- `backend/scripts/admin/step4-backfill-service-package-fields.js`
- `backend/scripts/admin/step5-seed-package-services.js`

## Kiểm thử cuối

- `backend npm test`: `89/89 PASS`
- `frontend npm run build`: PASS

Ghi chú test hạ tầng:

- Trước khi rerun backend suite, đã dùng script chuẩn của repo để xóa `77` test database an toàn theo pattern `vf_t...`, nhằm giải phóng quota collection trên MongoDB Atlas.
- Không xóa production DB `DATN_VITAFAMILY`.
- Không xóa 2 DB loại `review`:
  - `vf_bakchk_2251`
  - `vf_bakchk_demoreset_20260706_1728`

## Ngoài phạm vi, chưa làm

- UI đặt hộ gia đình phía client/patient.
- UI cho admin chỉnh `tuoi_nhan_kham_tu` trong `ManageDoctors`.
- Mọi thay đổi ở `doctor.routes.js`, `doctor.controller.js`, `ManageDoctors`.
