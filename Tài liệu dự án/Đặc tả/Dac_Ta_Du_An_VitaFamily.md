# ĐẶC TẢ DỰ ÁN
# VITAFAMILY — HỆ THỐNG QUẢN LÝ CHĂM SÓC SỨC KHỎE GIA ĐÌNH

---

| | |
|---|---|
| Tên dự án | VitaFamily |
| Nhóm thực hiện | 4 thành viên |
| Phiên bản | 1.0 |
| Ngày tạo | 06/06/2026 |

---

## MỤC LỤC

1. Giới thiệu dự án
2. Mục tiêu dự án
3. Đối tượng người dùng
4. Công nghệ sử dụng
5. Danh sách chức năng
6. Các bảng dữ liệu chính
7. Yêu cầu phi chức năng

---

## 1. GIỚI THIỆU DỰ ÁN

VitaFamily là một **website quản lý sức khỏe gia đình**, cho phép người dùng đặt lịch khám bệnh online, theo dõi hồ sơ y tế và nhắc nhở uống thuốc cho tất cả thành viên trong gia đình chỉ với một tài khoản duy nhất.

### Vấn đề đang giải quyết

Hiện nay việc đặt lịch khám tại các phòng khám tư nhân vẫn chủ yếu qua điện thoại, rất bất tiện. Bên cạnh đó người bệnh không có chỗ lưu trữ hồ sơ khám, hay thường quên uống thuốc đúng giờ. VitaFamily ra đời để giải quyết những vấn đề đó.

### Phạm vi dự án

- Nền tảng **web** (máy tính + điện thoại), không làm app mobile riêng.
- 3 nhóm người dùng: Bệnh nhân, Bác sĩ, Quản trị viên.
- Tổng cộng **20 chức năng** chính.
- Thanh toán được **mô phỏng** (không dùng tiền thật).

---

## 2. MỤC TIÊU DỰ ÁN

| # | Mục tiêu |
|---|---------|
| 1 | Bệnh nhân đặt lịch khám online mà không cần gọi điện |
| 2 | Quản lý hồ sơ sức khỏe của cả gia đình trong một tài khoản |
| 3 | Nhắc nhở uống thuốc đúng giờ qua thông báo tự động |
| 4 | Bác sĩ chủ động quản lý lịch làm việc và danh sách bệnh nhân |
| 5 | Admin giám sát toàn bộ hoạt động của hệ thống |

---

## 3. ĐỐI TƯỢNG NGƯỜI DÙNG

Hệ thống có 3 loại người dùng với vai trò khác nhau:

### Bệnh nhân (Patient)
- Người dùng thông thường, đăng ký tài khoản để sử dụng dịch vụ.
- Có thể quản lý thông tin sức khỏe cho cả gia đình (cha, mẹ, con...).
- Đặt lịch khám, xem hồ sơ y tế, theo dõi đơn thuốc.

### Bác sĩ (Doctor)
- Đăng ký tài khoản và phải được Admin **duyệt hồ sơ** trước khi hoạt động.
- Tự tạo lịch làm việc, xác nhận lịch hẹn, ghi kết quả sau khi khám xong.

### Quản trị viên (Admin)
- Tài khoản được tạo sẵn, không đăng ký qua website.
- Quản lý toàn bộ hệ thống: duyệt bác sĩ, quản lý bệnh viện, xử lý thanh toán, gửi thông báo.

---

## 4. CÔNG NGHỆ SỬ DỤNG

| Phần | Công nghệ | Dùng để làm gì |
|------|-----------|----------------|
| Giao diện (Frontend) | React + Vite | Xây dựng giao diện người dùng |
| Máy chủ (Backend) | Node.js + Express | Xử lý logic, cung cấp API |
| Cơ sở dữ liệu | MySQL | Lưu trữ toàn bộ dữ liệu |
| Xác thực | JWT | Đăng nhập, phân quyền người dùng |
| Gửi email | Nodemailer + Gmail | Gửi OTP, xác nhận lịch hẹn, nhắc thuốc |
| Thông báo trình duyệt | Firebase FCM | Gửi push notification |
| Nhắc nhở tự động | node-cron | Chạy tác vụ định kỳ mỗi phút |
| AI Chatbot | Google Gemini | Trả lời câu hỏi sức khỏe |

