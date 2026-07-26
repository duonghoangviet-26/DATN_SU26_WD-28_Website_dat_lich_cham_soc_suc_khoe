# Audit toàn diện chức năng Bác sĩ ↔ Y tá (Senior QA / BA / Solution Architect)

> Ngày: 2026-07-20 · Nhánh `Bac_si` · **Read-only** (không sửa code, không sửa DB). Đối chiếu schema/controller thật.
> Phạm vi: Doctor Page + Nurse Page + liên kết qua Appointment & Medical Record. Không lan sang Admin (trừ điểm giao thoa cần thiết).

---

## 1. Tổng quan

**Đã kiểm tra (theo code thật):** middleware phân quyền, routes doctor/nurse, các controller: `doctor/appointments`, `doctor/stats`, `doctor/leaves`, `nurse/queue`, `nurse/appointments`, `nurse/medical-records`, `nurse/dashboard`; các model `LichHen`, `LichLamViec`, `KetQuaKham`, `HangDoi`, `SinhHieuKham`; util `nurse-scope`. State machine lịch hẹn + luồng hồ sơ/revision doctor↔nurse.

**Mức độ sẵn sàng:** Lõi nghiệp vụ **vững** — phân quyền theo token chặt, scope theo ca đúng, giao dịch nguyên tử ở các điểm nhạy cảm, chống double-confirm/duplicate. Còn **một số lỗ hổng đồng nhất (timezone), nguyên tử hoá cục bộ, hiệu năng danh sách, và 2 bug UI đã sửa trong phiên**. Đủ để **demo/bảo vệ** sau khi lưu ý các mục Medium bên dưới.

**Tỷ lệ hoàn thành luồng chính:** Đặt lịch → check-in → hàng đợi → khám → nhập hồ sơ (y tá) → gửi → bác sĩ xác nhận / yêu cầu sửa → y tá sửa → xác nhận lại: **chạy end-to-end** (đã kiểm chứng bằng dữ liệu thật A1–A8).

---

## 2. Phân tích phạm vi & phân quyền (Giai đoạn 1–2)

### 2.1 Ma trận vai trò

| Chức năng | Doctor | Nurse | Admin | Ghi chú |
|---|---|---|---|---|
| Xem/khám lịch của **chính mình** | ✅ thao tác | — | xem | `doctor_id = getDocId(token)` |
| Xem lịch của **ca được giao hôm nay** | — | ✅ thao tác | xem | `LichLamViec.nurse_id` (today) |
| Check-in / hàng đợi / gọi / vào phòng / kết thúc | — | ✅ | — | `nurse/queue` |
| Nhập/sửa **nội dung** hồ sơ khám | (tự nhập được) | ✅ | — | y tá: `ban_nhap`→gửi |
| **Xác nhận** / **Yêu cầu chỉnh sửa** hồ sơ | ✅ | ❌ | — | chỉ bác sĩ chốt trạng thái |
| Tạo yêu cầu nghỉ | ✅ tạo/hủy(chờ duyệt) | — | ✅ duyệt/từ chối | doctor KHÔNG tự duyệt |
| Quản lý bác sĩ / chuyên khoa / dịch vụ / doanh thu | ❌ | ❌ | ✅ | Dashboard 2 vai trò KHÔNG lộ |

**Kết luận phạm vi:** Không phát hiện chức năng Admin lọt sang trang Doctor/Nurse. Dashboard bác sĩ chỉ thống kê **cá nhân** (không doanh thu toàn hệ thống, không danh sách toàn bộ bác sĩ/bệnh nhân). Dashboard y tá chỉ theo ca của mình.

### 2.2 Kết quả kiểm tra phân quyền / IDOR / Broken Access Control

- **Danh tính lấy từ JWT** (`verifyToken` → `req.user = decoded`), **không** lấy `doctorId`/`nurseId` từ body/params ở bất kỳ endpoint nghiệp vụ nào → **không giả mạo được**. ✅
- `requireRole('doctor')` / `requireRole('nurse')` áp ở **router cha** cho toàn bộ `/api/doctor/*` và `/api/nurse/*`. ✅
- Truy vấn luôn kèm scope: doctor `{_id, doctor_id: docId}`; nurse qua `getMyDoctorIdsToday` + `timEntryTrongCa`/`findEntryInShift` (403 nếu ngoài ca). ✅ Không đọc được dữ liệu bác sĩ/y tá khác.
- **Mass assignment:** các controller **pick field cụ thể** từ `req.body` (không `...req.body`) → không set bừa `status`/`doctor_id`. ✅
- **Trust boundary trạng thái:** các bước chốt (confirm/requestRevision/submit) đọc **status tươi trong transaction**, không tin FE. ✅

> Đánh giá bảo mật lõi (Giai đoạn 17): **Tốt**. Không thấy IDOR, privilege escalation hay mass assignment ở luồng doctor/nurse.

