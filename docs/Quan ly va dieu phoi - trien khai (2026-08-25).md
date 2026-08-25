# Gộp "Quản lý và điều phối" — triển khai (2026-08-25)

> Kế hoạch: `docs/superpowers/plans/2026-08-25-quan-ly-va-dieu-phoi.md`
> Thiết kế: `docs/superpowers/specs/2026-08-25-quan-ly-va-dieu-phoi-design.md` (local-only)
> Ledger đầy đủ (mọi review, mọi fix round, mọi phát hiện): `.superpowers/sdd/2026-08-25-quan-ly-va-dieu-phoi/progress.md`

## 1 · Tóm tắt

2 mục menu lễ tân cũ ("Điều phối bác sĩ" + "Điều phối lịch hẹn") gộp thành 1 trang 2 tab
tại `/receptionist/quan-ly-dieu-phoi`, kèm 6 sửa lỗi/bổ sung backend đi cùng. Thực thi
theo mô hình subagent-driven development: 13 task tuần tự (6 backend, 7 frontend), mỗi
task có review riêng trước khi sang task kế — xem bảng mục 2.

**Toàn bộ 13 task được thực thi trong môi trường job nền (background-job), KHÔNG có
trình duyệt và KHÔNG có dev server đang chạy.** Mọi task tự khai báo rõ điều này trong
report của mình. Xem mục 3 "Kiểm thử tay" — đây là giới hạn thật, không phải sơ suất bỏ
sót ghi chép.

## 2 · Task 1–13 → file bị đổi → tóm tắt

| Task | File chính | Tóm tắt |
|---|---|---|
| 1 | `doctorLeaveApproval.service.js`, `receptionist/appointment.controller.js`, `receptionist/doctor-leaves.controller.js`, `admin/doctor-leaves.controller.js` | Hợp nhất `reportDoctorUnavailable` với `duyetDonNghi` — trước đó là 2 bản cài đặt song song vi phạm nguyên tắc mục 7; xoá 3 hàm trùng lặp, thêm `actorRole` + ghi `LichSuLichHen` |
| 2 | `admin/reschedule-approval.controller.js` (`danhSachDonNghiConViec`), `receptionist-reschedule-approvals.service.ts` | Lọc đơn `da_huy` khỏi danh sách điều phối, thêm bộ lọc còn việc/đã xong, thêm `han_phan_hoi_som_nhat` |
| 3 | `admin/reschedule-approval.controller.js` (`tongQuanTheoDonNghi`) | Thêm `so_slot_da_khoa` + `so_khong_co_cho_da_xu_ly` vào tổng quan một đơn nghỉ |
| 4 | `receptionist/booking.controller.js` (`getDoctorDayOverview`), `receptionist-booking.service.ts` | Thêm số lịch tồn (`so_lich_chua_xu_ly`/`so_lich_anh_huong`) vào lịch bác sĩ trong ngày |
| 5 | `rescheduleRules.js` (`demSlotSeKhoa`), `doctorLeaveApproval.service.js` (`demAnhHuongCuaDonNghi`), `receptionist/appointment.controller.js` + `appointment.routes.js` (route mới), `receptionist/doctor-leaves.controller.js` | API xem trước ảnh hưởng (số lịch/slot bị khoá) trước khi báo nghỉ đột xuất |
| 6 | `appointmentReschedule.service.js` (`guiThongBaoDeXuat`) | Ghi việc "cần liên hệ tay" (`NhatKyThaoTac`) khi không tìm được phương án dời nào — trước đó nhóm 0-phương-án bị bỏ sót hoàn toàn khỏi `/contact-tasks` |
| 7 | `ReceptionistUI.tsx`, `utils/dieuPhoiHelpers.ts` (mới) | Component dùng chung `Tabs` + `ProcessBar` (thanh quy trình), 2 hàm thuần `xepBuocQuyTrinh`/`dinhDangDemNguoc` |
| 8 | `Sidebar.tsx`, `AppRoutes.tsx`, `pages/receptionist/QuanLyDieuPhoi.tsx` (mới) | Gộp menu, định tuyến `/receptionist/quan-ly-dieu-phoi` (vỏ trang, nội dung thật ở Task 9–11) |
| 9 | `DoctorDayView.tsx`, `utils/dieuPhoiHelpers.ts`, `__tests__/utils/dieuPhoiHelpers.test.ts` | Tab 1 "Lịch bác sĩ": gỡ panel khách vãng lai, dựng lại thẻ bác sĩ 4 trạng thái (`xepTrangThaiTheBacSi`) |
| 10 | `DoctorUnavailableModal.tsx` | Preview 2 nhịp khi báo nghỉ (gọi API Task 5 trước khi submit, khoá input trong lúc tải) + đổi màu nút xác nhận (orange → rose) |
| 11 | `DanhSachDieuPhoi.tsx` | Tab 2 "Điều phối lịch hẹn": bộ lọc còn việc/đã xong + đếm ngược hạn phản hồi |
| 12 | `DieuPhoiLichHen.tsx`, `DieuPhoiRow.tsx` | Trang con: breadcrumb + `ProcessBar`, nạp cả đơn `da_huy` (hiển thị không tương tác), nhóm "không có chỗ" dùng số liệu Task 3 |
| 13 | `DoctorDayView.tsx` (rà nút còn sót), `ConfirmRestoreModal.tsx` | Chuẩn hoá màu/kích cỡ còn lại (`min-h-10` → `min-h-11` khớp cụm modal) |

