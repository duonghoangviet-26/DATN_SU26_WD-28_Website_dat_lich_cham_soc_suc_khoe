# PROMPT 4 — Phân tích database & dữ liệu thật cho trang Y tá

> Ngày: 2026-07-18 · Field lấy **trực tiếp từ code model**; dữ liệu từ **probe read-only, đã che PII** (không in tên/SĐT/email/token). Không sửa schema, không seed, không migration.

## Bước 1 — Schema thực tế (đọc từ code)

### A. Bảng model thực tế

| Model (collection) | Vai trò | Quan hệ (ref) | Field quan trọng đã tìm thấy (bằng chứng code) | Vấn đề |
|---|---|---|---|---|
| `NguoiDung` (nguoi_dung) | Tài khoản mọi vai trò | — | `role` enum `['user,patient,doctor,admin,receptionist,nurse']`; `ho_ten`, `email`(unique), `mat_khau`(select:false), `status`. **Không có model YTa riêng** — y tá = role `nurse` | Nurse không có profile chuyên biệt (đúng thiết kế hiện tại) |
| `LichLamViec` (lich_lam_viec) | Ca làm việc/ngày + slots | `doctor_id`→BacSi, `nurse_id`→NguoiDung, `chi_nhanh_id`, `slots[]` | `nurse_id`(default null) = **phân công y tá theo NGÀY** (1 y tá/ngày, không theo slot); `slots[]{gio_bat_dau,gio_ket_thuc,status,phong_kham,specialty_id,benh_nhan_id,_id}`; unique `(doctor_id,ngay)` | `nurse_id` phần lớn null (xem B) |
| `LichHen` (lich_hen) | Lịch hẹn | `doctor_id`→BacSi, `nurse_id`→NguoiDung, `schedule_id`→LichLamViec, `slot_id`, `member_id`→ThanhVien | `nurse_id`(default null, **comment: copy từ LichLamViec.nurse_id lúc đặt — chưa thực thi**); `status` enum 10 giá trị; `payment_status`; `ngay_kham`,`gio_kham`; pre-validate clinic/home cần doctor+schedule+slot | **`nurse_id` không được set khi booking** (P0.1) |
| `KetQuaKham` (ket_qua_kham) | Hồ sơ khám | `appointment_id`→LichHen, `hang_doi_id`→HangDoi, `nguoi_nhap_id`, `bac_si_phu_trach_id`, `nguoi_xac_nhan_id` | `status` enum `['ban_nhap,cho_xac_nhan,da_xac_nhan,yeu_cau_chinh_sua']` default `cho_xac_nhan`; `doctor_revision_note`, `submitted_at`, `lich_su_sua[]{nguoi_sua_id,thoi_diem_sua,noi_dung}`, `thoi_diem_xac_nhan`; **sparse-unique** `appointment_id` & `hang_doi_id`; pre-validate cần ≥1 khóa | Có 3 bản ghi `status=null` (xem B) |
| `SinhHieuKham` (sinh_hieu_kham) | Sinh hiệu tiếp nhận | `appointment_id`, `hang_doi_id`, `member_id` | `can_nang,chieu_cao,huyet_ap,nhiet_do,nhip_tim`, `nguoi_do_id`; sparse-unique như KetQuaKham | — |
| `HangDoi` (hang_doi) | Hàng đợi động | `appointment_id`, `member_id`, `specialty_id`(required), `doctor_id` | `nguon` enum `[online,offline]`; `muc_uu_tien`; `trang_thai` enum `[dang_cho,da_goi,trong_phong,skipped,cancelled,hoan_thanh]`; `checkin_time`(required); sparse-unique `appointment_id` | Nơi **duy nhất** tạo HangDoi; dữ liệu hiện chỉ rác offline |
| `TrangThaiPhongKham` (trang_thai_phong_kham) | Trạng thái phòng/ngày | `doctor_id`(required), `nurse_id`, `benh_nhan_hien_tai_id`→HangDoi, `schedule_id` | `trang_thai` enum `[dang_kham,dang_don_phong,san_sang,tam_nghi]`; unique `(doctor_id,ngay)`; `nguoi_dieu_khien_id/vai_tro` (dự phòng y tá vắng) | UI chết |
| `ThanhVien` (thanh_vien) | Bệnh nhân trong gia đình | `family_id`→GiaDinh, `tai_khoan_id` | `ho_ten,ngay_sinh(required),gioi_tinh[nam,nu,khac],di_ung,benh_nen,nhom_mau,quan_he` | — |
| `BacSi` (bac_si) | Bác sĩ | `user_id`→NguoiDung, `specialties[]`→ChuyenKhoa | `phong_kham_mac_dinh`, `specialties` (dùng trong populate nurse) | — |
| `NhatKyThaoTac` | Audit thao tác | `nguoi_thuc_hien_id` | `vai_tro,hanh_dong,loai_doi_tuong,doi_tuong_id,du_lieu_cu/moi` | Dùng cho queue/room-status |
| `LichSuLichHen` | **Lịch sử trạng thái lịch hẹn** (model riêng) | — | — | Tồn tại nhưng nurse flow không dùng |
| `NghiPhepYTa` | Nghỉ phép y tá | — | — | **Ngoài phạm vi** — không dựng UI |