---

## 5. DANH SÁCH CHỨC NĂNG

Hệ thống chia thành 3 nhóm chức năng theo từng đối tượng người dùng.

---

### NHÓM A — CHỨC NĂNG DÀNH CHO BỆNH NHÂN (7 chức năng)

---

#### A1 — Đăng ký & Đăng nhập

**Ai dùng:** Bệnh nhân, Bác sĩ

**Dùng để làm gì:**
Cho phép người dùng tạo tài khoản mới hoặc đăng nhập vào hệ thống. Sau khi đăng nhập, hệ thống tự nhận ra người dùng là bệnh nhân hay bác sĩ và chuyển đến trang tương ứng. Ngoài ra còn hỗ trợ **quên mật khẩu** — hệ thống gửi mã OTP về email để đặt lại mật khẩu mới.

---

#### A2 — Quản lý hồ sơ gia đình

**Ai dùng:** Bệnh nhân

**Dùng để làm gì:**
Một tài khoản có thể quản lý sức khỏe cho nhiều thành viên trong gia đình (ví dụ: bố, mẹ, con). Bệnh nhân tạo nhóm gia đình, sau đó thêm từng thành viên với thông tin cơ bản như tên, ngày sinh, giới tính, nhóm máu, dị ứng và bệnh nền. Khi đặt lịch khám, có thể chọn khám cho bất kỳ thành viên nào trong nhóm.

---

#### A3 — Xem hồ sơ khám bệnh

**Ai dùng:** Bệnh nhân (xem), Bác sĩ (ghi sau khi khám xong)

**Dùng để làm gì:**
Lưu lại lịch sử các lần khám bệnh của từng thành viên trong gia đình — gồm ngày khám, tên bệnh viện, tên bác sĩ, chẩn đoán và ghi chú điều trị. Bệnh nhân cũng có thể tự thêm hồ sơ khám thủ công (ví dụ: nhập lại kết quả khám từ nơi khác). Hồ sơ được tạo tự động sau khi bác sĩ hoàn thành ca khám.

---

#### A4 — Quản lý đơn thuốc & nhắc uống thuốc

**Ai dùng:** Bệnh nhân (xem, đánh dấu đã uống), Bác sĩ (kê đơn sau khám), Hệ thống (tự động gửi nhắc nhở)

**Dùng để làm gì:**
Chuyển đơn thuốc thành lịch nhắc nhở tự động. Khi có đơn thuốc (do bác sĩ kê hoặc bệnh nhân tự nhập), hệ thống sẽ tạo lịch nhắc theo giờ uống trong ngày (sáng, trưa, chiều, tối). Đúng giờ, hệ thống tự gửi thông báo và email nhắc nhở. Bệnh nhân nhấn "Đã uống" để xác nhận.

---

#### A5 — Đặt lịch khám

**Ai dùng:** Bệnh nhân

**Dùng để làm gì:**
Cho phép bệnh nhân tự đặt lịch khám online theo 3 hình thức: **khám tại viện**, **bác sĩ đến nhà**, hoặc **tư vấn qua video**. Bệnh nhân tìm bác sĩ theo chuyên khoa hoặc bệnh viện, xem lịch còn trống của bác sĩ, chọn khung giờ phù hợp rồi xác nhận và thanh toán. Có thể đặt lịch cho bản thân hoặc cho thành viên trong gia đình.

---

#### A6 — Chatbot tư vấn sức khỏe (AI)

**Ai dùng:** Bệnh nhân

**Dùng để làm gì:**
Trợ lý ảo hoạt động 24/7, trả lời các câu hỏi sức khỏe thông thường bằng tiếng Việt thông qua AI (Google Gemini). Chatbot **chỉ tư vấn thông tin chung**, không chẩn đoán bệnh và không kê đơn thuốc. Mọi phản hồi đều kèm lưu ý khuyến khích gặp bác sĩ để được tư vấn chính xác hơn.

---

#### A7 — Xem thông báo

**Ai dùng:** Bệnh nhân, Bác sĩ

