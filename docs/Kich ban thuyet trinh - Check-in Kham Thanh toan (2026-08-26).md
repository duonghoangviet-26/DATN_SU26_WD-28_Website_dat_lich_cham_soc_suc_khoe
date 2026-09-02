# Kịch bản DEMO LIVE — Check-in → Khám → Thanh toán

> **Hình thức:** chiếu màn hình, chạy dự án thật · **Thời lượng: 10 phút**
> **Ngày:** 2026-08-26 · **Nhánh:** `Fix_demo`
> **Bối cảnh đã chốt:** phòng khám tư — **không áp dụng BHYT**. Không có máy in thật (chỉ nói bằng miệng, **không bấm in**).

**Cách đọc file này:**
- 🖱 = thao tác tay
- 🗣 = lời nói (đọc gần như nguyên văn)
- ⏳ = câu nói lấp lúc chờ màn hình load — **đừng im lặng nhìn spinner**
- 🚨 = phương án cứu khi lỗi

---

## ⚙️ CHUẨN BỊ TRƯỚC (làm xong 15 phút trước khi lên)

### Hai cửa sổ trình duyệt, KHÔNG dùng 2 tab

| | Cửa sổ | Đăng nhập | Mở sẵn ở |
|---|---|---|---|
| **A** | Chrome thường | **Lễ tân** | `/receptionist/patient-intake`, tab *"Tra cứu & tiếp nhận"* |
| **B** | Chrome ẩn danh | **Bác sĩ** | `/doctor/pending-records` |

> Dùng 2 cửa sổ riêng vì 2 vai đăng nhập khác nhau — chung trình duyệt sẽ đá token của nhau. Chuyển qua lại bằng **Alt+Tab**, tập trước cho quen.

### Checklist bắt buộc tick hết

- [ ] Có **1 lịch hẹn** trạng thái `confirmed`, **đã thanh toán**, **đúng ngày demo**
- [ ] **Ghi sẵn số điện thoại** của lịch đó ra giấy nhớ dán màn hình
- [ ] Chuẩn bị **số điện thoại dự phòng thứ 2** (một lịch khác) phòng khi ca đầu hỏng
- [ ] **Bác sĩ của lịch đó đang trong ca làm việc** vào giờ demo ⚠️ *(xem cảnh báo bên dưới)*
- [ ] Chạy thử **trọn vẹn cả 3 chặng** một lần với ca khác — để chắc không kẹt
- [ ] Zoom trình duyệt **110–125%**, tắt thông báo Windows/Chrome
- [ ] Backend + frontend đang chạy, không có lỗi đỏ trong console

### ⚠️ Cảnh báo giờ giấc — đọc kỹ

Hệ thống **chặn nút "Gọi bệnh nhân"** nếu bác sĩ ngoài ca hoặc trong giờ nghỉ trưa:

```
Ca sáng  08:00 – 11:30
NGHỈ     11:30 – 13:30   ← demo giờ này là nút BẤM KHÔNG ĐƯỢC
Ca chiều 13:30 – 17:30
```

*(Ràng buộc thật trong code: `bacSiDangTrongCaLamViec()` — `controllers/doctor/queue.controller.js:248`)*

**Biết trước giờ bảo vệ thì kiểm lại checklist. Nếu rơi vào 11:30–13:30 hoặc sau 17:30 → phải sửa lịch trực của bác sĩ demo trong DB trước, đừng để tới lúc bấm mới biết.**

### 🚨 Phương án cứu tổng — nếu hệ thống chết giữa chừng

Quay sẵn **1 video màn hình chạy trọn luồng** để trong USB. Nói: *"Xin phép hội đồng, em chiếu bản ghi lại để không mất thời gian."* Rồi nói đè lên video theo đúng kịch bản này. **Chuẩn bị video là bắt buộc, không phải tuỳ chọn.**

---
---

# ⏱ TIMELINE 10 PHÚT

| Phút | Chặng | Cửa sổ |
|---|---|---|
| 0:00 – 0:20 | Mở đầu | A |
| 0:20 – 2:10 | **Check-in** | A |
| 2:10 – 3:25 | Hàng đợi, gọi, vào phòng | B |
| 3:25 – 6:25 | **Khám 5 bước** | B |
| 6:25 – 8:25 | **Thanh toán** | A |
| 8:25 – 9:00 | Câu chốt | — |
| 9:00 – 10:00 | *đệm — 1 phút dự phòng* | — |

