# Thiết kế — Hoàn thiện UI lễ tân: LT-07, LT-10, gỡ LT-11

Ngày: 2026-08-02 · Nhánh: `Bac_si`

## 1. Bối cảnh

Backend LT-07 / LT-10 / LT-11 đã hoàn thành và push (`f16bf83`, `1761448`, `9b4a495`).
Frontend lễ tân chưa dùng được các tính năng này. Khi rà soát để bổ sung UI, phát hiện
thêm một regression và một số quyết định nghiệp vụ cần đảo.

### Hiện trạng frontend lễ tân

| Route | File | Nội dung |
|---|---|---|
| `/receptionist` | `pages/receptionist/Dashboard.tsx` | Tổng quan |
| `/receptionist/appointments` | `pages/receptionist/Appointments.tsx` | Lịch hẹn + check-in + dời/hủy |
| `/receptionist/patient-intake` | `pages/receptionist/PatientIntake.tsx` | Tra SĐT → chọn hồ sơ → check-in / walk-in |
| `/receptionist/payments` | `pages/receptionist/Payments.tsx` | Thu ngân |
| `/receptionist/news` | `NewsList/Create/Edit.tsx` | Tin tức |

Pattern sẵn có: service tập trung (`services/receptionist-*.service.ts`) gọi qua
`axiosInstance`; không có thư viện toast; modal tự dựng bằng overlay `fixed inset-0`;
lỗi/thông báo hiển thị inline qua state `error` / `message`.

Không tồn tại màn "đặt lịch tại quầy" tạo `LichHen` — lễ tân đẩy thẳng walk-in vào
`HangDoi` qua `POST /patient-intake/check-in`, đúng rule mục 13 (lễ tân không đặt hộ).
Vì vậy "màn đặt lịch tại quầy" trong yêu cầu = màn **Tiếp nhận tại quầy**.

## 2. Quyết định đã chốt

1. **Bỏ hẳn LT-11.** Lễ tân không có thẩm quyền xem hay can thiệp bệnh án / đơn thuốc,
   nên cũng không cần quyền *yêu cầu bác sĩ chỉnh sửa*. Gỡ luồng này khỏi backend.
2. **Hệ thống không có vai trò y tá.** Chỉ 4 vai trò: khách hàng · bác sĩ · lễ tân ·
   admin. Sửa rule để tránh hiểu nhầm về sau.
3. **Ưu tiên tốc độ quầy.** Bước xác minh danh tính khi check-in phải tự động hoá tối
   đa; trường hợp thường gặp không được tốn thêm thao tác.
4. Làm gói này trước, các gói khác (điều phối hàng đợi, UI dùng hết backend sẵn có)
   brainstorm riêng.

## 3. Regression phải sửa

`Appointments.tsx:341` và `:356` gọi:

```js
axiosInstance.patch(`/receptionist/appointments/${id}/arrived`)   // không body
```

Sau LT-07, `markAsArrived` (`appointment.controller.js:261-267`) bắt buộc
`ho_so_benh_nhan_id` + `so_dien_thoai` + `ho_ten`, thiếu → **400**.

⇒ Nút check-in ở `/receptionist/appointments` hiện **luôn lỗi**. Đường check-in duy nhất
còn hoạt động là qua `PatientIntake.tsx`.

## 4. Phần 1 — Gỡ LT-11

### Xoá

- `createMedicalRecordRevisionRequest()` — `controllers/receptionist/medical-record.controller.js`
- `router.post('/:id/revision-requests', ...)` — `routes/receptionist/medical-record.routes.js`
- Import tương ứng trong file route.

### Giữ nguyên

Đây là hàng rào bảo vệ, không phải tính năng:

- `denyDirectMedicalRecordPatch` + `PATCH /:id` → 403. Lễ tân vẫn bị chặn cứng khỏi bệnh án.
- `detectReceptionistMedicalPatchViolation` và test của nó.
- Toàn bộ admin override (`PATCH /api/admin/medical-read/exam-results/:id/override`) + 3 test.
- Trạng thái `yeu_cau_chinh_sua` — thuộc luồng **bác sĩ**
  (`doctor/appointments.controller.js:903-925`) và enum `KetQuaKham.js:78`, không thuộc LT-11.

### Vì sao an toàn

`tests/receptionist.lt11-medical-record-revision.test.js` có 4 test: 1 cho guard 403,
3 cho admin override. **Không test nào chạm `createMedicalRecordRevisionRequest`** —
gỡ hàm không làm hỏng test nào. Không đổi tên file test.

### Không làm

