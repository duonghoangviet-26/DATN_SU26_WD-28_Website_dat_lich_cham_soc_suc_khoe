# Phân tích tổng quan nghiệp vụ trang Y tá

> Ngày: 2026-07-18 · Giai đoạn: **phân tích nghiệp vụ (chưa đọc code, chưa đụng DB)** · Vai trò: BA y tế + hướng dẫn đồ án.
> Mọi trạng thái mô tả ở mức nghiệp vụ; tên field/enum kỹ thuật **đối chiếu code ở prompt sau**.

## 0. Mục đích trang y tá

Trang y tá là **công cụ tác nghiệp tại điểm khám**, không phải công cụ quản trị. Nó giúp y tá:
- Biết hôm nay mình phụ trách bác sĩ/phòng/ca nào.
- Nắm danh sách bệnh nhân trong ca và trạng thái từng người.
- Tiếp nhận ban đầu (sinh hiệu, triệu chứng) và **nhập hồ sơ khám theo nội dung chuyên môn bác sĩ đọc ra** — đóng vai **thư ký y khoa**, không phải người ra quyết định lâm sàng.
- Đẩy hồ sơ cho bác sĩ xác nhận và xử lý vòng chỉnh sửa.

Ranh giới cốt lõi: **y tá là người nhập liệu và điều phối hiện diện, bác sĩ là người chịu trách nhiệm chuyên môn.** Mọi thiết kế phải giữ ranh giới này.

## 1. Ngay sau khi đăng nhập, y tá cần thấy gì

Ưu tiên theo thứ tự tác nghiệp:
1. **Ca hôm nay:** đang hỗ trợ bác sĩ nào, phòng nào, chuyên khoa gì.
2. **Số liệu nhanh:** đã tiếp nhận / đang chờ khám / đang khám / chờ nhập hồ sơ / hồ sơ chờ bác sĩ xác nhận / hồ sơ bị trả về cần sửa.
3. **Việc cần làm ngay:** hàng đợi bệnh nhân gần nhất + hồ sơ đang bị trả về (đây là 2 "call to action" chính).

Không cần thấy: doanh thu, danh sách toàn hệ thống, dữ liệu bệnh nhân ngoài ca.

## 2. Chức năng NÊN có / KHÔNG nên có

**Nên có:**
- Tổng quan (dashboard tác nghiệp).
- Ca/phân công hôm nay (chỉ xem — do admin gán).
- Danh sách bệnh nhân/lịch hẹn trong ca.
- Chi tiết một lịch hẹn (thông tin bệnh nhân + lâm sàng nền + hồ sơ).
- Nhập hồ sơ khám + tiếp nhận ban đầu (sinh hiệu, triệu chứng).
- Hồ sơ cần chỉnh sửa (bác sĩ trả về).
- (Nếu hệ thống có luồng hiện diện) tiếp nhận/gọi bệnh nhân + trạng thái phòng.
- Thông tin cá nhân (đổi mật khẩu, xem hồ sơ mình).

**KHÔNG nên có (ngoài phạm vi vai trò):**
- Duyệt hồ sơ bác sĩ, quản lý người dùng, quản lý dịch vụ/giá/phòng.
- Xác nhận kết luận chuyên môn, kê đơn, chẩn đoán độc lập.
- Sửa thanh toán, hoàn tiền.
- Đổi bác sĩ/dịch vụ/phòng/lịch làm việc của lịch hẹn.
- **Xin nghỉ / quản lý ca / quản lý nhân sự** — KHÔNG thêm nếu đề tài chưa yêu cầu (tránh phình phạm vi).

## 3. Quan hệ y tá ↔ các tác nhân (tóm tắt, chi tiết ở mục C)

- **Admin:** một chiều — admin gán y tá vào ca; y tá chỉ nhận, không sửa phân công.
- **Bác sĩ:** cộng tác hai chiều quanh hồ sơ khám (y tá nhập → bác sĩ xác nhận/trả về).
- **Ca làm việc:** y tá chỉ đọc ca mình được gán; ca xác định phạm vi bệnh nhân.
- **Phòng:** y tá có thể điều phối hiện diện/trạng thái phòng (nếu hệ thống có), không đổi định danh phòng.
- **Lịch hẹn:** y tá đọc lịch trong ca; chỉ chuyển trạng thái ở các bước tác nghiệp cho phép (tiếp nhận, kết thúc khám) — không hủy/không đổi lịch.
- **Bệnh nhân:** chỉ đọc bệnh nhân trong ca; không sửa hồ sơ định danh bệnh nhân.
- **Hồ sơ khám:** tạo/sửa khi ở trạng thái mở; khóa khi đã gửi/đã xác nhận.