> **Mốc kiểm tra giữa chừng:** đến phút **6:25** mà chưa xong khám → **bỏ bước Kê đơn**, bấm thẳng sang Xác nhận. Thà thiếu một bước còn hơn cụt phần thanh toán.

---
---

## 🕐 0:00 – 0:20 · MỞ ĐẦU

**Màn hình:** cửa sổ A, trang Tiếp nhận, chưa nhập gì.

🗣 *"Em demo luồng **check-in — khám — thanh toán** trên hệ thống đang chạy. Hai cửa sổ là hai tài khoản, **lễ tân** và **bác sĩ**, em sẽ chuyển qua lại."*

**Hết. Vào việc luôn.**

> 💡 **Nguyên tắc xuyên suốt bài:** hội đồng là giảng viên, không phải khách hàng.
> - **Không** dẫn dắt, **không** tóm tắt phần trước, **không** giới thiệu vai trò nào làm gì.
> - **Không đọc lại những gì đang hiển thị trên màn hình** — họ nhìn thấy rồi. Chỉ nói **cái không nhìn thấy được**: ràng buộc, lý do thiết kế, chuyện gì chạy dưới nền.
> - Câu duy nhất phải giữ ở mở đầu là câu "hai cửa sổ là hai tài khoản" — để Alt+Tab lát nữa trông có chủ đích.

---

## 🕐 0:20 – 2:10 · CHẶNG 1: CHECK-IN

### Bước 1 — Tra số điện thoại

🗣 *"Bệnh nhân tới quầy. Hệ thống **không bắt nhớ mã lịch hẹn**, không cần quét mã — lễ tân chỉ hỏi số điện thoại."*

🖱 Gõ số điện thoại vào ô → bấm **"Tra cứu hồ sơ"**.

⏳ *(trong lúc chờ)* *"Và đây là chỗ có một quyết định thiết kế em muốn nhấn: **một số điện thoại có thể ra nhiều hồ sơ bệnh nhân**. Vì hệ thống cho phép **một tài khoản đặt lịch cho cả gia đình** — bố mẹ đặt cho con, con đặt cho ông bà. Nên khi tra, hệ thống tìm cả ba hướng cùng lúc: hồ sơ có đúng số đó, hồ sơ thuộc tài khoản có số đó, và hồ sơ mà người đó đứng tên giám hộ."*

🚨 **Không ra hồ sơ nào?** → *"Số này chưa có hồ sơ, em dùng số khác."* Rút giấy nhớ, gõ số dự phòng. Đừng loay hoay sửa.

### Bước 2 — Chọn đúng người bệnh

🗣 *"Lễ tân chọn **đúng người đang đứng trước mặt** — không phải người đứng tên tài khoản."*

🖱 Bấm chọn hồ sơ.

### Bước 3 — Check-in

🗣 *"Hệ thống tự biết hồ sơ này có lịch hôm nay nên **chỉ hiện đúng nút Check-in**. Không có lịch thì chỗ này là nút **Khám bệnh** — luồng khách vãng lai."*

🖱 Bấm **"Check-in"** → bấm chọn thẻ lịch hẹn → bấm nút xanh **"Check-in lịch hẹn [mã]"**.

### Đọc kết quả trả về

🖱 Chỉ vào **dòng thông báo xanh** vừa hiện.

🗣 *"Check-in xong, lịch hẹn chuyển trạng thái **đã check-in**, cấp số thứ tự, và tạo bản ghi hàng đợi bác sĩ cần: tuổi, nhóm máu, **tiền sử dị ứng**, bệnh nền, số phòng."*

🗣 *"Đến đây lễ tân sẽ **in phiếu khám khổ 80mm** đưa cho bệnh nhân — có tên, số thứ tự, bác sĩ, phòng — để bệnh nhân biết mình chờ ở đâu. Em xin phép không bấm in để khỏi mở hộp thoại che màn hình."*

---

## 🕐 2:10 – 3:25 · HÀNG ĐỢI, GỌI, VÀO PHÒNG

