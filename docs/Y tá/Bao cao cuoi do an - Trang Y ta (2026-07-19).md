# PROMPT 31 — Kiểm tra cuối & Báo cáo đồ án: Trang Y tá (VitaFamily)

> Ngày: 2026-07-19 · Nhánh `Bac_si`. **Nguyên tắc: chỉ khẳng định khi có bằng chứng.** Phân loại: ✅ Đã hoàn thành · 🟡 Một phần · ⛔ Chưa hoàn thành · 🧪 Chưa kiểm thử (live) · ⬜ Ngoài phạm vi.

## A. KẾT QUẢ KIỂM TRA CUỐI (14 mục — kèm bằng chứng)

| # | Mục | Bằng chứng | Kết luận |
|---|---|---|---|
| 1 | Không còn mock che API | `grep mock` trong `pages/nurse` + `nurse.service.ts` + `controllers/nurse` → **0** | ✅ |
| 2 | Không hard-code dữ liệu | Trang render từ `nurseService`; không mảng người/phòng/lịch cứng; 0 mock | ✅ |
| 3 | Không lộ dữ liệu y tá khác | Mọi controller đọc dữ liệu đều ca-scope (`getMyDoctorIdsOnDate/Today`, 13 lượt) hoặc `nguoi_nhap_id` | ✅ code · 🧪 chưa test live |
| 4 | Không có quyền admin/doctor trong nurse | BE `router.use(verifyToken, requireRole('nurse'))`; FE `ProtectedRoute roles={['nurse']}` | ✅ |
| 5 | Không sửa được payment | `payment_status` chỉ xuất hiện dưới dạng **đọc** (response); không endpoint payment ở nurse; FE badge "chỉ xem" | ✅ |
| 6 | Không sửa hồ sơ đã xác nhận | P27: BE `update`/`submit` trả **409** khi `da_xac_nhan` (đọc DB tươi); FE readOnly + ẩn nút | ✅ code · 🧪 chưa test live |
| 7 | Không tạo hồ sơ trùng | Sparse-unique `appointment_id`/`hang_doi_id` + `KetQuaKham.exists` → 409 | ✅ code · 🧪 chưa test live |
| 8 | Luồng doctor–nurse đồng bộ | P28: transaction submit/resubmit/request-revision + nguyên tử hàng đợi↔lịch | ✅ code · 🧪 chưa test live |
| 9 | Loading/error/empty đầy đủ | 6/6 trang nurse có cả 3 trạng thái (grep) | ✅ |
| 10 | Không còn console error | **0** `console.*` trong source nurse (static) | 🟡 static ✅ · runtime chưa kiểm (cần chạy app) |
| 11 | Type-check thành công | **0 lỗi trong file nurse**; NHƯNG repo còn **110 lỗi/3 file có sẵn** (`mock/doctor-appointments`, `Profile.tsx`, `types/index.ts`) | 🟡 nurse sạch · repo KHÔNG sạch |
| 12 | Build thành công | `vite build` ✅ (6.61s) | ✅ |
| 13 | Test quan trọng thành công | Unit **18/18 pass** (BE 9 + FE 9, đã chạy thật); integration/E2E **chưa chạy** | 🟡 unit ✅ · integration/E2E 🧪 |
| 14 | Không file thừa/import chết (phạm vi sửa) | 6 trang nurse đều routed; `NurseRevisions` nay đã nối (route+menu+dashboard) sau P28; tsc 0 unused trong nurse | ✅ |

**Lưu ý trung thực:** Mục 10, 11, 13 **chỉ đạt một phần** — không đánh dấu hoàn hảo. Type-check repo còn lỗi cũ ngoài nurse; console runtime và integration/E2E chưa chạy.

---

## B. BÁO CÁO ĐỒ ÁN

### 1. Mục tiêu nurse page
Cho phép **y tá** tiếp nhận bệnh nhân, điều phối hàng đợi khám, và **nhập hồ sơ khám hộ theo kết luận bác sĩ**, rồi gửi bác sĩ xác nhận — làm cầu nối vận hành giữa bệnh nhân đã đặt lịch và bác sĩ.

### 2. Phạm vi
- **Trong phạm vi:** toàn bộ trang y tá (FE `pages/nurse/*`, `services/nurse.service.ts`, `routes/nurse*`) + API `/api/nurse/*` (controllers/routes nurse) + điểm tích hợp bắt buộc với bác sĩ (endpoint `request-revision`).
- **⬜ Ngoài phạm vi:** trang admin/bệnh nhân; nghiệp vụ bác sĩ (ngoài điểm tích hợp); thanh toán; realtime/WebSocket; model dữ liệu (không đổi schema).