## 4. Quyền dữ liệu của y tá

| Loại quyền | Dữ liệu |
|---|---|
| **Được đọc** | Ca của mình; bác sĩ/phòng/chuyên khoa trong ca; lịch hẹn trong ca; thông tin bệnh nhân trong ca (tuổi, giới, bệnh nền, dị ứng, SĐT liên hệ); hồ sơ khám của lịch trong ca; lý do bác sĩ trả về; lịch sử chỉnh sửa. |
| **Được tạo** | Hồ sơ khám (nháp) cho lịch trong ca; sinh hiệu/tiếp nhận ban đầu. |
| **Được cập nhật** | Hồ sơ khám khi đang **nháp** hoặc **bị trả về**; trạng thái tác nghiệp cho phép (tiếp nhận/hiện diện/kết thúc khám nếu hệ thống có). |
| **Chỉ được xem** | Thông tin lịch hẹn (bác sĩ, dịch vụ, giá, phòng, loại khám); thanh toán; thông tin định danh bệnh nhân; phân công ca. |
| **Tuyệt đối KHÔNG sửa** | Chẩn đoán/kết luận **sau khi bác sĩ đã xác nhận**; trạng thái thanh toán; bác sĩ/dịch vụ/giá/phòng/lịch làm việc; phân công ca; dữ liệu bệnh nhân ngoài ca. |

## 5. Các điều kiện nghiệp vụ (business rules)

- **Được xem một lịch hẹn khi:** lịch thuộc ca y tá đang phụ trách (gắn với bác sĩ/ca của y tá hôm nay). Không thuộc ca → không được xem, kể cả gõ URL trực tiếp.
- **Được nhập hồ sơ khi:** bệnh nhân đã ở bước "sau tiếp nhận/đang hoặc đã khám" trong ca của y tá, lịch **chưa bị hủy / không phải no-show**, và **chưa có hồ sơ** cho lịch đó. Chẩn đoán là trường bắt buộc (do bác sĩ đọc ra, y tá gõ).
- **Được sửa hồ sơ khi:** hồ sơ đang **nháp** hoặc **bị bác sĩ trả về (yêu cầu chỉnh sửa)**.
- **Hồ sơ bị KHÓA (chỉ xem) khi:** đã **gửi và đang chờ bác sĩ xác nhận**, hoặc **đã được bác sĩ xác nhận**. Sau xác nhận, y tá không được đụng nội dung chuyên môn.
- **Lịch hẹn chuyển trạng thái:** các bước y tá được phép (nếu có luồng hiện diện): tiếp nhận → (đang khám) → kết thúc khám → chờ nhập hồ sơ → chờ bác sĩ xác nhận. Bước **hoàn thành cuối cùng do bác sĩ xác nhận**, không phải y tá.

## 6. Các trường hợp đặc biệt

| Tình huống | Hành vi đúng của trang y tá |
|---|---|
| Bác sĩ **yêu cầu chỉnh sửa** | Hồ sơ mở lại để sửa; hiển thị rõ **lý do bác sĩ trả về** + lịch sử; y tá sửa và **gửi lại**. |
| Bác sĩ **đã xác nhận** | Hồ sơ khóa; y tá chỉ xem; không nút sửa/gửi. |
| Lịch **bị hủy / bệnh nhân không đến** | Không cho nhập hồ sơ; hiển thị trạng thái, ẩn form nhập. |
| Y tá **không được phân công** gõ URL trực tiếp chi tiết lịch | Backend phải chặn (403/404) — **không dựa vào ẩn nút ở FE**. Đây là ranh giới bảo mật, không phải UX. |
| Ca **chưa được gán y tá** | Trang rỗng có thông báo "chưa được phân công", không lỗi vỡ. |

## 7. Đánh giá menu đề xuất

