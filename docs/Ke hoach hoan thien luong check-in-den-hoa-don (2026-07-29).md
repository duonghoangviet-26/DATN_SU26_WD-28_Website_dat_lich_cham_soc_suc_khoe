# Kế hoạch hoàn thiện luồng: Check-in → Khám → Hóa đơn → Ra về

Ngày: 2026-07-29
Phạm vi: khách khám tại phòng khám, gồm khách đã đặt trước và khách vãng lai.

## 1. Mục tiêu nghiệm thu

Một lượt khám chỉ được coi là hoàn tất khi truy được đầy đủ chuỗi sau:

```text
Hồ sơ đúng người
→ hàng đợi đúng bác sĩ
→ ca khám và hồ sơ khám hoàn tất
→ hóa đơn đúng các khoản được phép thu
→ giao dịch đã thu đủ
→ hóa đơn/PDF đã được in hoặc giao cho khách
```

Không tạo bảng nghiệp vụ mới nếu không cần thiết. Giữ `LichHen` cho online, `HangDoi` cho lượt thực tế, `KetQuaKham` cho chỉ định chuyên môn, `HoaDon` và `ThanhToan` cho tài chính. `HoaDon` hiện đã hỗ trợ gắn với `appointment_id` hoặc `hang_doi_id`.

## 2. Quy ước nghiệp vụ chốt để triển khai

1. **Lễ tân** là nơi duy nhất tạo check-in tại quầy và tạo lượt walk-in.
2. **Bác sĩ** chỉ thao tác trên lượt đã xuất hiện trong hàng đợi của mình: gọi, vào phòng, kết thúc, nhập/xác nhận kết quả.
3. Lịch online chỉ được check-in khi là lịch khám tại phòng khám, đúng ngày, có bác sĩ và ở trạng thái cho phép. Quy tắc mặc định: `confirmed` là hợp lệ; các ngoại lệ phải được ghi rõ, không dùng điều kiện “không phải trạng thái kết thúc”.
4. Lịch online chưa thanh toán không được vào phòng, trừ khi sau này có một cờ nghiệp vụ rõ ràng như `pay_at_clinic` cùng quyền duyệt của lễ tân.
5. Walk-in chỉ được tạo từ slot walk-in còn hiệu lực, được backend giữ nguyên tử.
6. Dịch vụ phát sinh do **bác sĩ chỉ định trong hồ sơ khám**. Thu ngân không được tự thêm dịch vụ chuyên môn.
7. Khách online đã trả tiền đặt lịch: khoản đó là phần đã thu của hóa đơn. Thu ngân chỉ thu phần còn thiếu. Walk-in thu sau khi hồ sơ khám được xác nhận.
8. Chỉ khi hóa đơn `da_thanh_toan_du` mới cho phép in/giao hóa đơn và đánh dấu khách đã hoàn tất thủ tục ra về.

## 3. Backlog triển khai theo task

### TASK 0 — Chốt contract trạng thái và quyền thao tác

**Mục đích:** biến các quy ước trên thành contract dùng chung trước khi sửa code.

**Thao tác người dùng được bảo vệ:**

```text
Lễ tân: nhận diện, check-in, tạo walk-in, thu tiền.
Bác sĩ: phục vụ bệnh nhân, ghi kết quả, chỉ định dịch vụ.
Thu ngân: lập/cập nhật hóa đơn từ dữ liệu hợp lệ, xác nhận tiền, in hóa đơn.
```

**Việc làm:**

- Lập hằng số/guard cho trạng thái check-in online được phép.
- Xác định rõ trạng thái “hoàn tất lâm sàng” và “hoàn tất tài chính”; không dùng một nhãn `hoan_thanh` để suy diễn cả hai.
- Ghi contract API và thông điệp lỗi 400/403/409 cho từng vai trò.

**Không làm:** đổi schema lớn hoặc đổi tên enum hàng loạt.

**Xong khi:** mọi task sau dùng cùng danh sách trạng thái; không còn điều kiện kiểu “không bị hủy là được”.

**Phụ thuộc:** không có.

---

### TASK 1 — Khóa đúng điểm check-in và điều kiện vào phòng của khách online

**Người dùng thao tác:** lễ tân chọn lịch đã đặt và bấm `Check-in lịch hẹn`; bác sĩ bấm `Vào khám ngay` hoặc `Vào phòng`.

**Hiện trạng cần sửa:** check-in cho phép quá rộng; hệ thống mới cảnh báo lịch chưa thanh toán, chưa chặn cứng khi vào phòng.

**Việc làm:**

