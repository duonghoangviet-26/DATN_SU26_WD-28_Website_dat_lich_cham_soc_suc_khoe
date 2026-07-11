# Admin Service - Specialty - Appointment Fix

## 1. Vấn đề ban đầu phát hiện được

### Services

- Trang `admin/services` đang bám theo cấu trúc cũ gồm 2 nhánh `clinic/home`.
- UI admin vẫn hiển thị nguyên nhánh `Khám tại nhà`, dù yêu cầu hiện tại là tạm ẩn toàn bộ luồng này.
- Trang services landing không phản ánh đúng nghiệp vụ DB thật hiện tại:
  - DB thật có `1` dịch vụ `home`
  - DB thật có `3` dịch vụ `related`
  - toàn bộ lịch hẹn thật hiện tại đều là `clinic`, không có lịch `home`

### Specialties

- Dữ liệu chuyên khoa trong DB thật có `4` bản ghi active.
- Nhưng canonical API `GET /api/admin/specialties` trước khi sửa chỉ trả về `1` chuyên khoa.
- UI admin vì vậy hiển thị thiếu chuyên khoa và kéo theo dịch vụ liên quan bị lệch khỏi danh sách quản trị.

### Appointments

- UI admin appointments đang dùng sai map nhãn cho `loai_kham`:
  - dùng `SERVICE_TYPE_LABEL`
  - trong khi dữ liệu thật của lịch hẹn cần map bằng `EXAM_TYPE_LABEL`
- DB/API thật đang trả các trạng thái lịch hẹn:
  - `pending`
  - `confirmed`
  - `checked_in`
  - `in_progress`
  - `completed`
  - `cancelled`
  - `no_show`
- Nhưng frontend admin trước khi sửa chỉ support 4 trạng thái:
  - `pending`
  - `confirmed`
  - `completed`
  - `cancelled`
- Form tạo lịch admin vẫn cho chọn `home`, trái với yêu cầu tạm bỏ luồng khám tại nhà khỏi UI.
- Màn quản lý appointments đang gọi `view_mode=doctor_grouped`, làm pagination frontend không còn bám đúng response chuẩn có `pagination`.

## 2. Nguyên nhân thật của việc dịch vụ không hiển thị đúng

- Gốc 1: Trang `frontend/src/pages/admin/ManageServices.tsx` đang tổ chức UI theo nhánh `home` cũ, không còn khớp với nghiệp vụ hiện tại.
- Gốc 2: Trang services landing lấy chuyên khoa theo nhánh hiển thị không phù hợp với admin canonical flow.
- Gốc 3: Dữ liệu specialty trong DB còn dấu vết multi-clinic cũ, khiến specialty/service nhìn từ admin bị lệch nếu tiếp tục lọc cứng theo singleton clinic cũ.

## 3. Nguyên nhân thật của việc chuyên khoa không hiển thị đúng

- Gốc chính nằm ở backend canonical specialties controller.
- Trước khi sửa, `backend/src/controllers/admin/specialties.controller.js` lọc theo `phong_kham_id` của singleton clinic đang lấy bằng `findOne().sort({ ngay_tao: 1 })`.
- Audit DB thật cho thấy:
  - có `2` bản ghi trong `thong_tin_phong_kham`
  - `4` chuyên khoa active đang chia trên `2` `phong_kham_id` khác nhau
- Vì vậy `GET /api/admin/specialties` chỉ nhìn thấy phần dữ liệu thuộc đúng clinic được chọn ngầm, làm mất các chuyên khoa còn lại.

## 4. Nguyên nhân thật của việc lịch hẹn hiển thị sai

- Gốc 1: frontend map sai `loai_kham` bằng `SERVICE_TYPE_LABEL`, nên lịch `clinic` không có nhãn hiển thị đúng.
- Gốc 2: type và badge màu của frontend không support đủ các status thật đang có trong DB/API:
  - `checked_in`
  - `in_progress`
  - `no_show`
- Gốc 3: UI filter trạng thái chưa có các trạng thái thật trên.
- Gốc 4: form tạo lịch admin còn cho chọn `home`, trong khi nghiệp vụ hiện tại yêu cầu chỉ tạo lịch `clinic`.
- Gốc 5: màn list appointments dùng luồng `doctor_grouped`, làm mất pagination chuẩn ở phía frontend.

## 5. Những file đã sửa

- `backend/src/controllers/admin/specialties.controller.js`
- `backend/tests/admin/adminSpecialtyList.test.js`
- `frontend/src/components/admin/services/ServiceFormModal.tsx`
- `frontend/src/pages/admin/ManageServices.tsx`
- `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/AddAppointment.tsx`
- `frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx`
- `frontend/src/services/specialty.service.ts`
- `frontend/src/types/index.ts`
- `frontend/src/utils/constants.ts`

## 6. Những gì đã sửa cụ thể

### Backend specialties