---

## 3. Danh sách lỗi & rủi ro

> Định dạng: ID · Chức năng · Mô tả · Tái hiện · Mong đợi · Thực tế · Mức độ · Ảnh hưởng · Nguyên nhân · Hướng xử lý (không sửa code ở đây).

### BUG-01 — [ĐÃ SỬA trong phiên] Trang "Hồ sơ cần chỉnh sửa" (Y tá) hỏng nút Chỉnh sửa
- **Mô tả:** API `GET /nurse/medical-records/revisions` không trả `appointment_id` (và `ngay_kham`/`bac_si_yeu_cau`/`ly_do_kham`) mà FE cần.
- **Tái hiện:** Y tá có hồ sơ `yeu_cau_chinh_sua` → mở trang → bấm "Chỉnh sửa hồ sơ".
- **Mong đợi:** điều hướng `/nurse/appointments/<id>`. **Thực tế (trước fix):** `/nurse/appointments/undefined`.
- **Mức độ:** High (chặn khép vòng revision). **Nguyên nhân:** lệch contract BE↔FE. **Xử lý:** đã bổ sung projection (commit trước).

### BUG-02 — [ĐÃ SỬA trong phiên] Dashboard bác sĩ trắng trang khi ca có y tá
- **Mô tả:** BE trả `y_ta_ho_tro` là object `{id, ho_ten}`, FE render thẳng object → React crash.
- **Tái hiện:** ca hôm nay đã gán y tá → vào `/doctor`. **Thực tế:** trắng trang. **Mong đợi:** hiện tên y tá.
- **Mức độ:** Critical (crash toàn trang). **Nguyên nhân:** type/comp coi `y_ta_ho_tro` là `string`. **Xử lý:** đã sửa type + render `?.ho_ten` (commit `c7f397f`).

### BUG-03 — Lệch "hôm nay" giữa Dashboard bác sĩ (giờ VN) và Hàng đợi/Scope (giờ UTC)
- **Mô tả:** `doctor/stats.getTodayOverview` tính "hôm nay" theo **VN (+7)** (`startOfTodayVN`), nhưng `doctor.examQueue`, `nurse-scope`, `nurse/dashboard`, `nurse/appointments` tính bằng `setHours(0,0,0,0)` dưới `TZ=UTC` → **ngày UTC**. Code tự ghi nhận (GAP-002) nhưng chỉ sửa ở stats.
- **Tái hiện:** thao tác trong khung **00:00–06:59 giờ VN**. **Thực tế:** dashboard đếm theo ngày VN trong khi hàng đợi/scope theo ngày UTC (lệch 1 ngày) → số liệu vênh, y tá có thể "mất ca"/thấy trống dù đã được phân công.
- **Mức độ:** Medium (chỉ lộ rạng sáng; ban ngày demo không ảnh hưởng). **Ảnh hưởng:** dữ liệu không nhất quán giữa các màn hình. **Hướng xử lý:** thống nhất 1 hàm tính "ngày làm việc" (VN) cho **tất cả** controller doctor/nurse, không trộn `setHours` UTC với `startOfTodayVN`.

### BUG-04 — `createResult` / `createDraft` không nguyên tử (record + đơn thuốc/sinh hiệu)
- **Mô tả:** `doctor.createResult` tạo `KetQuaKham` rồi `DonThuoc.create` rồi `LichHen.save` **tuần tự, không transaction**; `nurse.createDraft` tạo `KetQuaKham` rồi `upsertVitals` ngoài transaction. Các điểm khác (submit/requestRevision/checkin/intoRoom/finish) **có** dùng transaction → không đồng nhất.
- **Tái hiện:** lỗi/timeout ở bước 2 (tạo đơn thuốc/sinh hiệu) sau khi đã tạo hồ sơ.
- **Mong đợi:** rollback cả cụm. **Thực tế:** hồ sơ tồn tại nhưng thiếu đơn thuốc/sinh hiệu, hoặc lịch chưa `completed` → trạng thái nửa vời.
- **Mức độ:** Low–Medium (đơn thuốc/sinh hiệu là optional). **Hướng xử lý:** bọc transaction cho nhất quán với các luồng còn lại.

### BUG-05 — Danh sách lịch hẹn bác sĩ không phân trang + N+1 query
- **Mô tả:** `GET /doctor/appointments` (`list`) trả **toàn bộ** lịch của bác sĩ, mỗi item gọi `formatAppointment` = **3 truy vấn DB** (user + member + KetQuaKham) → 3·N truy vấn. `doctor.examQueue` cũng không phân trang. (Nurse `listQueue` thì CÓ phân trang.)
- **Tái hiện:** bác sĩ nhiều lịch (vd đã thấy 1 bác sĩ có 158 ngày lịch, 24+ lịch hẹn) → tải chậm dần theo thời gian.
- **Mức độ:** Medium (hiệu năng/khả năng mở rộng). **Hướng xử lý:** thêm pagination + gộp truy vấn (populate/`$in` thay vì N lần findOne).