## 3 · Kiểm chứng

### 3.1 · Backend — `npm test`

Chạy thật nhiều lần trong suốt quá trình (mỗi task backend chạy trước/sau khi sửa).
Baseline trước Task 1 (từ report Task 1): **180 test, 175 pass, 5 fail** (5 fail đã tồn
tại từ trước, không liên quan tới plan này).

Task 1 thêm `backend/tests/doctor-leave-approval.test.js` (5 case mới, tất cả pass) →
**185 test, 180 pass, 5 fail**. Task 5 force-add `backend/tests/reschedule-rules.test.js`
vào git (26 test, tất cả pass — file này bị `.gitignore` dòng 34 chặn từ commit đầu tiên
`4af390a`, xem `.superpowers/sdd/2026-08-25-quan-ly-va-dieu-phoi/progress.md` mục Task 5)
→ **189 test, 184 pass, 5 fail**. Con số này giữ nguyên từ Task 6 tới hết Task 13 (không
task nào sau đó thêm file test backend mới) — xác nhận lại lần cuối trong report Task 6:

```
# tests 189
# pass 184
# fail 5
```

**5 fail là pre-existing** — đã tồn tại từ trước khi bắt đầu Task 1, không liên quan tới
phạm vi kế hoạch này, không có fail mới phát sinh từ 13 task.

### 3.2 · Frontend — `npx vitest run`

Baseline trước Task 1 (qua Task 7, trước khi Task 7 thêm test): **16 file, 61 test pass**.
Task 7 thêm test cho `dieuPhoiHelpers.ts` → **17 file, 69 test pass**. Giữ nguyên qua Task
8. Task 9 thêm 5 test cho `xepTrangThaiTheBacSi` → **17 file, 74 test pass**. Giữ nguyên
**74/74** qua Task 10, 11, 12, 13 (xác nhận lại độc lập trong từng report, và review Task
12 tự chạy lại tái xác nhận, không chỉ tin theo report).

### 3.3 · Frontend — `npm run typecheck`

Baseline (3 lỗi pre-existing, không liên quan cụm receptionist): `ManageDoctorLeaves.tsx:218`
(`maxWidth` không có trên `ModalProps`), `DoctorProfile.tsx:245,952` (tương tự + field
`chuc_danh` không có trong `ProfileUpdateData`).