🖱 **Alt+Tab sang cửa sổ B (bác sĩ).**

🗣 *"Em chuyển sang **màn hình bác sĩ** — tài khoản khác, cửa sổ khác."*

🖱 Chỉ vào bệnh nhân vừa check-in đã có mặt trong hàng đợi.

🗣 *"Bệnh nhân vừa check-in **đã có mặt ở đây rồi**. Màn hình bác sĩ **tự cập nhật qua realtime**, bác sĩ không phải bấm F5."*

🚨 **Chưa thấy?** → bấm F5 và nói tỉnh: *"Em tải lại cho chắc."* Đừng nhắc lại chữ realtime nữa.

🖱 Chỉ vào bảng **"Chờ tiếp nhận"** phía trên.

🗣 *"Màn hình này có hai phần. Trên là **Chờ tiếp nhận** — khách đã đặt lịch hôm nay nhưng chưa ai bấm tiếp nhận; bác sĩ có thể tự tiếp nhận từ đây, dùng chung đúng service vừa nói. Dưới là **hàng đợi thật**, đã sắp đúng thứ tự ưu tiên."*

🗣 *"Nói nhanh về thứ tự hàng đợi — phần em tâm đắc nhất. Hệ thống **không lưu số thứ tự cứng vào database**, mà **tính động ngay lúc truy vấn**. Lý do rất thực tế: lưu cứng thì người đến sớm bị phạt oan — ai đến trước 30 phút sẽ bị xếp sau người đến sát giờ. Vô lý."*

🗣 *"Thứ tự tính theo ba bậc: **ưu tiên online** cho khách đặt online đã tới khung giờ của mình; **online thường** cho khách đến sớm — tới giờ là **tự động lên bậc trên**; và **offline** cho khách vãng lai hoặc khách online đến muộn quá 15 phút. Kèm cơ chế chống bỏ đói: **chờ quá 60 phút tự nâng một bậc**, để khách vãng lai không phải ngồi tới trưa vì khách online cứ chèn lên trên."*

🖱 Bấm **"Gọi bệnh nhân"**.

🗣 *"Bác sĩ bấm gọi. Hệ thống đổi trạng thái, **đếm số lần gọi** — gọi hai ba lần không thấy người thì có căn cứ bỏ lượt — và **gửi thông báo sang cho lễ tân**: mời dẫn bệnh nhân vào phòng số mấy."*

🚨 **Báo lỗi "ngoài ca hoặc trong giờ nghỉ"?** → Biến nó thành điểm cộng: *"Đây chính là một ràng buộc chúng em cố tình đặt — hệ thống không cho gọi bệnh nhân khi bác sĩ ngoài ca hoặc đang nghỉ trưa."* Rồi **chuyển ngay sang video dự phòng**, đừng cố sửa.

🖱 Bấm **"Vào phòng khám"**.

🗣 *"Bệnh nhân vào phòng. Đồng thời **trạng thái phòng khám** chuyển sang **đang khám** — phòng bị khóa, không ai khác vào được."*

---

## 🕐 3:25 – 6:25 · KHÁM 5 BƯỚC

🖱 Mở phiên khám.

🗣 *"Đây là phần lõi. Phiên khám của chúng em đi theo **5 bước có thứ tự** — 4 bước nhập liệu và 1 bước xác nhận — chứ không phải một cái form phẳng."*

🖱 Chỉ vào **5 chip đánh số** trên đầu trang.

🗣 *"Em xin nói thẳng lý do: bản đầu tiên của nhóm em nhập tất cả trong một form — sinh hiệu, chẩn đoán, đơn thuốc hiện ra cùng lúc, không có thứ tự nào. Chúng em bị nhận xét là **quá sơ sài**. Và đúng là vậy: form phẳng cho phép tạo ra một hồ sơ **có đơn thuốc mà không có chẩn đoán.**"*

### Bước 1 — Tiếp nhận *(~40 giây)*

🖱 Gõ triệu chứng: `Đau họng, ho khan 3 ngày, sốt nhẹ về chiều`
🖱 Điền nhanh **cân nặng** và **chiều cao**. *(Bỏ qua huyết áp/nhiệt độ/nhịp tim cho kịp giờ.)*