- `checkInLichHen`: chỉ nhận trạng thái lịch nằm trong allow-list của TASK 0.
- `intoRoom`: khi lượt có `appointment_id`, đọc trạng thái thanh toán mới nhất và từ chối nếu chưa đủ điều kiện.
- Trả lỗi có hành động tiếp theo: “Lịch chưa thanh toán, mời thu ngân xác nhận trước khi vào phòng.”
- Giao diện bác sĩ hiển thị nguyên văn lỗi backend; không đổi trạng thái phòng khi request thất bại.

**Ca thành công:** lịch `confirmed` + `paid` → check-in → `HangDoi.dang_cho` → vào phòng.

**Ca thất bại bắt buộc:** lịch `pending`, lịch hủy, lịch sai ngày, lịch chưa thanh toán, lịch đã có hàng đợi, phòng chưa sẵn sàng.

**File dự kiến:**

- `backend/src/services/checkIn.service.js`
- `backend/src/controllers/doctor/queue.controller.js`
- `frontend/src/pages/receptionist/PatientIntake.tsx`
- `frontend/src/pages/doctor/DoctorExamQueue.tsx`

**Phụ thuộc:** TASK 0.

---

### TASK 2 — Loại bỏ đường tắt bypass lễ tân

**Người dùng thao tác:** bác sĩ mở danh sách chờ khám.

**Hiện trạng cần sửa:** màn hình bác sĩ có thể tự check-in khách vãng lai; đường này bỏ qua xác minh hồ sơ, slot, độ trễ và căn cứ phân bác sĩ.

**Việc làm:**

- Ẩn/xóa form `Check-in vãng lai` phía bác sĩ.
- Không cho API bác sĩ tạo walk-in tự do; trả `403` hoặc chỉ cho phép một endpoint “khẩn cấp” riêng nếu sau này có quyết định nghiệp vụ và lý do bắt buộc.
- Danh sách bác sĩ chỉ hiển thị lượt do lễ tân tạo hoặc lịch đã được lễ tân check-in.

**Ca thành công:** walk-in luôn đi qua `Tiếp nhận tại quầy`, có `schedule_id`, `slot_id`, `nguoi_tiep_nhan_id`.

**Ca thất bại bắt buộc:** tài khoản bác sĩ gọi API tạo walk-in; request bị từ chối và không tạo `HangDoi`.

**File dự kiến:**

- `frontend/src/pages/doctor/DoctorExamQueue.tsx`
- `backend/src/controllers/doctor/queue.controller.js`
- `backend/src/routes/doctor/queue.routes.js`

**Phụ thuộc:** TASK 0.

---

### TASK 3 — Ghi chỉ định dịch vụ từ hồ sơ khám

**Người dùng thao tác:** bác sĩ nhập hồ sơ, chọn dịch vụ phát sinh phù hợp chuyên khoa, rồi xác nhận hồ sơ.

**Hiện trạng cần sửa:** `KetQuaKham.dich_vu_phat_sinh` đã có trong model nhưng API/UI chưa ghi dữ liệu; thu ngân lại tự chọn dịch vụ.

**Việc làm:**

- Bổ sung danh sách dịch vụ hợp lệ theo chuyên khoa trong modal nhập kết quả khám.
- API tạo/cập nhật/xác nhận kết quả validate: dịch vụ active, đúng chuyên khoa hoặc dịch vụ dùng chung, số lượng nguyên dương.
- Lưu snapshot tối thiểu: `service_id`, tên, đơn giá tại lúc chỉ định, số lượng, ghi chú.
- Khóa thay đổi chỉ định sau khi bác sĩ đã xác nhận hồ sơ; muốn sửa phải đi qua luồng yêu cầu chỉnh sửa hiện có.

**Ca thành công:** bác sĩ xác nhận hồ sơ có 2 dịch vụ → `KetQuaKham` chứa đúng 2 dòng được chỉ định.

**Ca thất bại bắt buộc:** dịch vụ ngừng hoạt động, sai chuyên khoa, số lượng 0/âm, chỉnh sửa sau xác nhận.

**File dự kiến:**

- `frontend/src/components/doctor/ExamResultModal.tsx`
- `frontend/src/services/doctor-appointment.service.ts`
- `backend/src/controllers/doctor/appointments.controller.js`
- `backend/src/models/KetQuaKham.js` (chỉ sửa nếu schema hiện tại thiếu dữ liệu snapshot)

**Phụ thuộc:** TASK 0.

---

### TASK 4 — Tạo nguồn dữ liệu thu ngân thống nhất cho online và walk-in

**Người dùng thao tác:** thu ngân mở danh sách “chờ thanh toán”.

