# Đồng bộ hai chiều: Lịch làm việc ↔ Xin nghỉ (Prompt 5 — Review, KHÔNG sửa code)

> Ngày: **2026-07-14**. Chế độ **chỉ đọc**. Xem tổng quan ở `doctor-schedule-logic-review.md`.
> Kết luận runtime chưa chạy lại: đánh dấu **[cần kiểm chứng động]**.

## 1. Sơ đồ nguồn dữ liệu

```
        ┌─────────────────────────┐        ┌──────────────────────────┐
        │  LichLamViec (lich_lam_ │        │ NghiPhepBacSi            │
        │  viec)                   │        │ (nghi_phep_bac_si)       │
        │  slots[].status          │        │ trang_thai: cho_duyet/   │
        │  trang_thai_ngay         │        │  da_duyet/tu_choi/da_huy │
        │  bi_khoa_boi_nghi_phep ← │        │ tu_ngay/den_ngay/gio_*   │
        │  nghi_phep_id          ← │  (cờ ĐÃ CÓ trong model nhưng    │
        └───────────┬─────────────┘   KHÔNG được luồng duyệt ghi)   │
                    │                  └────────────┬─────────────────┘
                    │ KHÔNG có khóa ngoại 2 chiều   │
                    │ (chỉ khớp theo bác sĩ+ngày+giờ)│
          ┌─────────┴───────────────────────────────┴─────────┐
          │  Đồng bộ hiển thị CHỈ ở FRONTEND                    │
          │  DoctorSchedule.tsx: getAll() + list()             │
          │  → findCoveringLeave(slot, leaves)  (chỉ slot active)│
          └────────────────────────────────────────────────────┘
```

**Kết luận nguồn dữ liệu:**
- Mỗi trang đọc nguồn riêng: **Lịch làm việc** đọc `LichLamViec`; **Xin nghỉ** đọc `NghiPhepBacSi`.
- **Không** có endpoint backend tổng hợp "slot + trạng thái nghỉ của slot". Việc ghép do FE tự làm.
- Cờ liên kết `slot.nghi_phep_id` / `bi_khoa_boi_nghi_phep` **tồn tại trong schema** nhưng **không nơi nào trong luồng duyệt nghỉ ghi vào** (chỉ Admin slots-editor có thể set thủ công). → **cờ "chết"** với luồng nghỉ phép.

## 2. API liên quan

| Nghiệp vụ | FE gọi | BE xử lý | Collection đọc/ghi | Trang dùng |
|---|---|---|---|---|
| Danh sách lịch | `GET /doctor/schedule` | `getSchedules` | đọc `LichLamViec`,`LichHen`(populate) | Lịch làm việc |
| Chi tiết ca | `GET /doctor/schedule/:id` | `getScheduleDetail` | đọc `LichLamViec`,`LichHen` | Lịch làm việc (modal) |
| Yêu cầu hủy slot | `POST .../request-cancel` | `requestCancelSlot` | ghi `LichLamViec.slots.cancel_requested` | Lịch làm việc |
| Danh sách đơn nghỉ | `GET /doctor/leaves` | `listMyLeaveRequests` | đọc `NghiPhepBacSi` | Cả 2 trang |
| Tạo đơn nghỉ | `POST /doctor/leaves` | `createLeaveRequest` | ghi `NghiPhepBacSi` (+đếm `LichHen`) | Cả 2 trang |
| Rút đơn nghỉ | `PATCH /doctor/leaves/:id/cancel` | `cancelLeaveRequest` | ghi `NghiPhepBacSi.trang_thai` | Xin nghỉ (+ Lịch qua findCoveringLeave) |
| Admin duyệt/từ chối | (admin) | `approveDoctorLeave`/`rejectDoctorLeave` | ghi **CHỈ** `NghiPhepBacSi` | Admin |
| Đặt lịch bệnh nhân | `GET /patient/booking/doctors/:id/slots` | `getSlots` | đọc `LichLamViec` (**KHÔNG** đọc nghỉ phép) | Bệnh nhân |

## 3. Bảng hành động → hiển thị kỳ vọng vs thực tế