🗣 *"Triệu chứng là **bắt buộc**. Sinh hiệu có **ngưỡng chặn số phi lý** — nhiệt độ chỉ nhận 25 đến 45 độ, nhịp tim 20 đến 300 — để bắt lỗi gõ nhầm thừa số 0. Nhưng cân nặng chiều cao **thiếu thì chỉ cảnh báo vàng, không chặn**: nếu bắt buộc, bác sĩ sẽ nhập bừa khi tái khám người lớn, sinh dữ liệu rác còn tệ hơn để trống. **BMI được tính tự động.**"*

🖱 Bấm **"Tiếp tục → Chẩn đoán"**.

🗣 *"Và để ý: **không có nút Lưu thủ công**. Mỗi lần bấm Tiếp tục là một lần ghi xuống database — bác sĩ đóng tab giữa chừng, mở lại vẫn đúng chỗ đang dở."*

### Bước 2 — Chẩn đoán *(~40 giây)*

🖱 Gõ chẩn đoán: `Viêm họng cấp`
🖱 Gõ hướng dẫn: `Uống nhiều nước ấm, hạn chế nói to, tái khám nếu sốt trên 38.5 độ`

🗣 *"Chẩn đoán là **bắt buộc** — không có chẩn đoán thì không chốt được ca. Kèm hướng dẫn điều trị, ghi chú, và ngày tái khám nếu cần."*

🖱 Bấm **"Tiếp tục → Dịch vụ"**.

### Bước 3 — Dịch vụ *(~40 giây)*

🖱 Chọn **1 dịch vụ** trong danh sách.

🗣 *"Bác sĩ chỉ định dịch vụ phát sinh — xét nghiệm, thủ thuật. Hệ thống tính sẵn **tổng tiền ước tính** ngay tại đây."*

🖱 Chỉ vào nút **"Thêm ảnh"** trên dòng dịch vụ.

🗣 *"Và mỗi dịch vụ **đính kèm được ảnh kết quả** — phim chụp, phiếu xét nghiệm — tối đa 10 ảnh, gắn thẳng vào hồ sơ bệnh án."*

🗣 *"Ở đây có một nguyên tắc phân quyền chúng em chốt rõ: **bác sĩ chỉ ghi chỉ định, tuyệt đối không thu tiền.** Tiền là việc của quầy. Lát nữa hội đồng sẽ thấy đúng dịch vụ này nhảy sang màn hình thanh toán."*

🖱 Bấm **"Đã thực hiện xong → Kê đơn"**.

> ⏰ **Quá phút 6:00 rồi?** Bấm **"Bỏ qua bước này"** và nói: *"Ca này không phát sinh dịch vụ."* — Nhưng lưu ý: bỏ qua thì hóa đơn lát nữa **chỉ có mỗi phí khám**, mất một ý hay. Ưu tiên giữ bước này, cắt bước Kê đơn thay thế.

### Bước 4 — Kê đơn *(~40 giây)*

🖱 Thêm 1 loại thuốc.

🖱 Chỉ vào **panel thông tin bệnh nhân** bên cạnh (dòng dị ứng, chữ đỏ).

🗣 *"Bác sĩ kê thuốc. Và trong suốt cả phiên khám, **tiền sử dị ứng và bệnh nền luôn hiển thị ngay cạnh** — được chép sẵn vào hàng đợi từ lúc check-in, tô đỏ để bác sĩ không bỏ sót khi cân nhắc thuốc."*

🖱 Bấm **"Tiếp tục → Xác nhận"**.

> 💡 **Chỉ nói đúng bấy nhiêu.** Đừng khoe cơ chế tự động chặn thuốc trùng dị ứng: thực tế rất ít bệnh nhân biết mình dị ứng gì, nên dữ liệu đó thường trống — khoe rồi bị hỏi *"lấy đâu ra dữ liệu dị ứng?"* là hụt. Bác sĩ **nhìn thấy rõ và tự cân nhắc** đã là đủ và đúng thực tế.

### Bước 5 — Xác nhận và chốt ca *(~50 giây)*

🖱 Chỉ vào bảng tổng hợp toàn bộ hồ sơ.

🗣 *"Bước cuối tổng hợp lại toàn bộ để bác sĩ soát trước khi chốt. Bác sĩ **được quay lại sửa bước đã qua**, nhưng **không được nhảy cóc** tới bước chưa tới."*

