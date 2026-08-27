# Câu hỏi cần bạn đính chính / quyết định — để hoàn thiện kịch bản thuyết trình

> Đi kèm: `docs/Kich ban thuyet trinh - Check-in Kham Thanh toan (2026-08-26).md`
> Ngày lập: 2026-08-26

**Cách dùng:** trả lời theo số. Câu nào có 🔴 là **chặn** — chưa trả lời thì kịch bản còn chỗ nói sai hoặc nói hớ trước hội đồng. Câu 🟡 là tinh chỉnh. Câu 🔵 là bạn phải tự đi kiểm chứng ngoài code (mình không tra được).

---

## NHÓM A — Mâu thuẫn có thật trong dự án (bắt buộc chốt)

### 🔴 A1. Gọi là "phiên khám **4 bước**" hay "**5 bước**"?

Dự án đang tự mâu thuẫn với chính mình:

| Nguồn | Nói là |
|---|---|
| `docs/Hoi-dong/B-Bac-si-cau-tra-loi-va-doi-chieu.md` — câu B39, B45, B46 | **4 bước** |
| `docs/Ke hoach WS-1 - Luong kham 4 buoc (2026-08-08).md` — tiêu đề | **4 bước** |
| …nhưng chính file đó, dòng 92, tên unit test | **"thứ tự 5 bước cố định"** |
| `frontend/src/routes/AppRoutes.tsx:65` — comment | **5 bước** |
| Code thật: `CAC_BUOC` trong `examStepRules.js` | **5 phần tử** |
| Giao diện bác sĩ nhìn thấy | **5 chip đánh số 1→5** |

Sự thật kỹ thuật: **4 bước nhập liệu + 1 bước xác nhận = 5 chip trên màn hình.**

**Rủi ro:** nếu thầy cô đã đọc bộ `docs/Hoi-dong/` (nói 4 bước) rồi nhìn màn hình demo đếm ra 5 chip → bị hỏi vặn.

**Mình đề xuất:** nói **"5 bước, trong đó 4 bước nhập và 1 bước xác nhận"** — vừa khớp màn hình, vừa không phủ nhận tài liệu cũ. Bạn duyệt hay muốn cách khác?

---

### 🔴 A2. Bảo hiểm y tế — trả lời thế nào cho đúng và không hớ?

Đây là câu mình lo nhất, vì **sự thật phức tạp hơn "có" hoặc "không"**:

**CÓ tồn tại (chỉ là nhãn hiển thị):**
- `BacSi.bao_hiem = { nha_nuoc, bao_lanh }` (`models/BacSi.js:61-63`)
- `ThongTinPhongKham.bao_hiem` tương tự (`models/ThongTinPhongKham.js:30-32`)
- Admin tick được checkbox: `components/admin/services/DoctorServiceFieldsModal.tsx`
- Bệnh nhân **nhìn thấy badge** trên thẻ bác sĩ: `components/client/DoctorCard.tsx:43-48`

**KHÔNG tồn tại (nghiệp vụ thật):**
- Không có ô nhập số thẻ BHYT của bệnh nhân
- Không có bất kỳ phép tính giảm trừ nào trong hóa đơn
- Enum `'giam_tru_bao_hiem'` có trong `models/HoaDon.js:7` nhưng **không dòng code nào tạo ra khoản này** (đã grep toàn repo)
- Không kết nối cổng BHXH

**Câu hỏi cho bạn:** khi hội đồng hỏi *"hệ thống có hỗ trợ BHYT không?"*, bạn muốn trả lời theo hướng nào?

- **(a)** *"Hiện chỉ hiển thị thông tin phòng khám/bác sĩ có chấp nhận BHYT hay không, để bệnh nhân biết trước khi đặt. Phần tính giảm trừ viện phí chúng em đã chừa sẵn cấu trúc trong hóa đơn nhưng chưa triển khai vì phòng khám tư quy mô nhỏ chưa ký hợp đồng BHXH."* ← mình nghiêng về hướng này, thành thật và có lý do nghiệp vụ
- **(b)** Không nhắc gì tới BHYT, nếu bị hỏi mới nói "chưa làm"
- **(c)** Bạn có lý do khác (đề tài đã chốt là không làm BHYT?) — cho mình biết để viết lại

**Kèm câu hỏi phụ:** trong **đặc tả gốc** (`Tài liệu dự án/Đặc tả/`) nhóm có **cam kết** làm BHYT không? Mình không đọc được file PDF/Word trong đó. Nếu có cam kết mà không làm thì phải chuẩn bị câu trả lời khác hẳn.

---

### 🟡 A3. Hai trạng thái "chết" — nói hay giấu?

- `cho_dich_vu` (chờ làm dịch vụ) — có trong enum `HangDoi`, **không luồng nào ghi vào**, chỉ được đọc ở bộ lọc
- `waiting_doctor_confirm` — có trong enum `LichHen`, **không dòng nào ghi vào**

