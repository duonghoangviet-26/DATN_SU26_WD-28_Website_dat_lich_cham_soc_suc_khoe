# Chốt thiết kế DB trang Y tá — Hàng đợi + Trạng thái phòng + WebSocket

> Ngày: 2026-07-15 · Tiếp nối: `Audit - Chuc nang va DB trang Y ta doi chieu luong nghiep vu (2026-07-15).md`
> Tài liệu này **chốt schema** dựa trên 4 quyết định thiết kế của nhóm. Chưa đụng code.

---

## 0. Bốn quyết định đã chốt (nền tảng thiết kế)

| # | Quyết định | Hệ quả thiết kế |
|---|---|---|
| **1** | Có actor **Lễ tân riêng**, làm sau, xong sẽ nối với Y tá | Bảng hàng đợi phải **actor-agnostic** ở khâu check-in: lưu `nguoi_tiep_nhan_id` + `vai_tro_tiep_nhan`, không hard-code là y tá. Trước mắt y tá/admin tạo entry; sau này lễ tân tạo — **không đổi schema** |
| **2** | **Một bảng `HangDoi` riêng**, dữ liệu online + offline **đồng nhất**, chỉ khác `nguon` để biết có xét ưu tiên theo lịch hẹn hay không | 1 collection duy nhất. Online có `appointment_id` → xét cửa sổ ±30' để tính ưu tiên. Offline không có → xếp theo giờ check-in |
| **3** | Dùng **WebSocket** | Thêm tầng realtime (Socket.IO). DB không đổi vì WebSocket, nhưng mọi thao tác đổi hàng đợi/trạng thái phòng phải **emit event** sau khi ghi DB |
| **4** | **Phòng lấy từ `LichLamViec` của bác sĩ ngày hôm đó** (bác sĩ có phòng riêng cố định, ít đổi) | ✅ **Bỏ được** `phong_kham_id` ref trên `LichHen`. Phòng = snapshot `String` từ `LichLamViec.slots[].phong_kham` / `BacSi.phong_kham_mac_dinh`. **Không cần chống trùng phòng** vì mỗi bác sĩ 1 phòng → GAP-ROOM khép lại |

---

## 0bis. Tinh chỉnh vòng 2 (2026-07-15) — 4 quyết định bổ sung

| # | Quyết định | Hệ quả |
|---|---|---|
| **A. Y tá gán theo BÁC SĨ** (không theo chuyên khoa); admin đổi y tá của 1 bác sĩ khi có yêu cầu riêng | ✅ **Giữ nguyên mô hình hiện tại** `LichLamViec.nurse_id` (y tá ↔ bác sĩ / ngày). Y tá lọc `HangDoi`/`TrangThaiPhongKham` theo **tập bác sĩ mình phụ trách hôm nay** = các `LichLamViec` có `nurse_id = mình` ngày đó. `HangDoi.specialty_id` chỉ dùng cho khâu check-in/định tuyến (lễ tân sau), không phải trục điều phối của y tá. **Không đổi schema** |
| **B. Bỏ `thu_tu`** — thứ tự đổi liên tục | Đã bỏ field. Query hàng đợi: lọc `{doctor_id, trang_thai}` → **sort động app-side** theo trọng số ưu tiên (`online_uu_tien` < `online_thuong` < `offline`) rồi `checkin_time`. Queue mỗi bác sĩ/ngày nhỏ (~10–30) → sort JS thoải mái |
| **C. Presence-gate + tạo `TrangThaiPhongKham` lười** | Xem mục 2bis dưới |
| **D. Ước tính + NGƯỠNG NHẬN bệnh nhân (capacity cutoff)** | Xem mục 2ter dưới |