Task 8 tạo `QuanLyDieuPhoi.tsx` với 2 prop `embedded` chưa tồn tại trên `DoctorDayView`/
`DanhSachDieuPhoi` (cố ý — kiểu "stub" chờ Task 9/11 nối dây) → tạm thời **5 lỗi** (3
pre-existing + 2 stub). Task 9 thêm prop `embedded` thật cho `DoctorDayView` → **4 lỗi**.
Task 11 thêm prop `embedded` thật cho `DanhSachDieuPhoi` → **3 lỗi** — đúng bằng baseline
pre-existing, không còn lỗi nào của plan này. Giữ nguyên 3 lỗi đó qua Task 12, 13 (Task 13
xác nhận bằng `git stash` rồi chạy lại typecheck — ra cùng 3 lỗi y hệt, chứng minh chúng
độc lập với thay đổi của plan).

### 3.4 · Kiểm thử tay — CHƯA THỰC HIỆN

**Không có bước kiểm thử tay bằng trình duyệt nào được thực hiện cho bất kỳ task nào
trong 13 task.** Toàn bộ kế hoạch được thực thi trong môi trường subagent/job nền: không
có trình duyệt, không có dev server đang chạy, không có tài khoản đăng nhập đã seed sẵn.
Mỗi implementer đều tự khai báo rõ điều này trong report của mình (không có report nào
ghi "đã kiểm thử tay" mà thực ra chưa làm).

Theo đúng quy ước của dự án (không ghi "đã sửa"/"đạt" cho việc chưa thực sự kiểm chứng),
danh sách dưới đây liệt kê CHÍNH XÁC những gì KHÔNG được kiểm chứng qua trình duyệt thật —
đây là việc còn tồn đọng, cần một người thật chạy qua trước khi merge/deploy nhánh
`Fix_demo`:

1. **Task 1, Step 9 (ưu tiên cao nhất — chạm luồng tiền)**: kịch bản merge
   `reportDoctorUnavailable`/`duyetDonNghi` — báo nghỉ một khung đã có khách đã thanh
   toán → tự sinh phương án → khoá slot → ghi `LichSuLichHen` → hình dạng response đúng
   cho luồng lễ tân. Review tĩnh (đọc code, đối chiếu brief, grep các call site) xác nhận
   code đúng, nhưng đây chỉ là xác nhận tĩnh — chưa có xác nhận runtime E2E. Vì đây là
   logic liên quan trực tiếp tới tiền của khách (rule mục 5/14/15 trong
   `.claude/rules/lich-lam-viec-bac-si.md`), một bug wiring runtime (nếu có) sẽ không bị
   phát hiện cho tới khi có người chạy dev server thật.
2. Modal báo nghỉ (`DoctorUnavailableModal.tsx`, Task 10) — preview 2 nhịp: gọi API xem
   trước ảnh hưởng, hiển thị số liệu đúng, khoá input trong lúc đang tải, rồi mới submit
   thật.
3. Trang `/receptionist/quan-ly-dieu-phoi` — Tab 1 "Lịch bác sĩ" (Task 9): 4 trạng thái
   thẻ bác sĩ hiển thị đúng, panel khách vãng lai đã gỡ không còn dấu vết.
4. Tab 2 "Điều phối lịch hẹn" (Task 11): mặc định tab "Còn việc", chuyển tab "Đã xong",
   trường hợp quá hạn phản hồi hiển thị đỏ + nút "Xử lý ngay".
5. Trang con `/receptionist/dieu-phoi/:leaveId` (Task 12): breadcrumb, `ProcessBar` theo
   đúng bước, đơn `da_huy` hiển thị mờ/không tương tác được, nhóm "không có chỗ" đúng số
   liệu Task 3.
6. Rào chắn `beforeunload` (Task 12 Step 5) khi còn `so_cho_duyet > 0` — xác nhận dialog
   xác nhận rời trang thật sự hiện ra, và không chặn nhầm khi đã xử lý xong.
7. `ConfirmRestoreModal.tsx` (Task 13) — thay đổi chiều cao nút 4px (`min-h-10` →
   `min-h-11`) khớp thị giác với 3 modal khác trong cụm. (Đây cũng là mục "minor deferred"
   duy nhất của Task 13 trong ledger — không lặp lại thành một dòng riêng ở §4, đã gộp vào
   đây.)

## 4 · Các phát hiện phụ (deferred minor) — chưa sửa, không chặn merge