🖱 Bấm **"Hoàn tất ca khám & mời bệnh nhân tiếp theo"**.

⏳ *(trong lúc chờ)*

🗣 *"Khi bấm chốt, hệ thống làm **bốn việc trong một giao dịch duy nhất**: hồ sơ khám chuyển **đã xác nhận và bị khóa lại**; lượt hàng đợi chuyển **hoàn thành**; **phòng khám được nhả ra** về trạng thái sẵn sàng — kèm cập nhật lại **thời gian khám trung bình của phòng** theo trung bình trượt, để dự báo thời gian chờ ngày càng chính xác; và lịch hẹn chuyển **đã khám xong**."*

🗣 *"Bốn việc này phải cùng đúng hoặc cùng sai. Nếu chốt hồ sơ mà quên nhả phòng thì **phòng kẹt vĩnh viễn**, bệnh nhân tiếp theo không vào được, bác sĩ hết đường khám trong ngày."*

🖱 Chỉ vào tên **bệnh nhân kế tiếp** hệ thống vừa gợi ý.

🗣 *"Và chốt xong, hệ thống **trả về luôn bệnh nhân kế tiếp** để bác sĩ bấm gọi ngay tại chỗ — không phải quay về trang hàng đợi. Một ngày 30 ca là tiết kiệm 30 lần thao tác thừa."*

🗣 *"Hồ sơ đã chốt thì **khóa, không sửa đè được nữa**. Muốn sửa phải đi qua chức năng **đính chính** riêng — bắt buộc nhập lý do, và ghi lại trường nào đổi, giá trị cũ, giá trị mới, ai sửa, lúc nào. Không xóa dấu vết bản gốc."*

🚨 **Báo lỗi "Chưa nhập chẩn đoán"?** → bạn đã lỡ nhảy bước. Bấm chip **Chẩn đoán**, điền, quay lại.

---

## 🕐 6:25 – 8:25 · CHẶNG 3: THANH TOÁN

🖱 **Alt+Tab về cửa sổ A (lễ tân)** → menu trái, vào **"Viện phí & hóa đơn"**.

🗣 *"Quay về quầy lễ tân. Và ở đây có một điểm đặc thù của mô hình chúng em cần nói rõ: **khách đặt online đã trả 100% tiền khám ngay lúc đặt lịch**. Nên khi ra quầy, họ **không trả lại tiền khám** — họ chỉ trả **phần phát sinh** mà bác sĩ vừa chỉ định."*

🖱 Chỉ vào danh sách ca chờ thu.

🗣 *"Màn hình này gom **cả hai nguồn về một danh sách**: ca đặt online và ca vãng lai. Có bộ lọc chờ thu / đã thu, hôm nay / tất cả."*

🖱 Bấm chọn **đúng bệnh nhân vừa khám xong**.

🗣 *"Và có một điều kiện cứng, không có đường vòng: **bác sĩ phải xác nhận hồ sơ khám xong thì mới lập được hóa đơn.** Chưa xác nhận, hệ thống trả về đúng câu 'Bác sĩ chưa xác nhận hồ sơ khám, chưa thể lập hóa đơn'. Không thu tiền một ca chưa khám xong."*

🖱 Chỉ vào bảng **"Chi tiết thu phí"**.

🗣 *"Hóa đơn được **dựng lại từ chính hồ sơ khám**: một dòng **phí khám**, và **đúng cái dịch vụ bác sĩ vừa chỉ định ban nãy** — hội đồng có thể đối chiếu."*

🗣 *"Phí khám lấy **giá theo chuyên khoa**, không phải theo bác sĩ. Vì hệ thống tự gán bác sĩ, nếu giá nhảy theo người thì sẽ sinh khiếu nại 'sao người kia khám rẻ hơn tôi'."*

🖱 Chỉ vào con số **"Còn phải thu"**.

🗣 *"Và đây là chỗ hay: **số tiền khách đã trả online tự động được gắn vào hóa đơn này**. Con số lễ tân nhìn thấy đã là **còn phải thu** — trừ sẵn rồi, lễ tân không phải nhẩm tay."*

🖱 Chọn **"Tiền mặt"** → bấm nút xác nhận.

