# PROMPT 8 — Phân tích Danh sách lịch hẹn/bệnh nhân của Y tá

> Ngày: 2026-07-18 · Chỉ đọc code (`pages/nurse/NurseQueue.tsx`, `controllers/nurse/appointments.controller.js`, `models/LichHen.js`). Không sửa.

## 1. Luồng lấy dữ liệu

```
NurseQueue.tsx (filterDate=hôm nay[UTC], filterStatus='')
 → nurseService.getQueue({date,status})
 → GET /api/nurse/appointments?date=&status=
 → routes/nurse/index (verifyToken + requireRole('nurse'))
 → appointments.controller.listQueue:
     filter = { nurse_id: req.user.id }              // ← gate theo LichHen.nurse_id (hệ cũ)
     filter.status = status || { $in: QUEUE_STATUSES }
       QUEUE_STATUSES = [confirmed, checked_in, in_progress, waiting_record,
                         waiting_doctor_confirm, completed, skipped]
     filter.ngay_kham = { $gte: dayStart, $lt: dayEnd }  // 1 NGÀY, setHours local
     LichHen.find(filter).populate(doctor_id→user_id, specialties).sort({gio_kham:1})
 → formatQueueItem(mỗi lịch): ThanhVien(member_id) + KetQuaKham(appointment_id)
     → trả benh_nhan, tuoi, gioi_tinh, bac_si, chuyen_khoa, phong_kham, loai_kham,
       ten_dich_vu, status, payment_status, da_co_ket_qua, ket_qua_status
 → ok() → bảng
```

## 2. Kết quả kiểm tra từng mục

| Mục | Kết quả |
|---|---|
| Query danh sách | `{nurse_id, status∈QUEUE_STATUSES, ngay_kham=1 ngày}` ✅ rõ ràng |
| Lọc theo y tá đăng nhập | ✅ `nurse_id = req.user.id` (token, không tin FE) |
| Phân công qua ca | ❌ **Dùng `LichHen.nurse_id` trực tiếp**, KHÔNG qua `LichLamViec`/ca (lệch với medical-records dùng `getMyDoctorIdsToday`) |
| Nhiều bác sĩ | Hiển thị cột "Bác sĩ" cho từng dòng; **không có filter theo bác sĩ** |
| Lịch bị hủy | ✅ `cancelled` & `no_show` không nằm trong QUEUE_STATUSES → loại. `skipped` được giữ |
| Lịch chưa thanh toán | Hiện cột "Thanh toán" (Badge) nhưng **không lọc**; lịch `unpaid` vẫn hiển thị |
| Lịch trùng | Không xử lý ở list; DB chặn trùng slot ở tầng đặt lịch |
| Phân trang | ❌ **Không có** — trả toàn bộ lịch trong ngày, FE render hết |
| Sort thời gian | ✅ `sort({gio_kham:1})` (chuỗi HH:MM). Controller tự ghi chú "không phải hàng đợi thật" |
| Tìm kiếm | ❌ **Không có** ô tìm tên/mã lịch hẹn (dù dữ liệu có `ho_ten`, `ma_lich_hen`) |
| Filter trạng thái | ⚠️ Có select nhưng **thiếu `waiting_record`, `skipped`** (có trong QUEUE_STATUSES nhưng không có trong option) |
| Format ngày | `formatDate(ngay_kham)`; default `filterDate = toISOString().slice(0,10)` (**UTC**) |
| Timezone | ⚠️ FE dùng **UTC** (`toISOString`), BE dùng **local** (`setHours`); chỉ nhất quán vì server = UTC → dễ vỡ nếu đổi TZ, và client sáng sớm VN có thể lệch ngày |
| Nút hành động theo trạng thái | ❌ **Không có** hành động theo trạng thái — chỉ "Xem chi tiết"/click dòng để điều hướng |
| Hành động vượt quyền | ✅ Không (list chỉ đọc) |
| Loading/error/empty | ✅ Đủ cả ba |
| Responsive | ✅ Bảng `min-w-[820px]` trong `overflow-x-auto` |
| Thiếu data do populate sai | ✅ Có fallback: `member?.ho_ten ?? ten_khach ?? 'Không rõ'`, bác sĩ null → '—' |
| FE tự lọc dư từ BE | ✅ Không — render đúng dữ liệu BE trả, không ẩn/lọc thêm (không có "bảo mật bằng FE filter") |
| Chuyển trang chi tiết | ✅ `navigate('/nurse/appointments/'+q.id)`, `q.id` = appointment `_id` (đúng, khác lỗi Revisions) |