Không thêm API đọc bệnh án cho lễ tân, không tạo trang "Kết quả khám", không thêm
badge/filter `yeu_cau_chinh_sua` phía lễ tân.

## 5. Phần 2 — Sửa rule vai trò

`.claude/rules/lich-lam-viec-bac-si.md` mục 7, dòng 72:

```diff
- - Lễ tân & y tá dùng **chung 1 service check-in** — không mỗi vai trò một luồng.
+ - Check-in đi qua **duy nhất 1 service** — không mỗi vai trò một luồng.
+ - Hệ thống chỉ có **4 vai trò**: khách hàng · bác sĩ · lễ tân · admin.
+   **KHÔNG có vai trò y tá.** Phần việc thường gán cho y tá (check-in, sinh hiệu)
+   do lễ tân và bác sĩ đảm nhiệm.
```

File rule ghi "KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI... trừ khi người dùng yêu cầu rõ ràng" — người
dùng đã yêu cầu rõ ràng ngày 2026-08-02.

`CLAUDE.md` đang ghi "3 vai trò: Bệnh nhân · Bác sĩ · Admin" — thiếu lễ tân. Sửa thành 4.

**Không sửa** các file trong `docs/Bác sĩ/Audit-*.md` có nhắc y tá — đó là biên bản audit
lịch sử (2026-07-08, 2026-07-11), không phải rule đang có hiệu lực.

## 6. Phần 3 — LT-07: xác minh đúng người bệnh

### 6.1 Modal xác minh khi check-in (`Appointments.tsx`)

Component mới `components/receptionist/CheckInVerifyModal.tsx`. Thay cả hai đường
check-in hiện có (nút nhanh ở dòng danh sách và `confirmCheckInModalOpen`) bằng một luồng
duy nhất.

Luồng, tối ưu cho tốc độ quầy:

```
Bấm [Check-in]
  → modal mở, TỰ ĐỘNG gọi searchByPhone (không bắt lễ tân bấm "Tra cứu")
  → đúng 1 hồ sơ  → tự chọn sẵn, nút Xác nhận sáng ngay  → 1 click là xong
  → nhiều hồ sơ   → hiện danh sách, buộc chọn rõ         → thêm 1 click
  → 0 hồ sơ       → khối "Cần xác minh" + đường dẫn sang Tiếp nhận tại quầy để tạo hồ sơ
```

Số điện thoại tra cứu: ưu tiên `appointment.so_dien_thoai_khach` (người được khám),
fallback `appointment.user_id.so_dien_thoai`.

Mỗi item hồ sơ hiển thị: họ tên · ngày sinh + tuổi · giới tính (nhãn tiếng Việt) ·
SĐT **của hồ sơ** · quan hệ + nhóm gia đình nếu là thành viên · trạng thái đã có lượt
trong hàng đợi hay chưa.

Hồ sơ đã có `luot_dang_cho_hom_nay` vẫn hiện trong danh sách nhưng **không chọn được**,
kèm nhãn "Đã có lượt trong hàng đợi" — tránh để lễ tân bấm rồi mới nhận lỗi từ backend.

**Payload gửi đi phải lấy từ chính hồ sơ đã chọn, không lấy từ lịch hẹn:**

```ts
{ ho_so_benh_nhan_id: profile.id,
  so_dien_thoai: profile.so_dien_thoai,
  ho_ten: profile.ho_ten }
```

Vì backend so khớp `normalizePhone(body.so_dien_thoai)` với SĐT hồ sơ và
`normalizeName(body.ho_ten)` với tên hồ sơ (`appointment.controller.js:271-274`); lấy dữ
liệu từ lịch hẹn sẽ 409 khi hai bên lệch nhau.

Không gửi `member_id` — backend đối chiếu member qua `ho_so_benh_nhan_id`
(`appointmentBelongsToProfile`), không có tham số nhận `member_id`.

Dùng `receptionistPatientIntakeService.checkInAppointment()` sẵn có, bỏ lệnh
`axiosInstance.patch` thô trong page.

### 6.2 Xử lý lỗi check-in

| Mã | Ý nghĩa | Hiển thị |
|---|---|---|
| 400 | Thiếu thông tin xác minh | Lỗi đỏ (không nên xảy ra sau khi sửa) |
| 404 | Không tìm thấy hồ sơ đang hoạt động | Lỗi đỏ + gợi ý tra cứu lại |
| 409 | Lịch không thuộc bệnh nhân vừa xác nhận | Khối **"Cần xác minh"** màu hổ phách, giữ modal mở, yêu cầu chọn lại |

### 6.3 `PatientIntake.tsx`

