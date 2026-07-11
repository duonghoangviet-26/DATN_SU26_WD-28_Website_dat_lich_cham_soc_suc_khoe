# Phân tích — Chức năng "Xác nhận hồ sơ khám" (KetQuaKham.status)

> Chỉ phân tích/phản biện, **chưa sửa code**. Đây là quan điểm để bạn quyết định giữ / bỏ / sửa lại thiết kế.

## 1. Chức năng này dùng để làm gì (theo thiết kế đọc được từ code)

`KetQuaKham` (hồ sơ khám) có field `status: cho_xac_nhan | da_xac_nhan | yeu_cau_chinh_sua`. Đọc comment trong code (`appointments.controller.js:294-296`):

> "Bác sĩ xác nhận hồ sơ khám đang 'cho_xac_nhan' (vd hồ sơ do y tá nhập — **module y tá chưa triển khai**, nhưng field/luồng xác nhận này dùng chung bất kể ai nhập)."

→ Đây là bước **QA nội dung lâm sàng**: được thiết kế cho kịch bản y tá nhập triệu chứng/sinh hiệu → bác sĩ xem lại, xác nhận đúng hoặc yêu cầu sửa, trước khi hồ sơ được coi là chính thức. Đây là 1 concern **khác** với việc "xác nhận lịch hẹn" (`LichHen.status`), vốn là bước chấp nhận đặt lịch trước khi khám. Về mặt thiết kế state machine, tách 2 luồng này ra là hợp lý cho hệ thống có y tá thật.

## 2. Vấn đề: hệ thống hiện tại KHÔNG có y tá — vậy ai tạo hồ sơ, ai xác nhận?

Đã verify bằng cách đọc kỹ route + controller:

- `POST /doctor/appointments/:id/result` (`createResult`) — chỉ bác sĩ đang đăng nhập gọi được, và chỉ tạo hồ sơ cho **lịch hẹn của chính họ** (`LichHen.findOne({ doctor_id: docId })`, `docId` suy từ JWT). `bac_si_phu_trach_id` được gán = docId của chính người tạo.
- `PATCH /doctor/appointments/:id/result/confirm` / `request-revision` — cũng chỉ bác sĩ đang đăng nhập, cũng chỉ trên lịch hẹn của chính họ (`doctor_id: docId` giống hệt).

→ **Người tạo hồ sơ và người xác nhận hồ sơ, trong 100% trường hợp hiện tại, là CÙNG MỘT bác sĩ.** Không có cách nào để 1 tài khoản khác (y tá, bác sĩ khác) chạm vào record của bác sĩ A. Điều này đã kiểm chứng chéo bằng test phân quyền (`test-doctor-page-api.js`): bác sĩ khác luôn nhận 404 khi cố xác nhận hồ sơ không phải của mình.

**Hệ quả:** mọi hồ sơ khám mới tạo, kể cả do chính bác sĩ tự nhập đầy đủ, mặc định `status = 'cho_xac_nhan'` (default trong schema, không phân biệt ai nhập) — bác sĩ phải bấm thêm 1 lần "Xác nhận hồ sơ" cho **chính nội dung họ vừa tự viết**. Đây là bước tự-duyệt-chính-mình, không có giá trị kiểm duyệt chéo như thiết kế gốc nhắm tới.

## 3. Không xác nhận thì sao? (đã trace toàn bộ codebase)

Grep toàn bộ `backend/src` cho các nơi đọc `KetQuaKham.status`:

