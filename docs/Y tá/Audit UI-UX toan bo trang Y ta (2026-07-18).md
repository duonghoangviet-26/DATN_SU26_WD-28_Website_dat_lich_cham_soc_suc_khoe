# PROMPT 15 — Audit UI/UX toàn bộ trang Y tá

> Ngày: 2026-07-18 · Đọc `layouts/NurseLayout`, `components/nurse/{NurseSidebar,NurseHeader}`, 4 page nurse, `nurseMenu`. Góc nhìn: y tá đang tác nghiệp trong ngày. Không sửa.

## A. Audit UI

| Trang | Vấn đề | Ảnh hưởng nghiệp vụ | Mức | Đề xuất |
|---|---|---|---|---|
| **Layout/Sidebar/Header** | Sạch, tách biệt admin ✅. Nhưng avatar/tên **không click được**, **không có Profile**; menu chỉ 3 mục | Y tá không có nơi xem/sửa thông tin cá nhân | P2 | Thêm Profile + menu/dropdown avatar |
| **Dashboard** | **7 thẻ số không click được**; thiếu ô ưu tiên "Hồ sơ cần sửa"; hơi nhồi thẻ | Không dẫn thẳng tới việc cần làm; liếc số nhưng không hành động được | **P1** | Gom nhóm thẻ, thẻ click → trang lọc, thêm 2 ô hành động (PROMPT 6) |
| **Ca làm việc** | Không có trang riêng; khối "ca hôm nay" thiếu giờ ca/số lịch | Không biết khung giờ trực | P2 | Nâng khối ca trong Dashboard (PROMPT 7) |
| **Danh sách lịch hẹn** | Bảng 9 cột, **thiếu cột "Hồ sơ"**; badge trạng thái map **thiếu màu** (`waiting_record`/`skipped`→xám); không tìm kiếm/reset | Không thấy nhanh lịch nào cần nhập/đang chờ; khó phân biệt trạng thái | **P1** | Thêm cột Hồ sơ + màu badge đủ + tìm kiếm (PROMPT 8) |
| **Chi tiết lịch hẹn** | Bố cục 2 cột tốt; `di_ung` đỏ + `benh_nen` amber **nổi bật** ✅; khóa hồ sơ rõ ✅. Nhưng **không cảnh báo "chưa lưu"** khi rời/reload | Mất dữ liệu form khi thao tác nhầm | **P1** | Thêm guard unsaved + (tùy) autosave nháp |
| **Tiếp nhận/Check-in** | **Không có UI** | Không tiếp nhận được từ trang y tá | P2 | Quyết định nối/gỡ (PROMPT 9) |
| **Hồ sơ cần nhập** | Không trang/bộ lọc riêng; phải mò trong danh sách | Khó tìm việc cần nhập | P2 | Bộ lọc "cần nhập" trong danh sách |
| **Form hồ sơ** | Nhóm "Tiếp nhận ban đầu"/"Hồ sơ khám" rõ; `Chẩn đoán *` bắt buộc. Nhưng **thiếu nhãn "nhập theo kết luận bác sĩ"**; input sinh hiệu nhỏ | Rủi ro hiểu nhầm y tá tự chẩn đoán | P2 | Thêm nhãn/disclaimer + nới input |
| **Hồ sơ cần sửa** | **Luôn rỗng** (luồng gỡ - PROMPT 12); nút "Chỉnh sửa" điều hướng `undefined` (P1.1) | Chức năng chết/nút hỏng | **P1** | Gỡ hoặc khôi phục theo quyết định A/B |
| **Hồ sơ đã gửi** | Không trang riêng (chỉ badge/đếm) | Khó theo dõi hồ sơ đã gửi | P3 | Bộ lọc trong danh sách |
| **Profile** | **Không tồn tại** | Không đổi mật khẩu/xem thông tin | P2 | Thêm trang tối giản |