- Card hồ sơ (`:430-446`): thêm SĐT của hồ sơ (khác số tra cứu là manh mối quan trọng khi
  số thuộc người giám hộ), `quan_he`, `nhom_gia_dinh`, tuổi; đổi `profile.gioi_tinh` từ
  in raw (`nam`/`nu`) sang nhãn tiếng Việt.
- Form tạo hồ sơ: thêm lựa chọn **"Không liên kết tài khoản online (khách dùng nhờ số)"**.
  Hiện nút submit bị disable cứng khi `accounts.length > 0 && !selectedAccountId` (`:585`),
  khiến không tạo nổi hồ sơ walk-in mới trên số đã có tài khoản.
- `createProfileAndCheckIn` (`:247`): bỏ fallback `|| accounts[0]`. Không có tài khoản khớp
  thì báo lễ tân chọn, không đoán.
- Khối `ambiguous_appointments` (`:356-364`): từ banner cảnh báo suông thành trạng thái
  "Cần xác minh" có hướng dẫn thao tác cụ thể.

## 7. Phần 4 — LT-10: sửa thông tin hành chính + audit

API đã sẵn sàng, chỉ thiếu phía frontend:

```
PATCH /api/receptionist/patient-intake/profiles/:id
GET   /api/receptionist/patient-intake/profiles/:id/audit
```

### 7.1 Service

`services/receptionist-patient-intake.service.ts` thêm:

```ts
updateProfileAdministrative(id, payload): Promise<{ profile, audit_id, changed_fields }>
getProfileAuditLogs(id): Promise<ProfileAuditLog[]>
```

Kèm type `ProfileAuditLog` (`actor`, `vai_tro`, `ly_do`, `du_lieu_cu`, `du_lieu_moi`, `ngay_tao`).

### 7.2 `components/receptionist/ProfileAdminEditModal.tsx`

9 trường hành chính: `ho_ten`, `so_dien_thoai`, `ngay_sinh`, `gioi_tinh`, `nhom_mau`,
`di_ung`, `benh_nen`, `dia_chi`, `ghi_chu`. Không hiện trường chuyên môn.

Ô **lý do cập nhật bắt buộc** (`ly_do_cap_nhat`).

**Chỉ gửi những trường thực sự đổi** + lý do. Backend dùng `hasOwnProperty` nên gửi thiếu
là hợp lệ; gửi thừa trường lạ sẽ bị 403.

Bảng **preview trước/sau** liệt kê đúng các trường đã đổi. Nút Lưu disable khi chưa có
thay đổi hoặc chưa nhập lý do.

Chuyển đổi `ngay_sinh` giữa ISO (API) và `YYYY-MM-DD` (`input[type=date]`) ở cả hai chiều.

Lưu thành công → gọi lại `searchByPhone` để refresh, đóng modal, hiện thông báo xanh.

Xử lý lỗi:

| Mã | Hiển thị |
|---|---|
| 400 (validate) | Lỗi cạnh trường tương ứng |
| 400 "Khong co thong tin ho so nao thay doi" | Thông báo trung tính "không có gì thay đổi", **không** hiện như lỗi nhập liệu |
| 403 | "Lễ tân không có quyền sửa trường chuyên môn" |
| 404 | "Hồ sơ không tồn tại hoặc đã ngừng hoạt động" |

### 7.3 `components/receptionist/ProfileAuditPanel.tsx`

Modal riêng (cùng kiểu overlay `fixed inset-0` như các modal sẵn có), mở từ nút "Lịch sử
cập nhật". Tự gọi API khi mount, có trạng thái đang tải / rỗng / lỗi.

Bảng lịch sử: thời gian · người thực hiện (tên + vai trò) · lý do · từng trường trước → sau.

`du_lieu_cu` / `du_lieu_moi` chứa thêm khoá `changed_fields`; khi render bảng diff **phải
bỏ qua khoá này**, chỉ lặp trên các khoá là tên trường thật.

Chỉ hiển thị audit `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE` — backend đã lọc sẵn.

### 7.4 Điểm vào

Nút "Sửa thông tin hành chính" và "Lịch sử cập nhật" đặt trong khối hồ sơ đã chọn của
`PatientIntake.tsx` (`:449-456`) — chỗ duy nhất lễ tân đã cầm hồ sơ trong tay, không bắt
tra cứu hai lần. Không tạo trang `/receptionist/patients` mới.

## 8. Phần 5 — Sửa mojibake `Appointments.tsx`

