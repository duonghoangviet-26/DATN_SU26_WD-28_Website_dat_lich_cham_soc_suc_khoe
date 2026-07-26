# RULE (BẤT BIẾN) — Nghiệp vụ Lịch làm việc bác sĩ / Lịch hẹn

> ⛔ **KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI nghiệp vụ này.** Đây là quy tắc đã chốt của VitaFamily.
> Mọi phân tích, thiết kế DB, API, UI về lịch làm việc / lịch hẹn / hàng đợi PHẢI tuân thủ.
> Muốn đổi quy tắc → phải được người dùng yêu cầu rõ ràng, không tự suy diễn.
> Chi tiết đầy đủ: `docs/Lịch làm việc bác sĩ.md`.

## 1. Ba tầng thời gian — bắt buộc phân biệt
`CA → KHUNG GIỜ (30 phút) → SLOT (1 slot = 1 bệnh nhân)`
- Ca sáng 08:00–11:30 = **7 khung**; ca chiều 13:30–17:30 = **8 khung**. Nghỉ trưa 11:30–13:30.
- Khung giờ = đơn vị bệnh nhân chọn khi đặt online. Slot = đơn vị đặt nhỏ nhất.
- Mỗi khung chứa **NHIỀU slot** theo chuyên khoa. **Không** đánh đồng slot = khung.

## 2. Cấu hình theo chuyên khoa
- `Số slot/khung = floor(30 / thời gian khám TB)` — **luôn làm tròn XUỐNG** (an toàn, không lấy lạc quan).
- TMH (hiện tại): thời gian khám 10–15′ → **2 slot/khung**. Sáng 14 / chiều 16 / ngày 30.
- Thêm chuyên khoa mới = cấu hình 4 giá trị (tên, TG khám, slot/khung, %online). **Không sửa code logic.**

## 3. Bác sĩ KHÔNG full-time
- Bác sĩ đăng ký **theo CA**, không theo ngày. Admin chưa tạo lịch ngày/ca nào → không hiển thị đặt online ngày/ca đó.
- **1 phòng = 1 bác sĩ / ca.** **1 bác sĩ = 1 phòng / ca.**
- Bác sĩ nghỉ đột xuất → admin đổi trạng thái → thông báo bệnh nhân đã đặt.

## 4. Online vs Walk-in — phân theo TỪNG KHUNG
- Mỗi khung tách slot **online** và **walk-in**. Quota mặc định **online 70% / walk-in 30%** capacity ca, phân **xen kẽ**.
- Walk-in (`nguon='tai_cho'`) **không chiếm** slot online; chỉ vào slot walk-in trống.
- Bệnh nhân đặt online **chỉ thấy slot online còn trống**.

## 5. Đặt online
- **1 lượt / bác sĩ / ngày** cho mỗi bệnh nhân.
- Thanh toán **100%** khi đặt. Hủy trước ca → hoàn 100%. No-show cả ca → hoàn 0%. Đến mà không kịp khám → chuyển lịch, không mất tiền.

## 6. Hàng đợi (HangDoi) — ĐÃ ĐÚNG, GIỮ NGUYÊN
- `HangDoi` **chỉ tạo khi check-in** (online + walk-in **chung 1 hàng đợi**). Chưa đến → không có trong hàng đợi.
- **Không lưu `thu_tu`** — tính động lúc query (`muc_uu_tien` → `checkin_time`).
- Ưu tiên: khẩn cấp > online check-in đúng cửa sổ ±30′ (`online_uu_tien`) > `online_thuong` > walk-in/đến trễ >30′ (`offline`).
- Xong sớm → gọi bệnh nhân khung sau; xong muộn → khung sau chờ (đã có buffer).

## 7. Ràng buộc dữ liệu bất biến
- Mỗi slot ↔ tối đa **1** `LichHen`. Mỗi `LichHen` ↔ tối đa **1** `HangDoi` đang hoạt động.
- Kiểm tra capacity phải **nguyên tử** — 2 lễ tân thao tác đồng thời không được vượt trần.
- Lễ tân & y tá dùng **chung 1 service check-in** — không mỗi vai trò một luồng.
- Mô hình hiện thực: **giữ `slots[]` embedded trong `LichLamViec`** (Lựa chọn A), thêm `khung_index` + `loai_slot`; KHÔNG đại phẫu tách collection trừ khi được yêu cầu.