Chính `.claude/rules/lich-lam-viec-bac-si.md` mục 9 cũng ghi *"CÒN THIẾU: trạng thái `cho_dich_vu`"*.

**Chọn hướng:**
- **(a)** Không nhắc. Nếu bị soi enum thì nói "đã chừa chỗ cho giai đoạn 2".
- **(b)** Chủ động nói: *"chúng em đã thiết kế sẵn trạng thái chờ làm dịch vụ, hiện luồng chưa nối vì phạm vi đồ án"* — biến điểm yếu thành điểm cho thấy có tầm nhìn.

Mình nghiêng **(b)** nhưng chỉ khi bạn tự tin, vì nói ra là mời hội đồng đào sâu.

---

## NHÓM B — Ranh giới "nói gì / không nói gì"

### 🟡 B1. VNPAY đang là sandbox — thừa nhận hay né?

Mình đã kiểm chứng: `backend/.env` **không hề có** `VNP_URL` hay `VNP_TMNCODE`, nên hệ thống rơi về giá trị hardcode trong `billing.controller.js:82-84` = `https://sandbox.vnpayment.vn/...`, TMN code `WVZUTWIX` (trùng y hệt `.env.example`).

→ **Chắc chắn là sandbox, chưa có merchant thật.**

Bạn muốn: (a) chủ động nói "môi trường sandbox của VNPAY", hay (b) chỉ nói "cổng thanh toán VNPAY" và chờ bị hỏi?

*(Mình khuyên (a) — hội đồng đồ án không ai kỳ vọng sinh viên có merchant thật, nhưng bị bắt giấu thì mất điểm trung thực.)*

---

### 🟡 B2. Xác nhận chuyển khoản làm tay — đây là "chủ ý" hay "chưa làm"?

Code không có IPN/webhook tự động; lễ tân phải mở app ngân hàng đối chiếu rồi bấm xác nhận. Comment trong `billing.controller.js` ghi là **cố ý** ("không tự động hoá xác nhận qua IPN/return").

Bạn muốn kể theo hướng nào?
- **(a)** *"Chủ ý — phòng khám nhỏ, người thu tiền phải chịu trách nhiệm bằng mắt, và mọi lần xác nhận đều ghi tên người thu vào nhật ký."* ← nghe chuyên nghiệp
- **(b)** *"Chưa kịp làm webhook."* ← thành thật hơn nhưng yếu hơn

---

### 🟡 B3. Hoàn tiền — nếu bị hỏi thì trả lời sao?

Rule mục 5 chốt **KHÔNG hoàn tiền trong mọi trường hợp**. Nhưng repo vẫn còn endpoint `POST /api/receptionist/payments/:id/refund` (theo ghi chú cũ của nhóm thì đây là **stub chưa nối thật**).

Bạn muốn kịch bản chuẩn bị sẵn câu trả lời cho tình huống hội đồng hỏi *"khách hủy thì sao, có trả tiền lại không?"* không? Nếu có, mình sẽ viết thêm một đoạn giải thích **cơ chế thay thế** (tiền được bảo toàn thành **quyền dời lịch** chứ không hoàn) — cái này là điểm mạnh nghiệp vụ, đáng khoe.

---

### 🟡 B4. Không có màn hình gọi số ở sảnh — có cần giải thích không?

Thực tế trong code: bác sĩ bấm "Gọi bệnh nhân" → hệ thống tạo `ThongBao` **cho lễ tân** → lễ tân đi dẫn khách vào. Không có TV, không có loa.

Có cần mình viết một câu chống đỡ kiểu *"mô hình phòng khám nhỏ, lễ tân dẫn khách trực tiếp, không cần màn hình sảnh"* không? Hay bạn định làm thêm màn hình đó trước buổi bảo vệ?

---

## NHÓM C — Bạn phải tự kiểm chứng ngoài code (mình chịu)

### 🔵 C1. Máy in nhiệt 80mm đã in thử thật chưa?

Code có template CSS `@page { size: 80mm 200mm }` (`QueueTicketTemplate.tsx`) và `InvoiceReceiptTemplate.tsx`, gọi `window.print()`. Nhưng **có phần cứng để demo không?**

Ba khả năng, mỗi khả năng mình viết kịch bản khác nhau:
- Có máy in thật, đã in ra giấy được → nói mạnh, thậm chí in tại chỗ
- Chỉ in ra PDF / xem preview → nói "xuất phiếu khổ 80mm", demo bằng preview
- Chưa từng thử → **bỏ hẳn** phần in khỏi kịch bản, đừng hứa

### 🔵 C2. Realtime (socket) có chạy trong môi trường demo không?

Kịch bản đang có câu *"màn hình bác sĩ tự cập nhật, không phải bấm F5"* (`services/doctorQueueRealtime.service.js` → sự kiện `doctor:queue_updated`).

Nếu demo mà phải F5 thật thì câu này thành nói dối trước mặt hội đồng. **Bạn mở 2 cửa sổ (lễ tân + bác sĩ) thử một lần giúp mình.**

