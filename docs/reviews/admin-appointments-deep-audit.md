# Admin Appointments Deep Audit

## 1. Tổng quan luồng hiện tại

- Domain đang rà soát: `admin appointments` từ `LichHen` -> admin API -> frontend admin.
- Luồng admin hiện hỗ trợ:
  - xem danh sách lịch hẹn
  - xem chi tiết
  - xem lịch sử
  - dời lịch
  - hủy lịch
  - khôi phục lịch đã hủy
  - xóa cứng lịch đã hủy
- Dữ liệu thật vẫn có thể chứa nhiều trạng thái ngoài bộ 4 trạng thái cũ của UI:
  - `pending`
  - `confirmed`
  - `checked_in`
  - `in_progress`
  - `completed`
  - `cancelled`
  - `no_show`

## 2. Lỗi logic phát hiện

- API list cũ `GET /api/admin/appointments` đang `find + populate` toàn bộ rồi mới filter/search/paginate trong memory.
- Search cũ chỉ lọc sau khi đã load hết dữ liệu, không chịu được lượng lớn 500-1000 lịch/ngày.
- Hủy lịch phía backend chưa bắt buộc lý do hủy, dù UI có yêu cầu.
- Hủy lịch chưa ghi đủ metadata hành vi hủy:
  - `huy_boi`
  - `nguoi_huy_id`
  - `thoi_diem_huy`
- Khôi phục lịch cũ có rủi ro logic:
  - trước đó chỉ đổi `status` về `pending`
  - không kiểm tra slot cũ còn trống hay đã bị người khác chiếm
- Xóa cứng trước đó có thể xóa cả lịch chưa hủy, quá nguy hiểm cho admin.
- Dời lịch trước đó chưa bắt buộc lý do dời.
- Dời lịch trước đó chưa chặn no-op:
  - chọn lại đúng bác sĩ
  - đúng lịch làm việc
  - đúng slot hiện tại
- Dời lịch trước đó chưa chặn rõ case dời vào quá khứ ở mức API.
- Lịch sử dời lịch trước đó ghi chưa đủ before/after:
  - ngày giờ cũ
  - ngày giờ mới
  - bác sĩ cũ/mới
  - specialty cũ/mới
  - slot cũ/mới

## 3. Lỗi UI/UX phát hiện

- Màn danh sách admin còn mỏng cho vận hành thật:
  - thiếu quick filter
  - thiếu filter thanh toán rõ ràng
  - thiếu badge cảnh báo
- Search placeholder cũ chưa nói rõ hỗ trợ:
  - mã lịch
  - bệnh nhân
  - số điện thoại
  - bác sĩ
- Modal chi tiết cũ chưa hiển thị đủ thông tin xử lý:
  - mã lịch
  - email
  - lý do hủy
  - số lần thay đổi
  - hóa đơn
- Modal lịch sử cũ chưa hiển thị rõ trường hợp dời lịch trước/sau.
- Form dời lịch chưa bắt nhập lý do và chưa cảnh báo lịch đã bị dời nhiều lần.
- Action hủy ở list chưa có trạng thái submit để tránh double click.

## 4. Lỗi performance phát hiện

- List cũ paginate ở frontend sau khi load full dataset từ DB.
- Search theo tên bệnh nhân/bác sĩ cũ lọc bằng JS trên toàn bộ tập kết quả đã populate.
- Chưa có summary đủ rõ cho vận hành:
  - chưa thanh toán
  - cần xử lý
  - đã hủy

## 5. Rủi ro khi có 500-1000 lịch/ngày

- Dễ chậm API list vì load thừa dữ liệu.
- Frontend có nguy cơ render bảng quá nặng nếu backend trả quá nhiều bản ghi.
- Admin khó nhìn ra nhóm cần ưu tiên xử lý nếu chỉ có bảng phẳng.
- Rủi ro thao tác nhầm cao nếu lịch hủy/chưa thanh toán/đổi nhiều lần không có badge cảnh báo.

## 6. Rủi ro spam lịch