- Bỏ lọc cứng `phong_kham_id` ở canonical list/get/update/toggle để admin nhìn thấy toàn bộ specialty dữ liệu thật trong trạng thái singleton hiện tại.
- Bổ sung `doctor_count` ngay ở response canonical `admin/specialties`.
- Giữ create theo clinic mặc định hiện hành để không phá contract tạo mới.

### Frontend services

- Dựng lại `ManageServices` để chỉ hiển thị luồng `dịch vụ liên quan theo chuyên khoa`.
- Ẩn hoàn toàn nhánh `Khám tại nhà` khỏi UI admin hiện tại.
- Chuyển sang dùng admin specialty data thật cho services landing.
- `ManageServiceSpecialtyDetail` chuyển sang đọc specialty theo admin flow thay vì bám public specialty flow.
- `ServiceFormModal` chỉ còn cho tạo/sửa `related service`, không còn UI tạo `home service`.

### Frontend appointments

- Mở rộng `AppointmentStatus` để support:
  - `checked_in`
  - `in_progress`
  - `no_show`
- Bổ sung label trạng thái tương ứng trong `frontend/src/utils/constants.ts`
- Đổi các màn appointments sang dùng `EXAM_TYPE_LABEL` cho `loai_kham`
- `ManageAppointments` quay lại dùng list API chuẩn có `pagination`
- Bổ sung filter trạng thái thật:
  - `Đã đến`
  - `Đang khám`
  - `Không đến khám`
- Bỏ option `home` khỏi filter loại khám trên UI admin hiện tại
- `AddAppointment` chỉ còn tạo lịch `clinic`
- Giữ dữ liệu lịch `home` cũ ở backend/DB, không xóa lịch sử

## 7. Những API đã test

### Audit DB -> API thật

- `GET /api/admin/specialties`
- `GET /api/admin/services?loai=related&page=1&limit=20`
- `GET /api/admin/appointments?page=1&limit=20`

### Kết quả sau sửa

- `GET /api/admin/specialties`
  - status `200`
  - count `4`
  - names:
    - `Tai`
    - `Mui`
    - `Hong`
    - `Tai Mui Hong tong quat`
- `GET /api/admin/services?loai=related`
  - status `200`
  - total `3`
  - names:
    - `Rua mui`
    - `Noi soi hong`
    - `Noi soi tai`
- `GET /api/admin/appointments`
  - status `200`
  - total `13`
  - statuses có thật:
    - `confirmed`
    - `cancelled`
    - `pending`
    - `in_progress`
    - `checked_in`
    - `completed`
    - `no_show`
  - types:
    - `clinic`

## 8. Những dữ liệu DB đã thêm/sửa

- Không sửa trực tiếp dữ liệu MongoDB thật trong đợt này.
- Không chạy migration ghi dữ liệu.
- Chỉ audit và xác nhận gốc lỗi dữ liệu:
  - DB thật đang có `2` clinic docs
  - specialty active đang chia trên `2` `phong_kham_id`
- Chọn hướng sửa ở controller/UI để admin nhìn đúng dữ liệu thật hiện tại, thay vì ghi đè dữ liệu DB production/demo ngay trong bước này.

## 9. Những phần đã tạm ẩn liên quan đến khám tại nhà

- Ẩn nhánh `Khám tại nhà` khỏi `admin/services`
- Ẩn khả năng tạo `home` trong form dịch vụ admin
- Ẩn option tạo lịch `home` trong `AddAppointment`
- Ẩn option lọc `home` ở màn admin appointments hiện tại

## 10. Kết quả test backend

### Test hẹp theo phạm vi

- `node --test backend/tests/admin/adminSpecialtyList.test.js`
  - PASS
- `node --test backend/tests/admin/adminAppointmentList.test.js`
  - PASS
- `node --test backend/tests/admin/adminAppointmentWriteFlow.test.js`
  - PASS
- `node --test backend/tests/admin/adminServiceAdminId.test.js`
  - PASS

### Full suite

- `cmd /c npm test` trong `backend`
  - PASS
  - `88/88` test pass
  - `0 fail`

## 11. Kết quả build frontend

- `cmd /c npm run typecheck` trong `frontend`
  - PASS
- `cmd /c npm run build` trong `frontend`
  - PASS

## 12. Kết quả runtime frontend mức HTTP

Đã kiểm tra route shell app sau build/preview:

- `http://127.0.0.1:4178/admin/services` -> `200`
- `http://127.0.0.1:4178/admin/clinics` -> `200`
- `http://127.0.0.1:4178/admin/appointments` -> `200`

## 13. Lỗi còn tồn đọng / giới hạn còn lại

- Chưa chốt được bằng chứng DOM end-to-end bằng browser automation trong môi trường này vì local browser runtime không ổn định đủ lâu khi chạy nền, và Playwright package/browser không sẵn sàng đầy đủ để giữ một phiên kiểm tra UI lâu hơn.
- Tuy nhiên:
  - DB audit thật đã có
  - admin API thật sau sửa đã có
  - frontend typecheck/build đã pass
  - route frontend mức HTTP/runtime đã pass
- Không có lỗi compile hay lỗi backend test còn mở ở phạm vi `services/specialties/appointments`.