**Dùng để làm gì:**
Hiển thị tất cả thông báo của người dùng tại một nơi: xác nhận lịch hẹn, nhắc lịch khám ngày mai, kết quả khám sẵn sàng, thông báo từ Admin... Có badge đỏ trên thanh menu hiển thị số thông báo chưa đọc. Người dùng có thể nhấn vào từng thông báo để chuyển đến trang liên quan.

---

### NHÓM B — CHỨC NĂNG DÀNH CHO BÁC SĨ (5 chức năng)

---

#### B1 — Quản lý hồ sơ bác sĩ

**Ai dùng:** Bác sĩ (tạo và cập nhật), Admin (duyệt)

**Dùng để làm gì:**
Bác sĩ điền thông tin chuyên môn của mình: tiểu sử, bằng cấp, kinh nghiệm, chuyên khoa, bệnh viện công tác và phí tư vấn. Hồ sơ này phải được Admin **duyệt** trước khi hiển thị công khai để bệnh nhân đặt lịch. Bác sĩ bị từ chối sẽ nhận email kèm lý do và có thể cập nhật lại hồ sơ để nộp lại.

---

#### B2 — Quản lý lịch làm việc

**Ai dùng:** Bác sĩ

**Dùng để làm gì:**
Bác sĩ tự tạo lịch làm việc cho từng ngày bằng cách thêm các **khung giờ khám** (ví dụ: 8:00–11:00, tối đa 10 bệnh nhân). Khi một khung giờ đã đủ bệnh nhân, hệ thống tự động khoá lại không cho đặt thêm. Bác sĩ xem lịch tổng quan theo tuần/tháng với màu sắc thể hiện trạng thái còn trống/gần đầy/đã đầy.

---

#### B3 — Xác nhận & quản lý lịch hẹn

**Ai dùng:** Bác sĩ

**Dùng để làm gì:**
Bác sĩ xem danh sách lịch hẹn và xử lý từng ca: **xác nhận** để giữ lịch hoặc **từ chối** kèm lý do. Trước khi khám, bác sĩ có thể xem trước hồ sơ của bệnh nhân (dị ứng, bệnh nền, lịch sử khám trước). Sau khi khám xong, bác sĩ đánh dấu "Hoàn thành" để chuyển sang bước ghi kết quả.

---

#### B4 — Ghi kết quả khám & kê đơn thuốc

**Ai dùng:** Bác sĩ

**Dùng để làm gì:**
Sau khi khám xong, bác sĩ ghi lại chẩn đoán, hướng dẫn điều trị và ngày tái khám (nếu có). Bác sĩ cũng có thể kê đơn thuốc điện tử với đầy đủ thông tin: tên thuốc, liều lượng, tần suất và khung giờ uống. Hệ thống tự động tạo hồ sơ khám cho bệnh nhân và tạo lịch nhắc uống thuốc.

---

#### B5 — Xem thống kê cá nhân & đánh giá

**Ai dùng:** Bác sĩ

**Dùng để làm gì:**
Trang tổng hợp số liệu cá nhân của bác sĩ: số ca khám trong tháng, biểu đồ ca khám theo ngày, tỉ lệ hoàn thành/hủy, điểm đánh giá trung bình và toàn bộ nhận xét từ bệnh nhân. Bác sĩ dùng trang này để theo dõi hiệu quả làm việc và nắm bắt phản hồi của người bệnh.

---

### NHÓM C — CHỨC NĂNG DÀNH CHO QUẢN TRỊ VIÊN (8 chức năng)

---

#### C1 — Quản lý người dùng

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin xem toàn bộ danh sách tài khoản trong hệ thống, tìm kiếm theo tên/email, lọc theo vai trò (bệnh nhân/bác sĩ) và trạng thái. Khi phát hiện tài khoản vi phạm, Admin có thể **khoá tài khoản** (kèm lý do) để người đó không đăng nhập được nữa, hoặc mở khoá lại sau khi xử lý.

---

#### C2 — Duyệt hồ sơ bác sĩ

**Ai dùng:** Admin