### BUG-06 — Bất đối xứng scope khi Y tá nhập hồ sơ (today) vs xem lịch (theo ngày)
- **Mô tả:** `nurse.createDraft` chặn theo **ca HÔM NAY** (`getMyDoctorIdsToday`), trong khi xem chi tiết lịch (`nurse/appointments.getById`) chặn theo **ngày của lịch** (`getMyDoctorIdsOnDate`). Sửa/gửi lại hồ sơ (`update`/`resubmit`) lại chặn theo **tác giả** (`nguoi_nhap_id`).
- **Ảnh hưởng:** 3 tiêu chí scope khác nhau cho cùng một nghiệp vụ hồ sơ → khó suy luận, tiềm ẩn "xem được nhưng không tạo được" với lượt khám ngoài ngày hôm nay. Thực tế hồ sơ thường nhập trong ngày nên **ít lộ**.
- **Mức độ:** Low. **Hướng xử lý:** thống nhất quy tắc scope (khuyến nghị: theo ngày của lượt khám cho create, theo tác giả cho edit — và ghi rõ trong spec).

### BUG-07 — Validate input nhẹ ở `list` (doctor)
- **Mô tả:** `status`/`date` trên `GET /doctor/appointments` không được validate (status tuỳ ý; `new Date(date)` không hợp lệ → NaN range → rỗng).
- **Mức độ:** Low. **Hướng xử lý:** whitelist `status` theo enum + kiểm tra ngày hợp lệ, trả 400 nếu sai (nhất quán với `listPendingResults` đã whitelist).

---

## 4. Lỗ hổng nghiệp vụ & phân tích tình huống (Giai đoạn 7–9, 14, 18)

### 4.1 State machine lịch hẹn — điểm cần biết
Trạng thái: `pending → confirmed → (checked_in) → in_progress → waiting_record → waiting_doctor_confirm → completed`; nhánh `cancelled/no_show/skipped`.
- **Bác sĩ được phép "đi tắt":** `complete()` từ `confirmed/in_progress/waiting_record`; `createResult()` từ `confirmed` → hồ sơ `da_xac_nhan` + lịch `completed` **bỏ qua** hàng đợi/y tá. → **Có chủ đích** (bác sĩ tự phục vụ khi không có y tá), **không phải bug**, nhưng nghĩa là luồng "bắt buộc qua y tá" **không được cưỡng chế**. Cần nêu rõ khi bảo vệ để tránh thầy hỏi "sao bỏ qua bước".
- **Không quay ngược sai:** `da_xac_nhan` bị khóa (updateResult 403; nurse.update 409). Muốn sửa phải qua "yêu cầu chỉnh sửa". ✅
- **Đồng bộ lịch↔hồ sơ nguyên tử:** submit (nurse) và requestRevision (doctor) dùng transaction cập nhật cả `KetQuaKham` và `LichHen`. ✅

### 4.2 Trả lời các câu hỏi tình huống (Giai đoạn 14)
| Tình huống | Kết quả hệ thống | Đánh giá |
|---|---|---|
| Bệnh nhân không đến | `no_show` + `trang_thai_den='khong_den'` (dashboard loại khỏi "cần tiếp nhận") | ✅ |
| Y tá chưa nhập hồ sơ | lịch ở `waiting_record`, hiện ở "Hồ sơ cần nhập" (`giai_doan=chua_tao`) | ✅ |
| Bác sĩ xác nhận 2 lần | lần 2 → 409 "chỉ xác nhận hồ sơ đang chờ" | ✅ chống |
| 2 y tá cùng sửa 1 hồ sơ | chỉ **tác giả** (`nguoi_nhap_id`) sửa được; y tá khác → 404 | ✅ chống (nhưng **không có optimistic-lock** nếu cùng tài khoản mở 2 tab — last-write-wins) |
| Gửi xác nhận nhiều lần / submit đồng thời | transaction + kiểm status tươi → 1×200, còn lại 409/WriteConflict-retry | ✅ |
| Bác sĩ nghỉ giữa ca | tạo `NghiPhepBacSi='cho_duyet'`; **KHÔNG** tự khóa slot/hủy lịch (Admin xử lý khi duyệt) | ✅ đúng phạm vi (nhưng lịch hẹn hiện có **chưa** được cảnh báo tự động cho tới khi Admin duyệt) |
| Hồ sơ đã hoàn thành/đang sửa | `da_xac_nhan` khóa; `yeu_cau_chinh_sua` chỉ tác giả sửa | ✅ |
| Token hết hạn giữa chừng | 401 "Token không hợp lệ/đã hết hạn" → FE cần bắt & điều hướng login | ✅ BE; ⚠️ kiểm tra FE có refresh/redirect mượt không |