| Mục menu | Có nên? | Ghi chú |
|---|---|---|
| Tổng quan | ✅ Có | Trang chính. |
| Ca làm việc được phân công | ✅ Có (chỉ xem) | Có thể gộp vào Tổng quan để gọn. |
| Danh sách bệnh nhân/lịch hẹn | ✅ Có | "Hàng đợi bệnh nhân". |
| Chi tiết lịch hẹn | ✅ Có | Là trang con của danh sách. |
| Tiếp nhận bệnh nhân | ⚠️ Có điều kiện | Chỉ khi hệ thống có luồng hiện diện/hàng đợi. Nếu chưa nối → không dựng menu treo. |
| Hồ sơ cần nhập | ✅ Có | Có thể là bộ lọc trong danh sách thay vì menu riêng. |
| Hồ sơ cần chỉnh sửa | ✅ Có | Ưu tiên cao (bác sĩ đang chờ). |
| Hồ sơ đã gửi bác sĩ | 🟡 Tùy | Hữu ích để theo dõi; có thể là bộ lọc. |
| Thông tin cá nhân | ✅ Có | Cơ bản mọi vai trò. |
| Xin nghỉ / quản lý lịch / nhân sự | ❌ Không | Ngoài yêu cầu đề tài — không thêm. |

---

# A. Phạm vi trang y tá

| Chức năng | Mục đích | Y tá ĐƯỢC làm | Y tá KHÔNG được làm |
|---|---|---|---|
| Tổng quan | Nắm việc hôm nay | Xem ca, số liệu, việc cần làm | Xem số liệu toàn hệ thống, doanh thu |
| Ca được phân công | Xác định phạm vi | Xem bác sĩ/phòng/chuyên khoa ca mình | Gán/sửa/hủy ca |
| Hàng đợi bệnh nhân | Điều phối trong ca | Xem danh sách + trạng thái bệnh nhân trong ca | Xem bệnh nhân ngoài ca |
| Chi tiết lịch hẹn | Chuẩn bị khám | Xem thông tin bệnh nhân + lâm sàng nền | Sửa định danh bệnh nhân, đổi bác sĩ/dịch vụ/giá/phòng |
| Tiếp nhận / hiện diện (nếu có) | Ghi nhận bệnh nhân đến | Đánh dấu đến, sinh hiệu, gọi vào phòng, kết thúc khám | Tự "hoàn thành" thay bác sĩ |
| Nhập hồ sơ khám | Số hóa kết luận bác sĩ | Tạo/sửa hồ sơ nháp, nhập chẩn đoán bác sĩ đọc ra, hẹn tái khám | Tự chẩn đoán, tự kê đơn, tự xác nhận |
| Gửi bác sĩ xác nhận | Chuyển trách nhiệm | Gửi hồ sơ, gửi lại sau khi sửa | Tự đặt trạng thái "đã xác nhận" |
| Hồ sơ cần chỉnh sửa | Đóng vòng phản hồi | Xem lý do trả về, sửa, gửi lại | Sửa hồ sơ đã xác nhận |
| Thông tin cá nhân | Tự quản lý | Đổi mật khẩu, xem hồ sơ mình | Sửa vai trò/quyền |

# B. Luồng nghiệp vụ tổng quát

```
Y tá đăng nhập
  → Xem ca hôm nay (bác sĩ / phòng / chuyên khoa)  [chỉ đọc, do admin gán]
  → Xem hàng đợi bệnh nhân trong ca
  → (nếu có luồng hiện diện) Tiếp nhận bệnh nhân đến: sinh hiệu, triệu chứng
  → Gọi bệnh nhân vào phòng / hỗ trợ bác sĩ khám
  → Bác sĩ khám xong → lịch sang "chờ nhập hồ sơ"
  → Y tá nhập hồ sơ theo nội dung bác sĩ đọc (chẩn đoán, hướng dẫn, tái khám)  [nháp]
  → Gửi bác sĩ xác nhận → lịch "chờ bác sĩ xác nhận", hồ sơ KHÓA sửa
  → Bác sĩ:
        • Xác nhận → hồ sơ "đã xác nhận", lịch "hoàn thành"  [KẾT THÚC]
        • Yêu cầu chỉnh sửa → hồ sơ mở lại + lý do trả về
             → Y tá sửa → gửi lại → (quay vòng đến khi bác sĩ xác nhận)
```

Bất biến của luồng: **chỉ bác sĩ mới đẩy được tới trạng thái "đã xác nhận / hoàn thành"**; y tá chỉ di chuyển hồ sơ trong vùng nháp ↔ chờ xác nhận.

