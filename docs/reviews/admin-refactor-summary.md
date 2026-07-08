# Báo Cáo Tổng Kết Tái Cấu Trúc Admin

## 1. Phạm vi đã rà soát

Báo cáo này chỉ tính các domain admin nằm trong lộ trình:

- `admin/clinics`
- `admin/specialties`
- `admin/services`
- `admin/appointments`
- `admin/payments`
- `admin/reviews`
- `admin/notifications`

Các phần sau vẫn ngoài phạm vi và không được tính là hạng mục cần sửa trong lộ trình này:

- `backend/src/routes/doctor.routes.js`
- `backend/src/controllers/doctor.controller.js`
- `frontend/src/pages/admin/ManageDoctor*`
- domain quản trị người dùng
- domain y tá, lễ tân

## 2. Kết luận tổng quan

Sau khi đối chiếu lại toàn bộ code hiện tại với roadmap, 7 domain admin trong phạm vi đã được dọn lại đáng kể và đã đạt các mục tiêu chính sau:

- backend đã được gom route/controller theo domain rõ ràng hơn
- các ref sai `ChiNhanh` đã được sửa về `ThongTinPhongKham`
- phần clinics đã đổi sang ngữ nghĩa “phòng khám đơn” thay cho mô hình nhiều bệnh viện/chi nhánh ở UI admin
- các service admin chính ở frontend đã chuyển sang API thật:
  - specialties
  - services
  - payments
  - notifications
  - dashboard
- dashboard admin đã dùng dữ liệu thật từ backend
- route admin frontend đã được dọn tên và xác minh runtime

Tại thời điểm rà soát này, không còn hạng mục lớn nào trong phạm vi 7 domain bị bỏ sót mà không có lý do rõ ràng.

## 3. Đối chiếu theo từng phase

### Phase 1: Gộp và dọn backend

Đã xử lý:

- tạo mount chuẩn cho:
  - `admin/clinics`
  - `admin/specialties`
  - `admin/appointments`
  - `admin/payments`
  - `admin/reviews`
  - `admin/notifications`
- xóa route/controller trùng:
  - route `clinic.routes.js`
  - route `clinic-info.routes.js`
  - controller `appointments.controller.js`
- chuyển notification route về `backend/src/routes/admin/notifications.routes.js`
- xóa dead code sau `return` trong `appointment.controller.js`

Trạng thái:

- đạt mục tiêu dọn cấu trúc
- vẫn còn giữ alias legacy `/admin/clinic-info` và `/admin/clinic` để tương thích luồng cũ
- việc giữ alias này là có chủ đích, không phải bỏ sót

### Phase 2: Sửa model và contract

Đã xử lý:

- sửa `ref: 'ChiNhanh'` sang `ref: 'ThongTinPhongKham'` trong:
  - `BacSi.js`
  - `LichHen.js`
  - `HoaDon.js`
  - `LichLamViec.js`
- sửa contract tạo lịch:
  - `clinic` không còn bắt buộc `service_id`
  - `home` vẫn bắt buộc `service_id`
- đồng bộ phần tạo lịch admin với rule mới
- thêm route `GET /api/admin/reviews/doctors`
- thêm endpoint dashboard thật `GET /api/admin/dashboard`

Trạng thái:

- phần contract trong phạm vi admin hiện đã chạy theo rule mới
- `phi_tu_van` vẫn còn tồn tại ở nhánh doctor ngoài phạm vi, không tính là lỗi còn sót của 7 domain admin trong lộ trình này

### Phase 3: Rà auth admin

Đã xử lý:

- tạo `docs/reviews/admin-id-audit.md`
- xác nhận các route admin trong phạm vi dùng:
  - `verifyToken`
  - `requireRole('admin')`
- xác nhận controller trong phạm vi không còn tin `admin_id` từ body

Trạng thái:

- đạt mục tiêu trong phạm vi 7 domain
- `doctor.controller.js` vẫn còn nhận `admin_id` từ body nhưng đã được ghi nhận đúng là ngoài phạm vi

### Phase 4: Thay mock bằng API thật

Đã xử lý:

- `frontend/src/services/specialty.service.ts`
- `frontend/src/services/service.service.ts`
- `frontend/src/services/payment.service.ts`
- `frontend/src/services/notification.service.ts`

Kết quả:

- UI admin cho specialties, services, payments, notifications đã đi qua `axiosInstance`
- `ManageServiceSpecialtyDetail.tsx` đã bỏ luồng doctor mock và đọc danh sách bác sĩ thật theo chuyên khoa qua `clinicService.getDoctorsBySpecialty`
- không còn phụ thuộc mock trong các service nằm trong phạm vi