### 2bis. `TrangThaiPhongKham` — tạo lười + ràng buộc "phải có mặt mới khám" (quyết định C)
- **Tạo lười (lazy upsert):** không tạo sẵn hàng loạt đầu ngày. Lần đầu y tá mở dashboard / thao tác với 1 bác sĩ trong ngày → backend `findOneAndUpdate({doctor_id, ngay}, {...}, {upsert:true})`, mặc định `san_sang`, copy `phong_kham` từ `LichLamViec`. Đơn giản, không rác cho ngày bác sĩ nghỉ.
- **Presence-gate (phải có mặt mới bắt đầu khám):** một bệnh nhân chỉ vào phòng khi **đã check-in vào hàng đợi = đã có mặt**. Cụ thể: chỉ entry `HangDoi.trang_thai ∈ {dang_cho, da_goi}` (đang hiện diện) mới được chuyển `trong_phong`; entry `skipped` (gọi 2 lần sau 10' không lên) **không** được vào. Đặt `TrangThaiPhongKham.trang_thai = 'dang_kham'` **bắt buộc** kèm `benh_nhan_hien_tai_id` trỏ tới 1 entry đang hiện diện — không cho `dang_kham` với phòng trống. Enforce ở controller (Plan 2/3).

### 2ter. Ước tính thời gian chờ + NGƯỠNG NHẬN bệnh nhân (quyết định D)
Yêu cầu: tránh nhận quá nhiều → bệnh nhân chờ tới hết ca vẫn chưa khám. → cần **ước tính động + chặn nhận khi quá tải**, hẹn đợt sau.

- **Nguồn dữ liệu:** `TrangThaiPhongKham.thoi_gian_kham_tb_phut` (TB động) + **giờ kết thúc ca** suy từ `LichLamViec` (max `gio_ket_thuc` các slot active của bác sĩ ngày đó).
- **Ước tính thời gian chờ 1 bệnh nhân** (hiển thị, tính lúc query): `vi_tri_trong_hang × thoi_gian_kham_tb_phut`.
- **Ngưỡng nhận lúc check-in:**
  ```
  so_dang_phuc_vu = số entry {dang_cho, da_goi, trong_phong} của bác sĩ đó
  du_kien_xong = now + (so_dang_phuc_vu + 1) × thoi_gian_kham_tb_phut
  Nếu du_kien_xong > gio_ket_thuc_ca:
     → CẢNH BÁO/CHẶN nhận, đề xuất "hẹn đợt sau" (không tạo HangDoi)
  ```
- **Schema:** không thêm field mới bắt buộc (tính động ở controller). `thoi_gian_cho_uoc_tinh_phut` trong `HangDoi` chỉ là cache hiển thị, cập nhật khi query. Logic ngưỡng nằm ở **Plan 3** (check-in).
- **Động khi ca kéo dài:** khi 1 ca khám lâu bất thường, `thoi_gian_kham_tb_phut` cập nhật → ước tính các bệnh nhân sau tự giãn ra (đúng mục 7 đặc tả).

---

## 1. Bảng MỚI: `HangDoi` (QueueEntry)

`backend/src/models/HangDoi.js` · collection `hang_doi`

```js
{
  // ── Nguồn & định danh bệnh nhân (đồng nhất online/offline) ──────────────
  nguon:            { enum: ['online','offline'], required },
  appointment_id:   { ObjectId ref 'LichHen', default null },       // BẮT BUỘC khi nguon='online'
  khach_vang_lai_id:{ ObjectId ref 'KhachVangLai', default null },  // dùng khi nguon='offline'
  member_id:        { ObjectId ref 'ThanhVien', default null },     // nếu offline là người nhà đã có hồ sơ
  // Snapshot hiển thị (đồng nhất — cả 2 nguồn đều có, không phải join lại để render hàng đợi)
  ten_benh_nhan:    { String, required },
  so_dien_thoai:    { String, default null },
  tuoi:             { Number, default null },
  gioi_tinh:        { enum: ['nam','nu','khac'], default null },

  // ── Điều phối ────────────────────────────────────────────────────────────
  specialty_id:     { ObjectId ref 'ChuyenKhoa', required },   // dùng cho check-in/định tuyến; y tá lọc theo doctor_id
  doctor_id:        { ObjectId ref 'BacSi', default null },     // bác sĩ được gán (y tá phụ trách bác sĩ này)
  phong_kham:       { String, default null },                  // snapshot từ LichLamViec (quyết định 4)
  // KHÔNG lưu thu_tu — thứ tự thay đổi liên tục, TÍNH ĐỘNG lúc query (sort muc_uu_tien → checkin_time)

  // ── Ưu tiên (chỉ khác nhau ở đây giữa online/offline) ─────────────────────
  muc_uu_tien:      { enum: ['online_uu_tien','online_thuong','offline'], required },
  gio_hen_goc:      { Date, default null },   // giờ đặt của lịch online → tính cửa sổ ±30'

  // ── Vòng đời trong hàng đợi ───────────────────────────────────────────────
  trang_thai:       { enum: ['dang_cho','da_goi','trong_phong','skipped','cancelled','hoan_thanh'], default 'dang_cho' },
  checkin_time:     { Date, required },        // thời điểm vào hàng đợi
  so_lan_goi:       { Number, default 0 },
  thoi_diem_goi:    { Date, default null },     // để cron/logic đếm 5'/10' no-show
  thoi_diem_vao_phong: { Date, default null },
  thoi_diem_ket_thuc:  { Date, default null },
  thoi_gian_cho_uoc_tinh_phut: { Number, default null },  // cập nhật động

  // ── Actor tiếp nhận (actor-agnostic — quyết định 1) ───────────────────────
  nguoi_tiep_nhan_id:  { ObjectId ref 'NguoiDung', default null },   // lễ tân (sau) / y tá / admin (giờ)
  vai_tro_tiep_nhan:   { String, default null },                     // 'receptionist' | 'nurse' | 'admin'
}
```

**Index:**
- `{ doctor_id: 1, trang_thai: 1 }` — hàng đợi của 1 bác sĩ (view chính của y tá — sort động app-side)
- `{ specialty_id: 1, trang_thai: 1 }` — dành cho check-in/định tuyến (lễ tân, plan sau)
- `{ appointment_id: 1 }` sparse unique — 1 lịch hẹn online chỉ vào hàng đợi 1 lần
- `{ trang_thai: 1, thoi_diem_goi: 1 }` — cron quét no-show

**Ràng buộc `pre('validate')`:**
- `nguon='online'` → bắt buộc `appointment_id`.
- `nguon='offline'` → bắt buộc `ten_benh_nhan` (đã required sẵn) + `so_dien_thoai`.

**Logic tính `muc_uu_tien` (áp dụng lúc check-in, mục TH1–TH6 đặc tả):**
```
Nếu offline                           → 'offline'
Nếu online:
  Δ = checkin_time − gio_hen_goc
  |Δ| ≤ 30 phút  (cửa sổ ưu tiên)     → 'online_uu_tien'  (đẩy lên #1 hàng của bác sĩ đã đặt)
  đến sớm 10–20', ngoài cửa sổ        → 'online_thuong'
  đến trễ > 30'                       → 'offline'  (mất ưu tiên, xử lý như offline)
```
→ Đây chính là điểm bạn nói "chỉ khác trạng thái online/offline để check có đưa vào hàng ưu tiên hay không". Dữ liệu 2 nguồn **đồng nhất**, chỉ nhánh tính `muc_uu_tien` khác.

---

## 2. Bảng MỚI: `TrangThaiPhongKham` (DoctorRoomStatus)

`backend/src/models/TrangThaiPhongKham.js` · collection `trang_thai_phong_kham`

> Vì phòng = phòng riêng cố định của bác sĩ (quyết định 4), "trạng thái phòng" ≈ "trạng thái bác sĩ trong ca". 1 bản ghi / bác sĩ / ngày.

```js
{
  doctor_id:        { ObjectId ref 'BacSi', required },
  ngay:             { Date, required },
  schedule_id:      { ObjectId ref 'LichLamViec', default null },  // nguồn suy ra phòng
  phong_kham:       { String, default null },                     // snapshot từ LichLamViec (quyết định 4)
  nurse_id:         { ObjectId ref 'NguoiDung', default null },    // y tá đang điều khiển (duy nhất được đổi)

  trang_thai:       { enum: ['dang_kham','dang_don_phong','san_sang','tam_nghi'], default 'san_sang' },
  benh_nhan_hien_tai_id: { ObjectId ref 'HangDoi', default null }, // ai đang trong phòng (null nếu trống)

  thoi_diem_doi:    { Date, default: Date.now },        // lúc chuyển trạng thái gần nhất
  thoi_gian_kham_tb_phut: { Number, default: 20 },      // TB động, phục vụ ước tính thời gian chờ

  // Dự phòng khi y tá vắng (vòng 3): nurse_id = y tá được phân công;
  // nguoi_dieu_khien_id = người THỰC TẾ đang điều khiển (lễ tân/admin khi y tá chưa tới).
  nguoi_dieu_khien_id:      { ObjectId ref 'NguoiDung', default null },
  nguoi_dieu_khien_vai_tro: { String, default null },   // 'nurse' | 'receptionist' | 'admin'
  y_ta_co_mat:              { Boolean, default false },  // y tá đã tiếp quản chưa (cảnh báo đến muộn)
}
```

**Index:** `{ doctor_id: 1, ngay: 1 }` unique · `{ ngay: 1, trang_thai: 1 }`

**Ràng buộc flow (enforce ở controller, KHÔNG ở schema):**
- Chỉ `nurse_id` (khớp token) được đổi trạng thái.
- `dang_kham → dang_don_phong → san_sang` — **không** cho `dang_kham → san_sang` trực tiếp.
- **Không** cho `tam_nghi` khi `benh_nhan_hien_tai_id != null`.
- Mỗi lần đổi → ghi `NhatKyThaoTac` (mục 4) + emit WebSocket (mục 5).

**Trigger chính:** khi y tá bấm "Phòng sẵn sàng" (`san_sang`) → backend tự gợi ý `HangDoi` kế tiếp của bác sĩ đó (không gán cứng ngay) → y tá xác nhận "Gọi bệnh nhân" → `HangDoi.trang_thai = 'da_goi'` + emit event cho lễ tân.

---

## 3. Sửa bảng `LichHen` (tối thiểu)

| Thay đổi | Lý do |
|---|---|
| `status` thêm `'waiting_record'` | Bác sĩ "kết thúc khám" → chờ y tá nhập hồ sơ |
| `status` thêm `'skipped'` | Đồng bộ khi `HangDoi.trang_thai='skipped'` (no-show khi gọi) |
| ~~`phong_kham_id` ref~~ | ❌ **KHÔNG thêm** (quyết định 4 — phòng lấy từ `LichLamViec`, giữ `phong_kham` String snapshot như hiện tại) |

> `gio_den_thuc_te` + `trang_thai_den` đã có → khi tạo `HangDoi` cho lịch online, cập nhật luôn 2 field này (tương thích màn admin đang đọc chúng).

---

## 4. Sửa bảng `NhatKyThaoTac` (audit)

| Trường | Thêm |
|---|---|
| `vai_tro` | thêm `'nurse'`, `'receptionist'` |
| `hanh_dong` | `CHANGE_DOCTOR_STATUS`, `CHECKIN_QUEUE`, `CALL_PATIENT`, `SKIP_PATIENT`, `ASSIGN_DOCTOR` |
| `loai_doi_tuong` | `queue_entry`, `room_status` |

Ghi log khi: đổi trạng thái phòng, gọi bệnh nhân, skip no-show. Tái dùng bảng có sẵn, **không tạo bảng audit mới**.

---

## 5. Tầng WebSocket (Socket.IO) — quyết định 3

DB không đổi vì WebSocket, nhưng cần bản đồ event. Đề xuất **rooms** theo chuyên khoa + theo actor:

| Room | Ai join | Event nhận |
|---|---|---|
| `specialty:{id}` | Y tá + lễ tân của chuyên khoa | `queue:updated`, `room:status_changed` |
| `nurse:{userId}` | Y tá đó | `record:returned` (hồ sơ bị trả), `doctor:no_response` |
| `reception` | Lễ tân | `patient:called` (tên+phòng+bác sĩ), `invoice:ready` |
| `doctor:{id}` | Bác sĩ | `record:submitted` (y tá gửi hồ sơ chờ duyệt) |

**Nguyên tắc:** emit **sau khi** ghi DB thành công (DB là nguồn sự thật, WebSocket chỉ đẩy thông báo). Reconnect → client gọi lại REST để đồng bộ (tránh mất event khi rớt mạng). `ThongBao` vẫn ghi song song để có lịch sử + fallback khi offline.

**Sự kiện `doctor:no_response`** (mục 7 đặc tả — bác sĩ không phản hồi hồ sơ lâu): cron quét `KetQuaKham.status='cho_xac_nhan'` + `submitted_at` quá X phút → emit + tạo `ThongBao`.

---

## 6. Sửa bảng phục vụ Nhóm 4–5 (ghi hồ sơ + bàn giao)

| Bảng | Thay đổi |
|---|---|
| `KetQuaKham.dich_vu_phat_sinh` | `[Mixed]` → sub-schema: `{ service_id ref DichVu, ten, so_luong, don_gia, thanh_tien, chi_dinh_boi_bac_si_id, them_boi_y_ta_id }` |
| `DonThuoc.nguon` | thêm `'y_ta'` + **thêm luồng y tá tạo `DonThuoc`** trong `nurse/medical-records.controller.js` (hiện thiếu) |
| `HoaDon` | ✅ giữ nguyên — khi bác sĩ duyệt hồ sơ, sinh `chi_tiet_thu_phi` từ `dich_vu_phat_sinh` + emit `invoice:ready` cho lễ tân |

---

## 7. Danh sách bảng cuối cùng (tổng kết)

| Bảng | Trạng thái | Hành động |
|---|---|---|
| `HangDoi` | 🆕 Tạo mới | Mục 1 |
| `TrangThaiPhongKham` | 🆕 Tạo mới | Mục 2 (+3 trường dự phòng) |
| `NghiPhepYTa` | 🆕 Tạo mới | Nghỉ phép y tá — xem `Xu ly vang mat y ta...` |
| `LichHen` | ✏️ Sửa | +2 enum status (mục 3) |
| `NhatKyThaoTac` | ✏️ Sửa | +enum vai_tro/hanh_dong (mục 4) |
| `KetQuaKham` | ✏️ Sửa | `dich_vu_phat_sinh` → sub-schema (mục 6) |
| `DonThuoc` | ✏️ Sửa | +`nguon='y_ta'` + luồng (mục 6) |
| `HoaDon` | ✅ Giữ nguyên | Chỉ đấu luồng |
| `SinhHieuKham` | ✅ Giữ nguyên | — |
| `PhongKham` (FK trên LichHen) | ❌ Không làm | Quyết định 4 |

→ **3 bảng mới + 4 bảng sửa nhẹ.** Đây là "đường DB gọn nhất" khớp đúng các quyết định, không dư thừa.
(Trước vòng 3 là 2 bảng mới; thêm `NghiPhepYTa` sau khi chốt luồng nghỉ phép + dự phòng y tá.)

---

## 8. Bước tiếp theo (khi nhóm duyệt thiết kế này)

1. Tạo 2 model mới + sửa 4 model (không đụng dữ liệu cũ — enum chỉ thêm giá trị mới).
2. Nurse controllers: hàng đợi realtime, đổi trạng thái phòng, gọi bệnh nhân, no-show cron.
3. Cài Socket.IO + rooms (mục 5).
4. Bổ sung luồng đơn thuốc + dịch vụ phát sinh + đấu `HoaDon`.
5. Frontend: màn Hàng đợi realtime + bảng điều khiển trạng thái phòng.
6. (Sau) Module Lễ tân → nối vào `HangDoi` qua `nguoi_tiep_nhan_id`.

*Mỗi bước sẽ báo cáo theo format: File cần sửa / Lý do / Rủi ro / Cách test / Dữ liệu mẫu.*