🗣 *"Lễ tân chọn một trong hai hình thức. **Tiền mặt** — thu xong bấm xác nhận, giao dịch chốt ngay, ghi luôn vào nhật ký ai là người thu."*

🗣 *"Còn nếu chọn **chuyển khoản**, hệ thống sinh **mã QR VNPAY đúng số tiền cần thu** hiện lên cho khách quét. Nhưng hệ thống **không tự động xác nhận** — lễ tân phải mở app ngân hàng đối chiếu rồi mới bấm 'Đã nhận tiền'. Đây là **chủ ý**: phòng khám nhỏ, người thu tiền phải chịu trách nhiệm bằng mắt, và mọi lần xác nhận đều ghi tên người thu vào nhật ký."*

> 💡 Nếu còn dư giờ mới bấm thử chuyển khoản để khoe QR. Không dư thì **chỉ nói**, đừng bấm.

🖱 Chỉ vào khối xanh **"Ca này đã hoàn tất thu ngân"**.

🗣 *"Thu đủ tiền, hệ thống làm nốt hai việc: **đánh dấu thu ngân đã đối soát**, và **tự chuyển lịch hẹn sang đã hoàn tất**. Lễ tân in biên lai giao khách. Ca khám kết thúc."*

🚨 **Báo "Bác sĩ chưa xác nhận hồ sơ"?** → bước 5 bên bác sĩ chưa thành công. Alt+Tab về B, bấm lại nút Hoàn tất.

---

## 🕐 8:25 – 9:00 · CÂU CHỐT

🗣 *"Vừa rồi là một ca khám đi trọn vẹn ba chặng trên hệ thống đang chạy thật."*

🗣 *"Một ca khám đi qua **năm mốc trạng thái được theo dõi chặt**: đã xác nhận → đã check-in → đang trong phòng → đã khám xong → đã thanh toán và hoàn tất."*

🗣 *"Hai điểm nhóm em muốn nhấn. **Một**, mỗi mốc đều có **ràng buộc để không nhảy cóc** — không check-in được lịch của ngày khác, không chốt được ca chưa có chẩn đoán, không lập được hóa đơn khi bác sĩ chưa xác nhận. **Hai**, mỗi thao tác chạm vào tiền hoặc chạm vào hồ sơ y tế đều **để lại dấu vết trong nhật ký** — cuối ca đối soát được ai đã làm gì."*

🗣 *"Em xin hết phần trình bày. Em sẵn sàng nhận câu hỏi của thầy cô."*

---
---

# 🎤 PHỤ LỤC — Trả lời khi bị hỏi

> Không nằm trong 10 phút. Học thuộc để phản xạ.

### "Khách không đặt lịch, đi thẳng tới thì sao?"

*"Luồng khác hẳn ở một điểm: **khách vãng lai không được gán bác sĩ ngay**. Họ vào một **hàng đợi trung tâm**, trạng thái chờ điều phối, và ở trạng thái đó họ **chưa xuất hiện trong hàng đợi của bất kỳ bác sĩ nào**. Lễ tân sang màn hình Hàng đợi vãng lai, hệ thống gợi ý bác sĩ phù hợp, lễ tân gán. Lúc gán, hệ thống kiểm hai điều kiện: bác sĩ có đang có bệnh nhân trong phòng không, và **có khách online nào đang cần được ưu tiên không** — nếu có thì chặn lại. Đó là cách bảo vệ người đã đặt lịch và đã trả tiền: khách vãng lai **không bao giờ được chèn lên trước** họ. Gán xong thì từ đó đi chung một luồng."*

### "Có hỗ trợ bảo hiểm y tế không?"

*"Không ạ. Mô hình chúng em là **phòng khám tư**, thu phí trực tiếp, không ký hợp đồng bảo hiểm xã hội nên không có nghiệp vụ giảm trừ BHYT."*

> ✅ **Đã xử lý 2026-08-26:** mọi hiển thị bảo hiểm đã được gỡ khỏi giao diện — không còn badge "BHYT nhà nước" / "Bảo lãnh viện phí" ở trang chọn bác sĩ, không còn ô tick "Loại bảo hiểm áp dụng" ở form admin. Trả lời câu trên là **an toàn tuyệt đối**, không sợ bị chỉ ngược lên màn hình.