## 8. Trạng thái bệnh nhân (canonical)
`chua_den → da_check_in → trong_phong → (cho_dich_vu) → hoan_thanh` | `no_show` (**chỉ online**) | `da_huy`.

## 9. Trạng thái đồng bộ với code (2026-07-23)
- ĐÃ ĐẠT (không đổi): `HangDoi`, giữ slot `pending_payment`, thanh toán/hoàn tiền, đổi lịch ≤3.
- CÒN THIẾU (theo Gap G1–G7 trong doc): tầng khung giờ + nhiều slot/khung, ca làm việc, cấu hình chuyên khoa, `loai_slot` online/walk-in, ràng buộc phòng, trạng thái `cho_dich_vu`.
- Khi triển khai: ưu tiên **P0** (thêm field cấu hình `ChuyenKhoa`) → P1 → P2, có migration, **không phá dữ liệu/demo**.

## 10. Bảng & field DB BẮT BUỘC cho nghiệp vụ này
> Kết quả phân tích DB (2026-07-23): DB hiện tại **KHÔNG đủ** — cần các thay đổi dưới đây.
> Chi tiết + migration: `docs/Phan tich DB - Lich lam viec bac si (2026-07-23).md`.

**A. Thêm field vào collection có sẵn:**
- `chuyen_khoa` **(P0 — ✅ ĐÃ TRIỂN KHAI 2026-07-23)**: `thoi_gian_kham_trung_binh_phut` (default 15), `so_slot_moi_khung` (default null = tự tính `floor(30/TG)`, admin chỉ được override XUỐNG thấp hơn mức an toàn — enforce ở `pre('validate')` trong `ChuyenKhoa.js`), `ty_le_online_phan_tram` (default 70). Đã cập nhật: model, `specialties.controller.js` (create/update), `clinic-info.controller.js` (legacy alias create/update), form admin `AddSpecialty.tsx`/`EditSpecialty.tsx`, `SpecialtyItem` type, seed `seed-all.js`, script backfill `backfill-chuyen-khoa-slot-config.js` cho dữ liệu cũ.
- `lich_lam_viec` **(Phase 1A — ✅ ĐÃ TRIỂN KHAI 2026-07-23)**: slot-level `khung_index` (Number, nhóm nhiều slot cùng khung 30') + `loai_slot` (enum `online|walk_in`, quota phân bổ xen kẽ qua `phanBoOnlineTheoKhung()`). **CHƯA làm**: `ca` + `phong_id` cấp lịch (Phase 1B — xem inventory 9 file phụ thuộc bên dưới, cần plan riêng).
- `hang_doi` **(P2)**: thêm enum `cho_dich_vu` vào `trang_thai`.
- `lich_hen` **(P2)**: thêm `nguon` (enum `online|tai_cho`); thêm `cho_dich_vu` vào `status`.

**B. Bảng MỚI:**
- `mau_lich_lam_viec` (MauLichLamViec) **(P1)** — mẫu đăng ký ca theo tuần của bác sĩ (nguồn để generator sinh lịch, thay cho auto full-day). Fields: `bac_si_id, thu_trong_tuan(0-6), ca, phong_id, chuyen_khoa_id, trang_thai, hieu_luc_tu, hieu_luc_den`.

**C. Index / migration:**
- `lich_lam_viec`: unique `(doctor_id, ngay)` → **`(doctor_id, ngay, ca)`**; thêm unique `(phong_id, ngay, ca)` (ràng buộc 1 phòng=1 BS/ca).
- Sửa `scheduleGenerator.service.js`: sinh lịch theo `mau_lich_lam_viec` + số slot/khung theo `chuyen_khoa`, **KHÔNG** auto full-day cho mọi bác sĩ.

**KHÔNG tách** collection `KhungGio`/`Slot` riêng — giữ `slots[]` embedded (Lựa chọn A), khung giờ = nhóm theo `khung_index`.
**KHÔNG đụng** `HangDoi` (đã đúng), `NghiPhepBacSi`, `KhachVangLai`, `CauHinhPhongKham`, `PhongKham`.
