# Luồng test hoàn chỉnh — BS Khang (TEST) ↔ Y tá Thanh Hà

> Ngày: 2026-07-20 · Nhánh `Bac_si` · Ghi thẳng vào **DB Cloud dùng chung** (đã được người dùng xác nhận).
> Mục tiêu: dựng **1 luồng handoff hoàn chỉnh hôm nay** giữa 2 actor có sẵn để kiểm thử end-to-end.

## 1. Hiện trạng (inspect read-only — `inspect-khang-doctor-data.js`)

- **DB:** MongoDB Atlas Cloud (`cluster0…mongodb.net`) — dùng chung cả nhóm.
- **Y tá `role='nurse'`:** đúng **1** — "Điều dưỡng Thanh Hà" (`_id=6a4f6a2d…410bd6`, active). **Không** có `LichLamViec`/`LichHen` nào mang `nurse_id` của cô ấy ⇒ đăng nhập vào **mọi trang y tá trống** (đúng như báo cáo).
- **Có 2 bác sĩ "Khang":** bản thật `@vitafamily.vn` (KHÔNG đụng) và **Khang (TEST)** `doctor.test@vitafamily.local` (`doctor_id=6a4fba7e…047cae`, chuyên khoa Tai Mũi Họng).
- **Khang (TEST):** có ca **HÔM NAY 20/07** (15 slot, 0 đặt) nhưng **0 lịch hẹn hôm nay** ⇒ chỉ gắn `nurse_id` thôi thì hàng đợi/hồ sơ hôm nay vẫn rỗng, không đi hết luồng.

## 2. Cơ chế quyết định "y tá thấy gì" (nguồn: code)

| Màn hình | Lọc theo | File |
|---|---|---|
| Phạm vi bác sĩ | `LichLamViec.nurse_id` = y tá **trong ngày** (`getMyDoctorIdsToday`) — KHÔNG dùng `LichHen.nurse_id` | `utils/nurse-scope.js` |
| Hàng đợi | `HangDoi.trang_thai` (dang_cho/da_goi/trong_phong/hoan_thanh…) theo doctor trong phạm vi | `nurse/queue.controller.js` |
| DS lịch hẹn | `LichHen.status ∈ {confirmed, checked_in, in_progress, waiting_record, waiting_doctor_confirm, completed, skipped}`, ngày = hôm nay | `nurse/appointments.controller.js` |
| Hồ sơ cần nhập | `LichHen.status ∈ {waiting_record, waiting_doctor_confirm}` + `KetQuaKham.status` | `nurse/appointments.controller.js` |

Chuyển trạng thái thật của controller (mô phỏng đúng khi seed):
check-in → `confirmed`+`trang_thai_den=da_den`+queue `dang_cho`; vào phòng → `in_progress`+`trong_phong`; kết thúc → `waiting_record`+`hoan_thanh`; nhập nháp → `KetQuaKham=ban_nhap`; gửi → `waiting_doctor_confirm`+`cho_xac_nhan`; BS xác nhận → `completed`+`da_xac_nhan`; BS yêu cầu sửa → `waiting_record`+`KetQuaKham=yeu_cau_chinh_sua`.

## 3. Thiết kế seed (8 chặng hôm nay)

**Bước A (tiên quyết):** gắn `nurse_id = Thanh Hà` vào `LichLamViec` ca **hôm nay** của Khang (TEST) (đã tồn tại — chỉ update, không tạo ca mới).

**Bước B:** tạo 8 `LichHen` hôm nay trên ca đó (dùng 8 slot `active` đầu, đánh dấu `booked`), `nurse_id`=Thanh Hà, phủ trọn vòng handoff:

| # | Ý nghĩa | LichHen.status | HangDoi | KetQuaKham | Thao tác kế tiếp |
|---|---|---|---|---|---|
| A1 | Chưa đến | confirmed | — | — | Y tá check-in |
| A2 | Đã đến, chờ gọi | confirmed +`da_den` | dang_cho | — | Y tá gọi → vào phòng |
| A3 | Đang khám | in_progress | trong_phong | — | Y tá kết thúc khám |
| A4 | Chờ nhập hồ sơ | waiting_record | hoan_thanh | (chưa có) | Y tá tạo nháp |
| A5 | Hồ sơ nháp | waiting_record | hoan_thanh | ban_nhap + SinhHieuKham | Y tá gửi |
| A6 | Đã gửi, chờ BS | waiting_doctor_confirm | hoan_thanh | cho_xac_nhan | **BS xác nhận / yêu cầu sửa** |
| A7 | BS yêu cầu sửa | waiting_record | hoan_thanh | yeu_cau_chinh_sua + `doctor_revision_note` + `lich_su_sua` | Y tá sửa → gửi lại |
| A8 | Đã xác nhận (khóa) | completed | hoan_thanh | da_xac_nhan + `nguoi_xac_nhan_id` | (hoàn tất) |

