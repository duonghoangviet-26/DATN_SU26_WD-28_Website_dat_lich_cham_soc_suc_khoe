# PROMPT 22 — Báo cáo sửa Chi tiết lịch hẹn + Tiếp nhận (Y tá)

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Thực thi QĐ-2 (nối check-in vào UI). Không sửa chức năng nhập hồ sơ.

## Thay đổi

| File | Thay đổi |
|---|---|
| `backend/.../appointments.controller.js` | `getById`: import `HangDoi`; thêm truy vấn `HangDoi.findOne({appointment_id})`; trả **`da_check_in`** (`trang_thai_den==='da_den'` HOẶC có entry hàng đợi), `trang_thai_den`, `hang_doi_trang_thai` |
| `frontend/types/index.ts` | `NurseAppointmentDetail`: thêm `trang_thai_den?`, `da_check_in`, `hang_doi_trang_thai?` |
| `frontend/components/common/ConfirmDialog.tsx` | thêm prop optional `confirmDisabled` (disable nút xác nhận khi request chạy) — additive, không phá nơi khác |
| `frontend/pages/nurse/NurseAppointmentDetail.tsx` | thanh **"Tiếp nhận bệnh nhân"**: nút chỉ hiện khi `canCheckin`; **ConfirmDialog**; gọi `checkinQueue({appointment_id})`; chống bấm lặp; disable khi chạy; refetch sau xong; xử lý conflict |

**`canCheckin` (FE)** = `!da_check_in && status∈{pending,confirmed} && là hôm nay`. Backend là chốt chặn cuối.

## Đáp ứng yêu cầu bảo mật
- **Backend kiểm phạm vi:** `getById` scope theo ca (`getMyDoctorIdsOnDate`, PROMPT 18) → lịch ngoài ca **404**; `checkin` scope theo ca (`getMyDoctorIdsToday`) → ngoài ca **403**. Không dựa nút ẩn FE.
- **Whitelist:** `checkin` chỉ nhận field cụ thể (destructure); FE chỉ gửi `appointment_id`.
- **Không sửa payment / bác sĩ / phòng / dịch vụ / giá:** grep controller nurse = **0 match** ghi các field này. ✅
- **Không tự hoàn thành lịch:** không nurse endpoint set `status='completed'` (grep xác nhận); `finish` chỉ set `waiting_record`. ✅

## Đáp ứng yêu cầu Tiếp nhận
- Nút chỉ hiện khi trạng thái/ngày cho phép ✅ (`canCheckin`).
- Confirm dialog ✅ (ConfirmDialog).
- Chống bấm lặp ✅ (`if (checkingIn) return` + `confirmDisabled` + nút `disabled`).
- Disable khi request chạy ✅.
- Refetch sau thành công ✅ (`load()` trong `finally`, chạy cả khi lỗi để đồng bộ).
- Doctor page đọc trạng thái mới ✅ (`checkin` tạo `HangDoi` → doctor examQueue thấy; set `trang_thai_den='da_den'`, `pending→confirmed`).
- Thông báo rõ ✅ (toast thành công/lỗi kèm message backend).
- Xử lý conflict ✅ (lỗi 403/409 từ backend → toast lý do + `load()` đồng bộ trạng thái mới nhất).

## Kiểm thử
- **Backend syntax** `node --check` → OK.
- **Frontend type-check** → **110 lỗi/3 file = baseline**, 0 lỗi mới.
- **Build** `vite build` → ✅ (6.79s).
- **Bảo mật (grep):** 0 chỗ nurse ghi payment/giá/bác sĩ/phòng/dịch vụ/complete ✅.
- **Các kịch bản prompt (code-enforced, đã phân tích/verify):**

| Kịch bản | Cơ chế chặn |
|---|---|
| URL trực tiếp / lịch không thuộc quyền | `getById` ca-scope → **404** (verified PROMPT 18: 2 lịch bác sĩ khác bị loại); `checkin` → **403** |
| Lịch hủy | `checkin` chặn `cancelled/no_show/completed/skipped` → **409**; FE `canCheckin` loại luôn |
| Lịch đã check-in | `checkin` chặn khi đã có `HangDoi` → **409**; FE ẩn nút khi `da_check_in`, hiện "đã tiếp nhận" |
| Request lặp | FE `checkingIn` guard + `confirmDisabled`; backend `HangDoi` unique + `exists` → **409** lần 2 |

- **Chưa chạy live check-in** (ghi DB) — cần server + seed hôm nay (Bước 17). Happy-path check-in đã có test tích hợp sẵn `nurse-doctor-status-sync.test.js` (checkin→into-room→finish), chạy được ở Bước 17.

## Rủi ro & ghi nhận
- **Rủi ro thấp–trung.** `getById` thêm 1 truy vấn `HangDoi` (nhẹ). ConfirmDialog đổi additive (prop optional) — các nơi dùng khác không ảnh hưởng.
- **Hôm nay y tá 0 ca** → `getMyDoctorIdsToday` rỗng → check-in 403 (và getById 404) cho mọi lịch hôm nay. Đúng nghiệp vụ (không ca = không tiếp nhận). Cần seed (Bước 17) để demo.
- Không sửa form nhập hồ sơ (đúng phạm vi).

## Vấn đề còn tồn
- Full luồng check-in→khám→hồ sơ chỉ chạy khi có ca + seed hôm nay (Bước 17).
- QĐ-3 (quyền `cancel` của y tá) vẫn chờ quyết định — chưa đụng `queue.cancel` trong bước này.
