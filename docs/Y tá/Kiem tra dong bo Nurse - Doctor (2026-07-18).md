# PROMPT 13 — Kiểm tra đồng bộ Nurse page ↔ Doctor page

> Ngày: 2026-07-18 · Đọc controllers nurse (queue/medical-records/appointments/dashboard) + doctor (confirmResult/updateResult/examQueue/listPendingResults) + models. Ưu tiên sửa nurse; **không sửa doctor**. Không sửa gì trong prompt này.

## Bối cảnh: KHÔNG có realtime
Không có WebSocket/polling trong code (dù `docs/Y tá/Chot thiet ke...WebSocket` có nhắc — **chưa triển khai**). Mỗi trang tự `load()` lại sau thao tác của CHÍNH nó; trang bên kia **phải reload thủ công** mới thấy thay đổi. Không dùng react-query → **không có invalidate cache dùng chung**.

## A. Bảng đồng bộ

| Sự kiện | Nurse page trước/sau | Doctor page trước/sau | Backend thay đổi | Đồng bộ? |
|---|---|---|---|---|
| Lịch hợp lệ xuất hiện | Queue lọc `LichHen.nurse_id` | List lọc `LichHen.doctor_id` | — | ⚠️ Nurse rỗng vì `nurse_id` chưa set (P0.1); doctor thấy bình thường |
| Y tá tiếp nhận (check-in) | (UI **chưa nối**) → nếu chạy: HangDoi=`dang_cho`, `trang_thai_den='da_den'` | examQueue (HangDoi) thấy bệnh nhân; **List (LichHen.status) vẫn `confirmed`** | `LichHen.trang_thai_den`, `gio_den_thuc_te`; tạo HangDoi | ⚠️ Chỉ đồng bộ qua HangDoi; `status` **không** thành `checked_in` |
| Doctor nhận "đã đến" | — | examQueue thấy (HangDoi) | — | ⚠️ Chỉ nếu bác sĩ dùng trang HangDoi; trang List không phân biệt đến |
| "Bác sĩ bắt đầu khám" | into-room (**nurse thao tác**) → `in_progress` | examQueue cập nhật | `LichHen.status=in_progress`; HangDoi=`trong_phong`; phòng=`dang_kham` | ⚠️ Thực chất **nurse-driven**, không phải bác sĩ; đúng nếu reload |
| Bác sĩ kết thúc khám | finish (**nurse thao tác**) → `waiting_record` | — | `LichHen.status=waiting_record`; HangDoi=`hoan_thanh` | ⚠️ Cũng nurse-driven |
| Nurse hiện việc "cần nhập hồ sơ" | Dashboard `cho_nhap_ho_so` (gồm waiting_record) | — | — | ✅ (khi có dữ liệu) |
| Y tá tạo/lưu/gửi hồ sơ | createDraft(⚠️409)→ban_nhap → submit | — | `KetQuaKham=cho_xac_nhan`; `LichHen=waiting_doctor_confirm` | ✅ logic (nếu qua được P0.2) |
| Doctor hiện "hồ sơ chờ xác nhận" | — | listPendingResults (`bac_si_phu_trach_id`) thấy `cho_xac_nhan` | — | ✅ (bac_si_phu_trach_id set lúc tạo) |
| **Bác sĩ yêu cầu sửa** | ~~Revisions~~ | ~~request revision~~ | **ĐÃ GỠ 2026-07-16** | ❌ Không tồn tại (PROMPT 12) |
| Y tá sửa & gửi lại | resubmit (không kích hoạt được) | — | — | ❌ Moot |
| Bác sĩ xác nhận | Detail khóa (`da_xac_nhan`) sau reload | confirmResult → `da_xac_nhan` | `KetQuaKham=da_xac_nhan`+`nguoi_xac_nhan_id`; `LichHen=completed` | ⚠️ Đồng bộ đúng nhưng **nurse phải reload** |
| Hai trang hiện "hoàn thành" + khóa | Queue thấy `completed`; Detail khóa | List thấy `completed` | — | ✅ (sau reload) |

## B. Điểm lệch

