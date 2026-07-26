# PROMPT 16 — Kế hoạch sửa trang Y tá (tổng hợp)

> Ngày: 2026-07-18 · Tổng hợp PROMPT 1–15. Không sửa code. Ưu tiên nurse; **không đụng admin/doctor/patient/receptionist**. Thay đổi DB = kế hoạch riêng (mục cuối).

## 0. Điều chỉnh nền tảng & quyết định cần chốt trước

**Điều chỉnh do ràng buộc "không sửa patient":** thay vì set `LichHen.nurse_id` lúc đặt lịch (phải sửa `patient/receptionist booking` — CẤM), ta **đổi phạm vi query của controller nurse sang gate theo CA** (`LichLamViec.nurse_id → doctor_ids của ngày`). Lợi ích: (a) trong phạm vi nurse; (b) **thống nhất gate** cho list/detail/medical-records/check-in (hết P1.2); (c) dùng index `doctor_id`/`(ngay_kham,doctor_id)` sẵn có; (d) không phụ thuộc lịch cũ có `nurse_id` hay không.

**3 quyết định NGHIỆP VỤ chi phối kế hoạch (cần bạn chốt trước khi làm bước liên quan):**
- **QĐ-1 (Revision A/B):** (A) khôi phục vòng "bác sĩ yêu cầu chỉnh sửa" · (B) gỡ sạch phần revision phía y tá. → gate Bước 12/8/5.
- **QĐ-2 (Check-in):** nối hệ HangDoi vào UI y tá, hay để dormant/gỡ. → gate Bước 9.
- **QĐ-3 (Quyền `cancel`):** y tá được "hủy lịch hẹn" hay chỉ "bỏ lượt/không đến". → gate Bước 9.

## Bảng kế hoạch (từng bước, foundation → nghiệp vụ → UI → security → test)

| Bước | Mục tiêu | File ĐỌC | File SỬA | File KHÔNG sửa | Rủi ro | Cách test | Điều kiện hoàn thành |
|---|---|---|---|---|---|---|---|
| **1. Verify guard** | Xác nhận route+role đúng, không đổi | `routes/nurse/*`, `auth.middleware.js`, `ProtectedRoute.tsx` | (không) | tất cả | 0 | Gọi `/api/nurse/*` không token→401; role≠nurse→403 | Xác nhận guard 2 lớp, không cần sửa |
| **2. Verify danh tính y tá** | Mọi query dùng `req.user.id`, không tin FE | các `controllers/nurse/*` | (không) | — | 0 | Đọc: không controller nào nhận nurseId từ body/query | Xác nhận |
| **3. Scope theo CA** ⭐ | List/detail/dashboard gate theo `getMyDoctorIds(date)` thay `LichHen.nurse_id` | `utils/nurse-scope.js`, `controllers/nurse/{appointments,dashboard}.controller.js` | `utils/nurse-scope.js`(thêm `getMyDoctorIds(nurseId,date)`), `appointments.controller.js`, `dashboard.controller.js` | booking/doctor/admin | Đổi tập dữ liệu hiển thị | Nurse gán ca hôm nay → list/detail/dashboard hiện đúng lịch của bác sĩ đó; nurse khác ca → 404 | Ba nơi cùng gate CA, nhất quán |
| **4. Decouple createDraft** ⭐ | Cho nhập hồ sơ neo `appointment_id` khi không có HangDoi | `controllers/nurse/medical-records.controller.js`, `models/KetQuaKham.js` | `medical-records.controller.js` | models | Nhánh mới sai auth | TDD: nurse có ca + lịch không HangDoi → `createDraft` 201, record `appointment_id`, `hang_doi_id` null; lịch ngoài ca → 403; đã có hồ sơ → 409 | Test đỏ→xanh; đường HangDoi cũ vẫn chạy |
| **5. Chuẩn hóa API/service** | Sửa mismatch type | `nurse.service.ts`, `types/index.ts`, `medical-records.controller.js` | `types/index.ts`(sửa `submit/resubmit` bỏ `appointment_status` hoặc thêm ở BE); revisions theo QĐ-1 | doctor | Nhỏ | type-check pass; response khớp type | Không còn field undefined bất ngờ |
| **6. Dashboard** | Ngữ nghĩa "đến/khám" đúng + thẻ click | `dashboard.controller.js`, `NurseDashboard.tsx` | `dashboard.controller.js`, `NurseDashboard.tsx` | — | Đổi số hiển thị | Lịch `no_show`/`skipped` không tính "đã check-in"; thẻ dẫn tới trang lọc | Số khớp trạng thái thật; thẻ điều hướng |
| **7. Khối ca hôm nay** | Thêm giờ ca + phòng thực + lọc ngày làm | `dashboard.controller.js`, `models/LichLamViec.js` | `dashboard.controller.js`, `NurseDashboard.tsx` | — | Nhỏ | Ca `nghi`/`nghi_phep` không hiện; có giờ bắt đầu–kết thúc | Khối ca đủ thông tin |
| **8. Danh sách lịch hẹn** | Thêm cột "Hồ sơ" + badge màu đủ + tìm kiếm/reset | `appointments.controller.js`, `NurseQueue.tsx` | `appointments.controller.js`(nhận `q`), `NurseQueue.tsx` | — | Nhỏ | Tìm theo tên/`ma_lich_hen`; cột hồ sơ hiện `da_co_ket_qua`/`ket_qua_status`; reset xoá lọc | Y tá thấy nhanh lịch cần nhập |
| **9. Check-in** (QĐ-2, QĐ-3) | Nối UI hệ HangDoi HOẶC gỡ khỏi service | `queue.controller.js`, `room-status.controller.js`, `nurse.service.ts`, `NurseQueue.tsx` | Theo QĐ-2 | doctor examQueue | Cao (luồng mới) | Nếu nối: check-in→doctor examQueue thấy; nếu gỡ: service sạch | Nhất quán 1 hệ |
| **10. Chi tiết lịch hẹn** | SĐT fallback + back-to-source | `appointments.controller.js`, `NurseAppointmentDetail.tsx` | `appointments.controller.getById`, `NurseAppointmentDetail.tsx` | — | Nhỏ | SĐT hiện cho lịch member (`?? user.so_dien_thoai`); "Quay lại" đúng trang nguồn | Chi tiết đủ thông tin |
| **11. Form hồ sơ** | Nhãn "nhập theo bác sĩ" + set `chi_dinh_tai_kham` + ghi `lich_su_sua` khi y tá sửa | `NurseAppointmentDetail.tsx`, `medical-records.controller.js` | cả hai | doctor | Nhỏ | Có nhãn; sửa hồ sơ → `lich_su_sua` có dòng của y tá | Vết sửa đầy đủ |
| **12. Revision loop** (QĐ-1) | Khôi phục (A) hoặc gỡ (B) | `medical-records.controller.js`, `NurseRevisions.tsx`, `nurseMenu.ts`, `dashboard.controller.js` | Theo QĐ-1 | **doctor** (nếu A cần endpoint bác sĩ → ghi đề xuất, KHÔNG tự sửa) | Trung bình | A: bác sĩ tạo `yeu_cau_chinh_sua`→nurse thấy→sửa→gửi lại; B: không còn menu/trang/thẻ revision | Không còn trang mồ côi |
| **13. Khóa hồ sơ đã XN** | Xác nhận đã đúng | `medical-records.controller.js`, `NurseAppointmentDetail.tsx` | (không dự kiến) | — | 0 | Hồ sơ `da_xac_nhan` → không sửa (FE ẩn nút + BE 409) | Xác nhận |
| **14. Đồng bộ doctor-nurse** | Transaction cho submit + refetch-on-focus | `medical-records.controller.js`, `NurseAppointmentDetail.tsx` | `medical-records.controller.submit`, các page nurse | doctor | Trung bình | Ngắt giữa chừng không để lệch `KetQuaKham`/`LichHen`; quay lại tab → refetch | Không lệch trạng thái |
| **15. UI/UX** | Design system (badge/màu, ConfirmDialog, unsaved guard, empty phân biệt) | các page nurse, `components/common/*` | các page/component nurse | admin/doctor | Nhỏ | Skip/cancel có ConfirmDialog; rời form chưa lưu → cảnh báo; badge đủ màu | Đạt checklist PROMPT 15 |
| **16. Security** | Audit checkin+medical-records; verify whitelist | `queue/medical-records.controller.js` | hai controller nurse | — | Nhỏ | Thao tác → có `NhatKyThaoTac`; body thừa field bị bỏ | Có vết + an toàn |
| **17. Test data (seed)** | Seed idempotent có tag để test hôm nay | `scripts/*` | `scripts/seed-nurse-today-test.js`(mới) | dữ liệu thật | Chạm DB Cloud | Chạy seed → nurse test có ca+lịch hôm nay; chạy lại không nhân đôi; unseed sạch | Test được end-to-end |
| **18. Kiểm tra cuối** | Regression toàn luồng | tất cả | (không) | — | 0 | Chạy full test + click-through luồng đăng nhập→nhập→gửi→xác nhận | Tất cả xanh |

