# PROMPT 12 — Phân tích luồng "Bác sĩ yêu cầu chỉnh sửa hồ sơ"

> Ngày: 2026-07-18 · Đọc `controllers/doctor/appointments.controller.js` (confirmResult/updateResult/confirmResultByRecord), `controllers/nurse/medical-records.controller.js`, `pages/nurse/{NurseRevisions,NurseAppointmentDetail}.tsx`. Không sửa.

## ⚠️ Phát hiện quyết định (đính chính các phân tích trước)

**Luồng "bác sĩ yêu cầu chỉnh sửa → đẩy về y tá" ĐÃ BỊ GỠ ở phía bác sĩ (2026-07-16).** Bằng chứng: `doctor/appointments.controller.js:559-561` — comment ghi rõ đã gỡ; **không còn endpoint nào set `status='yeu_cau_chinh_sua'` hoặc ghi `doctor_revision_note`.** Bác sĩ nay dùng mô hình **"Lưu & Xác nhận" một bước** (`confirmResult`): xem hồ sơ `cho_xac_nhan`, sửa trực tiếp (tùy chọn qua `applyResultEdits`), rồi set thẳng `da_xac_nhan`.

**Hệ quả:**
- **Không có "producer" của `yeu_cau_chinh_sua`** → khớp dữ liệu thật (probe: **0 hồ sơ** ở trạng thái này).
- **Phía y tá mồ côi:** `NurseRevisions` page, menu "Hồ sơ cần chỉnh sửa", `getRevisions`, `resubmit`, hiển thị `doctor_revision_note` — **tất cả không bao giờ có dữ liệu** vì không ai tạo ra `yeu_cau_chinh_sua`.
- **Đính chính P1.1** (nút Revisions điều hướng `undefined`): trở thành **lỗi tiềm ẩn/vô hại trong thực tế** (trang luôn rỗng), chỉ phát tác **nếu khôi phục luồng yêu cầu chỉnh sửa**.
- **Đính chính spec "Bridge tối thiểu":** phần "vòng lặp chỉnh sửa" tôi từng coi là "chạy end-to-end" **thực ra đã bị gỡ một nửa** — cần quyết định lại (khôi phục hay bỏ hẳn phía y tá).

## Sơ đồ trạng thái THỰC TẾ (sau khi gỡ)

```
Y tá: createDraft → ban_nhap → submit → cho_xac_nhan
                                             │
Bác sĩ (confirmResult, 1 bước):              ▼
   xem 'cho_xac_nhan' → (sửa trực tiếp nếu cần) → da_xac_nhan → LichHen=completed
                                             │
                                             └─ KHÔNG có nhánh → yeu_cau_chinh_sua (đã gỡ)

[Dữ liệu cũ] yeu_cau_chinh_sua ──(nurse resubmit / doctor updateResult)──> cho_xac_nhan
   (chỉ để "giải kẹt" bản ghi cũ; không có đường MỚI đi VÀO yeu_cau_chinh_sua)
```

So với luồng PROMPT 12 mong đợi: **bước "bác sĩ yêu cầu chỉnh sửa" và "y tá nhận yêu cầu → sửa → gửi lại" không còn tồn tại trong hệ thống hiện tại.**

## Bảng kiểm tra (theo luồng còn thực sự chạy)

