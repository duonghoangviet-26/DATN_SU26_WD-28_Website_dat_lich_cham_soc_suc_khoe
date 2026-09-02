# Đồng bộ giao diện "Xem hồ sơ" (Bệnh nhân đã khám) với Tổng kết hồ sơ khám

**Ngày:** 2026-08-27
**Liên quan:** nối tiếp `docs/Sua trang Bac si - Chan doan tieng Viet, buoi uong thuoc, giao dien tong ket (2026-08-27).md`
**Yêu cầu gốc:** đồng bộ giao diện modal "Xem hồ sơ" (mở từ trang "Bệnh nhân đã khám" →
`DoctorExamHistory.tsx` → `ExamHistoryDetailModal.tsx`) với giao diện "Tổng kết hồ sơ khám"
(`StepXacNhan.tsx`) vừa làm mới hôm nay, kèm rà lại tiếng Việt không dấu.

## Kiểm tra tiếng Việt không dấu

Rà `ExamHistoryDetailModal.tsx` và `DoctorExamHistory.tsx` bằng cùng danh sách từ khóa đã dùng lần
trước — **không tìm thấy chuỗi hiển thị nào thiếu dấu** ở 2 file này. Không có gì cần sửa ở mục này.

## Đồng bộ giao diện

Thay vì copy lại y hệt phần khối màu đã viết trong `StepXacNhan.tsx`, tách ra thành component dùng
chung `frontend/src/components/doctor/exam/KhoiThongTin.tsx`:
- Export `KhoiTomTat` (khối thẻ: viền màu + icon bọc màu + tiêu đề + nút hành động tùy chọn `action`
  thay vì cứng nút "Sửa" như bản cũ, để dùng được cho cả "Sửa bước" lẫn "Đính chính"/"In hồ sơ").
- Export 6 màu tĩnh: `MAU_SKY`, `MAU_VIOLET`, `MAU_AMBER`, `MAU_EMERALD`, `MAU_BRAND`, `MAU_SLATE`.
- Export `nhanBuoiUong(gio)` — khớp ngược giờ đại diện (07:00/12:00/19:00) về "Sáng/Trưa/Tối" cho
  hiển thị, dùng chung cho cả 2 màn hình có in giờ uống thuốc.

`StepXacNhan.tsx` được refactor để import từ file dùng chung này thay vì định nghĩa cục bộ (không
đổi hành vi, chỉ chuyển vị trí định nghĩa).

`ExamHistoryDetailModal.tsx` áp cùng khối màu cho 6 phần:
- Thông tin bệnh nhân → sky, icon `user`
- Chẩn đoán & điều trị → violet, icon `edit`, nút hành động "Đính chính" (giữ nguyên hành vi cũ)
- Dịch vụ phát sinh → amber, icon `service`, thêm khung tổng tiền nổi bật giống bên Tổng kết (trước
  đây chỉ là dòng chữ căn phải nhỏ)
- Đơn thuốc → emerald, icon `receipt`, giờ uống hiển thị lại thành nhãn Sáng/Trưa/Tối thay vì liệt
  kê chung 1 dòng — đồng bộ với cách kê đơn ở `StepKeDon.tsx`
- Thanh toán → màu brand (thương hiệu), icon `payment`, nút hành động "In hồ sơ" (giữ nguyên hành vi
  `inHoSo`)
- Lịch sử chỉnh sửa → màu trung tính (slate), icon `clock` — đây là log phụ nên không dùng 1 trong
  4 màu nhấn chính

**Không đổi:** khối "Đính chính hồ sơ đã xác nhận" (form sửa khi bấm nút "Đính chính") vẫn giữ
nguyên khung cảnh báo màu vàng như cũ — đây là trạng thái đang chỉnh sửa, khác về ý nghĩa với các
khối tóm tắt tĩnh nên không áp màu theo bước. Không đổi dữ liệu, props, hay logic `luuDinhChinh`/
`inHoSo`/whitelist trường được đính chính ở backend.

## Kiểm chứng

- `npx tsc --noEmit -p tsconfig.json` (frontend), lọc theo 3 file liên quan
  (`ExamHistoryDetailModal`, `KhoiThongTin`, `StepXacNhan`): không phát sinh lỗi mới, các thẻ
  JSX đóng/mở khớp đủ sau khi tách section thành `KhoiTomTat`.
- Chưa mở UI thật — cần vào "Bệnh nhân đã khám" → bấm "Xem hồ sơ" một ca đã hoàn tất để xác nhận
  trực quan.