Giá trị khóa: `KetQuaKham.nguoi_nhap_id`=Thanh Hà, `bac_si_phu_trach_id`=Khang(TEST) doctor_id, `nguoi_xac_nhan_id`/`lich_su_sua.nguoi_sua_id`=Khang(TEST) user_id. `SinhHieuKham.nguoi_do_id`=Thanh Hà.

## 4. An toàn & hoàn tác

- Chỉ ghi khi có cờ `--confirm`; không cờ → in hướng dẫn, không ghi gì.
- Target BS **chặt theo email `doctor.test@vitafamily.local`** — tuyệt đối không chạm Khang thật.
- Y tá = đúng 1 `role='nurse'`; nếu 0 hoặc >1 → **dừng**, không đoán.
- Nếu ca hôm nay của Khang(TEST) không tồn tại → **dừng** (không tự tạo ca).
- Marker: `ma_lich_hen` prefix `LIVETEST_KH_`, `ten_khach` prefix `(LIVETEST)`.
- `--cleanup`: xóa theo marker (cascade KetQuaKham/SinhHieuKham/HangDoi → LichHen) + gỡ `nurse_id` ca hôm nay + trả slot đã booked về `active`. Idempotent; seed tự chạy cleanup trước khi tạo.
- **Không** tạo HoaDon/ThanhToan, không tạo bệnh nhân/bác sĩ/y tá mới.

## 5. Cách dùng

```bash
cd backend
node src/scripts/seed-khang-nurse-live-flow.js            # chỉ in hướng dẫn
node src/scripts/seed-khang-nurse-live-flow.js --confirm  # gắn nurse_id + tạo 8 chặng hôm nay
node src/scripts/seed-khang-nurse-live-flow.js --cleanup  # dọn sạch theo marker + trả trạng thái ban đầu
```

## 6. Kịch bản kiểm thử sau khi seed

1. Đăng nhập **Y tá Thanh Hà** → Dashboard/Hàng đợi/DS lịch hẹn/Hồ sơ cần nhập phải có dữ liệu hôm nay của Khang(TEST).
2. A1: check-in → A2 xuất hiện trong hàng đợi `dang_cho`.
3. A2: gọi → vào phòng (A3-like) → kết thúc → chuyển "chờ nhập hồ sơ".
4. A4: tạo nháp; A5: gửi hồ sơ → sang `waiting_doctor_confirm`.
5. Đăng nhập **BS Khang (TEST)** → thấy A6 chờ xác nhận → xác nhận (→ completed/khóa) hoặc yêu cầu sửa.
6. A7: quay lại y tá sửa & gửi lại; A8: xác nhận hồ sơ đã khóa (chỉ đọc).

## 7. Kết quả thực thi (2026-07-20)

Đã chạy `node src/scripts/seed-khang-nurse-live-flow.js --confirm` — thành công:
- Gắn `nurse_id`=Thanh Hà vào ca hôm nay của Khang(TEST); tạo 8 lịch hẹn `LIVETEST_KH_001..008`.

Verify read-only (`verify-khang-nurse-live-flow.js`) — đạt toàn bộ theo logic controller:

| Kiểm chứng | Kết quả |
|---|---|
| `getMyDoctorIdsToday(Thanh Hà)` chứa Khang(TEST) | ✅ CÓ |
| Lịch hẹn hôm nay trong phạm vi / hiện trên DS y tá | 8 / 8 |
| Hàng đợi | dang_cho×1, trong_phong×1, hoan_thanh×5 (A1 chưa check-in — đúng) |
| Hồ sơ khám (KetQuaKham) | ban_nhap/cho_xac_nhan/yeu_cau_chinh_sua/da_xac_nhan mỗi loại 1 + 1 sinh hiệu |
| 'Hồ sơ cần nhập' | 4 (A4,A5,A7 + A6); A8 completed đã loại đúng |

**Hoàn tác:** `node src/scripts/seed-khang-nurse-live-flow.js --cleanup` (chưa chạy — giữ dữ liệu để kiểm thử).

**File liên quan:**
- `backend/src/scripts/seed-khang-nurse-live-flow.js` — seed/cleanup.
- `backend/src/scripts/verify-khang-nurse-live-flow.js` — kiểm chứng read-only.
- `backend/src/scripts/inspect-khang-doctor-data.js` — inspect tổng quát (có sẵn từ trước).