| Bước | Người thao tác | Điều kiện | Dữ liệu thay đổi | Trang còn lại phải nhận |
|---|---|---|---|---|
| Gửi hồ sơ | Y tá | record `ban_nhap` | `status=cho_xac_nhan`, `submitted_at`; `LichHen=waiting_doctor_confirm` | Bác sĩ thấy ở `pending-results` |
| Xem hồ sơ | Bác sĩ | `bac_si_phu_trach_id` khớp | — | — |
| **Yêu cầu chỉnh sửa** | ~~Bác sĩ~~ | **ĐÃ GỠ** | ~~`yeu_cau_chinh_sua` + `doctor_revision_note`~~ | ~~Y tá thấy ở Revisions~~ |
| Xác nhận (kèm sửa) | Bác sĩ | record `cho_xac_nhan` | `status=da_xac_nhan`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`, push `lich_su_sua`; `LichHen=completed` (nếu không có dịch vụ phát sinh) | Y tá thấy hồ sơ khóa (`da_xac_nhan`) |
| (Cũ) Nhận yêu cầu → sửa → gửi lại | Y tá | record `yeu_cau_chinh_sua` (không còn sinh mới) | `resubmit`: `cho_xac_nhan` + `LichHen=waiting_doctor_confirm` | Bác sĩ thấy lại — nhưng không kích hoạt được |

## Trả lời "cần kiểm tra"

| Câu hỏi | Trả lời |
|---|---|
| Bác sĩ bắt buộc nhập lý do chỉnh sửa? | **N/A** — không còn endpoint yêu cầu chỉnh sửa |
| Ghi chú chỉnh sửa lưu ở đâu? | Field `doctor_revision_note` tồn tại nhưng **không endpoint nào ghi** (dead field). `lich_su_sua[]` được `confirmResult` push nội dung "Bác sĩ xác nhận..." |
| Y tá thấy đầy đủ ghi chú? | UI có chỗ hiển thị `doctor_revision_note` + `lich_su_sua`, nhưng `doctor_revision_note` **luôn null** → y tá không bao giờ thấy "lý do trả về" |
| Dashboard hiển thị hồ sơ cần sửa? | Có thẻ `ho_so_can_sua` nhưng **luôn = 0** |
| Thông báo/badge? | Badge/count có nhưng luôn 0 |
| Y tá sửa đúng hồ sơ? | `resubmit` tồn tại nhưng **không kích hoạt được** (không có `yeu_cau_chinh_sua` mới) |
| Phần nào được sửa? | (khi ban_nhap) chan_doan, huong_dan_dieu_tri, ghi_chu, trieu_chung_ban_dau, ghi_chu_dieu_duong, ngay_tai_kham, sinh_hieu |
| Hồ sơ đã xác nhận bị sửa lại? | **Không** — `updateResult`(bác sĩ) 403 với `da_xac_nhan`; nurse chỉ sửa `ban_nhap`/`yeu_cau_chinh_sua`. **Và không có đường mở lại `da_xac_nhan`** → khóa vĩnh viễn (GAP nghiệp vụ) |
| Gửi lại đổi trạng thái đúng? | Logic đúng (`yeu_cau_chinh_sua→cho_xac_nhan`), nhưng không xảy ra |
| Doctor page nhận lại hồ sơ? | `listPendingResults` lọc `bac_si_phu_trach_id` — nếu resubmit chạy sẽ thấy. Logic OK |
| Ghi chú cũ có mất? | `lich_su_sua[]` là push → không mất; `doctor_revision_note` là 1 field (ghi đè) — nhưng không ai ghi |
| Lịch sử nhiều vòng? | `lich_su_sua[]` lưu nhiều dòng ✅ — nhưng **chỉ bác sĩ push**, **sửa của y tá không push** |
| Người yêu cầu + thời gian? | Qua `lich_su_sua{nguoi_sua_id, thoi_diem_sua}` — nhưng luồng yêu cầu đã gỡ |
| Người sửa + thời gian (y tá)? | **Không** — nurse `update` không push `lich_su_sua`; chỉ cập nhật `submitted_at` khi gửi |
| Gửi lại không sửa nội dung? | `resubmit` không yêu cầu sửa → có thể gửi lại y nguyên (moot) |
| Bỏ qua yêu cầu chỉnh sửa? | N/A |
| Tạo hồ sơ mới thay vì sửa? | Bị chặn — `createDraft` kiểm `exists` + unique index |
| Nguy cơ 2 bản ghi? | **Không** — sparse-unique `appointment_id`/`hang_doi_id` |
| Race bác sĩ ↔ y tá? | Gate trạng thái khác nhau (nurse cần ban_nhap/yeu_cau; doctor cần cho_xac_nhan) giảm chồng lấn; nhưng **không có optimistic lock** → nếu đồng thời, last-write-wins có thể mất cập nhật |
| Thông báo thành công/thất bại? | Nurse: có toast ✅ |

## Lỗ hổng

| Lỗ hổng | Hậu quả | File liên quan | Cách sửa (đề xuất, chưa làm) |
|---|---|---|---|
| **Luồng yêu cầu chỉnh sửa gỡ một nửa** — phía y tá còn mồ côi | Menu/trang/thẻ "Hồ sơ cần chỉnh sửa" luôn rỗng; gây hiểu nhầm "đã có chức năng" | `NurseRevisions.tsx`, `nurseMenu.ts`, `medical-records.controller.{listRevisions,resubmit}`, `dashboard.controller` (`ho_so_can_sua`) | **Quyết định 1 trong 2:** (A) khôi phục endpoint bác sĩ "yêu cầu chỉnh sửa" (ghi `doctor_revision_note`+`yeu_cau_chinh_sua`) rồi phía y tá dùng lại được; (B) **gỡ hẳn** phần revision phía y tá cho nhất quán |
| **Hồ sơ `da_xac_nhan` không có đường sửa** | Bác sĩ lỡ xác nhận sai → khóa vĩnh viễn, không sửa được | `doctor/appointments.updateResult` (403), không có reopen | Thêm đường mở lại có kiểm soát (bác sĩ) — thuộc trang bác sĩ, ngoài scope nurse |
| **Comment mâu thuẫn** | `updateResult:430` vẫn nói "muốn sửa hồ sơ đã xác nhận phải qua luồng yêu cầu chỉnh sửa (nurse) đã có sẵn" — nhưng luồng đó đã gỡ (`:559`) | `doctor/appointments.controller.js` | Cập nhật comment (tránh hiểu sai) |
| **`doctor_revision_note` = dead field** | UI y tá hiển thị field không bao giờ có giá trị | KetQuaKham schema + nurse UI | Bỏ hiển thị (nếu chọn B) hoặc nối lại (nếu chọn A) |
| **Sửa của y tá không ghi `lich_su_sua`** | Mất vết ai sửa nội dung phía y tá | `medical-records.controller.update` | Push `lich_su_sua` khi y tá sửa |
| **Không optimistic lock** | Race bác sĩ↔y tá có thể mất cập nhật | cả hai controller | Thêm version/`updatedAt` check khi save |

## Kết luận

- **Luồng PROMPT 12 mô tả hiện KHÔNG tồn tại** — đã được thay bằng mô hình bác sĩ "Lưu & Xác nhận" một bước (quyết định thiết kế 2026-07-16, có tài liệu ở `docs/Bác sĩ/`).
- **Việc cần quyết định trước tiên (nghiệp vụ):** giữ mô hình một bước (thì **gỡ sạch phần revision phía y tá**) hay khôi phục vòng phản hồi hai chiều (thì **làm lại endpoint bác sĩ + sửa P1.1**). Đây là **quyết định của bạn** — quyết định này chi phối luôn kế hoạch "Bridge tối thiểu" đã lập.

*Chỉ phân tích, chưa sửa code. Phần "hồ sơ đã xác nhận không sửa được" nằm ở trang bác sĩ — ghi nhận, không tự sửa.*