Ghi chú:

- một số comment cũ trong `axiosInstance.ts` vẫn còn nhắc giai đoạn mock, nhưng đây là nợ chú thích, không còn là nợ chức năng

### Phase 5: Bỏ hardcode admin id

Đã xử lý:

- luồng notifications không còn hardcode `CURRENT_ADMIN_ID`
- backend trong phạm vi lấy người thực hiện từ `req.user`

Trạng thái:

- đạt mục tiêu trong 7 domain
- `CURRENT_ADMIN_ID` vẫn còn trong `ManageDoctor*`, đúng với phần ngoài phạm vi

### Phase 6: Chuẩn hóa cấu trúc frontend

Đã xử lý:

- đổi `ManageHospitals` thành `ManageClinics`
- xóa hẳn thư mục legacy rỗng `ManageHospitals/`
- đổi route thật sang `/admin/clinics`
- giữ redirect `/admin/hospitals -> /admin/clinics`
- gỡ các re-export mỏng ở:
  - `ManageClinics`
  - `ManageAppointments`
  - `ManageNotifications`
- cập nhật menu admin theo route mới

Kết quả kiểm tra:

- route admin runtime đã được xác minh:
  - `/admin/clinics`
  - `/admin/services`
  - `/admin/appointments`
  - `/admin/reviews`
  - `/admin/notifications`
  - `/admin/payments`
- các trang trong 7 domain đã được quét lại để bỏ `console.error`/`console.warn` còn sót trong runtime in-scope

Trạng thái:

- đạt mục tiêu Phase 6

### Phase 7: Dashboard thật

Đã xử lý:

- thêm backend service/controller/route cho `GET /api/admin/dashboard`
- trả dữ liệu thật gồm:
  - số lịch hẹn hôm nay
  - số bác sĩ `trang_thai = 'active'`
  - tổng doanh thu hóa đơn
  - tổng tiền đã thu
  - phần còn cần thu
- frontend `Dashboard.tsx` đã bỏ toàn bộ số liệu mẫu
- frontend gọi `dashboardService.getSummary()`

Kết quả kiểm tra:

- backend integration test dashboard đã pass
- frontend `Dashboard.tsx` đang đọc `dashboardService.getSummary()`, không còn số hardcode
- frontend runtime check đã xác nhận:
  - có request thật tới `/api/admin/dashboard`
  - số hiển thị khớp payload API
  - text dữ liệu mẫu cũ đã biến mất

Trạng thái:

- đạt mục tiêu Phase 7

## 4. Trạng thái theo 7 domain

### 4.1 Clinics

Đã đạt:

- UI đã chuyển sang `ManageClinics`
- semantics đã đổi sang “phòng khám đơn”
- service thật là `clinic.service.ts`
- route chính là `/admin/clinics`

Còn giữ tạm:

- alias legacy `/admin/clinic-info`

Lý do giữ:

- tránh gãy tương thích tức thời với các nhánh code cũ trong thời gian chuyển đổi

### 4.2 Specialties

Đã đạt:

- controller canonical hoạt động với singleton clinic
- frontend service đã dùng API thật
- specialties được quản lý dưới ngữ cảnh clinic singleton

Còn giữ tạm:

- alias legacy `/admin/clinic`
- một số nested endpoint legacy dưới `/admin/clinic-info/...`

Lý do giữ:

- adapter tương thích trong giai đoạn chuyển giao, không còn là luồng chính

### 4.3 Services

Đã đạt:

- `service.service.ts` dùng API thật
- contract frontend đã chỉnh theo backend
- fix đếm liên quan chuyên khoa trên UI services

Trạng thái:

- không thấy tồn đọng chức năng nào trong phạm vi domain này

### 4.4 Appointments

Đã đạt:

- controller trùng đã xóa
- dead code đã xóa
- contract `clinic/home` đã được sửa
- form admin tạo lịch đã đi theo rule mới

Trạng thái:

- domain này đã ổn trong phạm vi roadmap
- phần `view_mode=doctor_grouped` vẫn là một lựa chọn contract hiện hành, chưa phải lỗi blocking sau khi rà soát lần này

### 4.5 Payments

Đã đạt:

- service frontend dùng API thật
- route/controller backend thật đã có đủ list/detail/refund
- type frontend đã mở rộng theo backend

Trạng thái:

- không còn mock trong domain này

### 4.6 Reviews

Đã đạt:

- route thật `/admin/reviews/doctors` đã có
- frontend review service tiếp tục dùng API thật

Trạng thái:

- không còn mismatch endpoint trong phạm vi domain này

### 4.7 Notifications

Đã đạt:

- route nằm đúng tại `routes/admin/notifications.routes.js`
- frontend dùng `axiosInstance`
- không còn hardcode admin id trong luồng notification thuộc phạm vi

Trạng thái:

- domain này ổn về chức năng
- controller vẫn đang ở `backend/src/controllers/notification.controller.js`, đây là nợ cấu trúc nhỏ nhưng chưa ảnh hưởng hành vi

## 5. Những gì đã bỏ

- mô hình “nhiều bệnh viện/chi nhánh” trong admin clinics UI
- thư mục legacy rỗng `frontend/src/pages/admin/ManageHospitals`
- các wrapper re-export mỏng không còn giá trị
- dữ liệu mẫu ở Dashboard admin
- mock CRUD trong các service admin chính thuộc phạm vi
- hardcode admin id trong notification flow
- doctor mock/action mock còn sót trong `ManageServiceSpecialtyDetail.tsx`
- `console.error`/`console.warn` còn sót trong các trang admin thuộc 7 domain

## 6. Những gì đã thêm

- `docs/reviews/admin-routes-audit.md`
- `docs/reviews/admin-id-audit.md`
- backend dashboard:
  - `backend/src/services/admin/dashboard.service.js`
  - `backend/src/controllers/admin/dashboard.controller.js`
  - `backend/src/routes/admin/dashboard.routes.js`
- test dashboard backend:
  - `backend/tests/admin/adminDashboard.test.js`
- test khóa luồng admin-id thực thi theo token:
  - `backend/tests/admin/adminServiceAdminId.test.js`
- test auth matrix cho route admin:
  - `backend/tests/admin/adminRouteAuthMatrix.test.js`
- frontend dashboard:
  - `frontend/src/services/dashboard.service.ts`
  - render dashboard theo API thật

## 7. Những gì còn giữ lại có chủ đích trong phạm vi

Các điểm sau vẫn còn tồn tại nhưng có lý do rõ ràng, nên không được xem là “bỏ sót không có giải thích”:

- alias legacy `/admin/clinic-info`
- alias legacy `/admin/clinic`
- redirect `/admin/hospitals -> /admin/clinics`
- comment cũ trong `frontend/src/services/axiosInstance.ts`
- controller notification chưa chuyển hẳn vào thư mục `controllers/admin`

Khuyến nghị:

- sau khi chốt build/test tổng cuối cùng, có thể mở một nhánh cleanup nhỏ để xóa alias legacy nếu chắc chắn không còn phụ thuộc

## 8. Kết quả kiểm tra đã có

Đã có bằng chứng pass trong quá trình thực hiện:

- test model/contract cho `LichHen`
- test route reviews `/doctors`
- test dashboard backend với DB thật
- check TypeScript theo từng scope nhỏ cho:
  - clinics
  - Phase B contracts
  - Phase C services
  - Phase 6 route cleanup
  - Phase 7 dashboard
- runtime check frontend cho:
  - `/admin/clinics`
  - `/admin/services`
  - `/admin/appointments`
  - `/admin/reviews`
  - `/admin/notifications`
  - `/admin/payments`
  - dashboard request `/api/admin/dashboard`
- frontend build/typecheck đã pass sau cleanup Phase 6

## 9. CÒN TỒN ĐỌNG, CHƯA XỬ LÝ (ngoài phạm vi lộ trình này)

- `doctor.routes.js` vẫn thiếu `verifyToken` và `requireRole('admin')`
- `doctor.controller.js` vẫn nhận `admin_id` từ body
- `ManageDoctors` frontend chưa được dọn theo chuẩn refactor hiện tại
- domain quản trị người dùng/y tá/lễ tân chưa được xử lý trong lộ trình này

## 10. Kết luận Step 26

Sau khi rà soát lại toàn bộ 7 domain trong phạm vi, báo cáo này ghi nhận:

- các hạng mục chính của roadmap từ Phase 1 đến Phase 7 đã được thực hiện
- các điểm còn tồn tại trong phạm vi đều đã có lý do rõ ràng, không phải bỏ sót vô chủ
- các rủi ro còn lại chủ yếu nằm ngoài phạm vi đã khóa từ đầu

Vì vậy, `Step 26` được xem là đạt điều kiện PASS ở mức báo cáo và đối chiếu hiện trạng code.