| Nơi đọc `status` | Có gate hành vi theo status không? |
|---|---|
| `patient/records.controller.js` (bệnh nhân xem hồ sơ) | **Không** — trả về `chan_doan`, `huong_dan_dieu_tri`, đơn thuốc... bất kể `status` là gì. Field `status` thậm chí không được trả về cho bệnh nhân. |
| `admin/medical-read.controller.js` | **Không** đọc field này (grep 0 kết quả). |
| `LichHen.status` (appointment) | **Không** — `createResult` tự set appointment → `completed` ngay khi tạo hồ sơ, không chờ `KetQuaKham.status` chuyển `da_xac_nhan`. |
| `updateResult` (còn sửa được không) | Gate theo `co_the_sua` (boolean khác), **không liên quan** đến `status`. |
| Frontend (badge màu, label) | Có — chỉ hiển thị nhãn "Chờ xác nhận / Đã xác nhận / Cần chỉnh sửa" khác màu. |

**Kết luận:** nếu bác sĩ **không bao giờ bấm xác nhận**, hồ sơ vẫn nằm mãi ở `cho_xac_nhan` — nhưng bệnh nhân vẫn thấy đầy đủ chẩn đoán/đơn thuốc như bình thường, lịch hẹn vẫn `completed` bình thường, không ai bị chặn, không có cron/nhắc việc nào theo dõi hồ sơ "treo" quá lâu. Nói cách khác: **trạng thái xác nhận hiện tại thuần túy là trang trí (cosmetic)** — không có bất kỳ luồng nghiệp vụ nào tiêu thụ nó để ra quyết định.

## 4. Xác nhận thì thế nào (cơ chế hiện tại)

- Vào **"Lịch hẹn của tôi"** (`DoctorAppointments.tsx`) → bấm dòng lịch hẹn để mở rộng chi tiết → nếu `da_co_ket_qua && ket_qua_status === 'cho_xac_nhan'`, hiện 2 nút: "Xác nhận hồ sơ" (→ `da_xac_nhan`) và "Yêu cầu chỉnh sửa" (bắt buộc nhập lý do, → `yeu_cau_chinh_sua`).
- Có 1 trang riêng **"Hồ sơ chờ xác nhận"** (`DoctorPendingRecords.tsx`, gọi `GET /doctor/appointments/pending-results`) liệt kê đúng các hồ sơ này — nhưng trang này **chỉ xem, không có nút hành động** (comment trong code: "xác nhận/yêu cầu chỉnh sửa thực hiện ở trang Lịch hẹn của tôi"). Muốn xác nhận, bác sĩ phải rời trang này, qua trang khác, tự tìm đúng lịch hẹn, bấm mở rộng, rồi mới thấy nút.

→ Đây là **1 lỗ hổng UX rõ ràng**: có riêng 1 trang menu tên "Hồ sơ chờ xác nhận" nhưng không cho xác nhận tại chỗ — trái ngược với kỳ vọng tên trang.

## 5. Vấn đề phụ phát hiện thêm khi trace: "khóa sau 24 giờ" không có thật

- `ExamModal` hiển thị: "Kết quả đã lưu trên 24 giờ — không thể chỉnh sửa" khi `co_the_sua === false`.
- Nhưng: `co_the_sua` mặc định `true` (schema), và **grep toàn bộ `backend/src` không tìm thấy bất kỳ nơi nào set `co_the_sua = false`**. `NhatKyThaoTac.js:38` chỉ có 1 dòng comment nhắc tới 1 job tên `LOCK_EXAMINATION_RESULT` — nhưng `backend/src/cron/index.js` (nơi đăng ký toàn bộ cron job thật) chỉ có 2 job: sinh lịch T+7 và auto-cancel home quá hạn thanh toán. **Job khóa 24h không tồn tại.**
- → Dòng chữ "khóa sau 24 giờ" trên UI hiện tại **không bao giờ xảy ra thật** — bác sĩ luôn sửa được hồ sơ vô thời hạn. Đây là câu chữ gây hiểu lầm (nói 1 đằng, hệ thống làm 1 nẻo).
- Hệ quả liên đới: nếu sau này job này được bật, 1 hồ sơ ở trạng thái `yeu_cau_chinh_sua` (do request-revision) nhưng đã qua 24h sẽ **không sửa được nữa** (vì `updateResult` gate theo `co_the_sua`, không theo `status`) — tức "yêu cầu chỉnh sửa" thành công nhưng không ai sửa được. Chưa xảy ra hôm nay, nhưng là bẫy thiết kế cần lưu ý nếu bật job khóa 24h trong tương lai.