| Hành động | Trang thực hiện | DB thay đổi | Lịch làm việc PHẢI hiện | Xin nghỉ PHẢI hiện | Thực tế |
|---|---|---|---|---|---|
| Gửi yêu cầu (từ Lịch) | Lịch | tạo `NghiPhepBacSi` cho_duyet (theo khung giờ slot) | Nhãn "Chờ duyệt", ẩn nút gửi | Đơn mới cho_duyet | ✅ (Lịch gọi `loadLeaves()` sau gửi; Xin nghỉ refetch khi mở) |
| Gửi yêu cầu (từ Xin nghỉ) | Xin nghỉ | tạo `NghiPhepBacSi` cho_duyet | Nhãn "Chờ duyệt" trên slot phủ | Đơn mới đầu danh sách | ✅ **sau khi Lịch remount/refetch** (không realtime) |
| Rút đơn (Xin nghỉ) | Xin nghỉ | trang_thai=da_huy | Bỏ nhãn, hiện lại nút gửi | Trạng thái "Đã hủy", ẩn nút hủy | ✅ sau refetch |
| Rút đơn (từ Lịch) | — | — | — | — | ❌ **Không có nút rút trên Lịch** (chỉ có ở Xin nghỉ) |
| Admin **duyệt** | Admin | **CHỈ** trang_thai=da_duyet | Ca hiện "nghỉ", KHÔNG như ca hoạt động, KHÔNG cho đặt | "Đã duyệt" + ghi chú | ⚠ **Sai**: slot vẫn `active`, ngày vẫn `lam_viec`; FE chỉ hiện nhãn per-slot; **bệnh nhân vẫn đặt được** [cần kiểm chứng động] |
| Admin **từ chối** | Admin | trang_thai=tu_choi | Ca về bình thường | "Từ chối" + ghi chú | ✅ (đúng — vì duyệt vốn không đổi slot nên "khôi phục" là không cần) |
| Admin xử lý ca có lịch hẹn | Admin | — | Hiện lịch hẹn bị ảnh hưởng, chỉ-đọc | — | ⚠ Không có luồng riêng; lịch hẹn không tự đổi khi duyệt nghỉ |

## 4. Kiểm tra 10 câu hỏi đồng bộ (mục VII đề bài)

1. **Hai trang dùng chung nguồn?** Chung ở chỗ cả hai gọi `GET /doctor/leaves`; nhưng trạng thái ca lấy từ `LichLamViec` riêng. → **Một phần**.
2. **Mỗi trang tự lưu trạng thái riêng?** Có — không có store toàn cục (không React Query/Redux); mỗi component tự `useState` + refetch on mount.
3. **Dữ liệu trùng lặp?** Không trùng lưu trữ; nhưng **trạng thái nghỉ phải suy ra 2 lần** (FE Lịch tự đối chiếu; Admin tự cập nhật lịch tay).
4. **Xin nghỉ đã cập nhật nhưng Lịch chưa?** Có thể — nếu bác sĩ đang mở Lịch, thao tác ở Xin nghỉ (tab khác) không đẩy sang Lịch cho tới khi remount/refetch.
5. **Cần reload để thấy?** Có, ở mức chuyển trang (remount) hoặc sau thao tác cùng trang (Lịch tự `loadLeaves()`).
6. **Cache cũ?** Không có lớp cache riêng; axios không cache. "Cũ" chỉ do state RAM chưa refetch.
7. **Invalidate/refetch sau thao tác?** Lịch: có (`loadLeaves()` sau gửi nghỉ; `setSlots` optimistic sau request-cancel). Xin nghỉ: cập nhật state cục bộ sau create/cancel. **Không** invalidate chéo trang.
8. **Dùng sự kiện/state toàn cục?** Không.
9. **Race condition?** Lịch có `AbortController` hủy request cũ khi đổi tuần nhanh (tốt). Không thấy race ghi.
10. **Một trang PENDING nhưng trang kia vẫn hiện nút gửi?** Trong cùng trang Lịch: không (findCoveringLeave ẩn nút). Giữa 2 trang trước khi refetch: có thể lệch tạm thời.