### "Khách hủy thì có được hoàn tiền không?"

*"**Không hoàn tiền** — đây là chính sách chúng em chốt rõ ngay từ đầu và bắt khách tick đồng ý điều khoản trước khi thanh toán. Nhưng tiền không mất trắng: nó được bảo toàn thành **quyền dời lịch**. Khách đến muộn vẫn được khám và không mất tiền. Đã check-in mà hết ca chưa được gọi thì được dời, không mất tiền. Chỉ hai trường hợp mất tiền: **tự ý hủy**, và **hết ca không tới**."*

### "Bệnh nhân được gọi vào phòng bằng cách nào? Có màn hình ở sảnh không?"

*"Mô hình phòng khám nhỏ nên chúng em không làm màn hình sảnh. Bác sĩ bấm gọi thì **hệ thống gửi thông báo cho lễ tân** kèm số phòng, lễ tân dẫn bệnh nhân vào. Bệnh nhân cầm phiếu có số thứ tự nên biết còn bao nhiêu người trước mình."*

### "Bác sĩ nghỉ đột xuất thì khách đã đặt xử lý sao?"

*"Chúng em có hẳn một module **Quản lý và điều phối**. Khi bác sĩ báo nghỉ, hệ thống **tự sinh phương án dời** cho từng bệnh nhân đã đặt, sắp theo **độ lệch giờ ít nhất** để khách không phải chờ quá xa giờ đã hẹn, và **giữ sẵn chỗ** ở phương án tốt nhất. Lễ tân duyệt hàng loạt. Lần dời này tính là **lỗi phòng khám** nên **không trừ vào quyền dời 1 lần của khách**."*

### "Lễ tân có sửa được hồ sơ bệnh án không?"

*"Không. Trong code có hẳn một endpoint tồn tại **chỉ để từ chối** thao tác đó. Hồ sơ bệnh án là của bác sĩ; lễ tân chỉ chạm vào lịch hẹn, hàng đợi và tiền."*

### "Sao không tự động xác nhận chuyển khoản qua webhook?"

*"Là chủ ý ạ. Ở quy mô phòng khám nhỏ, chúng em muốn **có một người chịu trách nhiệm bằng mắt** cho mỗi khoản tiền vào, và tên người đó được ghi vào nhật ký. Nối webhook là bước tiếp theo khi lên quy mô lớn hơn."*

### "Cổng thanh toán đã thật chưa?"

*"Đang chạy **môi trường sandbox của VNPAY** ạ. Toàn bộ luồng ký, sinh mã, hết hạn 15 phút đều đúng như thật, chỉ thiếu tài khoản merchant chính thức."*

---

## 🚫 Những thứ ĐỪNG nói

| Đừng nói | Vì |
|---|---|
| **"Bác sĩ chọn kết cục ca khám: chuyển viện / cấp cứu"** | Backend có 4 lựa chọn nhưng **giao diện chưa có ô chọn** — `StepChanDoan.tsx:81` luôn gửi cứng `dieu_tri_thuong`. Nói là bị bắt bẻ ngay nếu hội đồng bảo bấm thử. |
| Bất cứ gì về **BHYT / giảm trừ bảo hiểm** | Đã chốt: phòng khám tư, không có. Giao diện cũng đã gỡ sạch (2026-08-26). |
| **"Hệ thống tự chặn thuốc trùng dị ứng"** | Cơ chế có thật, nhưng dữ liệu dị ứng thực tế thường trống — khoe là mời hỏi *"lấy đâu ra dữ liệu?"*. Chỉ nói *"bác sĩ nhìn thấy rõ tiền sử dị ứng khi kê đơn"*. |
| **"Đã in phiếu ra máy in nhiệt"** | Không có máy in. Chỉ nói *"lễ tân sẽ in phiếu khổ 80mm"* ở thì tương lai. |
| Trạng thái **`cho_dich_vu`**, **`waiting_doctor_confirm`** | Có trong enum nhưng **chưa luồng nào ghi vào**. |
| **"Hệ thống hoàn tiền cho khách"** | Chính sách là **không hoàn tiền**. |
| **"Tích hợp cổng thanh toán thật"** | Sandbox. |
