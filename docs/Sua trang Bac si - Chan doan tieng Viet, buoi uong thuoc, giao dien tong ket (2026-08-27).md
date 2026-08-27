# Sửa trang Bác sĩ: tiếng Việt không dấu ở bước Chẩn đoán, chọn buổi uống thuốc, giao diện Tổng kết

**Ngày:** 2026-08-27
**Phạm vi:** luồng khám 4 bước của bác sĩ (`ExamSessionPage.tsx` → `StepTiepNhan` → `StepChanDoan` →
`StepDichVu` → `StepKeDon` → `StepXacNhan`), mở từ "Hồ sơ chờ khám".

## 1. Tiếng Việt không dấu ở bước Chẩn đoán (chỉ sửa hiển thị)

Rà toàn bộ `pages/doctor` + `components/doctor` bằng danh sách từ khóa tiếng Việt không dấu
thường gặp. Chỉ 2 file có chuỗi hiển thị cho người dùng bị lỗi (phần còn lại — Dashboard,
Appointments, Profile, ExamQueue, StepDichVu, DayShiftBoard... — đã đúng dấu; các chuỗi không dấu
còn sót chỉ nằm trong comment code, không hiển thị, không đụng tới):

- `StepChanDoan.tsx`: nhãn "Chan doan" → "Chẩn đoán", "Luu y" → "Lưu ý", "Ngay tai kham" → "Ngày
  tái khám", chuỗi "Trieu chung da ghi:" → "Triệu chứng đã ghi:", placeholder "Benh nhan can lam
  gi, kieng gi, theo doi ra sao" → "Bệnh nhân cần làm gì, kiêng gì, theo dõi ra sao", nút "Dang
  luu..." / "Tiep tuc -> Dich vu" → "Đang lưu..." / "Tiếp tục → Dịch vụ".
- `StepTiepNhan.tsx`: banner "Da tu dien tu ly do kham khi dat lich online..." → "Đã tự điền từ lý
  do khám khi đặt lịch online. Bác sĩ hỏi lại và bổ sung thêm nếu cần trước khi lưu."

**Không đụng:** `StepChanDoan.tsx:11` so sánh `phien.ho_so?.chan_doan === '(dang kham)'` — đây là
so khớp với giá trị sentinel thật trong dữ liệu (logic), không phải chuỗi hiển thị, giữ nguyên.

## 2. Kê đơn: chọn buổi uống (Sáng/Trưa/Tối) thay vì gõ giờ

Backend (`DonThuoc.js`) validate cứng `gio_uong` là mảng giờ `HH:MM` — không đổi được và không cần
đổi. Cách làm: `StepKeDon.tsx` thay input `type="time"` tự do bằng 3 nút bấm **Sáng / Trưa / Tối**
(`BUOI_UONG` — chọn được nhiều cùng lúc), mỗi nút ánh xạ 1 giờ đại diện cố định (07:00 / 12:00 /
19:00, trùng với dữ liệu mẫu sẵn có ở `e2e-luong-tiep-nhan.js` và `seed-doctor-test-data.js`) rồi
ghi thẳng vào đúng mảng `gio_uong` như trước — payload gửi backend không đổi cấu trúc, vẫn hợp lệ
với validator `HH:MM`.

Đơn thuốc cũ có giờ tự nhập (không khớp 3 giờ chuẩn) vẫn được giữ nguyên trong `gio_uong` khi tải
lên form sửa — chỉ là không nút nào trong 3 nút hiện "đang chọn"; sửa lại vẫn hoạt động bình
thường qua `toggleBuoiUong`.

**Ngoài phạm vi:** `components/doctor/ExamResultModal.tsx` (dùng ở màn hình khác, không thuộc luồng
"Hồ sơ chờ khám" 4 bước) vẫn còn ô nhập giờ tự do dạng chuỗi phẩy — chưa sửa theo yêu cầu, để lại
nếu sau này cần đồng bộ.

## 3. Giao diện "Tổng kết hồ sơ khám" (`StepXacNhan.tsx`)

Giữ nguyên toàn bộ dữ liệu/props hiển thị, chỉ nâng cấp trình bày:
- Mỗi khối tóm tắt (Tiếp nhận/Chẩn đoán/Dịch vụ/Kê đơn) có 1 màu nhấn riêng (viền + nền tiêu đề +
  icon bọc màu — sky/violet/amber/emerald) và icon riêng (`stethoscope`/`edit`/`service`/`receipt`
  từ `components/admin/icons.tsx`) thay vì 4 khối trắng-viền-xám giống hệt nhau.
- Số bước đổi từ "1. Tiếp nhận" (chữ trơn) thành nhãn "Bước 1" + tiêu đề tách dòng, đặt trong khối
  màu nhấn ở đầu mỗi thẻ.
- Chỉ số thể trạng (cân nặng/chiều cao/BMI/huyết áp) đổi từ bảng `<dl>` chữ nhỏ sang 4 ô số nổi bật
  (grid, số to, nhãn nhỏ dưới) trong nền sky nhạt.
- Tổng tiền dịch vụ và mỗi dòng thuốc có khung nền màu riêng để nổi bật; giờ uống thuốc hiển thị
  lại thành nhãn "Sáng/Trưa/Tối" (khớp ngược từ giờ đại diện của mục 2 — thuần hiển thị, không đổi
  dữ liệu; giờ lạ không khớp được thì vẫn in nguyên giờ, không mất thông tin).
- Thêm dòng mô tả ngắn ở đầu trang tóm tắt hướng dẫn bác sĩ bấm "Sửa" đúng khối cần chỉnh.
- Màn "Đã hoàn tất ca khám" (sau khi bấm nút cuối) giữ nguyên — ngoài phạm vi yêu cầu (chỉ nói về
  màn tổng kết TRƯỚC khi hoàn tất).

## Kiểm chứng

- `npx tsc --noEmit -p tsconfig.json` (frontend), lọc theo 4 file đã sửa: không phát sinh lỗi mới.
- Chưa chạy UI thật — cần mở một ca khám thật (hoặc dữ liệu demo) qua "Hồ sơ chờ khám" để xác nhận
  trực quan cả 3 điểm trên trình duyệt.