> Ghi chú trùng trách nhiệm: **hai "hàng đợi" song song** — `LichHen.status` (chuỗi trạng thái lịch) và `HangDoi` (hàng đợi hiện diện). Không trùng field nhưng trùng *khái niệm điều phối*.

## Bước 2 — Dữ liệu thật (probe read-only, đã che PII)

### B. Bảng dữ liệu thực tế

| Collection | Số lượng | Có data test hợp lệ? | Lỗi dữ liệu | Nhận xét |
|---|---|---|---|---|
| nguoi_dung | 14 (user 6, doctor 5, admin 1, **nurse 1**, receptionist 1) | ✅ | — | Chỉ **1 y tá** ("Điều dưỡng Thanh Hà") |
| lich_lam_viec | 275 | ✅ | **265/275 không có nurse_id** | `nurse_id` chỉ có ở **1 bác sĩ** (backfill test) |
| lich_hen | 73 | ✅ | **60/73 không nurse_id**; hôm nay 6, **0 nurse_id** | 72 clinic/1 home; **tất cả có schedule_id** |
| ket_qua_kham | 7 | ✅ một phần | **status: 4 da_xac_nhan, 3 `null`**; 6 có `nguoi_xac_nhan_id` (>4 da_xac_nhan → lệch) | **7/7 gắn `appointment_id`, 0 `hang_doi_id`** |
| sinh_hieu_kham | 6 | ✅ | — | Neo theo appointment |
| hang_doi | 28 | ⚠️ rác | **28/28 `nguon=offline`, `trang_thai=skipped`, 0 `appointment_id`** | Chỉ smoke-test offline, không phản ánh luồng thật |
| trang_thai_phong_kham | 3 | ⚠️ | — | Sinh khi test room-status |

**Kiểm tra quan hệ (integrity):**
- `KetQuaKham.appointment_id` trỏ tới LichHen không tồn tại: **0** ✅
- `KetQuaKham` thiếu cả 2 khóa: **0** ✅
- `LichHen.nurse_id` không trỏ tới user role=nurse: **0/13** ✅

**Dị thường cần ghi nhận:**
- **3 `KetQuaKham` có `status=null`** dù schema default `cho_xac_nhan` → tạo bằng đường bỏ qua default (dữ liệu cũ/insert trực tiếp). Ảnh hưởng: UI map nhãn theo status có thể hiển thị trống.
- **6 bản ghi có `nguoi_xac_nhan_id` nhưng chỉ 4 `da_xac_nhan`** → 2 bản ghi "có người xác nhận" mà status không phải da_xac_nhan (lệch trạng thái–hành động).

## Bước 3 — Đối chiếu nghiệp vụ (trả lời trực tiếp)