| Điểm lệch | Nguyên nhân | File nguồn | Mức | Cách sửa ưu tiên (nurse) |
|---|---|---|---|---|
| **"Người phụ trách" có 2 nguồn** | Nurse list dùng `LichHen.nurse_id`; nurse medical-records/queue dùng `LichLamViec.nurse_id`→`getMyDoctorIdsToday` | `appointments.controller` vs `medical-records/queue.controller` | **P1** | Chọn 1 nguồn chuẩn (khuyến nghị: copy `LichLamViec.nurse_id`→`LichHen.nurse_id` lúc đặt, rồi mọi nơi dùng `LichHen.nurse_id`) |
| **Trạng thái "đã đến" không vào `LichHen.status`** | check-in set `trang_thai_den` + HangDoi, không set `checked_in` | `queue.controller.checkin`, `dashboard.controller` | **P2** | Đọc "đã đến" từ `trang_thai_den`/HangDoi thống nhất 2 trang |
| **Nurse list (LichHen) vs doctor/nurse queue (HangDoi) là 2 nguồn hàng đợi** | Thiết kế 2 hệ song song | `appointments.controller` (LichHen) vs `queue.controller`/doctor examQueue (HangDoi) | **P1** | Chốt 1 hệ; nurse list nên phản ánh cùng nguồn với check-in |
| **submit/confirm không transaction** | 2 `save()` rời (KetQuaKham rồi LichHen) | `medical-records.submit`, `doctor.confirmResult` | **P2** | Bọc transaction/session hoặc bù trạng thái khi lỗi giữa chừng |
| **Revision loop gỡ nửa vời** | Doctor gỡ, nurse còn | `NurseRevisions`, `medical-records.{listRevisions,resubmit}`, `dashboard.ho_so_can_sua` | **P1** | Quyết định A (khôi phục) / B (gỡ nurse) — PROMPT 12 |
| **Không realtime → stale chéo** | Không ws/polling; refetch cục bộ | toàn bộ | **P2** | Tối thiểu: refetch khi focus/điều hướng; (tùy) ws sau |
| **`checked_in` enum chết** | Không endpoint set | LichHen schema, các controller | P3 | Dùng hoặc bỏ khỏi enum |
| **Comment mâu thuẫn phía doctor** | `updateResult:430` nói còn luồng revision (đã gỡ `:559`) | `doctor/appointments.controller` | P3 | (Doctor — ghi nhận, không tự sửa) |

## C. Source of truth (nguồn dữ liệu chuẩn)

| Dữ liệu | Nguồn chuẩn (canonical) | Ghi chú lệch |
|---|---|---|
| **Trạng thái lịch hẹn** | `LichHen.status` | Nhưng "đã đến" bị tách sang `LichHen.trang_thai_den` + `HangDoi.trang_thai` → **3 mảnh cho vòng đời**; cần coi `LichHen.status` là chính, HangDoi là điều phối hiện diện |
| **Trạng thái hồ sơ** | `KetQuaKham.status` | ✅ Duy nhất, rõ ràng |
| **Người được phân công** | **Chưa nhất quán** — thiết kế: `LichLamViec.nurse_id`; thực thi list: `LichHen.nurse_id` | **PHẢI chốt 1** — khuyến nghị `LichHen.nurse_id` (snapshot) làm chuẩn cho lịch hẹn, copy từ ca lúc đặt |
| **Người nhập hồ sơ** | `KetQuaKham.nguoi_nhap_id` | ✅ Rõ ràng |
| **Người xác nhận hồ sơ** | `KetQuaKham.nguoi_xac_nhan_id` (+`thoi_diem_xac_nhan`) | ✅ Rõ ràng |

## Kết luận kỹ thuật (các câu hỏi)
- **State machine thống nhất?** ❌ 3 máy trạng thái (`LichHen.status`, `HangDoi.trang_thai`, `KetQuaKham.status`) chỉ khớp cục bộ qua các hàm map (dashboard, doctor `trangThaiTongHop`).
- **Enum FE/BE thống nhất?** ⚠️ Phần lớn khớp; ngoại lệ: `checked_in` chết, filter FE thiếu option, `NurseRevisionItem` lệch (P1.1).
- **Appointment + record cập nhật cùng nhau?** ⚠️ Có cập nhật cả hai nhưng **rời rạc, không transaction** → rủi ro lệch nếu lỗi giữa chừng.
- **Transaction/rollback?** Booking có session; **luồng hồ sơ KHÔNG có**.
- **Refetch sau mutation?** Cục bộ có (`load()`); **chéo trang thì không** (phải reload).
- **Mock gây lệch?** Không — không mock.
- **Nhiều nguồn sự thật?** Có — "người phụ trách" (2 nguồn) + "đã đến" (3 mảnh).
- **Duplicate logic FE?** Nhãn/màu trạng thái lặp giữa các trang (chấp nhận được).

**Ưu tiên sửa (nurse):** P1 — chốt nguồn "người phụ trách" (copy nurse_id lúc đặt) + chốt 1 hệ hàng đợi + quyết định revision A/B. P2 — "đã đến" thống nhất, transaction cho submit, refetch-on-focus. **Không đụng doctor page** (chỉ ghi nhận: comment mâu thuẫn, `da_xac_nhan` không reopen).

*Chỉ phân tích, chưa sửa code.*