**Dùng để làm gì:**
Khi bác sĩ nộp hồ sơ, Admin nhận thông báo và vào xem xét thông tin chuyên môn. Nếu hồ sơ đầy đủ và hợp lệ thì **duyệt** — bác sĩ sẽ xuất hiện công khai để bệnh nhân tìm và đặt lịch. Nếu thiếu thông tin hoặc không hợp lệ thì **từ chối** và ghi rõ lý do để bác sĩ cập nhật lại.

---

#### C3 — Quản lý bệnh viện & chuyên khoa

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin thêm, sửa, ẩn hoặc xoá thông tin các bệnh viện/phòng khám liên kết và danh sách chuyên khoa y tế trong hệ thống. Đây là dữ liệu nền tảng — bác sĩ chọn bệnh viện và chuyên khoa từ danh sách này khi đăng ký hồ sơ; bệnh nhân lọc bác sĩ theo bệnh viện và chuyên khoa khi đặt lịch.

---

#### C4 — Quản lý dịch vụ

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin tạo và quản lý các gói dịch vụ khám (đặc biệt là dịch vụ khám tại nhà): tên dịch vụ, mô tả, giá tiền, thời gian thực hiện. Dịch vụ có thể được bật/tắt — khi tắt thì bệnh nhân sẽ không thấy dịch vụ đó khi đặt lịch nữa.

---

#### C5 — Quản lý lịch hẹn toàn hệ thống

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin xem tổng quan tất cả lịch hẹn trong hệ thống theo bộ lọc (ngày, bác sĩ, trạng thái, loại khám). Khi cần thiết, Admin có thể **huỷ lịch hẹn** khẩn cấp kèm lý do, hoặc **chuyển sang bác sĩ khác** khi bác sĩ gốc nghỉ đột xuất — hệ thống sẽ tự thông báo cho bệnh nhân.

---

#### C6 — Quản lý đánh giá & phản hồi

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin xem toàn bộ đánh giá bệnh nhân gửi cho bác sĩ, đặc biệt chú ý các đánh giá 1–2 sao. Nếu phát hiện nội dung vi phạm, Admin có thể **ẩn** đánh giá đó để không hiển thị công khai nữa hoặc **xoá** hẳn. Mọi thao tác đều được ghi lại trong nhật ký để truy vết.

---

#### C7 — Gửi thông báo hệ thống

**Ai dùng:** Admin

**Dùng để làm gì:**
Admin soạn và gửi thông báo hàng loạt đến người dùng, có thể chọn đối tượng nhận: **tất cả**, **chỉ bệnh nhân**, hoặc **chỉ bác sĩ**. Hỗ trợ **gửi ngay** hoặc **lên lịch gửi vào giờ cụ thể**. Trước khi gửi, Admin xem trước nội dung và số lượng người sẽ nhận.

---

#### C8 — Quản lý thanh toán

**Ai dùng:** Admin (duyệt hoàn tiền, xác nhận chuyển tiền cho bệnh viện), Bệnh nhân (thanh toán khi đặt lịch)

**Dùng để làm gì:**
Quản lý toàn bộ vòng đời thanh toán trong hệ thống:

- **Thanh toán**: Bệnh nhân thanh toán khi đặt lịch qua cổng thanh toán mô phỏng (VitaPay).
- **Hoàn tiền**: Khi bệnh nhân huỷ lịch, hệ thống tự tính % hoàn tiền dựa trên thời gian còn lại trước lịch khám. Admin duyệt hoặc từ chối yêu cầu hoàn tiền.
- **Chuyển tiền cho bệnh viện (Payout)**: Cuối mỗi tháng, Admin tổng hợp doanh thu và chuyển **85%** cho bệnh viện (giữ lại 15% phí hoa hồng).

**Chính sách hoàn tiền:**

| Thời gian huỷ trước lịch khám | Được hoàn |
|-------------------------------|----------|
| Từ 24 giờ trở lên | 100% |
| Từ 12 đến 24 giờ | 80% |
| Từ 6 đến 12 giờ | 50% |
| Dưới 6 giờ | 0% |
| Bác sĩ chủ động huỷ | 100% (bất kể thời gian) |

---

## 6. CÁC BẢNG DỮ LIỆU CHÍNH

Dưới đây là danh sách các bảng trong cơ sở dữ liệu và ý nghĩa của từng bảng:

| Bảng | Lưu trữ gì |
|------|-----------|
| `users` | Tài khoản người dùng (bệnh nhân, bác sĩ, admin) |
| `password_resets` | Mã OTP dùng để đặt lại mật khẩu |
| `fcm_tokens` | Token thiết bị để gửi push notification |
| `families` | Thông tin nhóm gia đình của mỗi bệnh nhân |
| `members` | Thông tin từng thành viên trong gia đình |
| `doctors` | Hồ sơ chuyên môn của bác sĩ |
| `doctor_specialties` | Bác sĩ thuộc chuyên khoa nào |
| `doctor_hospitals` | Bác sĩ làm việc tại bệnh viện nào |
| `doctor_schedules` | Lịch làm việc theo ngày của bác sĩ |
| `slots` | Các khung giờ khám trong mỗi ngày làm việc |
| `hospitals` | Danh sách bệnh viện/phòng khám liên kết |
| `specialties` | Danh sách chuyên khoa y tế |
| `services` | Các gói dịch vụ khám (đặc biệt là khám tại nhà) |
| `appointments` | Lịch hẹn khám của bệnh nhân |
| `medical_records` | Hồ sơ khám bệnh của từng thành viên |
| `examination_results` | Kết quả sau ca khám do bác sĩ ghi |
| `prescriptions` | Đơn thuốc |
| `prescription_items` | Chi tiết từng loại thuốc trong đơn |
| `reminders` | Lịch nhắc uống thuốc cho từng liều |
| `reviews` | Đánh giá của bệnh nhân sau khi khám |
| `notifications` | Thông báo của từng người dùng |
| `system_notifications` | Thông báo hệ thống do Admin gửi hàng loạt |
| `chat_sessions` | Phiên hội thoại với AI Chatbot |
| `chat_messages` | Nội dung từng tin nhắn trong hội thoại |
| `payments` | Thông tin thanh toán của từng lịch hẹn |
| `refunds` | Yêu cầu hoàn tiền |
| `payouts` | Khoản chuyển tiền cho bệnh viện cuối tháng |
| `payment_settings` | Cấu hình tỉ lệ hoa hồng và chính sách hoàn tiền |
| `audit_logs` | Nhật ký thao tác của Admin |

---

## 7. YÊU CẦU PHI CHỨC NĂNG

Đây là các yêu cầu về **chất lượng** của hệ thống, không phải tính năng cụ thể nhưng rất quan trọng.

### Hiệu năng
- Các trang web tải trong vòng **dưới 3 giây** với mạng bình thường.
- Thông báo nhắc thuốc gửi đi **không trễ quá 2 phút** so với giờ đã hẹn.
- Hệ thống hoạt động ổn định với khoảng **50 người dùng online cùng lúc**.

### Bảo mật
- Mật khẩu được **mã hoá** trước khi lưu vào database, không lưu dạng thô.
- Mỗi người dùng sau khi đăng nhập nhận được một **token** (JWT) để xác thực — token hết hạn sau 7 ngày.
- Mọi API nhạy cảm đều kiểm tra quyền truy cập — bệnh nhân không thể gọi API của admin hay bác sĩ.
- Dữ liệu truyền đi được **mã hoá qua HTTPS**.

### Dễ sử dụng
- Giao diện hoạt động tốt trên cả **máy tính và điện thoại**.
- Luồng đặt lịch khám hoàn thành trong **tối đa 6 bước** rõ ràng.
- Thông báo lỗi hiển thị **bằng tiếng Việt** và gợi ý cách sửa.
- Các thao tác không thể hoàn tác (xoá, huỷ lịch) đều có **bước xác nhận lại**.

### Độ tin cậy
- Khi xảy ra lỗi, hệ thống hiển thị thông báo thân thiện — **không để lộ lỗi kỹ thuật** ra màn hình.
- Dữ liệu thanh toán và lịch hẹn được xử lý theo nhóm (transaction) để đảm bảo **tính toàn vẹn**.

---

> **Lưu ý:** Tài liệu này mô tả tổng quan dự án để cả nhóm nắm được bức tranh chung.
> Chi tiết luồng xử lý, API và cấu trúc database được trình bày riêng trong tài liệu *"Chi tiết chức năng VitaFamily"*.