| Câu hỏi | Trả lời (bằng chứng code/dữ liệu) |
|---|---|
| Lịch hẹn thuộc trách nhiệm y tá xác định bằng cách nào? | Qua **`LichHen.nurse_id`** (hệ cũ, dùng ở appointments/dashboard) **hoặc** `LichLamViec.nurse_id`→`getMyDoctorIdsToday` (hệ mới, dùng ở medical-records/queue). **Hai cách song song.** |
| Gán trực tiếp lịch hay qua ca? | Thiết kế: **qua ca** (`LichLamViec.nurse_id`), rồi **copy sang `LichHen.nurse_id`** lúc đặt — nhưng bước copy **chưa thực thi** trong booking. |
| Đổi y tá của ca có ảnh hưởng lịch cũ? | Không — `LichHen.nurse_id` là **snapshot** (comment model), giữ lịch sử. Nhưng vì chưa copy nên hiện luôn null. |
| Hồ sơ biết người nhập bằng gì? | `KetQuaKham.nguoi_nhap_id`. |
| Hồ sơ biết ai xác nhận? | `KetQuaKham.nguoi_xac_nhan_id` + `thoi_diem_xac_nhan`. |
| Nhiều hồ sơ cho 1 lịch? | **Không** — sparse-unique `appointment_id` (và `hang_doi_id`) chặn trùng ở tầng DB. |
| Chống tạo trùng? | ✅ unique index + controller kiểm `exists`. |
| Khóa hồ sơ sau xác nhận? | ✅ controller: chỉ sửa khi `ban_nhap`/`yeu_cau_chinh_sua`; FE `isEditable=false` khi `da_xac_nhan`. |
| Lưu ghi chú yêu cầu sửa? | ✅ `doctor_revision_note` + `lich_su_sua[]`. |
| Lưu người sửa & thời gian? | ✅ `lich_su_sua[]{nguoi_sua_id,thoi_diem_sua}`. |
| Trạng thái hồ sơ vs lịch hẹn lệch nhau? | **Có thể** — 2 chuỗi trạng thái riêng (`KetQuaKham.status` vs `LichHen.status`); đồng bộ chỉ ở `submit`/xác nhận. 3 record status=null là ví dụ lệch. |
| Đủ data cho dashboard tổng hợp? | Một phần — đếm hồ sơ đủ; đếm lịch hẹn theo nurse_id **rỗng hôm nay**. |
| Có phụ thuộc mock? | **Không** — không mock ở nurse. |
| Collection/model trùng trách nhiệm? | Trùng **khái niệm điều phối** (`LichHen.status` ↔ `HangDoi`); `NghiPhepYTa` tồn tại nhưng chưa dùng. |

### C. Bảng đối chiếu chức năng ↔ dữ liệu

| Chức năng nurse | Model/field đang dùng | Đủ? | Thiếu về nghiệp vụ |
|---|---|---|---|
| Dashboard | LichLamViec.nurse_id, LichHen.nurse_id, KetQuaKham.nguoi_nhap_id | ⚠️ | nurse_id chưa set lúc booking → phần lịch rỗng |
| Hàng đợi/chi tiết | LichHen(+populate BacSi/ThanhVien), KetQuaKham, SinhHieuKham | ✅ | Chỉ thiếu dữ liệu (nurse_id), không thiếu field |
| Nhập/sửa hồ sơ | KetQuaKham(appointment_id), SinhHieuKham | ✅ **schema đủ** | Controller ép hang_doi_id — không phải thiếu schema |
| Gửi/xác nhận | KetQuaKham.status + LichHen.status | ✅ | — |
| Revisions | KetQuaKham(status,doctor_revision_note,appointment_id) | ✅ **schema đủ** | Controller **không project `appointment_id`** (P1.1) — lỗi code, không phải thiếu field |
| Tiếp nhận/phòng | HangDoi, TrangThaiPhongKham | ✅ schema đủ | Thiếu **nối UI**, không thiếu DB |

## D. Báo cáo thay đổi database đề xuất

**Kết luận: KHÔNG cần thay đổi schema cho hướng bridge tối thiểu.**
- Nhu cầu "y tá phụ trách lịch" → đã có `LichHen.nurse_id` + `LichLamViec.nurse_id`.
- Nhu cầu "hồ sơ neo lịch không cần hàng đợi" → schema đã cho phép (`appointment_id` sparse-unique, pre-validate ≥1 khóa).
- Nhu cầu "khóa/lịch sử/người xác nhận" → đã có đủ field.

**Vấn đề mức DỮ LIỆU (không phải schema) cần theo dõi — KHÔNG tự sửa:**
1. 3 `KetQuaKham.status=null` — nên chuẩn hóa (backfill status) **khi có prompt cho phép**; ghi nhận rủi ro hiển thị.
2. 28 `HangDoi` rác offline/skipped — dữ liệu test cũ; cân nhắc dọn khi chốt kiến trúc.
3. `nurse_id` lịch cũ null — sẽ tự đúng cho lịch MỚI sau khi vá booking; lịch cũ cần backfill nếu muốn hiển thị.

*(Mọi thao tác ghi/dọn dữ liệu chỉ thực hiện khi có prompt yêu cầu rõ ràng.)*
