# DB Models — Trường dữ liệu phục vụ TRANG BÁC SĨ (MongoDB)

> Đọc trước khi gắn service layer trang bác sĩ vào API thật (MongoDB Cloud).
> Phạm vi: chỉ liệt kê model + trường mà trang bác sĩ cần đọc/ghi. Không liệt kê toàn bộ 27 bảng.
> Nguồn: `backend/src/models/*.js` (đọc trực tiếp code, không suy đoán).

---

## 1. BacSi (`bac_si`) — hồ sơ hành nghề bác sĩ

Khóa chính liên kết mọi truy vấn của trang bác sĩ: **mọi controller doctor/* đều bắt đầu bằng
`BacSi.findOne({ user_id: req.user.id })`** để lấy `doctor_id`, KHÔNG bao giờ nhận `doctor_id` từ
client. Khi gắn API thật, service layer FE **không tự truyền doctor_id** — BE tự suy ra từ JWT.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `user_id` | ObjectId → NguoiDung | unique, dùng để tìm bác sĩ từ token đăng nhập |
| `chi_nhanh_id` | ObjectId → ChiNhanh | |
| `tieu_su`, `bang_cap`, `kinh_nghiem`, `so_nam_kinh_nghiem` | String/Number | dùng ở Profile |
| `gia_kham` | Number | giá khám clinic (30 phút/slot) — **không nằm ở DichVu** |
| `tuoi_nhan_kham_tu` | Number | |
| `trang_thai_duyet` | enum `pending/approved/rejected/suspended` | do admin duyệt, bác sĩ chỉ đọc |
| `trang_thai` | enum `active/nghi_phep/nghi_viec` | do hệ thống set khi xin nghỉ được duyệt |
| `diem_danh_gia`, `tong_danh_gia` | Number | hiển thị ở Dashboard/Profile |
| `phong_kham_mac_dinh` | String | admin gán khi duyệt hồ sơ — cron copy vào từng slot |
| `specialties`, `services`, `related_services` | [ObjectId] | tham chiếu ChuyenKhoa/DichVu |
| `loai` | enum `specialist/home_staff` | |

**Model liên quan Profile:** `HoSoChiTietBacSi` (1-1 qua `doctor_id`) — chức danh, quá trình công
tác/đào tạo, giải thưởng. Tách riêng khỏi `BacSi` để danh sách/đặt lịch không phải load nặng.

---

## 2. LichLamViec (`lich_lam_viec`) — Lịch làm việc

1 document = 1 bác sĩ + 1 ngày, chứa mảng `slots[]`.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `doctor_id` | ObjectId → BacSi | required |
| `ngay` | Date | unique cùng `doctor_id` |
| `slots[].gio_bat_dau`, `gio_ket_thuc` | String `HH:MM` | |
| `slots[].benh_nhan_id` | ObjectId → NguoiDung | null nếu chưa đặt |
| `slots[].specialty_id` | ObjectId → ChuyenKhoa | |
| `slots[].phong_kham` | String (snapshot tên phòng, không ref) | xem `PhongKham` bên dưới |
| `slots[].status` | enum `active/pending_payment/booked/locked/cancelled/expired` | |
| `slots[].bi_khoa_boi_nghi_phep`, `nghi_phep_id` | Boolean / ObjectId → NghiPhepBacSi | slot bị khóa do nghỉ phép — **bác sĩ không tự khóa/mở tay**, chỉ hệ thống set khi nghỉ phép được duyệt |

Đối chiếu với audit "Lịch làm việc bác sĩ" trước đó: chức năng đổi `phong_kham` / khóa-mở `status`
tay trong `DoctorSchedule.tsx` hiện đang cho bác sĩ làm — đây là 2 trường model cho phép ghi đè,
nhưng theo nghiệp vụ chỉ admin (phòng khám) và hệ thống (nghỉ phép) được đổi.

---

## 3. LichHen (`lich_hen`) — Lịch hẹn

Model lớn nhất, dùng cho cả Danh sách + Chi tiết lịch hẹn.

| Nhóm | Trường chính |
|---|---|
| Liên kết | `user_id`, `member_id`→ThanhVien, `doctor_id`→BacSi, `schedule_id`→LichLamViec, `slot_id`, `service_id`→DichVu, `specialty_id` |
| Loại/thời gian | `loai_kham` (`clinic`/`home`), `ngay_kham`, `gio_kham`, `gio_ket_thuc`, `phong_kham`, `dia_chi_kham` |
| Trạng thái | `status` enum 7 giá trị: `pending, confirmed, checked_in, in_progress, completed, cancelled, no_show` (audit trước xác nhận FE chỉ dùng 4/7 — cần rà lại khi map dữ liệu thật, có thể BE trả về giá trị mà FE type chưa xử lý) |
| Thanh toán | `payment_status` enum `unpaid/partial/paid/refunded`, `gia_kham` |
| Mã hiển thị | `ma_lich_hen` — **đây là "mã lịch hẹn" mà audit Chi tiết lịch hẹn từng nói FE đang thiếu hiển thị** |
| Khách vãng lai (không có tài khoản) | `ten_khach`, `gioi_tinh_khach`, `so_dien_thoai_khach`, `nam_sinh_khach`... — khi `member_id` null bắt buộc phải có `ten_khach` |
| Hủy | `ly_do_huy`, `huy_boi`, `nguoi_huy_id`, `thoi_diem_huy` |

Lưu ý validate ở `pre('validate')`: `loai_kham === 'clinic'` bắt buộc `doctor_id` + `schedule_id` +
`slot_id`; `loai_kham === 'home'` bắt buộc `dia_chi_kham` + `service_id`. Khi map dữ liệu thật,
FE không cần validate lại field này (BE đã chặn), nhưng phải hiểu tại sao 1 số field null tùy loại.

**Lịch sử thay đổi:** `LichSuLichHen` (`lich_su_lich_hen`) — audit trail mọi lần đổi status/bác
sĩ/lịch. Có thể dùng để hiển thị "lịch sử" ở Chi tiết lịch hẹn nếu cần, nhưng chưa có trong scope
hiện tại của trang bác sĩ.

---

## 4. KetQuaKham (`ket_qua_kham`) — Hồ sơ khám (kết quả khám)

| Trường | Ghi chú |
|---|---|
| `appointment_id` | unique — 1 lịch hẹn 1 kết quả khám |
| `nguoi_nhap_id` → NguoiDung | **người nhập ban đầu (y tá)** — audit trước xác nhận field này tồn tại nhưng chưa được set ở đâu trong controller hiện tại |
| `bac_si_phu_trach_id` → BacSi | bác sĩ phụ trách — cũng chưa được populate |
| `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan` | dùng cho luồng bác sĩ xác nhận — **chưa có trong controller hiện tại** (`createResult`/`updateResult` ghi thẳng `chan_doan`, không qua bước xác nhận riêng) |
| `chan_doan` | required |
| `huong_dan_dieu_tri`, `ghi_chu`, `ngay_tai_kham` | |
| `chi_dinh_tai_kham`, `da_dat_lich_tai_kham`, `da_gui_cho_benh_nhan` | Boolean flag |
| `co_the_sua` | Boolean — khóa sửa sau khi gửi bệnh nhân |
| `lich_su_sua[]` | mảng `{nguoi_sua_id, thoi_diem_sua, noi_dung}` |

**Không có trường `status`** (pending/confirmed...) — nếu Phase 6/7 (Hồ sơ chờ xác nhận / Xác nhận)
cần trạng thái riêng biệt với luồng y tá nhập → bác sĩ duyệt, đây là chỗ **bắt buộc phải sửa model
dùng chung** (additive, không phá vỡ dữ liệu cũ), đúng như plan đã ghi ở Phase 6+7.

**3 model con theo chuyên khoa** (chỉ tham chiếu `ket_qua_kham_id` + `appointment_id`, dữ liệu đặc
thù riêng — không phải trang bác sĩ dùng chung cho mọi ca khám):
- `KetQuaKhamHong` — `la_ket_qua_chinh`, `hinh_anh_noi_soi[]` (url, mô tả, uploaded_at)
- `KetQuaKhamMui`, `KetQuaKhamTai` — cấu trúc tương tự (chưa đọc chi tiết, cùng pattern)

**Sinh hiệu khám:** `SinhHieuKham` (`sinh_hieu_kham`) — `appointment_id` unique, `can_nang`,
`chieu_cao`, `huyet_ap`, `nhiet_do`, `nhip_tim`, `nguoi_do_id`, `co_the_sua`. Tách riêng khỏi
`KetQuaKham` — nếu trang bác sĩ cần hiển thị sinh hiệu trong màn Hồ sơ khám thì phải query thêm
model này bằng `appointment_id`.

**Đơn thuốc:** `DonThuoc` (`don_thuoc`) — gắn với `ket_qua_kham_id`, có `doctor_id`, `nguon` enum
`bac_si/tu_nhap`. Nếu Hồ sơ khám có phần kê đơn thì query theo `ket_qua_kham_id`.

---

## 5. NghiPhepBacSi (`nghi_phep_bac_si`) — Xin nghỉ

| Trường | Ghi chú |
|---|---|
| `bac_si_id` | required — luôn lấy từ JWT, không nhận từ client |
| `tu_ngay`, `den_ngay` | Date, validate `den_ngay >= tu_ngay` |
| `trang_thai` | enum **chỉ 3 giá trị**: `cho_duyet, da_duyet, tu_choi` — **không có trạng thái hủy**, đúng như audit trước đã chỉ ra là thiếu (Phase 8 cần thêm enum value, additive-safe vì `formatDoctorLeave()` ở admin không switch-case cứng) |
| `nguoi_duyet_id`, `thoi_diem_duyet` | do admin set |
| `ly_do`, `ghi_chu` | |

---

## 6. Các model phụ trợ (đọc, không sửa)

| Model | Collection | Dùng khi nào ở trang bác sĩ |
|---|---|---|
| `NguoiDung` | `nguoi_dung` | JWT decode → `req.user.id`; field `role` có cả `nurse` (đã tồn tại enum nhưng chưa có module gán y tá cho ca khám — xác nhận lại giả thuyết "y tá hỗ trợ" ở Dashboard) |
| `ChuyenKhoa` | `chuyen_khoa` | hiển thị tên chuyên khoa ở lịch hẹn/dashboard, tham chiếu `phong_kham_id` → `ThongTinPhongKham` |
| `PhongKham` | `phong_kham` | danh sách phòng vật lý (tầng/tòa) — admin quản lý; `full_name` virtual khớp format string đang lưu snapshot trong `LichLamViec.slots[].phong_kham` và `LichHen.phong_kham` |
| `ThongTinPhongKham` | `thong_tin_phong_kham` | thông tin **1 cơ sở duy nhất** (singleton, `ma='MAIN'`) — không phải danh sách bệnh viện |
| `DanhGia` | `danh_gia` | đánh giá sau khám, `doctor_id` + `so_sao` + `status` (`visible/hidden` — bác sĩ KHÔNG được thấy review `hidden`) |
| `ThanhVien` | `thanh_vien` | hồ sơ thành viên gia đình bệnh nhân — nguồn `ho_ten`, `ngay_sinh`, `gioi_tinh` cho Chi tiết lịch hẹn (đúng chỗ audit từng phát hiện bug hiển thị giới tính) |
| `DichVu` | `dich_vu` | chỉ liên quan nếu lịch hẹn `loai_kham='home'`; giá khám clinic KHÔNG nằm ở đây |
| `HoSoYTe` | `ho_so_y_te` | hồ sơ y tế tổng — record `nguon='tu_kham'` được tạo tự động từ appointment khi bác sĩ ghi kết quả |

---

## 7. Áp dụng khi gắn service layer thật

- Field DB đã tiếng Việt khớp field frontend hiện dùng trong mock (`ngay_kham`, `gio_kham`,
  `phong_kham`, `chan_doan`...) — đúng convention CLAUDE.md, nên phần lớn không cần đổi tên khi
  map response, chỉ cần đổi phần thân hàm service từ mock sang `axiosInstance`.
- 3 chỗ **model chưa đủ field/enum** cho đúng nghiệp vụ đã audit (cần sửa BE trước khi FE gắn thật
  cho các phần tương ứng): `KetQuaKham` thiếu `status` cho luồng xác nhận, `NghiPhepBacSi.trang_thai`
  thiếu giá trị hủy, `LichHen.status` có 7 giá trị nhưng FE type mới cover 4 — ba việc này nằm
  ở Phase 6+7 và Phase 8 của kế hoạch, **không tự sửa khi mới gắn API đọc (GET)**.
  - Nghĩa là: các màn hình chỉ **đọc** (Dashboard, Danh sách/Chi tiết lịch hẹn, Lịch làm việc) có
    thể gắn API thật trước, an toàn.
  - Các màn hình cần **ghi** vào 3 chỗ trên (xác nhận hồ sơ khám, hủy xin nghỉ) nên đợi sửa model
    trước, tránh gắn API ghi vào field/enum còn thiếu.
- Không có trường nào trong các model trên cho phép client tự truyền `doctor_id` — mọi controller
  doctor/* đều tự suy ra qua `BacSi.findOne({user_id: req.user.id})`. Khi đổi service từ mock sang
  axios thật, **không thêm doctor_id vào query param/body** — giữ nguyên như audit bảo mật trước đã
  xác nhận.