### 4.3 Revision — mất dữ liệu/lịch sử? (Giai đoạn 9)
- `doctor_revision_note` (lý do mới nhất) + `lich_su_sua[]` (mảng lịch sử, có `nguoi_sua_id`, thời điểm, nội dung) được **push thêm**, không ghi đè → **không mất lịch sử** ở phía bác sĩ. ✅
- ⚠️ **Quan sát:** khi **y tá sửa** hồ sơ `yeu_cau_chinh_sua` (`nurse.update`), hệ thống **không** thêm bản ghi vào `lich_su_sua` (chỉ bác sĩ mới push). → Lịch sử **thiếu dấu vết lần y tá chỉnh** (không mất dữ liệu nội dung, nhưng **thiếu audit-trail** thao tác của y tá). Mức Low — nên bổ sung để đối chiếu đầy đủ.

---

## 5. Đánh giá UI/UX & Code (Giai đoạn 11, 15, 16) — mức tổng quan

- **UI:** BUG-02 (crash) đã xử lý. Nên rà thêm mọi chỗ FE render trực tiếp field có thể là **object/null** trả từ BE (bài học từ `y_ta_ho_tro`). Empty/error/loading state có ở các trang chính (Dashboard, Revisions).
- **UX luồng revision:** khép vòng hợp lý (doctor yêu cầu sửa → y tá thấy ở "Hồ sơ cần chỉnh sửa" → sửa → gửi lại). Sau BUG-01 fix thì mượt.
- **Code:** phân tầng route→controller rõ; response chuẩn `{success,message,data}`; transaction ở điểm nhạy cảm; comment nghiệp vụ dày (dễ bảo vệ). Điểm trừ: **N+1** ở `formatAppointment`, thiếu pagination phía doctor, và **~110 lỗi type có sẵn** (`mock/doctor-appointments.ts`, `client/Profile.tsx`, `types/index.ts` trùng identifier) — không chặn runtime nhưng nên dọn.

---

## 6. Kiểm tra Database (Giai đoạn 13) — chỉ đọc

- **Khóa duy nhất chống trùng/mồ côi:** `KetQuaKham` unique sparse theo `appointment_id` và `hang_doi_id`; `HangDoi` unique sparse `appointment_id`; `SinhHieuKham` tương tự → chống 2 hồ sơ/1 lượt. ✅
- **Quan hệ:** `LichHen.nurse_id` chỉ là **metadata lịch sử** (nurse-scope KHÔNG dùng) — đúng như comment; scope thật qua `LichLamViec.nurse_id`. Cần nhớ điểm này khi giải thích với thầy.
- **Rủi ro mồ côi còn lại:** đơn thuốc/sinh hiệu tạo ngoài transaction (BUG-04) — mồ côi cục bộ khi lỗi giữa chừng. Đơn thuốc rỗng được xóa chủ động (không để mồ côi khi sửa). ✅ phần lớn.
- Không thực hiện thay đổi dữ liệu nào trong audit này.

---

## 7. Đánh giá tổng thể & ưu tiên trước nghiệm thu

**Trang Bác sĩ:** đúng nghiệp vụ, phân quyền chặt, xác nhận/yêu-cầu-sửa nguyên tử. Trừ BUG-02 (đã sửa), còn lại là hiệu năng (BUG-05) và đồng nhất timezone (BUG-03).

**Trang Y tá:** đúng phạm vi ca, không lẫn admin. Trừ BUG-01 (đã sửa), còn lại là đồng nhất scope (BUG-06) và audit-trail khi y tá sửa (mục 4.3).

**Phối hợp Doctor ↔ Nurse:** luồng hồ sơ + revision **thông suốt** và **nguyên tử** ở các điểm chốt — đây là điểm mạnh để demo.

**Ưu tiên xử lý:**
1. **(Đã xong)** BUG-01, BUG-02 — chặn crash & khép vòng revision.
2. **Medium:** BUG-03 (timezone thống nhất) nếu có khả năng demo/chạy rạng sáng; BUG-05 (pagination + gộp query) nếu dữ liệu lớn.
3. **Low:** BUG-04 (transaction hoá), BUG-06 (thống nhất scope), BUG-07 (validate input), audit-trail lần y tá sửa, dọn lỗi type có sẵn.

> Ghi chú: Báo cáo chỉ đọc code/DB, **không sửa gì** (ngoài 2 bug BUG-01/02 đã sửa & commit ở các bước trước theo yêu cầu trực tiếp của người dùng). Giai đoạn 5 (Schedule sâu) có tài liệu chuyên biệt sẵn trong `docs/doctor-schedule-*` và `docs/Y tá/*` — nên đối chiếu thêm nếu cần trọn vẹn.
