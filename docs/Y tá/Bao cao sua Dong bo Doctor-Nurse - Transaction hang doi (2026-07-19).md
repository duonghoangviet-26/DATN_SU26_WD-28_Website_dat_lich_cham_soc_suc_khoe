# PROMPT 28 (bổ sung) — Nguyên tử hóa cập nhật hàng đợi ↔ lịch hẹn (Y tá)

> Ngày: 2026-07-19 · Nhánh `Bac_si`. Hoàn tất nguyên tắc "xử lý cập nhật thất bại giữa chừng" cho check-in/into-room/finish — mục đã ghi "còn tồn" ở báo cáo khôi phục revision. Nurse-side, không chạm doctor.

## Vấn đề
3 hành động phía y tá ghi **2–3 bảng không transaction** → lệch giữa `HangDoi`/`TrangThaiPhongKham` và `LichHen.status` nếu lỗi giữa chừng:

| Hành động | Các bảng ghi | Drift khi lỗi | Tự lành? |
|---|---|---|---|
| `into-room` | HangDoi + phòng + `LichHen=in_progress` | Hàng đợi `trong_phong` nhưng lịch kẹt `confirmed` | ❌ Dính (retry → 409) |
| `finish` | HangDoi + phòng + `LichHen=waiting_record` | Lượt `hoan_thanh` nhưng lịch chưa `waiting_record` → **y tá không thấy "cần nhập hồ sơ"** | ❌ Dính (retry → 409) |
| `checkin` (online) | `LichHen=da_den` + HangDoi.create | Lịch `da_den` nhưng không có lượt | ⚠️ Tự lành khi retry |

`into-room`/`finish` nguy hiểm nhất vì drift **dính** (retry bị 409 do trạng thái đã đổi) và làm hỏng đúng 2 mắt xích đồng bộ #2/#3.

## Thay đổi (chỉ `backend/src/controllers/nurse/queue.controller.js`)
- `+ import mongoose`.
- **`checkin` (online):** hoist `appt`, dời `appt.save()` xuống bọc `session.withTransaction` cùng `HangDoi.create([payload], { session })`. Offline giữ nguyên (1 lượt ghi, không cần tx).
- **`intoRoom`:** bọc `entry.save` + `room.save` + `LichHen.updateOne(in_progress)` trong 1 transaction. `tuRoom` chụp trước tx.
- **`finish`:** bọc `entry.save` + `room.save` + `LichHen.updateOne(waiting_record)` trong 1 transaction. Tính `thoi_gian_kham_tb_phut` trong tx.
- **Audit/nhật ký** (`ghiAuditQueue`, `NhatKyThaoTac`) và thông báo **để NGOÀI transaction** (best-effort) — lỗi ghi log không rollback trạng thái nghiệp vụ.

## Đáp ứng nguyên tắc PROMPT 28
- **Appointment ↔ record/queue không lệch** ✅ — mọi chuyển tiếp đa-bảng nay nguyên tử.
- **Xử lý cập nhật thất bại giữa chừng** ✅ — lỗi bất kỳ write nào → rollback toàn bộ → không còn trạng thái nửa vời.
- **Một nguồn sự thật** ✅ — `LichHen.status` luôn khớp với `HangDoi.trang_thai` sau mỗi thao tác.
- **Không mock, không sửa doctor, không API trái ngược** ✅.

## Kiểm thử
- `node --check queue.controller.js` → OK.
- **Không phá test hiện có:** `nurse-doctor-status-sync.test.js` (dòng 98–111) assert success-path (check-in→201, into-room→200, finish→200, `LichHen=waiting_record`, dashboard `cho_nhap_ho_so`). Thay đổi giữ **nguyên kết quả success-path**, chỉ thêm nguyên tử khi lỗi → test vẫn xanh (không sửa test).
- **Chưa chạy live** (cần server + DB ghi) — theo ràng buộc DB read-only, không tự chạy. Transaction cần replica set (Atlas — đã verify P25).

## Rủi ro & ghi nhận
- **Rủi ro thấp–trung.** Success-path không đổi hành vi; `withTransaction` tự retry callback (mutation idempotent — set cùng field). Cần replica set (đã có).
- **Không đổi FE** (thuần backend) — không cần type-check/build lại.
- Còn lại (tùy chọn, ngoài phạm vi bắt buộc): refetch-on-focus cho stale chéo trang (chưa realtime); chạy live 10 kịch bản khi có seed (Bước 17).