### 3. Chức năng đã hoàn thành
| Chức năng | Trạng thái |
|---|---|
| Dashboard y tá (số liệu ca hôm nay, cần tiếp nhận, cần nhập hồ sơ, cần sửa) | ✅ |
| Ca làm việc (xem theo tuần, theo ca được phân) | ✅ |
| Danh sách lịch hẹn (ca-scope, tìm kiếm, phân trang, lọc trạng thái) | ✅ |
| Chi tiết lịch hẹn + tiếp nhận (check-in) | ✅ |
| Hàng đợi động (gọi/vào phòng/kết thúc) | ✅ |
| Nhập & lưu nháp hồ sơ (form, cảnh báo chưa lưu, validation) | ✅ |
| Gửi hồ sơ cho bác sĩ (transaction) | ✅ |
| Nhận yêu cầu chỉnh sửa + gửi lại | ✅ code · 🧪 chưa test live |
| Khóa hồ sơ sau khi bác sĩ xác nhận | ✅ code · 🧪 chưa test live |
| Danh sách hồ sơ cần nhập / cần sửa | ✅ |

### 4. Luồng nghiệp vụ (state machine liên kết)
`đặt lịch → (y tá) check-in → gọi → vào phòng (in_progress) → kết thúc (waiting_record) → (y tá) lưu nháp (ban_nhap) → gửi (cho_xac_nhan / waiting_doctor_confirm) → (bác sĩ) xác nhận (da_xac_nhan/completed, KHÓA) HOẶC yêu cầu sửa (yeu_cau_chinh_sua/waiting_record) → (y tá) sửa & gửi lại → …`
Mỗi chuyển tiếp 2 bảng bọc **transaction** (P25/P28). ✅ code · 🧪 chưa chạy live 10 kịch bản.

### 5. Phân quyền
- BE: mọi route `/api/nurse/*` qua `verifyToken + requireRole('nurse')`. Danh tính lấy từ token (`req.user.id`), **không tin** id từ FE. ✅
- Phạm vi dữ liệu = bác sĩ y tá trực trong ngày (`LichLamViec.nurse_id` → `getMyDoctorIdsOnDate`); ngoài ca → 404/403. ✅ code · 🧪 chưa test live.
- Ownership hồ sơ: `KetQuaKham.nguoi_nhap_id`. ✅
- FE: `ProtectedRoute roles={['nurse']}`. ✅

### 6. Kiến trúc frontend
- React + TS + Vite + Tailwind. Trang `pages/nurse/*` → gọi **duy nhất** qua `services/nurse.service.ts` (unwrap `data.data`). Không mock, không axios trực tiếp trong trang.
- Điều hướng: `routes/AppRoutes.tsx` (khu `/nurse` bọc ProtectedRoute), menu `routes/nurseMenu.ts`.
- Không react-query → mỗi trang tự `load()`/refetch sau mutation (không cache chung).

### 7. Kiến trúc backend
- Express (ESM) + Mongoose. `routes/nurse/*` (thin) → `controllers/nurse/*` (logic) → models. Envelope `{success,message,data}` qua `ok/created/fail`.
- Tiện ích: `nurse-scope.js` (phạm vi ca), `validators.js` (ngày tái khám). Transaction qua `session.withTransaction` (Atlas replica set).

### 8. Quan hệ dữ liệu (đúng schema hiện tại, không đổi)
`LichLamViec`(doctor_id, **nurse_id**, ngay, slots) · `LichHen`(doctor_id, status, trang_thai_den, member_id/ten_khach) · `HangDoi`(appointment_id, doctor_id, trang_thai, muc_uu_tien) · `KetQuaKham`(appointment_id, hang_doi_id, nguoi_nhap_id, bac_si_phu_trach_id, status, nguoi_xac_nhan_id, thoi_diem_xac_nhan) · `SinhHieuKham`(appointment_id, hang_doi_id, …). Nguồn sự thật: trạng thái lịch = `LichHen.status`; trạng thái hồ sơ = `KetQuaKham.status`.

### 9. API (nurse)
`GET /nurse/dashboard` · `GET /nurse/appointments` (list, q/page/limit) · `GET /nurse/appointments/pending-records` · `GET /nurse/appointments/:id` · `GET /nurse/schedule` · `POST /nurse/medical-records` (createDraft) · `PATCH /nurse/medical-records/:id` (update) · `PATCH …/:id/submit` · `PATCH …/:id/resubmit` · `GET …/revisions` · `POST /nurse/queue/checkin` · `PATCH /nurse/queue/:id/{call,into-room,finish,skip,cancel}` · `GET/PATCH /nurse/room-status`. Điểm tích hợp bác sĩ: `PATCH /doctor/appointments/:id/result/request-revision` (mới, P28).