# C. Ma trận tương tác

| Tác nhân | Y tá NHẬN dữ liệu gì | Y tá GỬI dữ liệu gì | Điều kiện |
|---|---|---|---|
| **Admin** | Phân công ca (bác sĩ/phòng/ngày) | — (không gửi ngược) | Admin đã gán y tá cho ca |
| **Bác sĩ** | Nội dung chuyên môn (miệng/ghi chú) để nhập; lý do trả về; kết quả xác nhận | Hồ sơ nháp để xác nhận; hồ sơ sửa lại | Lịch thuộc ca của y tá |
| **Ca làm việc** | Bác sĩ, phòng, chuyên khoa, ngày | — | Ca gán cho y tá "hôm nay" |
| **Phòng** | Trạng thái phòng (nếu có luồng) | Đổi trạng thái hiện diện (sẵn sàng/tạm nghỉ/đang khám) nếu được phép | Phòng thuộc bác sĩ y tá phụ trách |
| **Lịch hẹn** | Danh sách + chi tiết lịch trong ca | Chuyển trạng thái tác nghiệp cho phép (tiếp nhận/kết thúc khám) | Lịch thuộc ca; trạng thái hợp lệ |
| **Bệnh nhân** | Định danh tối thiểu + lâm sàng nền (tuổi, giới, bệnh nền, dị ứng, SĐT) | — (không sửa định danh) | Bệnh nhân thuộc lịch trong ca |
| **Hồ sơ khám** | Hồ sơ + trạng thái + lịch sử | Tạo/sửa nháp, gửi/gửi lại | Hồ sơ ở trạng thái mở (nháp/bị trả về) |

# D. Danh sách rủi ro

**D1. Rủi ro nghiệp vụ**
- Y tá vô tình đóng vai bác sĩ (tự xác nhận, tự hoàn thành) nếu luồng trạng thái không chặn.
- Nhập hồ sơ cho bệnh nhân sai (nhầm lịch) nếu danh sách không gắn rõ ca/định danh.
- Cho nhập hồ sơ khi lịch đã hủy/no-show → dữ liệu rác.
- Menu "tiếp nhận" treo nếu luồng hiện diện chưa nối → y tá thao tác vô nghĩa.

**D2. Rủi ro dữ liệu**
- Hồ sơ trùng cho một lịch (tạo 2 lần) nếu thiếu ràng buộc duy nhất.
- Sinh hiệu/hồ sơ mồ côi nếu không gắn đúng khóa lịch/lượt khám.
- Số liệu dashboard lệch thực tế nếu đếm theo tiêu chí khác backend.
- Hiển thị rỗng gây hiểu nhầm "mất dữ liệu" khi thực chất chưa được phân công.

**D3. Rủi ro phân quyền**
- Xem/nhập lịch ngoài ca qua URL trực tiếp nếu backend không kiểm tra chủ sở hữu (chỉ ẩn nút FE là **không đủ**).
- Y tá chạm được endpoint của bác sĩ/admin nếu route guard yếu.
- Rò rỉ định danh bệnh nhân (SĐT/email) ngoài phạm vi cần thiết.

**D4. Rủi ro đồng bộ**
- Trạng thái lịch hẹn ở trang y tá lệch trang bác sĩ nếu hai bên đọc/ghi field khác nhau.
- Gửi hồ sơ nhưng lịch không cập nhật sang "chờ bác sĩ xác nhận" → bác sĩ không thấy.
- Hai cơ chế phân quyền/danh sách song song khiến "xem được nhưng thao tác lỗi".
- Hồ sơ do y tá gửi nhưng bác sĩ trả về không hiện lại đúng ở trang y tá.

**D5. Rủi ro giao diện**
- Nút sửa/gửi vẫn hiện khi hồ sơ đã khóa → thao tác lỗi.
- Không phân biệt trạng thái hồ sơ (nháp/chờ/đã xác nhận/bị trả) → y tá thao tác nhầm.
- Không hiển thị cảnh báo dị ứng/bệnh nền nổi bật → rủi ro an toàn người bệnh.
- Thiếu phản hồi lỗi rõ ràng khi API từ chối (403/409) → y tá không biết vì sao.

---
*Phân tích nghiệp vụ, chưa đọc code sản phẩm, chưa đụng DB. Prompt sau: đối chiếu từng điểm với code + dữ liệu thật.*
