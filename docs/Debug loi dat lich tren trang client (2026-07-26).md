# Debug: "Lỗi API dữ liệu khi đặt lịch" trên trang client (2026-07-26)

## Yêu cầu
Người dùng báo trang client (`/booking`) gặp lỗi về API dữ liệu khi đặt lịch khám, cần soi console để tìm gốc rễ.

## Phương pháp
Dùng browser automation (Claude in Chrome) để tái hiện trực tiếp luồng đặt lịch 5 bước tại `http://localhost:5173/booking`, đọc console + network requests ở từng bước thay vì đoán.

## Phát hiện 1 (nguyên nhân chính): frontend dev server chạy nhầm từ worktree cũ

- Tại thời điểm bắt đầu, trang `/booking` hiện overlay lỗi Vite: `Failed to resolve import "@/mock/news"` — đường dẫn file trong lỗi trỏ tới
  `...\.claude\worktrees\audit-nurse-removal\frontend\...`, **không phải** thư mục làm việc chính
  `D:\DATN\...\frontend`.
- Xác nhận bằng `Get-CimInstance Win32_Process`: tiến trình giữ cổng 5173 (PID 2004) có command line trỏ thẳng vào
  `node_modules\.bin\..\vite\bin\vite.js` bên trong worktree đó.
- Worktree `audit-nurse-removal` dừng ở commit `c8b1a95` — **trước** cả các commit xóa actor Y tá đã merge vào `main`
  (`0184a63`, `7fab404`) và trước toàn bộ các fix bảo mật/dời lịch của phiên làm việc gần nhất trên nhánh `Bac_si`
  (`ccb7202`). Code ở đó thiếu file `@/mock/news`, và có thể thiếu nhiều thay đổi khác về kiểu dữ liệu API mà phần
  còn lại của ứng dụng đã cập nhật theo — đây là nguồn gốc hợp lý nhất của "lỗi API dữ liệu" mà người dùng thấy.
- Backend cổng 5000 **không bị ảnh hưởng** — xác minh bằng cách gọi thử `GET /api/receptionist/appointments` không
  token, nhận `401` đúng như fix bảo mật mới nhất trên `Bac_si` (nếu backend là bản cũ thì sẽ không có guard này).

### Xử lý
- Dừng tiến trình cũ (PID 2004) theo xác nhận của người dùng.
- Khởi động lại `npm run dev` đúng từ `D:\DATN\...\frontend` — chạy sạch trên cổng 5173.

## Phát hiện 2 (bug thật, phạm vi hẹp): tài khoản có tên chứa dấu chấm không tự đặt lịch được

Trong lúc tái hiện, phiên trình duyệt đang đăng nhập sẵn bằng tài khoản bác sĩ **"BS. Trần Minh Khang"**
(`role=doctor`, dùng thử trang client để test). Ở bước 3 ("Triệu chứng"), bấm **Tiếp tục** luôn báo:

> Họ tên bệnh nhân không hợp lệ (phải từ 2 ký tự trở lên và chỉ chứa chữ cái).

### Gốc rễ
- `frontend/src/pages/client/Booking.tsx`, chế độ **"Tự khám"**: trường họ tên **không có ô nhập** — khóa cứng theo
  `user.ho_ten` (không có cách nào sửa tay).
- `nameRegex` (dòng 393, trước khi sửa) không có dấu chấm `.` trong tập ký tự cho phép:
  ```
  /^[a-zA-ZÀÁÂÃ...ẠỹđĐ\s']{2,100}$/
  ```
- Tên "BS. Trần Minh Khang" chứa dấu chấm sau "BS" → luôn fail regex → chặn cứng bước 3→4, không có đường thoát.
- Backend (`patient/booking.controller.js` và các nơi khác) **không** validate định dạng `ten_khach` — đây thuần là
  giới hạn phía frontend, không phải yêu cầu nghiệp vụ hay ràng buộc dữ liệu.
- Ảnh hưởng: bất kỳ tài khoản nào có `ho_ten` chứa dấu chấm (chủ yếu các danh xưng "BS.", "ThS.", "TS.", "PGS.",
  "GS." — tức tài khoản bác sĩ dùng cổng bệnh nhân để tự đặt lịch/đặt hộ gia đình) sẽ luôn bị chặn ở bước 3, với
  thông báo lỗi không cho biết cách khắc phục (vì trường không sửa được).

### Fix
Thêm `.` vào tập ký tự cho phép của `nameRegex`:
```diff
- const nameRegex = /^[a-zA-ZÀÁÂÃ...Ạ-ỹđĐ\s']{2,100}$/
+ const nameRegex = /^[a-zA-ZÀÁÂÃ...Ạ-ỹđĐ\s'.]{2,100}$/
```
Xác minh bằng Node trực tiếp trên regex mới:
- `"BS. Trần Minh Khang"` → `true` (trước đây `false`)
- `"Phạm Thị Hồng"` → `true` (không đổi)
- `"a"` (quá ngắn) → `false` (không đổi — validation độ dài tối thiểu vẫn giữ nguyên)

Không sửa lại vào tài khoản bác sĩ thật (`haiv5634@gmail.com`) để kiểm chứng qua UI vì đây là email cá nhân thật của
thành viên nhóm, không phải tài khoản demo — không tự ý đăng nhập/đoán mật khẩu tài khoản người khác.

## Kiểm chứng luồng chính (tài khoản bệnh nhân demo `patient02.demo@vitafamily.vn`, mật khẩu seed `123456`)

Chạy lại trọn vẹn 5 bước sau khi khởi động lại đúng frontend, dùng tài khoản bệnh nhân bình thường (tên không có
ký tự đặc biệt) để xác nhận API dữ liệu thật sự thông suốt:

| Bước | API | Kết quả |
|---|---|---|
| Chọn chuyên khoa + khung giờ | `GET /api/patient/booking/specialties/:id/slots` | 200 |
| Xác nhận đặt lịch | `POST /api/patient/booking` | **201** |
| Tạo phiên thanh toán | `POST /api/patient/payments/:id/vnpay-session` | 200 |
| Kiểm tra trạng thái thanh toán | `GET /api/patient/payments/:id/status` | 200 |

→ Toàn bộ chuỗi API đặt lịch hoạt động đúng, không có lỗi dữ liệu ở tài khoản bệnh nhân thông thường. Sau khi xác
nhận, đã dọn lịch hẹn test (`LH-260727-0014`, trạng thái `pending`) khỏi DB dùng chung và trả slot về pool.

## Kết luận
- **Nguyên nhân chính** người dùng gặp phải: frontend đang trỏ vào một dev server bỏ quên chạy từ worktree lỗi
  thời, không phải bug trong code hiện tại của nhánh `Bac_si`. Đã dừng tiến trình cũ + khởi động lại đúng.
- **Bug phụ tìm thấy khi test**: tài khoản có tên chứa dấu chấm (chủ yếu bác sĩ dùng cổng bệnh nhân) không tự đặt
  lịch được do regex kiểm tra họ tên ở frontend quá chặt. Đã sửa 1 dòng, không đổi hành vi với tên thông thường.
- Không phát hiện thêm lỗi API dữ liệu nào khác trong luồng đặt lịch chính khi test với tài khoản bệnh nhân bình
  thường.

## File thay đổi
- `frontend/src/pages/client/Booking.tsx` — thêm `.` vào `nameRegex` (dòng ~393).