**Đánh giá tổng theo yêu cầu thiết kế:**
- Rõ ràng / tách biệt admin / responsive / loading-error-empty / feedback (toast): ✅
- Không hiển thị hành động không hợp lệ (khóa ẩn nút): ✅
- Ghi chú bác sĩ nổi bật (banner đỏ) + hồ sơ khóa rõ (banner + disabled): ✅ (dù note luôn rỗng)
- Ưu tiên việc cần xử lý ngay: ⚠️ yếu (dashboard không dẫn hành động)
- Trạng thái dễ phân biệt: ⚠️ badge map thiếu màu cho vài trạng thái
- Nút nguy hiểm có xác nhận: ⚠️ **không có modal xác nhận** (skip/cancel chưa nối; submit không confirm — chấp nhận)
- Không mất dữ liệu khi thao tác nhầm: ❌ **không có cảnh báo unsaved**
- Không nhồi card: ⚠️ dashboard 7 thẻ

## B. Design system đề xuất (đặc tả, chưa code)

| Thành phần | Đề xuất |
|---|---|
| **Typography** | Thang rõ: tiêu đề trang `text-lg/xl font-bold`; nhãn phụ `text-xs uppercase tracking-wide text-slate-400`; body `text-sm`. Giữ 1 font, không lạm dụng size |
| **Khoảng cách** | Nhịp 4px; card `p-4`; khoảng giữa section `space-y-5`; tránh dày đặc ở form (nới input py-2) |
| **Card** | Bo `rounded-xl`, viền `border-slate-200`, nền trắng; nhóm theo mục đích; **thẻ số → click được** (hover + con trỏ) |
| **Table** | Header `bg-slate-50 uppercase text-xs`; row hover; `overflow-x-auto` giữ; **thêm cột trạng thái Hồ sơ**; cân nhắc bỏ cột ít giá trị (Dịch vụ/Nguồn) |
| **Badge** | **Bảng màu trạng thái ĐỦ, nhất quán 2 trang:** đặt/chưa đến=slate; đã đến-chờ=blue; đang khám=amber; chờ nhập/chờ XN=amber; đã XN/hoàn thành=green; hủy/no_show=red; skip=gray. Trạng thái hồ sơ có bộ màu riêng (đang dùng ở detail — tốt) |
| **Button** | 3 cấp: primary (brand), secondary (viền), **danger (đỏ)** cho skip/cancel; luôn có `disabled` khi `saving`; kèm nhãn hành động rõ |
| **Modal** | **ConfirmDialog cho hành động khó hoàn tác** (skip/cancel/no_show); dùng lại `components/common/ConfirmDialog` đã có |
| **Form** | Nhóm rõ (tiếp nhận vs hồ sơ); `*` cho bắt buộc; **nhãn "ghi theo kết luận bác sĩ"** ở khối chẩn đoán; **cảnh báo "thay đổi chưa lưu"** khi rời trang; nút Lưu/Gửi cố định cuối form |
| **Alert** | Banner phân loại: đỏ=yêu cầu sửa/cảnh báo dị ứng; amber=chờ xác nhận; xanh=đã xác nhận; xám=thông tin. Icon + tiêu đề đậm + nội dung |
| **Empty state** | Icon mờ + câu rõ nguyên nhân (phân biệt "chưa được phân công" vs "không có kết quả lọc") |
| **Loading skeleton** | Thay "Đang tải..." bằng skeleton card/row để đỡ nhảy layout (tùy — hiện có spinner text là chấp nhận được) |

## Kết luận
- **Nền UI tốt** (tách biệt admin, responsive, loading/error/empty, cảnh báo dị ứng nổi bật, khóa hồ sơ rõ).
- **3 việc UI ưu tiên (P1):** (1) Dashboard hướng-hành-động + thẻ click được; (2) Danh sách thêm cột "Hồ sơ" + màu badge đủ + tìm kiếm; (3) chống mất dữ liệu form (cảnh báo unsaved) + xử lý trang Revisions (gỡ/khôi phục).
- P2: Profile, nâng khối ca, nhãn chuyên môn form, ConfirmDialog cho hành động nguy hiểm.

*Chỉ phân tích, chưa sửa code.*