## 5. Đối chiếu quy tắc đồng bộ bắt buộc (mục VIII đề bài)

| Trạng thái | Yêu cầu chuẩn | Thực tế | Đạt? |
|---|---|---|---|
| Chưa có yêu cầu | Lịch bình thường, có nút gửi | ✅ | ✅ |
| **Chờ duyệt** | Giữ ca, hiện "Chờ duyệt", không nút trùng, không coi là đã nghỉ | FE đúng (chỉ slot active); nhưng **đặt lịch vẫn mở** (chính sách A ngầm định) | ⚠ Một phần |
| **Bị từ chối** | Ca về trạng thái ban đầu, có thể gửi lại | ✅ (slot chưa từng bị đổi) | ✅ |
| **Bác sĩ rút** | Bỏ chờ duyệt, về bình thường, giữ lịch sử | ✅ | ✅ |
| **Được duyệt** | Ca vẫn ở đúng ngày/giờ, gắn trạng thái nghỉ, KHÔNG như ca hoạt động, KHÔNG cho đặt, không nút gửi lại | ✅ **Đã sửa (2026-07-14)** — `approveDoctorLeave` khóa slot giao khung giờ (`status='locked'`, `bi_khoa_boi_nghi_phep=true`, `nghi_phep_id`) hoặc `trang_thai_ngay='nghi_phep'` nếu nghỉ cả ngày; `getSlots`/`createBooking` loại slot bị khóa | ✅ |
| **Ca nghỉ không biến mất** | Giữ trên lịch bác sĩ | ✅ (dòng thời gian T2–T7 cố định) | ✅ |

## 6. Quy tắc giữ / loại ca nghỉ

- **Trang bác sĩ:** KHÔNG bỏ ngày nghỉ khỏi dòng thời gian ✅. Nhưng **thiếu** chỉ báo cấp-ngày rõ ràng cho ngày đã duyệt nghỉ (chỉ nhãn per-slot, và chỉ với slot active).
- **Trang bệnh nhân:** mô hình chọn-ngày-đơn (`getSlots(doctorId, date)`), không có cửa sổ N-ngày → **không cần** logic bù ngày. Ca nghỉ đã duyệt **chưa** bị loại tự động (getSlots không đọc nghỉ phép) → **rủi ro Critical SYNC-01**.
- **Bổ sung ngày làm việc tiếp theo:** không áp dụng (không có cửa sổ cố định). Nếu sau này thêm màn "N ngày gần nhất", quy tắc phải là: chỉ lấy ngày có `LichLamViec` thật + `trang_thai_ngay='lam_viec'` + còn slot `active`, **không sinh ngày giả**.

## 7. Chính sách "đang chờ duyệt" có ảnh hưởng khả dụng không?

Hiện dự án **ngầm định Chính sách A** (vẫn nhận lịch khi đơn đang `cho_duyet`) — nhưng **do thiếu logic** chứ không phải quyết định có chủ đích (getSlots không hề đọc `NghiPhepBacSi`).

| | Chính sách A (vẫn nhận lịch khi chờ) | Chính sách B (tạm khóa khi chờ) |
|---|---|---|
| Ưu | Không giảm năng lực khi Admin chưa duyệt | Giảm số BN bị ảnh hưởng nếu duyệt |
| Nhược | Duyệt xong nhiều BN bị ảnh hưởng | Bị từ chối thì mất cơ hội nhận lịch |

**Đề xuất (chưa sửa):** chốt **một** chính sách thống nhất cho **cả** backend (getSlots) và frontend. Khuyến nghị: **A cho lúc `cho_duyet`** (không khóa) + **khóa CỨNG ở backend khi `da_duyet`** — vì việc còn thiếu bắt buộc nhất là chặn đặt lịch sau khi ĐÃ DUYỆT.

## 8. Ma trận test (đề xuất — chưa chạy)

> Chưa thực thi (Prompt review). Đánh dấu kỳ vọng để dùng ở prompt sửa sau.