- Chưa có rule chống spam phức tạp.
- Đợt này mới thêm lớp nhận diện vận hành tối thiểu qua summary/quick filter:
  - `need_attention`
  - `unpaid`
  - `so_lan_thay_doi >= 2`
- Chưa có badge spam theo số điện thoại tạo liên tục trong thời gian ngắn.
- Đây vẫn là tồn đọng phase sau nếu muốn bắt nghi spam chuẩn hơn.

## 7. Rủi ro hủy hàng loạt

- Đã siết lại từng lệnh hủy đơn:
  - bắt buộc lý do
  - ghi người hủy
  - ghi thời điểm hủy
  - sync payment/refund theo logic hiện có
- Chưa thêm bulk cancel.
- Chủ đích giữ nguyên: không mở thêm thao tác hàng loạt nguy hiểm khi chưa có confirm nhiều lớp.

## 8. Rủi ro chưa thanh toán hàng loạt

- Đã có filter thanh toán ở UI admin.
- Đã có summary `unpaid`.
- Đã có badge cảnh báo `Chưa thanh toán`.
- Chưa triển khai dashboard đối soát sâu giữa `LichHen.payment_status`, `HoaDon`, `ThanhToan` ở màn admin appointments.

## 9. Những gì đã sửa

### Backend

- `backend/src/controllers/admin/appointment.controller.js`
  - chuyển list sang filter/search/paginate ở DB
  - thêm clamp `limit` tối đa
  - thêm quick filter server-side:
    - `today`
    - `upcoming`
    - `unpaid`
    - `cancelled`
    - `need_attention`
  - thêm search theo:
    - `ma_lich_hen`
    - `ten_khach`
    - `so_dien_thoai_khach`
    - `NguoiDung.ho_ten`
    - `NguoiDung.email`
    - tên bác sĩ qua `NguoiDung -> BacSi`
  - validate ObjectId ở detail/history/schedules
  - hủy lịch bắt buộc lý do
  - hủy lịch ghi:
    - `huy_boi = admin`
    - `nguoi_huy_id`
    - `thoi_diem_huy`
  - khôi phục lịch chỉ cho phép khi slot cũ còn trống
  - xóa cứng chỉ cho phép với lịch đã hủy
  - dời lịch bắt buộc lý do
  - dời lịch chặn dời vào chính slot hiện tại
  - dời lịch chặn thời điểm quá khứ
  - lịch sử dời lịch ghi before/after chi tiết hơn
  - detail response mở rộng:
    - mã lịch
    - email
    - lý do hủy
    - thông tin hóa đơn
    - badge warning data

### Model / Index

- `backend/src/models/LichHen.js`
  - thêm index:
    - `specialty_id`
    - `ngay_kham + status`
    - `ngay_kham + payment_status`
    - `ngay_kham + doctor_id`
  - không giữ index trùng `ma_lich_hen` vì schema đã có `unique+sparse` sẵn

### Frontend