### 🔵 C3. Dữ liệu demo đã sẵn sàng chưa?

Để diễn trọn 3 chặng, hôm demo cần có sẵn:
- Ít nhất **1 lịch hẹn `confirmed`, đã thanh toán, đúng ngày demo**, thuộc khung giờ đang diễn ra
- Bác sĩ đó **có ca làm việc** đúng khung đó (nếu ngoài ca, nút "Gọi bệnh nhân" sẽ bị chặn — `bacSiDangTrongCaLamViec()`)
- Tài khoản đăng nhập sẵn cho cả 3 vai: lễ tân, bác sĩ, (và bệnh nhân nếu cần)

Bạn đã có bộ dữ liệu này chưa, hay cần mình viết script seed?

### 🔵 C4. Demo lúc mấy giờ?

Nghe lạ nhưng **rất quan trọng**: hệ thống chặn gọi bệnh nhân khi bác sĩ **ngoài ca hoặc trong giờ nghỉ trưa** (11:30–13:30). Ca sáng 08:00–11:30, ca chiều 13:30–17:30.

→ **Demo vào 11:45 hoặc 18:00 là nút "Gọi bệnh nhân" bấm không được.** Bạn cho mình biết khung giờ bảo vệ để mình ghi cảnh báo vào kịch bản (hoặc tính đường lùi).

*(Tin tốt mình đã kiểm: `.env` **không set** `NODE_ENV=production` và **không set** `NO_SHOW_SWEEP_ENABLED`, nên cron tự đánh dấu vắng mặt **sẽ không chạy** — dữ liệu demo an toàn, không bị máy đánh dấu `no_show` giữa buổi.)*

---

## NHÓM D — Bối cảnh buổi thuyết trình (để mình chỉnh đúng liều lượng)

### 🔴 D1. Bạn có **bao nhiêu phút** thật sự?

Kịch bản hiện tại: Phần 1 ~6–7 phút + Phần 2 ~3 phút = **~10 phút**.

- Nếu bạn chỉ có **5 phút** → mình phải cắt mục 4 (gọi bệnh nhân) gộp vào mục 3, và bỏ hẳn Phần 2
- Nếu có **15 phút** → mình viết dày thêm phần khám và thêm đoạn về xử lý bác sĩ nghỉ đột xuất

### 🔴 D2. Vừa nói vừa **demo live**, hay chỉ nói + slide?

Khác nhau hoàn toàn:
- **Demo live** → mình phải viết lại thành **script thao tác**: bấm nút nào, chờ gì, nói gì trong lúc chờ loading, và **phương án cứu** khi lỗi
- **Chỉ nói** → giữ nguyên văn phong kể chuyện như hiện tại
- **Nói + video quay sẵn** → mình chèn mốc "ở đây chạy video, bạn nói đè"

### 🟡 D3. Bạn nói **một mình** hay chia vai với 3 bạn còn lại?

Nếu chia (ví dụ: bạn kể lễ tân, bạn khác kể bác sĩ), mình sẽ đánh dấu rõ **điểm bàn giao** và viết câu chuyển tiếp cho mượt.

### 🟡 D4. Người nghe là ai?

- **Hội đồng chấm đồ án** → nhấn kỹ thuật: transaction, ràng buộc, vì sao thiết kế vậy
- **Giả lập khách hàng / chủ phòng khám** → nhấn lợi ích: nhanh hơn, ít nhầm hơn, đối soát được
- **Buổi nội bộ nhóm** → nhấn luồng dữ liệu

Kịch bản hiện tại đang viết cho **hội đồng chấm**. Đúng chưa?

### 🟡 D5. Có cần khớp với bộ `docs/Hoi-dong/` không?

Nhóm đã có sẵn `docs/Hoi-dong/B-Bac-si-cau-tra-loi-va-doi-chieu.md` — bộ Q&A dự phòng (B39, B45, B46… đều về đúng luồng khám này).

Bạn muốn mình **rà chéo** kịch bản mới với bộ đó để không có chỗ nào nói vênh nhau không? *(Mình đã phát hiện 1 chỗ vênh — xem A1.)*

### 🟡 D6. Có được dùng **sơ đồ** không?

Luồng này có 3 vai × 6 mốc trạng thái — một sơ đồ khối sẽ giúp người nghe bám theo dễ hơn nhiều. Nếu được, mình dựng sơ đồ luồng (Mermaid hoặc trang web xem được) để bạn chiếu kèm.

---

## Tóm tắt — 6 câu chặn cần trả lời trước

1. **A1** — gọi 4 bước hay 5 bước?
2. **A2** — BHYT trả lời theo hướng nào? (và đặc tả gốc có cam kết không?)
3. **D1** — bao nhiêu phút?
4. **D2** — có demo live không?
5. **C1** — máy in có thật không?
6. **C4** — demo lúc mấy giờ? (sợ rơi vào giờ nghỉ trưa)

Trả lời 6 câu này là mình cập nhật được kịch bản ngay. Các câu còn lại trả lời sau cũng kịp.