Toàn bộ tiếng Việt trong file bị double-encode (`'ÄÃ£ Ä‘áº¿n'` thay vì `'Đã đến'`), xác
nhận bằng hexdump. Màn Lịch hẹn của lễ tân đang hiển thị chữ rác. Chỉ 2 file trong toàn
frontend bị (file kia là `admin/ManageServiceSpecialtyDetail.tsx`, ngoài phạm vi).

Decode lại về UTF-8 đúng, **commit riêng biệt trước** commit tính năng để `git diff` phần
tính năng còn đọc được.

## 9. Ràng buộc với e2e sẵn có

`e2e/receptionist-patient-intake.spec.ts` **đã lệch sẵn** với code hiện tại (chờ nút
"Kiểm tra lịch bác sĩ và sức chứa", code hiện là "Kiểm tra khả năng tiếp nhận") — hỏng từ
trước, không do thay đổi này. Không sửa e2e trong phạm vi này, nhưng phải giữ:

- `input[placeholder="Số điện thoại người liên hệ"]`
- Nút `Tra cứu hôm nay`, heading `Tiếp nhận tại quầy`
- `forms.nth(1)` = form tạo hồ sơ → **không thêm `<form>` nào vào DOM mặc định** của
  `PatientIntake.tsx`. Modal chỉ mount khi mở nên an toàn.
- `forms.nth(1).locator('input').nth(0)` = ô Họ tên → checkbox "Không liên kết tài khoản"
  phải đặt **sau** ô Họ tên trong thứ tự DOM.

## 10. Danh sách file thay đổi

**Backend**
- `backend/src/controllers/receptionist/medical-record.controller.js` — xoá hàm
- `backend/src/routes/receptionist/medical-record.routes.js` — xoá route

**Rule / tài liệu**
- `.claude/rules/lich-lam-viec-bac-si.md` — mục 7
- `CLAUDE.md` — 3 → 4 vai trò
- `docs/Le tan/LT-07-LT-10-LT-11-backend-da-hoan-thanh-va-ui-can-bo-sung.md` — ghi LT-11 bị loại
- `docs/superpowers/specs/2026-08-02-le-tan-lt07-lt10-design.md` — spec này

**Frontend**
- `src/services/receptionist-patient-intake.service.ts` — +2 hàm, +type
- `src/components/receptionist/CheckInVerifyModal.tsx` — mới
- `src/components/receptionist/ProfileAdminEditModal.tsx` — mới
- `src/components/receptionist/ProfileAuditPanel.tsx` — mới
- `src/pages/receptionist/PatientIntake.tsx` — card hồ sơ, form tạo, điểm vào LT-10
- `src/pages/receptionist/Appointments.tsx` — mojibake + dùng modal xác minh

## 11. Commit

1. `fix(receptionist): repair mojibake encoding in appointments page`
2. `refactor(receptionist): remove medical record revision request flow`
   (gồm sửa rule + `CLAUDE.md` + doc bàn giao)
3. `feat(receptionist): verify patient identity on check-in and edit administrative profile`

## 12. Kiểm chứng

**Backend**
```bash
cd backend
node --test tests/receptionist.lt07-shared-phone.test.js \
            tests/receptionist.lt10-patient-profile-update.test.js \
            tests/receptionist.lt11-medical-record-revision.test.js
```
Kỳ vọng: 12/12 pass **sau khi** gỡ LT-11 (không test nào phụ thuộc hàm bị gỡ).

**Frontend**
```bash
cd frontend
npm run typecheck && npm run lint && npm run test && npm run build
```

Playwright (`npm run test:e2e:receptionist`) cần server chạy và đã lệch từ trước — **không
chạy**, báo rõ lý do thay vì tuyên bố pass.

## 13. Ngoài phạm vi

- Điều phối hàng đợi: chuyển lượt đang chờ sang bác sĩ khác khi bác sĩ khám kéo dài.
  Đây là thứ **duy nhất thật sự thiếu backend** — `HangDoi` chỉ được đọc, chưa từng bị đổi
  `doctor_id` trong `controllers/receptionist/`. Gói riêng.
- UI dùng hết backend sẵn có: thông báo khách khi hủy/dời/đổi bác sĩ
  (`notifyAppointmentCustomerChange` đã gọi ở cả 3 luồng), lịch sử dời lịch
  (`LichSuLichHen` + `GET /:id/reschedule-history`), khách đến muộn (`markLateArrival` với
  3 chính sách, UI đã có), trạng thái vận hành bác sĩ (`getDoctorOperationalStatuses`).
  Gói riêng.
- Sửa mojibake `admin/ManageServiceSpecialtyDetail.tsx`.
- Sửa e2e đã lệch.
- Vai trò y tá: không làm, đã loại khỏi rule.