**Hiện trạng cần sửa:** danh sách hiện chỉ lọc `nguon: offline`; khách online không có đường thu phần phát sinh hoặc nhận hóa đơn cuối.

**Việc làm:**

- Tạo truy vấn/endpoint trả về các lượt đã hoàn tất lâm sàng nhưng hóa đơn chưa thanh toán đủ, gồm cả `appointment_id` và `hang_doi_id`.
- Chuẩn hóa DTO `BillingCase`: bệnh nhân, nguồn, bác sĩ, chuyên khoa, tham chiếu lượt, hóa đơn hiện có, tiền đã thu, công nợ, dịch vụ đã chỉ định.
- Với online, nạp hóa đơn/giao dịch tiền đặt lịch hiện có và coi đó là số tiền đã thu.
- Với walk-in, chỉ đưa vào danh sách sau khi có `KetQuaKham` đã xác nhận.

**Ca thành công:** một khách online có dịch vụ phát sinh và một walk-in đã khám đều xuất hiện ở cùng danh sách thu ngân.

**Ca thất bại bắt buộc:** chưa kết thúc khám, chưa xác nhận hồ sơ, hóa đơn đã đủ tiền, dữ liệu thuộc bác sĩ/ngày khác không hợp lệ.

**File dự kiến:**

- `backend/src/controllers/receptionist/offline-payment.controller.js` (đổi tên hoặc tách controller theo scope mới)
- `backend/src/routes/receptionist/offline-payment.routes.js`
- `frontend/src/services/receptionist-patient-intake.service.ts`
- `frontend/src/pages/receptionist/Payments.tsx`

**Phụ thuộc:** TASK 3.

---

### TASK 5 — Lập/cập nhật hóa đơn chỉ từ nguồn hợp lệ

**Người dùng thao tác:** thu ngân chọn một ca và bấm `Lập hóa đơn` hoặc `Thu phần còn lại`.

**Việc làm:**

- Tạo hoặc tái sử dụng đúng một hóa đơn theo `appointment_id` hoặc `hang_doi_id`.
- Tạo các dòng phí khám và dịch vụ từ dữ liệu đã được bác sĩ xác nhận; thu ngân không gửi danh sách dịch vụ tùy ý.
- Tính `tổng phải thu - tổng đã thu`; với online, cộng các giao dịch `paid` trước đó vào tổng đã thu.
- Chặn cập nhật hóa đơn nếu có giao dịch chuyển khoản `pending`.
- Thực hiện update hóa đơn/giao dịch theo transaction hoặc điều kiện cập nhật nguyên tử để chống thao tác hai tab.

**Ca thành công:**

```text
Online: phí đã trả 200k + phát sinh 100k → cần thu 100k.
Walk-in: phí khám 150k + phát sinh 100k → cần thu 250k.
```

**Ca thất bại bắt buộc:** tạo hóa đơn trước hồ sơ khám, thêm dịch vụ không do bác sĩ chỉ định, tạo hóa đơn thứ hai, sửa tổng nhỏ hơn tiền đã thu, xử lý giao dịch đang pending.

**File dự kiến:**

- `backend/src/controllers/receptionist/*payment*.controller.js`
- `backend/src/services/hoaDon.service.js`
- `backend/src/models/HoaDon.js`
- `backend/src/models/ThanhToan.js`

**Phụ thuộc:** TASK 4.

---

### TASK 6 — Hoàn thiện màn hình thu ngân

**Người dùng thao tác:** thu ngân xem chi tiết, chọn phương thức, xác nhận đã nhận tiền/chuyển khoản.

**Việc làm:**

- Đổi danh sách “lượt offline” thành “ca chờ thanh toán”, có nhãn nguồn Online/Walk-in.
- Hiện rõ: phí khám, dịch vụ bác sĩ chỉ định, đã thu, còn phải thu, số hóa đơn, giao dịch đang chờ.
- Bỏ checkbox tự thêm dịch vụ khỏi màn hình thu ngân.
- Tiền mặt: tạo giao dịch `paid` và cập nhật tổng ngay.
- Chuyển khoản: tạo `pending`; chỉ chuyển `paid` khi thu ngân xác nhận đã đối soát.
- Sau thành công, tải lại dữ liệu và vô hiệu hóa thao tác không còn hợp lệ.

**Ca thành công:** thu đủ → hóa đơn `da_thanh_toan_du`, không còn trong danh sách chờ tiền.

**Ca thất bại bắt buộc:** xác nhận lại giao dịch đã xử lý, thanh toán khi đang có pending, API lỗi, thao tác song song ở hai tab.