## 6. Trả lời thẳng câu hỏi "tại sao không gộp chung với xác nhận lịch hẹn"

Về mặt thiết kế lý thuyết, **không nên gộp** — đây là 2 concern nghiệp vụ khác nhau về bản chất:
- `LichHen.status` = có nhận ca khám này không (trước khi khám).
- `KetQuaKham.status` = nội dung khám (chẩn đoán, đơn thuốc) đã được rà soát/chốt hay chưa (sau khi khám) — vốn nhắm tới việc **người nhập ≠ người duyệt** (y tá nhập, bác sĩ duyệt).

Nhưng **trong hiện trạng dự án** (không có y tá, người nhập = người duyệt = cùng 1 bác sĩ), việc tách riêng này **không sai về lý thuyết nhưng vô dụng về thực tế** — nó chỉ là 1 bước bấm thêm không ai được lợi, không ảnh hưởng bệnh nhân, không ảnh hưởng lịch hẹn, không bị track bởi bất kỳ báo cáo/thống kê nào khác.

## 7. Test logic — các lỗi/điểm bất hợp lý cụ thể tìm được

1. **Tự-xác-nhận vô nghĩa**: chỉ 1 actor (chính bác sĩ) vừa tạo vừa duyệt — không có giá trị kiểm duyệt chéo như tên gọi "xác nhận" ngụ ý.
2. **Không có hệ quả downstream**: bệnh nhân, admin, thống kê... đều không đọc `status` này để ra quyết định gì — xác nhận hay không xác nhận, hệ thống vận hành y hệt nhau.
3. **UX 2 trang chồng chéo**: "Hồ sơ chờ xác nhận" (chỉ xem) và "Lịch hẹn của tôi" (mới có nút hành động thật) — gây khó hiểu, đi ngược kỳ vọng đặt tên trang.
4. **"Khóa 24h" là lời hứa suông**: text cảnh báo hiển thị nhưng cron job thực thi không tồn tại — enum/UI nói 1 đằng, hệ thống làm 1 nẻo (tương tự pattern "dead enum value" đã từng gặp ở `checked_in`/`in_progress` trước đây).
5. **Bẫy tương lai**: nếu bật lock 24h mà không sửa `requestResultRevision`, hồ sơ "cần chỉnh sửa" nhưng quá 24h sẽ vĩnh viễn không sửa được — mâu thuẫn nội tại giữa 2 field `status` và `co_the_sua` (2 cơ chế khóa độc lập, không đồng bộ với nhau).

## 8. Khuyến nghị (chỉ để bạn cân nhắc — chưa làm gì)

3 hướng khả dĩ, đánh đổi khác nhau:
- **(a) Giữ nguyên, chờ module y tá**: nếu nhóm sắp làm y tá thật, luồng này sẽ có ý nghĩa ngay — chỉ cần thêm UX gộp nút hành động vào đúng trang "Hồ sơ chờ xác nhận" cho tiện.
- **(b) Bỏ bước xác nhận khi người tạo = bác sĩ phụ trách**: tự động set `status = 'da_xac_nhan'` ngay khi bác sĩ tự tạo hồ sơ (vì tự duyệt chính mình vô nghĩa), chỉ giữ `cho_xac_nhan` cho hồ sơ do người khác (y tá) nhập — cần thêm điều kiện phân biệt người tạo vs người phụ trách.
- **(c) Bỏ hẳn field/luồng này** cho tới khi có module y tá thật, đơn giản hóa lại — giảm 1 lớp trạng thái không ai dùng.

Không có lựa chọn nào rẻ tuyệt đối; (a) an toàn nhất nếu y tá sắp được làm, (b)/(c) giảm rối hiện tại nhưng phải làm lại khi thêm y tá sau này.