- `frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx`
  - thêm quick filter UI
  - thêm filter thanh toán
  - thêm error state
  - summary cards bám vận hành hơn
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`
  - thêm cột `Mã lịch`
  - thêm badge cảnh báo
  - thêm hiển thị số hóa đơn
  - thêm chống double submit khi hủy
- `frontend/src/pages/admin/ManageAppointments/AppointmentDetail.tsx`
  - mở rộng dữ liệu hiển thị phục vụ xử lý
- `frontend/src/pages/admin/ManageAppointments/AppointmentHistoryModal.tsx`
  - hiển thị rõ dời lịch trước/sau
  - hiển thị loại thay đổi/lý do thay đổi
- `frontend/src/pages/admin/ManageAppointments/RescheduleAppointment.tsx`
  - bắt buộc lý do dời lịch
  - cảnh báo lịch đã đổi nhiều lần
- `frontend/src/services/appointment.service.ts`
  - thêm param mới cho list/filter
  - chuẩn hóa type cho history và reschedule
- `frontend/src/types/index.ts`
  - mở rộng `AppointmentItem`
  - mở rộng `AppointmentSummary`
  - thêm `AppointmentHistoryItem`

## 10. API đã sửa

- `GET /api/admin/appointments`
- `GET /api/admin/appointments/:id`
- `PATCH /api/admin/appointments/:id/cancel`
- `PATCH /api/admin/appointments/:id/restore`
- `DELETE /api/admin/appointments/:id`
- `PATCH /api/admin/appointments/:id/reschedule`
- `GET /api/admin/appointments/:id/history`
- `GET /api/admin/appointments/doctors/:id/schedules`

## 11. Index DB đã thêm / đề xuất

### Đã thêm trong model

- `specialty_id`
- `ngay_kham + status`
- `ngay_kham + payment_status`
- `ngay_kham + doctor_id`

### Đã giữ nguyên vì đã có sẵn

- `ma_lich_hen`

## 12. Test đã chạy

### PASS

- `node --test backend/tests/admin/adminAppointmentList.test.js`
- `node --test backend/tests/admin/adminAppointmentWriteFlow.test.js`
  - gồm cả guard:
    - hủy lịch phải có lý do
    - restore fail nếu slot cũ đã bị chiếm
- `cmd /c npm run typecheck` trong `frontend`
- `cmd /c npm run build` trong `frontend`

### Đã thử nhưng không dùng làm gate hoàn thành do môi trường

- `cmd /c npm test` trong `backend`
  - lần 1 fail do timeout DNS tới Mongo SRV trong sandbox
  - lần 2 chạy ngoài sandbox nhưng bị `EPIPE` từ test harness sau thời gian dài
  - không có bằng chứng cho thấy fail do logic appointment vừa sửa
- lưu ý thêm:
  - root `.gitignore` hiện đang ignore `tests/`
  - vì vậy các chỉnh sửa test local trong `backend/tests/` không hiện trong `git status`
  - nếu muốn giữ lại test case này cho agent khác qua git, cần xử lý riêng quy tắc ignore hoặc chuyển test sang vị trí được track

## 13. Kết quả test từng case

- List appointment với filter cũ + field mới: PASS
- Create appointment: PASS
- Reschedule hợp lệ: PASS
- Cancel thiếu lý do: PASS
- Restore khi slot cũ đã bị chiếm: PASS
- Frontend compile/typecheck: PASS
- Frontend production build: PASS

## 14. Case hiếm đã test

- Restore lịch bị chặn khi slot gốc không còn trống.
- Hủy lịch thiếu lý do bị chặn ở backend, không chỉ ở UI.
- Reschedule bắt buộc lý do và có concurrency check theo `updatedAt`.

## 15. Vấn đề còn tồn đọng

- Full backend suite chưa có kết quả PASS cuối cùng vì môi trường chạy test không ổn định với Mongo SRV/harness dài.
- Chưa có benchmark seed lớn 200/500/1000 lịch trong báo cáo này.
- Chưa có rule chống spam sâu theo phone/email/tần suất tạo lịch.
- Chưa có UI thống kê:
  - checked_in
  - in_progress
  - cancelled
  như card riêng ở đầu trang.
- Chưa có bulk action an toàn nhiều lớp, và hiện chưa nên thêm vội.

## 16. Đề xuất phase sau

1. Tạo seed stress test riêng cho `LichHen`:
   - 50
   - 200
   - 500
   - 1000 lịch/ngày
2. Chạy đo response time thật cho:
   - list mặc định
   - filter theo ngày
   - filter unpaid
   - search theo phone/name/code
3. Thêm audit/heuristic nghi spam:
   - cùng phone nhiều lịch/ngày
   - cùng bệnh nhân nhiều lịch sát giờ
   - tạo rồi hủy liên tục
4. Bổ sung manual/runtime checklist cho giao diện:
   - màn nhỏ
   - text dài
   - missing populate
   - API chậm
5. Nếu cần độ an toàn cao hơn nữa:
   - chuyển reschedule/cancel sang optimistic locking rõ hơn
   - cân nhắc transaction/atomic guard sâu hơn quanh race condition slot
