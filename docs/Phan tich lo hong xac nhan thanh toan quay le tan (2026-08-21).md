# Phân tích lỗ hổng: "Thanh toán hiện thành công nhưng lễ tân không xác nhận nhận được tiền"

> Ngày kiểm tra: 2026-08-21. Yêu cầu từ user: sau khi bác sĩ khám xong, chuyển sang màn hình hóa đơn
> bên lễ tân để thanh toán — hệ thống hiện "thành công" nhưng không xác nhận đã nhận tiền, cho cả 3
> trường hợp (đã trả online không phát sinh / có phát sinh cần thu thêm / khách vãng lai thu toàn bộ).
>
> Phương pháp: đọc mã nguồn (`billing.controller.js`, `hoaDon.service.js`, `examSession.service.js`,
> `patient/booking.controller.js`, `receptionist/booking.controller.js`) rồi **đối chiếu bằng dữ liệu
> thật, chỉ đọc (read-only)** trên DB đang dùng (`DATN_VITAFAMILY`) qua script mới
> `backend/src/scripts/inspect-cashier-confirmation-gap.js`. Không có ghi/xóa nào được thực hiện.

## Kết luận ngắn gọn

**Lỗ hổng không nằm ở khâu bác sĩ → lễ tân (KetQuaKham → HoaDon liên kết đúng), mà nằm ở khâu
đặt lịch/thanh toán online → hóa đơn.** Với lịch đặt online, hóa đơn (`HoaDon`) được tạo và có thể
đạt `trang_thai_hoa_don = 'da_thanh_toan_du'` **ngay tại thời điểm đặt lịch/thanh toán VNPAY**,
tức là **trước khi bác sĩ khám**. Toàn hệ thống (trang bệnh nhân, màn khám của bác sĩ,
`appointment.payment_status`) đều đọc và hiển thị "đã thanh toán" từ lúc đó.

