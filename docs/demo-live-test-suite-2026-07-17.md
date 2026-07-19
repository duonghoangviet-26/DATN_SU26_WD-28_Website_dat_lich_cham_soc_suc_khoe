# Bộ Test Và Kịch Bản Demo Live

Ngày rà soát live: `Friday, July 17, 2026`

Tài liệu này bám theo dữ liệu đang chạy thực tế ở `http://localhost:5000/api`, không bám theo bộ `demo-seed` cũ.

## 1. Tài khoản dùng demo

| Vai trò | Email | Mật khẩu | Ghi chú |
| --- | --- | --- | --- |
| Admin | `admin@vitafamily.vn` | `123456` | Đúng với `backend/src/scripts/seed-all.js` |
| Lễ tân | `reception@vitafamily.vn` | `123456` | Đúng với DB hiện tại |
| Y tá | `nurse@vitafamily.vn` | `123456` | Dùng cho flow hỗ trợ, không bắt buộc trong demo chính |
| Bác sĩ | `doctor.khang@vitafamily.vn` | `123456` | Tài khoản bác sĩ demo chính |
| Bệnh nhân | `patient01.demo@vitafamily.vn` | `123456` | Dùng được để đặt và hủy lịch |

Tài khoản test bổ sung đang có trong DB:

| Vai trò | Email | Mật khẩu | Mục đích |
| --- | --- | --- | --- |
| Bác sĩ test | `doctor.test@vitafamily.local` | `Test123456` | Test sâu trang bác sĩ |
| Bác sĩ test phụ | `doctor.other.test@vitafamily.local` | `Test123456` | Kiểm tra phân quyền bác sĩ |
| Bệnh nhân test | `patient.test@vitafamily.local` | `Test123456` | Dữ liệu test riêng, tránh lẫn demo chính |

## 2. Lệnh kiểm thử tự động

Chạy bộ test vai trò chính:

```bash
cd backend
node src/scripts/test-demo-role-flows.js
```

Chạy bộ test sâu cho trang bác sĩ:

```bash
cd backend
node src/scripts/test-doctor-page-api.js
```

Chạy full backend unit/integration test:

```bash
cd backend
node --test --test-concurrency=1 "tests/**/*.test.js"
```

## 3. Kịch bản demo nên đi với thầy cô

### A. Bệnh nhân

1. Vào `/login` bằng `patient01.demo@vitafamily.vn / 123456`.
2. Vào trang đặt lịch.
3. Chọn bác sĩ, chọn slot còn trống trong tương lai.
4. Tạo lịch khám tại phòng khám.
5. Kỳ vọng:
   - Hệ thống tạo `appointment`, `invoice`, `payment pending`.
   - Slot bị giữ chỗ.
6. Sau khi demo xong, hủy lịch để dọn dữ liệu test.

Luồng này đã test live thành công ngày `July 17, 2026`:
- Tạo được lịch ngày `Saturday, July 18, 2026`
- Hủy lại được ngay sau đó

### B. Lễ tân

1. Vào `/login` bằng `reception@vitafamily.vn / 123456`.
2. Mở trang danh sách lịch hẹn.
3. Lọc `today`, `tomorrow`, `upcoming`.
4. Mở trang booking của lễ tân để tra cứu bác sĩ/slot.
5. Mở trang thanh toán để xem danh sách thu ngân.

Nên demo ở mức đọc dữ liệu và tra cứu. Không nên lấy flow y tá làm trục chính của phần lễ tân vì hai nhánh này trong code hiện tại chưa được nối thành một đường vận hành hoàn toàn mượt.

### C. Bác sĩ

1. Vào `/login` bằng `doctor.khang@vitafamily.vn / 123456`.
2. Vào dashboard bác sĩ.
3. Mở lịch hẹn theo ngày `Friday, July 17, 2026`.
4. Mở chi tiết một lịch hẹn.
5. Nếu có lịch đã có kết quả khám, mở chi tiết hồ sơ.
6. Mở trang xin nghỉ để cho thấy dữ liệu nghỉ phép và quản lý lịch bác sĩ.

Nếu muốn demo sâu hơn riêng trang bác sĩ, dùng tài khoản test:
- `doctor.test@vitafamily.local / Test123456`

Tài khoản test này đã có script kiểm tra riêng.

### D. Admin

1. Vào `/login` bằng `admin@vitafamily.vn / 123456`.
2. Mở dashboard admin.
3. Mở quản lý lịch hẹn.
4. Mở quản lý thanh toán.
5. Mở lịch làm việc bác sĩ / doctor schedules.

Phần admin phù hợp để demo vai trò giám sát hệ thống hơn là thao tác ghi dữ liệu trực tiếp trong buổi trình bày.

## 4. Kết quả kiểm thử live ngày Friday, July 17, 2026

### Đã pass

- Đăng nhập được với `admin`, `receptionist`, `nurse`, `doctor.khang`, `patient01`.
- Bệnh nhân xem được hồ sơ gia đình.
- Bệnh nhân đặt lịch thật thành công và hủy lại được.
- Admin xem được dashboard, danh sách lịch hẹn, danh sách thanh toán.
- Lễ tân xem được danh sách lịch hẹn, bác sĩ phục vụ đặt hộ, trang thanh toán.
- Bác sĩ xem được profile, dashboard, lịch hẹn theo ngày, chi tiết lịch hẹn, kết quả khám khi có dữ liệu.
- Script test sâu trang bác sĩ pass `17/18` bước.

### Cảnh báo

- `GET /doctor/appointments/pending-results` đang trả `0` bản ghi ở thời điểm test. Đây không phải lỗi API, nhưng hiện chưa có seed đẹp để demo riêng tab “hồ sơ chờ xác nhận”.
- Nurse flow có route và controller thật, nhưng không nên lấy làm luồng trung tâm nếu mục tiêu buổi demo là `user -> receptionist -> doctor -> admin`.

### Lỗi cần báo cáo thẳng

- `GET /api/receptionist/appointments` hiện truy cập được khi không có token.
  Đây là lỗ hổng phân quyền backend, cần sửa trước khi coi hệ thống là an toàn.

## 5. Kết quả chạy test code

Khi chạy:

```bash
cd backend
node --test --test-concurrency=1 "tests/**/*.test.js"
```

Kết quả hiện tại:

- `94` pass
- `8` fail

Các fail chính đang nằm ở:

- `adminDashboard.test.js`
- `adminMedicalReadOnly.test.js`
- `donThuoc.model.test.js`
- `ketQuaKham.model.test.js`

Nhóm lỗi này nghiêng về chênh lệch giữa test fixture cũ và contract model hiện tại, không phải dấu hiệu toàn bộ hệ thống sập. Tuy vậy, nên sửa trước buổi bảo vệ nếu nhóm muốn dùng test suite làm bằng chứng chất lượng.

## 6. Khuyến nghị demo

Nên chọn trục demo chính:

1. Bệnh nhân đăng nhập và đặt lịch.
2. Lễ tân tra cứu và theo dõi lịch.
3. Bác sĩ xem lịch và hồ sơ.
4. Admin xem tổng quan và thanh toán.

Không nên đặt trục demo chính vào:

- Nurse queue end-to-end
- Pending doctor confirm
- Các route lễ tân ghi dữ liệu nhạy cảm

cho tới khi vá xong phân quyền và seed lại dữ liệu trình diễn cho sạch hơn.