**File dự kiến:**

- `frontend/src/pages/receptionist/Payments.tsx`
- `frontend/src/services/receptionist-patient-intake.service.ts`

**Phụ thuộc:** TASK 4 và TASK 5.

---

### TASK 7 — In/giao hóa đơn và chốt khách ra về

**Người dùng thao tác:** sau khi hóa đơn đủ tiền, thu ngân bấm `In hóa đơn` hoặc `Tải PDF`, giao khách.

**Việc làm:**

- Tạo view hóa đơn in được/PDF, dùng dữ liệu server trả về, không tự tính lại tiền ở frontend.
- Nội dung tối thiểu: số hóa đơn, người bệnh, ngày giờ, các dòng thu, tổng, đã thu, phương thức/giao dịch, người thu.
- Chỉ hiện nút in khi `trang_thai_hoa_don = da_thanh_toan_du`.
- Ghi audit `PRINT_INVOICE`/`HAND_OVER_INVOICE` với người thao tác và thời điểm.
- Sau khi giao, ca được đánh dấu hoàn tất thủ tục tài chính; không xóa dữ liệu khỏi lịch sử.

**Ca thành công:** khách nhận được bản in/PDF có số hóa đơn khớp dữ liệu server.

**Ca thất bại bắt buộc:** hóa đơn chưa đủ tiền, truy cập hóa đơn không thuộc quyền lễ tân, số tiền frontend khác server.

**File dự kiến:**

- `frontend/src/pages/receptionist/Payments.tsx` hoặc component `InvoiceReceipt.tsx` mới
- `backend/src/controllers/receptionist/*payment*.controller.js`
- `backend/src/models/NhatKyThaoTac.js` (chỉ khi action enum cần bổ sung)

**Phụ thuộc:** TASK 5 và TASK 6.

---

### TASK 8 — Kiểm thử đầu-cuối, phân quyền và dữ liệu demo

**Mục đích:** chỉ nghiệm thu khi dữ liệu đi được xuyên suốt, không chỉ từng API riêng lẻ.

**Bộ test bắt buộc:**

1. Online đã trả tiền: check-in → khám → chỉ định → thu phần phát sinh → in hóa đơn.
2. Online chưa trả tiền: check-in có thể bị từ chối hoặc cảnh báo theo contract, nhưng tuyệt đối không vào phòng khi chưa đủ điều kiện.
3. Walk-in còn slot: nhận tại quầy → đúng bác sĩ → khám → hóa đơn → in.
4. Walk-in hết slot/trễ ca: không tạo hàng đợi và có minh chứng lý do.
5. Hai lễ tân giữ cùng slot: chỉ một người thành công; người còn lại nhận 409 và dữ liệu mới.
6. Bác sĩ cố tạo walk-in trực tiếp: bị từ chối.
7. Thu ngân cố thêm dịch vụ không có chỉ định: bị từ chối.
8. Chuyển khoản pending: không in hóa đơn; xác nhận tiền xong mới in được.
9. Kiểm tra múi giờ tối: slot của BS. Lê Quốc Bảo hiển thị, check-in và hàng đợi đúng ngày.

**Kiểm tra kỹ thuật:** `node --check` backend liên quan, `npm run typecheck` frontend, test service hiện có, test API theo role và chạy lại luồng trên giao diện.

**Phụ thuộc:** TASK 1 đến TASK 7.

## 4. Thứ tự triển khai

```text
TASK 0
 ├─ TASK 1 ─┐
 ├─ TASK 2 ─┤
 └─ TASK 3 ─┴─ TASK 4 → TASK 5 → TASK 6 → TASK 7 → TASK 8
```

TASK 1 và TASK 2 là hàng rào an toàn, phải làm trước. TASK 3–7 là chuỗi tài chính; không triển khai giao diện thu ngân mới khi chưa có nguồn dịch vụ do bác sĩ chỉ định và API dữ liệu thống nhất.

## 5. Tiêu chí hoàn tất toàn bộ

- Không có đường tạo walk-in ngoài lễ tân.
- Không có khách online chưa đủ điều kiện thanh toán đi vào phòng.
- Không có dịch vụ nào được thu nếu không có chỉ định chuyên môn.
- Một ca chỉ có một hóa đơn nghiệp vụ; không tạo trùng khi bấm lại hoặc mở hai tab.
- Online và walk-in đều đi tới cùng điểm kết thúc: hóa đơn đủ tiền, in/giao được, có lịch sử thao tác.
- Toàn bộ các ca ở TASK 8 đạt trên giao diện và API.