Nhưng cờ `HoaDon.da_xac_nhan_thu_ngan` — đại diện cho việc **lễ tân đã đối chiếu và xác nhận thực
nhận đủ tiền tại quầy** — là một bước **hoàn toàn thủ công, tách biệt**, chỉ được set `true` khi lễ
tân bấm nút trong `Payments.tsx` ("Xác nhận đã đối chiếu (0đ)" / "Xác nhận thu tiền mặt" / "Xác nhận
đã nhận tiền" cho chuyển khoản) — **sau khi** bác sĩ đã hoàn tất ca khám. Không có cơ chế nào tự
động thực hiện bước này, và không có gì cảnh báo lễ tân rằng vẫn còn một thao tác "xác nhận" đang
treo — vì mọi nơi khác trong hệ thống đã hiển thị "đã thanh toán" từ trước, lễ tân dễ nghĩ là xong.

Vì vậy: **"thanh toán hiện thành công" = đúng (tiền đã vào hệ thống qua VNPAY/booking)**, nhưng
**"xác nhận nhận được tiền" = một thao tác riêng, dễ bị bỏ sót**, đặc biệt với trường hợp 1 (không
phát sinh gì thêm, "còn phải thu" hiển thị 0đ) — lễ tân không thấy động lực để bấm.

## Bằng chứng thật trên DB (chỉ đọc, không sửa)

Chạy `node src/scripts/inspect-cashier-confirmation-gap.js` trên DB `DATN_VITAFAMILY`:

- **98 hóa đơn** có `trang_thai_hoa_don = 'da_thanh_toan_du'` nhưng `da_xac_nhan_thu_ngan != true`.
  Phần lớn (92) là lịch hẹn đã `no_show` / `cancelled` / dữ liệu test cũ (`TEST_...`, `LIVETEST_...`)
  — không phải case đang hoạt động, có thể bỏ qua.
- **6 hóa đơn LÀ CASE THẬT, đang tồn đọng** (ca khám đã `completed`, bác sĩ đã `da_xac_nhan` hồ sơ,
  bệnh nhân tên thật, ngày gần đây 2026-07-13 → 2026-08-19):

  | Mã lịch hẹn | Bệnh nhân | Ngày khám | Có dịch vụ phát sinh chưa thu? |
  |---|---|---|---|
  | LH-260713-0006 | Nguyễn Thị Huyền | 2026-07-13 | Không |
  | LH-260724-0003 | Nguyễn Minh An | 2026-07-24 | **Có — 2 dịch vụ, `tong_tien_phat_sinh` vẫn = 0 trên hóa đơn** |
  | LH-260804-0009 | Dương Hoàng Việt | 2026-08-04 | **Có — 1 dịch vụ, `tong_tien_phat_sinh` vẫn = 0 trên hóa đơn** |
  | LH-260814-0001 | Dương Hoàng Việt | 2026-08-14 | Không |
  | LH-260815-0001 | Hoàng Viêt Dương | 2026-08-15 | Không |
  | LH-260819-0001 | Hoàng Viêt Dương | 2026-08-19 | Không |

  Với `LH-260724-0003` và `LH-260804-0009`, bác sĩ **đã chỉ định dịch vụ phát sinh** ở bước 3 của
  phiên khám 4 bước, nhưng vì lễ tân chưa từng mở `Payments.tsx` cho ca này, hóa đơn **chưa bao giờ
  được cập nhật lại tổng tiền** — nghĩa là phòng khám **đang thất thu thật** khoản phát sinh của 2
  ca này, không chỉ là thiếu xác nhận giấy tờ.
- Đối chiếu `ThanhToan.status='paid'` mà `hoa_don_id=null`: **0** — luồng gắn `hoa_don_id` lúc đặt
  lịch online hoạt động đúng, không có thanh toán "mồ côi".
- Đối chiếu hóa đơn online có `ThanhToan(phi_dat_lich).status='paid'` mà hóa đơn lại chưa
  `da_thanh_toan_du`: **0 lệch** — `tinhTrangThaiHoaDon` tính đúng trạng thái hóa đơn.

→ Tức là **tầng tính toán trạng thái hóa đơn hoàn toàn chính xác**; lỗ hổng nằm ở **quy trình**, không
phải phép tính sai.

## Vì sao dễ bị bỏ sót — 2 nguyên nhân cộng hưởng

1. **Không có auto-reconcile cho case "đã trả đủ, không phát sinh gì"**: nút bấm vẫn tồn tại
   ("Xác nhận đã đối chiếu (0đ)") nhưng vì con số hiển thị là 0đ và mọi nơi khác đã ghi "đã thanh
   toán", lễ tân không thấy lý do phải bấm — dễ đóng modal và chuyển sang ca khác.
2. **`Payments.tsx` mặc định lọc theo `scope = 'today'`** (`OfflineQueue`/`Payments` load
   `listBillingCases('pending', 'today')` lúc mount). Case nào không được đối chiếu **trong đúng
   ngày khám** sẽ rơi khỏi danh sách "Chờ thu" mặc định — lễ tân phải tự tay bấm sang tab "Tất cả"
   mới thấy lại. Đây là lý do 6 case trên vẫn "treo" nhiều tuần mà không ai phát hiện: mỗi ngày mới,
   case cũ biến mất khỏi màn hình mặc định.

Cùng một cơ chế cũng áp dụng cho **lịch vãng lai do lễ tân đặt hộ tại quầy**
(`receptionist/booking.controller.js` dòng ~775: `trang_thai_hoa_don` có thể set thẳng
`da_thanh_toan_du` nếu `isPaid=true` ngay lúc tạo lịch) — không riêng gì luồng đặt online của bệnh
nhân.

## Không phải lỗi ở khâu bác sĩ

Đã kiểm chứng: `KetQuaKham.status='da_xac_nhan'` ↔ `HoaDon` (qua `appointment_id`/`hang_doi_id`) ↔
`dich_vu_phat_sinh` đều liên kết đúng, `billing.controller.js` đọc đúng dữ liệu bác sĩ ghi. Điểm gãy
nằm hoàn toàn ở tầng lễ tân/thanh toán, cụ thể là khoảng trống giữa lúc hóa đơn đạt
`da_thanh_toan_du` (tự động, có thể xảy ra **trước** khi khám) và lúc `da_xac_nhan_thu_ngan` được
set (thủ công, chỉ **sau** khi khám, dễ quên).

## Đề xuất hướng xử lý (chưa triển khai — cần chốt với user)

1. **Data fix** (không đụng code): chạy một script sửa 2 hóa đơn `LH-260724-0003` /
   `LH-260804-0009` để cộng lại đúng `tong_tien_phat_sinh` từ `dich_vu_phat_sinh` đã ghi, rồi báo lễ
   tân thu bổ sung; 4 case còn lại có thể xác nhận thu ngân thủ công qua UI (0đ, không có gì để thu
   thêm) nếu quyết định giữ quy trình thủ công.
2. **Code fix — chọn 1 trong 2 hướng** (ảnh hưởng nghiệp vụ, cần user quyết định):
   - (a) **Tự động xác nhận thu ngân** khi hóa đơn đạt `da_thanh_toan_du` VÀ không phát sinh gì thêm
     tại thời điểm bác sĩ hoàn tất ca khám (`hoanTatPhienKham`) — bỏ bước bấm tay cho case 1. Case 2/3
     (còn tiền phải thu) vẫn bắt buộc lễ tân xác nhận thủ công như hiện tại.
   - (b) **Giữ xác nhận thủ công bắt buộc** (đúng nguyên tắc "tiền phải có người đối chiếu bằng mắt",
     tránh sai sót) nhưng bổ sung: mặc định `Payments.tsx` hiển thị "Chờ thu" theo `scope='all'`
     (không lọc theo ngày) để case cũ không biến mất khỏi tầm mắt, và thêm chỉ số cảnh báo số ca "quá
     hạn xác nhận" trên dashboard lễ tân.
3. Áp dụng đồng bộ hướng đã chọn cho cả `patient/booking.controller.js` (đặt online) và
   `receptionist/booking.controller.js` (đặt hộ vãng lai tại quầy) — cả hai cùng chung root cause.

Script chẩn đoán đã thêm: `backend/src/scripts/inspect-cashier-confirmation-gap.js` (read-only, an
toàn chạy lại bất cứ lúc nào để tái kiểm tra sau khi vá).

## Đã xử lý (2026-08-21)

Theo lựa chọn của user: **giữ xác nhận thủ công, bỏ lọc mặc định theo ngày + thêm cảnh báo**, và
**sửa luôn 6 hóa đơn tồn đọng**.

- **Code** (`frontend/src/pages/receptionist/Payments.tsx`):
  - `scope` mặc định đổi `'today'` → `'all'` — case không được đối chiếu trong ngày không còn
    biến mất khỏi danh sách "Chờ thu" mặc định.
  - Thêm ô số liệu "Quá hạn xác nhận" (đỏ khi > 0) đếm số ca `pending` có ngày khám đã qua.
  - Mỗi dòng ca quá hạn có thêm nhãn "Quá hạn xác nhận" cạnh trạng thái, để lễ tân nhận ra ngay
    trong danh sách dài mà không cần mở từng ca.
  - `npx tsc --noEmit` toàn bộ frontend: sạch, không lỗi mới.
- **Dữ liệu** (`backend/src/scripts/fix-stale-billing-cases-2026-08-21.js`, gọi lại đúng
  `billing.createBillingInvoice` thật qua req/res giả lập, không tự viết lại logic nghiệp vụ):
  - 4 ca không phát sinh gì thêm (`LH-260713-0006`, `LH-260814-0001`, `LH-260815-0001`,
    `LH-260819-0001`) → đã xác nhận đối chiếu 0đ (`da_xac_nhan_thu_ngan=true`), đúng thực tế vì
    không còn gì phải thu.
  - 2 ca có dịch vụ phát sinh (`LH-260724-0003`: +350.000đ; `LH-260804-0009`: +280.000đ) →
    **chỉ cập nhật lại `tong_tien_phat_sinh`/`tong_thanh_toan` cho đúng thực tế**, KHÔNG tự đánh
    dấu đã thu (tiền thật sự chưa vào tay lễ tân) — hai ca này giờ hiện đúng số tiền còn phải thu
    trong tab "Chờ thu", lễ tân cần thu bổ sung rồi xác nhận qua UI như bình thường.
  - Đối chiếu lại bằng `inspect-cashier-confirmation-gap.js`: tổng số hóa đơn "đã thanh toán đủ
    nhưng chưa xác nhận" giảm từ 98 → 92 (đúng bằng 6 ca vừa xử lý; 92 còn lại là lịch `no_show`/
    `cancelled`/dữ liệu test cũ, không phải case đang hoạt động).
