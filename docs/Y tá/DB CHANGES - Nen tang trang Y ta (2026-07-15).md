# DB CHANGES — Nền tảng trang Y tá (Plan 1)

> Ngày: 2026-07-15 · Trạng thái: **ĐÃ CODE + test 12/12 pass** (`backend/tests/nurse-db.models.test.js`)
> File này = bản ghi gọn "thêm mới / chỉnh sửa" của DB. Chi tiết thiết kế xem:
> `Chot thiet ke DB...`, `Xu ly vang mat y ta...`, `Ke hoach 1 - Nen tang DB...`
> Nguyên tắc: **chỉ THÊM** collection/field/enum — không xoá/đổi giá trị cũ → không migration, data cũ không vỡ.

---

## A. COLLECTION THÊM MỚI (3)

### A1. `trang_thai_phong_kham` — model `TrangThaiPhongKham` 🆕
Trạng thái phòng/bác sĩ realtime, 1 bản ghi / bác sĩ / ngày.

| Field | Kiểu | Ghi chú |
|---|---|---|
| `doctor_id` | ObjectId → BacSi, **required** | |
| `ngay` | Date, **required** | |
| `schedule_id` | ObjectId → LichLamViec | nguồn suy ra phòng |
| `phong_kham` | String | snapshot từ LichLamViec (quyết định 4) |
| `nurse_id` | ObjectId → NguoiDung | y tá được phân công |
| `trang_thai` | enum `dang_kham / dang_don_phong / san_sang / tam_nghi` | default `san_sang` |
| `benh_nhan_hien_tai_id` | ObjectId → HangDoi | ai đang trong phòng (null = trống) |
| `thoi_diem_doi` | Date | lần đổi trạng thái gần nhất |
| `thoi_gian_kham_tb_phut` | Number | default 20 — ước tính thời gian chờ |
| `nguoi_dieu_khien_id` | ObjectId → NguoiDung | người THỰC TẾ đang điều khiển (dự phòng) |
| `nguoi_dieu_khien_vai_tro` | String | `nurse` / `receptionist` / `admin` |
| `y_ta_co_mat` | Boolean | default false — cảnh báo y tá đến muộn |

**Index:** `{doctor_id, ngay}` unique · `{ngay, trang_thai}`
**Ràng buộc flow (ở controller, plan sau):** `dang_kham → dang_don_phong → san_sang ⇄ tam_nghi`; không nhảy `dang_kham→san_sang`; không `tam_nghi` khi còn bệnh nhân.

### A2. `hang_doi` — model `HangDoi` 🆕
Hàng đợi động, online + offline đồng nhất (không lưu `thu_tu` — sort động lúc query).

| Field | Kiểu | Ghi chú |
|---|---|---|
| `nguon` | enum `online / offline`, **required** | |
| `appointment_id` | ObjectId → LichHen | **required khi online** (pre-validate) |
| `khach_vang_lai_id` | ObjectId → KhachVangLai | dùng khi offline |
| `member_id` | ObjectId → ThanhVien | |
| `ten_benh_nhan` | String, **required** | snapshot hiển thị |
| `so_dien_thoai` | String | **required khi offline** (pre-validate) |
| `tuoi` / `gioi_tinh` | Number / enum `nam,nu,khac` | snapshot |
| `specialty_id` | ObjectId → ChuyenKhoa, **required** | định tuyến check-in |
| `doctor_id` | ObjectId → BacSi | bác sĩ được gán |
| `phong_kham` | String | snapshot từ LichLamViec |
| `muc_uu_tien` | enum `online_uu_tien / online_thuong / offline`, **required** | TH1–TH6 |
| `gio_hen_goc` | Date | tính cửa sổ ±30' |
| `trang_thai` | enum `dang_cho / da_goi / trong_phong / skipped / cancelled / hoan_thanh` | default `dang_cho` |
| `checkin_time` | Date, **required** | |
| `so_lan_goi` · `thoi_diem_goi` | Number · Date | đếm no-show 5'/10' |
| `thoi_diem_vao_phong` · `thoi_diem_ket_thuc` | Date | |
| `thoi_gian_cho_uoc_tinh_phut` | Number | cache hiển thị |
| `nguoi_tiep_nhan_id` · `vai_tro_tiep_nhan` | ObjectId → NguoiDung · String | actor-agnostic (lễ tân sau) |