Trích từ ledger đầy đủ (`.superpowers/sdd/2026-08-25-quan-ly-va-dieu-phoi/progress.md`),
liệt kê để làm tài liệu tham chiếu "còn gì chưa xong":

- **Task 2**: `idsCanLay` trộn lẫn kiểu `ObjectId`/`string` giữa 2 nhánh `con_viec`/
  `da_xong` trong `danhSachDonNghiConViec` — không ảnh hưởng đúng-sai (Mongo/Mongoose ép
  kiểu như nhau trong `$in`), chỉ là dọn style cho một đợt sau.
- **Task 5**: `demAnhHuongCuaDonNghi` đếm thiếu bệnh nhân ở trạng thái `cho_dich_vu` trong
  `so_da_checkin` — ảnh hưởng thấp (chỉ là con số xem trước, không dùng để ra quyết định
  khoá slot); hàm này cũng chưa có test tự động (chạm DB, đúng quy ước file chỉ test hàm
  thuần).
- **Task 6**: còn race TOCTOU hẹp trong guard `findOne`-trước-`create` khi 2 đơn nghỉ chạm
  cùng lịch hẹn ở đúng cùng một thời khắc (khác với chạy tuần tự) — cửa sổ đã hẹp hơn
  trước khi vá, sửa tiếp cần unique index mới mà Global Constraints của plan cấm thêm.
  Đánh đổi được chấp nhận.
- **Task 7**: `TabItem`/`TabsProps` không được export từ `ReceptionistUI.tsx` — chưa cần
  vì chưa ai import theo tên, nhưng có thể cần export nếu task sau muốn dùng type theo
  tên thay vì literal inline.
- **Task 8**: `QuanLyDieuPhoi.tsx` và `Sidebar.tsx` mỗi nơi tự gọi API lấy cùng 1 số badge,
  không chia sẻ cache — đúng như code mẫu trong chính brief, không phải lỗi implementer.
- **Task 9**: tham số `trang_thai_ngay` của `xepTrangThaiTheBacSi` chưa dùng tới (cố ý,
  brief yêu cầu vậy, có test bao phủ); các chuỗi ternary màu/nhãn badge trong
  `DoctorDayView` có thể gom thành bảng tra cứu — đã cờ cho Task 13 nhưng Task 13 không xử
  lý phần này (nằm ngoài phạm vi được giao cho Task 13).
- **Task 11**: `DanhSachDieuPhoi` tự lặp lại markup `PageShell` thay vì import dùng chung
  (2 nguồn sự thật); hình dạng prop `embedded` khác cấu trúc so với cách Task 9 làm ở
  `DoctorDayView` (có thể là cách làm tốt hơn — tránh bọc đôi — nhưng không nhất quán);
  nhãn tab không hiện số đếm inline như mockup thiết kế (brief không yêu cầu điều này).
- **Task 12**: callout "Mở Liên hệ bệnh nhân" dùng thẻ `<a>` thường thay vì `<Link>` của
  router — gây tải lại trang đầy đủ và có thể kích hoạt nhầm dialog xác nhận
  `beforeunload` khi `so_cho_duyet > 0` (đây là code gốc trong brief, không phải
  implementer tự thêm); dòng đơn `da_huy` không được làm mờ toàn dòng như mô tả trong
  brief (chỉ mờ ở cấp ô, không phải cả hàng) — không ảnh hưởng chức năng.

## 5 · Chưa làm

- Kiểm thử tay bằng trình duyệt cho toàn bộ 7 kịch bản ở mục 3.4 — đặc biệt kịch bản #1
  (Task 1 Step 9), vì đây là logic chạm tiền của khách.
- Sửa `.gitignore` dòng 34 (chặn thư mục `tests` ở mọi cấp) — phát hiện phụ trong Task 5,
  nằm ngoài phạm vi task này, không rõ ảnh hưởng lan rộng tới đâu nếu sửa, để lại như một
  việc cần một đợt riêng.
- Các phát hiện phụ (deferred minor) ở mục 4 — không chặn merge nhưng chưa có ai xử lý.