### Nhóm A — Đồng bộ 2 trang
| # | Bước | Kỳ vọng |
|---|---|---|
| A1 | Gửi nghỉ từ Lịch → mở Xin nghỉ | Đơn cho_duyet xuất hiện |
| A2 | Gửi nghỉ từ Xin nghỉ → quay Lịch | Slot phủ hiện "Chờ duyệt", nút gửi ẩn |
| A3 | Rút đơn ở Xin nghỉ → quay Lịch | Nút gửi hiện lại |
| A4 | Admin từ chối → cả 2 trang | Ca bình thường; đơn "Từ chối" |
| A5 | Admin **duyệt** → cả 2 trang **+ trang bệnh nhân** | **[FAIL kỳ vọng hiện tại]** BN vẫn đặt được; slot vẫn active |

### Nhóm B — Ngày nghỉ / đặt lịch
| # | Bước | Kỳ vọng |
|---|---|---|
| B1 | Nghỉ cả ngày đã duyệt | Bệnh nhân không đặt được ngày đó |
| B2 | Nghỉ 1 ca (khung giờ) đã duyệt | Chỉ khung giờ đó bị loại, ca khác còn đặt được |
| B3 | Ca nghỉ vẫn hiện trên lịch bác sĩ | ✅ hiện với nhãn nghỉ cấp ngày |
| B4 | Nhiều đơn nghỉ theo ca cùng ngày | **[FAIL hiện tại]** đơn thứ 2 bị 409 (chống trùng mức ngày) |

### Nhóm C — Trạng thái đơn
cho_duyet / da_duyet / tu_choi / da_huy / trùng / của bác sĩ khác (404) / ca đã qua (400) — đối chiếu §5.

## 9. Kết luận đồng bộ

- **Chiều Xin nghỉ → Lịch (hiển thị):** hoạt động ở mức chấp nhận được **nhờ FE tự đối chiếu** + refetch-on-mount; hạn chế: chỉ slot `active`, không realtime, không có nút rút trên Lịch.
- **Chiều Duyệt → Vận hành ca → Đặt lịch:** ~~ĐỨT GÃY~~ **✅ Đã sửa (2026-07-14)**. Duyệt nghỉ nay tác động `LichLamViec` (khóa slot giao khung giờ hoặc `trang_thai_ngay='nghi_phep'` nếu cả ngày) và đặt lịch bệnh nhân (`getSlots`/`createBooking`) loại các slot bị khóa — cả ở tầng liệt kê lẫn tầng ghi giao dịch (phòng vệ race condition). Xem `docs/superpowers/plans/2026-07-14-doctor-leave-sync-fix.md` — 30/30 test backend PASS (25 test cũ + 5 test mới `doctor.leave-sync.test.js`).
- **Nguyên tắc cần chốt:** đưa quyết định trạng thái về **backend** (nguồn sự thật) — **đã áp dụng** cho luồng duyệt/từ chối nghỉ phép.
- **Giới hạn còn lại (đã biết, ngoài phạm vi bản sửa này):** không có luồng "hủy duyệt/mở lại slot" — một khi đơn `da_duyet`, không có API nào rescind (doctor không tự hủy được `da_duyet`; admin `reject` bị chặn 409 nếu đơn đã `da_duyet`). FE (Lịch làm việc, trang admin xử lý đơn nghỉ) **chưa** hiển thị field mới `so_slot_da_khoa`/`lich_hen_can_xu_ly` mà API duyệt nghỉ trả về — nằm ngoài phạm vi "chỉ backend" đã chốt. Đơn nghỉ đang `cho_duyet` vẫn theo Chính sách A (không khóa đặt lịch), đúng như đề xuất ở §7.

> **Xác nhận:** Đã sửa backend (SYNC-01, SYNC-02, LEAVE-01) theo phạm vi "chỉ lỗi đồng bộ Critical+High" đã chốt với người dùng ở Prompt 5. Không sửa frontend. Không đổi schema/model. Không chạy seed/migration. Không fake dữ liệu — toàn bộ verify qua integration test thật (HTTP + MongoDB Cloud) trên lịch làm việc tự tạo cô lập, đã tự dọn sạch.