⭐ = bước nền tảng bắt buộc trước.

## Kế hoạch DATABASE riêng (KHÔNG làm trong đợt này)
1. **Index bổ sung:** `KetQuaKham.{nguoi_nhap_id, bac_si_phu_trach_id, status}` (dashboard/list quét collection). *(LichHen không cần index `nurse_id` nếu chuyển sang gate `doctor_id` — đã có index.)*
2. **Chuẩn hóa dữ liệu:** 3 `KetQuaKham.status=null` → backfill; 28 `HangDoi` rác offline/skipped → dọn.
3. Mọi thao tác ghi DB cần prompt cho phép + nêu rủi ro migration.

## Bước đầu tiên NHỎ NHẤT, AN TOÀN NHẤT để bắt đầu

**→ Bước 4: Decouple `createDraft` khỏi ràng buộc HangDoi (P0.2), theo TDD.**

Vì sao là bước khởi đầu an toàn nhất:
- **Cô lập** trong đúng 1 file nurse (`controllers/nurse/medical-records.controller.js`).
- **Cộng thêm** (thêm nhánh "appointment-only" khi không có HangDoi) — **giữ nguyên đường HangDoi cũ** → gần như không rủi ro hồi quy.
- **Độc lập** với 3 quyết định A/B, check-in, cancel.
- **Khớp dữ liệu thật:** 7/7 hồ sơ hiện có là appointment-only → đúng hướng.
- **Kiểm thử được ngay** bằng test API (như `doctor.confirm-result.test.js`): nurse có ca + lịch không HangDoi → `createDraft` 201.
- Mở khóa **chức năng lõi nhất** (nhập/lưu hồ sơ).

Sau Bước 4, làm **Bước 3 (scope theo CA)** để chức năng thông suốt end-to-end trên UI. Hai bước này là P0; các bước còn lại theo thứ tự bảng, dừng lại ở các mốc QĐ-1/2/3 để bạn chốt.

*Chỉ lập kế hoạch, chưa sửa code.*
