# Đơn giản hóa panel chi tiết thanh toán (trang lễ tân)

**Ngày:** 2026-08-27
**File:** `frontend/src/pages/receptionist/Payments.tsx`

## Vấn đề

Panel chi tiết mở khi lễ tân chọn 1 ca ở "Thanh toán tại quầy" hiện số tiền 2 lần: 4 ô tổng quan
đầu panel ("Tổng hóa đơn / Đã thu / Còn phải thu") rồi lặp lại ở khối "1. Đối chiếu số tiền phải
thu" (Phí khám / Dịch vụ phát sinh / Cần thu sau khám) ngay bên dưới, đặt trong khung xám lồng thêm
ô trắng bên trong — vừa trùng thông tin vừa rối bố cục. "Chi tiết thu phí" ngay dưới đã liệt kê
từng dòng phí nên khối đối chiếu là dư thừa.

## Sửa

- Bỏ hẳn khối "1. Đối chiếu số tiền phải thu" (3 `MetricTile` Phí khám/Dịch vụ phát sinh/Cần thu
  sau khám) — không mất thông tin vì đã có ở 4 ô tổng quan + "Chi tiết thu phí".
- Khối "Thao tác thu ngân" hết còn là bước "2." (vì bước "1." đã bỏ) — đổi tiêu đề đánh số dạng
  khoanh tròn sang icon (`CircleDollarSign`) + tên mục, bỏ khái niệm đánh số bước không còn ý nghĩa.
- Khối "Thao tác thu ngân" trước đó là khung xám (`bg-slate-50`) lồng thêm ô trắng bên trong — đổi
  outer thành khung trắng viền đơn (đồng nhất với "Chi tiết thu phí"/"Lịch sử giao dịch" cùng cột),
  đồng thời đảo các ô nội dung bên trong (Số tiền khách cần chuyển, khung QR, Số tiền cần xử lý,
  Phương thức thanh toán) từ trắng sang `bg-slate-50` để vẫn có 1 lớp phân tách nhẹ, không còn
  "xám lồng trắng" 2 tầng như cũ.
- Xóa component `SectionTitle` (đánh số bước) vì sau khi gộp không còn nơi nào dùng.
- Không đổi API, state, hay logic xử lý thanh toán (`createInvoice`, `resolveTransfer`,
  `regenerateTransferQr`, `printReceipt`) — chỉ bỏ 1 khối JSX và đổi class màu/bố cục.

## Kiểm chứng

- `npx tsc --noEmit -p tsconfig.json`, lọc theo `Payments.tsx`: không lỗi.
- Diff: 44 dòng xóa / 14 dòng thêm — thu gọn thực sự, không phải đổi ngang.
- Chưa mở UI thật — cần vào "Thanh toán tại quầy" → chọn 1 ca để xác nhận trực quan.