## 3. Cột

**Đang hiển thị:** Giờ hẹn · Bệnh nhân (+ma_lich_hen) · Tuổi/Giới tính · Bác sĩ · Dịch vụ · Nguồn/Loại (clinic/home) · Thanh toán · Trạng thái · (Xem chi tiết).

**Cột cần GIỮ:** Giờ hẹn, Bệnh nhân, Tuổi/Giới tính, Trạng thái, Thanh toán (chỉ xem), action, và **Bác sĩ** (hữu ích khi hỗ trợ nhiều bác sĩ).

**Cột nên BỎ / gộp:** "Dịch vụ" (`ten_dich_vu` thường null với clinic) và "Nguồn/Loại" (clinic/home ít ý nghĩa với y tá phòng khám) — có thể gộp/ẩn để gọn.

**Cột nên THÊM (dữ liệu đã có sẵn nhưng KHÔNG dùng):** **"Hồ sơ"** từ `da_co_ket_qua` + `ket_qua_status` — `formatQueueItem` đã trả 2 field này nhưng bảng **không hiển thị**. Đây chính là thông tin y tá cần nhất (lịch nào cần nhập/đang chờ xác nhận/cần sửa).

## 4. Filter

**Hiện có:** Ngày (1 ngày), Trạng thái (subset).
**Thiếu (dữ liệu HỖ TRỢ được):**
- Tìm theo **tên bệnh nhân / `ma_lich_hen`**.
- Filter theo **bác sĩ** (khi nhiều bác sĩ trong ca).
- Filter theo **tình trạng hồ sơ** (cần nhập / cần sửa / đã gửi) — map `ket_qua_status`.
- **Nút Reset** bộ lọc.
- Bổ sung option **`waiting_record`, `skipped`** cho khớp QUEUE_STATUSES.
> "Sắp tới / Đã qua" chỉ nên thêm nếu quyết định mở rộng ngoài phạm vi 1 ngày — hiện là lựa chọn thiết kế, không phải lỗi.

## 5. Nút hành động — đúng/sai
- **Đúng:** không có nút vượt quyền; "Xem chi tiết" điều hướng đúng id.
- **Thiếu (theo nghiệp vụ):** không có lối tắt "Nhập hồ sơ" cho lịch `da_co_ket_qua=false` / "Sửa" cho `ket_qua_status='yeu_cau_chinh_sua'` ngay trên dòng — hiện phải vào chi tiết mới thấy.

## 6. Lỗi tổng hợp

**Lỗi API/nghiệp vụ:**
- (P0.1) Gate `LichHen.nurse_id` rỗng vì booking không set → **list rỗng hôm nay**.
- (P1.2) Gate list (`nurse_id`) ≠ gate lưu hồ sơ (`HangDoi`) → xem được dòng nhưng vào chi tiết lưu có thể 409.

**Lỗi quyền:** không có (guard 2 lớp + lọc token đúng, không FE-filter).

**Lỗi UI/UX:**
- Không hiển thị cột "Hồ sơ" dù có dữ liệu → y tá không biết lịch nào cần nhập.
- Không tìm kiếm, không reset, filter trạng thái thiếu option.
- Timezone FE(UTC)/BE(local) dễ lệch ngày ở biên.
- Không phân trang (chấp nhận được cho 1 ngày, rủi ro nếu ca đông).

## 7. Kế hoạch sửa (theo ưu tiên, chưa thực hiện)

| # | Việc | Mức | Ghi chú |
|---|---|---|---|
| 1 | Giải P0.1 (nurse_id lúc đặt lịch) | **P0** | List mới có dữ liệu |
| 2 | Thống nhất gate list & lưu (P1.2) | **P1** | Hết "xem được, lưu 409" |
| 3 | Thêm cột **"Hồ sơ"** (`da_co_ket_qua`/`ket_qua_status`) + lối tắt Nhập/Sửa theo dòng | **P1/P2** | Dữ liệu đã có, chỉ hiển thị |
| 4 | Thêm tìm kiếm (tên/`ma_lich_hen`) + Reset + option trạng thái đủ | **P2** | FE + (BE nhận `q`) |
| 5 | Đồng nhất timezone (FE dùng local thay vì `toISOString` UTC) | **P2** | Tránh lệch ngày biên |
| 6 | Gọn cột (ẩn/gộp Dịch vụ + Nguồn/Loại) | **P3** | — |
| 7 | Phân trang nếu ca đông | **P3** | Chưa cấp thiết |

*Chỉ phân tích, chưa sửa code.*