### 10. State transition (enum thật)
- `LichHen.status`: pending→confirmed→in_progress→waiting_record→waiting_doctor_confirm→completed (+cancelled/no_show/skipped).
- `KetQuaKham.status`: ban_nhap→cho_xac_nhan→da_xac_nhan **hoặc** →yeu_cau_chinh_sua→(sửa)→cho_xac_nhan.
- `HangDoi.trang_thai`: dang_cho→da_goi→trong_phong→hoan_thanh (+skipped/cancelled).

### 11. Kiểm thử (bằng chứng — xem `Bao cao kiem thu toan dien Nurse`)
- ✅ **Đã chạy:** Unit BE `nurse-unit.test.js` **9/9**; Unit FE `nurse.service.test.ts` **9/9**; regression FE 51/54 (3 fail có sẵn, ngoài nurse); build ✅.
- 🧪 **Chưa chạy:** integration (auth/role/ownership/list/detail/check-in/tạo-gửi hồ sơ/yêu cầu sửa/gửi lại/khóa/lặp/không tồn tại) + component FE + E2E — thiếu server + local test DB (Cloud read-only). File test **đã có, sẵn sàng** (`nurse-*.test.js`, `doctor.confirm-result.test.js`). Seed test đã chuẩn bị (PROMPT 29, **chưa chạy**).

### 12. Lỗi đã sửa (tiêu biểu — chi tiết trong docs/Y tá/Bao cao sua *)
- Nurse scope rỗng do dùng `LichHen.nurse_id` (chưa gán) → chuyển sang `LichLamViec.nurse_id` (P18).
- Bug timezone FE (`toISOString` lệch 1 ngày) → dùng ngày local (P21).
- Gửi hồ sơ 2 bảng không nguyên tử → transaction (P25).
- Hồ sơ đã xác nhận vẫn sửa được → khóa FE+BE (P27).
- Luồng revision mồ côi (bác sĩ đã gỡ) → khôi phục producer + nối UI (P28).
- Check-in/into-room/finish ghi 2–3 bảng không nguyên tử → transaction (P28 bổ sung).

### 13. Rủi ro còn lại
- 🧪 **Chưa xác thực live** toàn bộ luồng (unit đã pass; integration/E2E chưa chạy) — rủi ro chính.
- `into-room/finish/check-in` transaction cần replica set (đã verify Atlas hỗ trợ; local test DB phải là replica set để chạy transaction).
- Không realtime → hai trang stale chéo tới khi reload.
- Type-check repo còn 110 lỗi cũ (ngoài nurse) — không chặn build nhưng là nợ kỹ thuật.

### 14. Giới hạn của đồ án
- Không có WebSocket/polling (đồng bộ chéo phải reload thủ công).
- Không có harness component FE (RTL/jsdom) → chưa test render.
- Chạy integration/E2E cần môi trường test riêng (đã thiết kế seed, chưa vận hành).
- Enum `checked_in` còn "chết" (không producer) — giữ trong schema cho dữ liệu cũ.

### 15. Hướng phát triển
- Bật local test DB (replica set) + chạy seed PROMPT 29 → chạy trọn integration + E2E 10 kịch bản.
- Thêm RTL/jsdom cho test component (loading/error/empty/modal/responsive).
- Realtime (WebSocket/polling) để đồng bộ chéo doctor–nurse tức thời.
- Dọn 110 lỗi type-check cũ (ngoài nurse) + gỡ/enable enum `checked_in`.
- Refetch-on-focus tối thiểu trước khi có realtime.

---

## C. BẢNG PHÂN LOẠI TRẠNG THÁI (tổng)
| Trạng thái | Hạng mục |
|---|---|
| ✅ **Đã hoàn thành** | Mock/hardcode sạch · phân quyền route+FE · payment chỉ đọc · loading/error/empty · build · unit test 18/18 · wiring không import chết · các trang chức năng nurse |
| 🟡 **Hoàn thành một phần** | Type-check (nurse sạch, repo còn lỗi cũ) · console (static sạch, runtime chưa kiểm) · test (unit ✅, integration/E2E chưa) |
| 🧪 **Chưa kiểm thử (live)** | Không lộ dữ liệu y tá khác · khóa sau xác nhận · không tạo trùng · đồng bộ doctor–nurse · toàn luồng E2E |
| ⛔ **Chưa hoàn thành** | (không có hạng mục mới bỏ dở; các mục còn lại là "chưa kiểm thử live", không phải "chưa làm") |
| ⬜ **Ngoài phạm vi** | Admin/bệnh nhân · nghiệp vụ bác sĩ (ngoài request-revision) · thanh toán · realtime · đổi schema |

**Kết luận trung thực:** Trang y tá đã hoàn thiện về **code + unit test**; các đảm bảo nghiệp vụ (phân quyền, khóa, đồng bộ, chống trùng) đã **cưỡng chế ở code** nhưng **chưa được xác thực bằng integration/E2E live** do thiếu môi trường test riêng. Không hạng mục nào được tuyên bố "pass" mà chưa chạy.