**Index:** `{doctor_id, trang_thai}` · `{specialty_id, trang_thai}` · `{appointment_id}` unique sparse · `{trang_thai, thoi_diem_goi}`
**Kèm hàm export** `tinhMucUuTien(nguon, checkinTime, gioHenGoc)` (cửa sổ ±30 phút).

### A3. `nghi_phep_y_ta` — model `NghiPhepYTa` 🆕
Y tá tự xin nghỉ → admin duyệt. Nhân bản `NghiPhepBacSi` nhưng **không khóa ca** (chỉ reassign).

| Field | Kiểu | Ghi chú |
|---|---|---|
| `y_ta_id` | ObjectId → NguoiDung, **required** | y tá = NguoiDung role=nurse |
| `tu_ngay` · `den_ngay` | Date, **required** | pre-validate `den_ngay >= tu_ngay` |
| `gio_bat_dau` · `gio_ket_thuc` | String HH:MM | null = nghỉ cả ngày |
| `ly_do` | String | |
| `trang_thai` | enum `cho_duyet / da_duyet / tu_choi / da_huy` | default `cho_duyet` |
| `nguoi_duyet_id` · `thoi_diem_duyet` | ObjectId → NguoiDung · Date | |
| `ghi_chu` | String | lý do từ chối |
| `y_ta_thay_id` | ObjectId → NguoiDung | admin chọn lúc DUYỆT |

**Index:** `{y_ta_id, tu_ngay, den_ngay}` · `{trang_thai}`

---

## B. COLLECTION CHỈNH SỬA (4) — chỉ thêm giá trị/field

| Collection | Thay đổi | Trước | Sau |
|---|---|---|---|
| `lich_hen` (`LichHen`) | enum `status` +2 giá trị | `...in_progress, waiting_doctor_confirm, completed...` | +`waiting_record` (bác sĩ khám xong, chờ y tá nhập), +`skipped` (no-show khi gọi) |
| `nhat_ky_thao_tac` (`NhatKyThaoTac`) | enum `vai_tro` +2 giá trị + comment | `admin, doctor, user, system` | +`nurse`, +`receptionist`; thêm block comment hành động y tá (`CHANGE_DOCTOR_STATUS, CHECKIN_QUEUE, CALL_PATIENT, SKIP_PATIENT, ASSIGN_DOCTOR`) |
| `ket_qua_kham` (`KetQuaKham`) | `dich_vu_phat_sinh` đổi kiểu | `[Mixed]` | `[dichVuPhatSinhSchema]` = `{service_id, ten*, so_luong, don_gia*, thanh_tien*, chi_dinh_boi_bac_si_id, them_boi_y_ta_id}` (*required). `dich_vu_tu_choi` GIỮ Mixed |
| `don_thuoc` (`DonThuoc`) | enum `nguon` +1 giá trị | `bac_si, tu_nhap` | +`y_ta` (hook ép `member_id` chỉ áp `tu_nhap` → `y_ta` tự do cho khách vãng lai) |

**+ `src/models/index.js`:** đăng ký 3 export mới (`TrangThaiPhongKham`, `HangDoi`, `NghiPhepYTa`).

---

## C. KHÔNG đụng tới (xác nhận)

- `HoaDon` — đã đủ (`chi_tiet_thu_phi` + `tong_tien_phat_sinh`), chỉ đấu luồng ở plan sau.
- `SinhHieuKham`, `LichLamViec` (đã có `nurse_id`), `PhongKham` — giữ nguyên.
- **Không** thêm `phong_kham_id` ref vào `LichHen` (quyết định 4 — phòng lấy từ LichLamViec).
- **Không** tạo model `YTa` riêng — y tá là `NguoiDung` role=`nurse`.

---

## D. Kiểm chứng

- `node --test tests/nurse-db.models.test.js` → **12 pass / 0 fail** (2026-07-15).
- Import qua barrel `index.js` chạy sạch → toàn bộ model đăng ký OK.
- Chưa chạy regression `doctor.api.test.js` (cần server + seed) — rủi ro thấp vì chỉ thêm enum/field.

## E. Việc còn lại về tài liệu (đề xuất)

- [ ] Cập nhật file schema chuẩn `docs/Đặc tả trang web và database/database.md` (đang mô tả 27 bảng) → thêm 3 bảng mới thành 30 bảng, để tài liệu gốc khớp code. *(Chưa làm — hỏi ý kiến trước khi sửa file đặc tả gốc.)*
