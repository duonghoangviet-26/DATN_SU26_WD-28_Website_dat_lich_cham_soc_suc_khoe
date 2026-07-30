# Triển khai L14 + ràng buộc slot — 2026-07-26

Đợt sửa theo thứ tự đã chốt: **L14 (khôi phục cấu hình chuyên khoa) → §5 (chặn trùng lượt) + §7 (ràng buộc 1 slot ↔ 1 lịch hẹn) → §3 (MauLichLamViec)**.

Rule tham chiếu: `.claude/rules/lich-lam-viec-bac-si.md`.
Phân tích tiền đề: `docs/Phan tich lo hong luong dat lich Online-Offline (2026-07-25).md`.

---

## 1. Phát hiện quan trọng — dữ liệu KHÔNG mất, chỉ có MODEL mất

Rule §9 ghi "3 field cấu hình `ChuyenKhoa` đã mất sau khi merge `main` (commit `ca685dc`)". Kiểm tra trực tiếp DB nhóm (`DATN_VITAFAMILY`) ngày 2026-07-26:

```
chuyen_khoa sample keys: _id, phong_kham_id, ten, mo_ta, icon_url, slug, thu_tu,
                         status, ngay_tao, __v, so_slot_moi_khung,
                         thoi_gian_kham_trung_binh_phut, ty_le_online_phan_tram
Tai Mũi Họng: TG=15  slot/khung=2  online=70%  gia=undefined
```

**Ba field vẫn còn nguyên trong DB với giá trị đúng.** Thứ mất là định nghĩa trong `models/ChuyenKhoa.js`. Hậu quả giống hệt nhau — Mongoose strip field không khai báo, `.select()` trả `undefined`, generator rơi về fallback 1 slot/khung + 100% online — nhưng cách khắc phục nhẹ hơn nhiều: chỉ cần khôi phục model, không phải nhập lại dữ liệu.

Chỉ `gia_kham` là thực sự chưa từng có (rule §10.D bổ sung sau).

**Bài học:** một field biến mất khỏi model là lỗi *câm* — không có exception, không có log, hệ thống vẫn chạy nhưng chạy sai nghiệp vụ. Đây là lý do phải luôn đối chiếu model với DB thật thay vì tin vào code.

---

## 2. L14 — Khôi phục cấu hình chuyên khoa

### Đã làm

| File | Thay đổi |
|---|---|
| `backend/src/utils/slotConfig.js` | **MỚI** — nguồn duy nhất cho phép tính slot: `tinhSoSlotToiDa`, `chotSoSlotMoiKhung`, `chotTyLeOnline`, `kiemTraCauHinhSlot` |
| `backend/src/models/ChuyenKhoa.js` | 4 field: `thoi_gian_kham_trung_binh_phut`, `so_slot_moi_khung`, `ty_le_online_phan_tram`, `gia_kham` + `pre('validate')` chặn override vượt trần |
| `backend/src/services/scheduleGenerator.service.js` | `.select()` thêm `thoi_gian_kham_trung_binh_phut`; dùng chung phép tính từ `slotConfig` |
| `backend/src/controllers/admin/specialties.controller.js` | Nhận + kiểm 4 field ở `create`/`update`; trả thêm `so_slot_moi_khung_thuc_dung` |
| `backend/src/controllers/admin/clinic-info.controller.js` | Đường alias legacy — kiểm cùng ràng buộc |
| `backend/src/scripts/seed-all.js` | 3 chuyên khoa seed kèm cấu hình đầy đủ |
| `backend/scripts/migrations/010-...js` | **MỚI** — backfill field còn thiếu + suy `gia_kham` từ giá bác sĩ |
| `frontend/.../SpecialtyCapacityFields.tsx` | **MỚI** — form cấu hình dùng chung, có bảng xem trước sức chứa |
| `frontend/.../AddSpecialty.tsx`, `EditSpecialty.tsx` | Gắn form cấu hình |
| `frontend/src/types/index.ts` | `SpecialtyItem` thêm 4 field (optional — bản ghi cũ chưa có) |

### Hai tầng phòng vệ cho ràng buộc `so_slot_moi_khung ≤ floor(30/TG)`

`pre('validate')` của Mongoose **không chạy** với `findByIdAndUpdate` (query middleware ≠ document middleware). Đây đúng là cái bẫy đã ghi trong phân tích 2026-07-25. Nên ràng buộc được kiểm ở **hai chỗ**:

1. `pre('validate')` trong model — cho đường `document.save()`
2. Gọi tay `kiemTraCauHinhSlot()` trong cả hai controller — cho đường `findByIdAndUpdate`

Ngoài ra `chotSoSlotMoiKhung()` còn `Math.min` lần cuối lúc đọc, nên kể cả dữ liệu cũ lệch chuẩn cũng không sinh ra slot vượt trần.

### Kiểm chứng thực tế

Lịch do cron sinh trên DB test sạch:

```
Lịch ngày 2026-07-20
  tổng slot            : 30
  số slot mỗi khung    : 2
  online / walk_in     : 21 / 9
  ca sáng              : 14 chỗ — 10 online
  ca chiều             : 16 chỗ — 11 online
  phân bổ online/khung : 1,2,1,2,1,2,1,1,2,1,2,1,2,1,1
```

Khớp **chính xác** rule §2 ("Sáng 14 / chiều 16 / ngày 30") và ví dụ xen kẽ ở §4 (`[1,2,1,2,1,2,1]` cho ca sáng).

---

## 3. §5 — Chặn trùng lượt đặt

`createBooking` của bệnh nhân trước đây **không kiểm tra gì**. Đã thêm hai lớp, theo đúng thứ tự:

1. **Nhả giữ chỗ cũ trước** — mỗi người được khám tối đa 1 slot `pending_payment` đang hoạt động; đặt mới thì hủy giữ chỗ cũ.
2. **Rồi mới đếm lượt còn lại** — 1 lượt / chuyên khoa / ngày / người được khám.

Thứ tự này quan trọng. Đảo lại thì chính giữa chỗ bỏ dở của khách sẽ chặn khách đặt lại — và đó **đúng là tình huống đã sinh ra dữ liệu hỏng trên DB thật**: slot `...83c3e8`, cùng một khách `Nguyen Minh An`, hai lịch hẹn cách nhau 5 phút, bản đầu `pending`/`unpaid` không mã lịch hẹn nằm chết, bản sau `confirmed`/`paid` 300.000đ.

Định danh dùng `member_id` (người được khám), không dùng `user_id` — một tài khoản đặt cho cả gia đình, tính theo `user_id` sẽ chặn nhầm mẹ đặt cho hai con cùng ngày (rule §5).

`cancelled` và `no_show` **không** tính vào hạn mức: khách đã hủy thì thôi, khách `no_show` đã mất 100% tiền rồi (rule §5) — chặn họ đặt lại chỉ là phạt chồng phạt.

---

## 4. §7 — Ràng buộc 1 slot ↔ 1 lịch hẹn

### 4.1 Sửa lỗi P0: claim slot khớp sai phần tử mảng

Cả `patient/booking.controller.js` và `receptionist/booking.controller.js` đều viết điều kiện slot **rời nhau**:

```js
{ 'slots._id': slot_id, 'slots.status': 'active', 'slots.benh_nhan_id': null }
```

MongoDB cho phép mỗi điều kiện khớp một **phần tử khác nhau** của mảng: chỉ cần trong ngày còn *bất kỳ* slot nào `active` là điều kiện `status` đã thoả, rồi toán tử `$` lại trỏ về phần tử khớp **đầu tiên**. Kết quả: có thể ghi đè slot người khác đang giữ.

Đã gói toàn bộ vào **một** `$elemMatch` ở cả hai file.

### 4.2 Unique partial index

```js
appointmentSchema.index(
  { schedule_id: 1, slot_id: 1 },
  { unique: true, name: 'uniq_lich_hen_theo_slot',
    partialFilterExpression: {
      schedule_id: { $type: 'objectId' },
      slot_id:     { $type: 'objectId' },
      status:      { $in: [ ...mọi trạng thái trừ 'cancelled' ] },
    } }
)
```

Hai chi tiết kỹ thuật:
- **`$type: 'objectId'` chứ không phải `$ne: null`** — `partialFilterExpression` không hỗ trợ `$ne`, và lịch khám tại nhà cũ có `schedule_id`/`slot_id` = `null` sẽ dùng chung khoá `(null, null)` nếu không lọc.
- **`$in` trong partial filter cần MongoDB ≥ 5.3.** Đã đo: cluster đang chạy **8.0.28** → hỗ trợ.

### 4.3 Dữ liệu phải dọn trước

Index không build được khi còn trùng. Đo trên DB nhóm: **5 cặp** `(schedule_id, slot_id)` trùng.

| Slot | Giữ | Hủy | Căn cứ |
|---|---|---|---|
| `...4d54dd` | `LIVEHIST_260715_04` | `TEST_TODAY_APT_04` | bản giữ có hàng đợi + kết quả khám |
| `...4d54dc` | `LIVEHIST_260715_03` | `TEST_TODAY_APT_03` | nt |
| `...4d54db` | `LIVEHIST_260715_02` | `TEST_TODAY_APT_02` | nt |
| `...4d54da` | `LIVEHIST_260715_01` | `TEST_TODAY_APT_01` | nt |
| `...83c3e8` | `LH-260715-0001` | (không mã, `pending`) | bản giữ có `thanh_toan` paid 300.000đ |

Bốn cặp đầu là **rác test** (hai script seed cùng ghi lên một slot). Cặp thứ năm là **lỗi nghiệp vụ thật** — chính lỗ hổng §5 vừa vá.

Script `dedupe-slot-appointments.js` chấm điểm theo 4 tiêu chí giảm dần (đã khám → đã trả tiền → tiến trình → tạo sau), **dừng lại** nếu một nhóm hoà cả 4 thay vì đoán bừa. Mặc định dry-run, có backup JSON, **không xóa** — chỉ chuyển `status='cancelled'` để index bỏ qua.

---

## 5. Sửa ngoài kế hoạch — `seed-all.js` đang hỏng hoàn toàn

Khi dựng môi trường kiểm chứng mới phát hiện: `seed-all.js` **mất toàn bộ header** (đọc `.env`, import `models`/`bcryptjs`, 3 hàm tiện ích). Chạy là `ReferenceError` ngay dòng `mongoose.connect(uri)` — tức **cả nhóm không seed lại DB được**.

Đã khôi phục: `dotenv`, `uri`, `import * as models`, `bcrypt`, `dateOnlyUtc`, `addDays`, `isoDateOnly`, `roomFullName`. Cùng kiểu hỏng với `ChuyenKhoa` — dấu vết của cùng một lần merge.

Cũng sửa `config/db.js`: log khởi động **hardcode** `"Đã kết nối MongoDB Cloud (DATN_VITAFAMILY)"` bất kể nối vào DB nào. Đây là loại nhầm lẫn nguy hiểm nhất khi làm việc với DB dùng chung — nay in tên DB thật.

---

## 6. Kiểm chứng

### 6.1 Môi trường

Bộ test là **integration** — gọi vào backend đang chạy. Server ở port 5000 chạy `node src/index.js` (không nodemon) từ 01:22 hôm nay, **không nạp code mới**, nên mọi kết quả test trên nó đều vô nghĩa với đợt sửa này.

Đã dựng riêng: DB `DATN_VITAFAMILY_CLAUDE_TEST` + backend port 5199. Không chạm DB nhóm.

### 6.2 Kết quả

| Nhóm | Kết quả |
|---|---|
| `doctor.api` · `doctor.schedule` · `doctor.leave-sync` · `ketquakham-sinhhieu` · `admin.medical-read` · `doctor.confirm-result` | **58/58 pass** |
| `doctor.confirm-offline` · `doctor.exam-queue` | Không chạy được — hardcode ObjectId của DB nhóm. Đã kiểm: hai file này không tạo `LichHen` có slot nên **không** chịu ảnh hưởng của index mới |
| Frontend `tsc --noEmit` | Không lỗi trong file đã sửa (43 lỗi còn lại đều có sẵn, thuộc `ServiceItem.image_url` và `mock/doctor-appointments.ts`) |

### 6.3 Hai chẩn đoán sai đã loại trừ

**Test 41/45 `doctor.leave-sync` fail luân phiên** — ban đầu nghi là hồi quy của tôi. Thực tế: DB nhóm còn **330 bản ghi nghỉ phép rác** từ các lần chạy test trước, trong đó ~9 bản `test LEAVE-01 ca sang` còn `cho_duyet`. Test chọn ngày bằng `RUN_SALT = Date.now() % 3650` nên thỉnh thoảng trúng ngày đã bị chiếm → 409. Trên môi trường sạch cả hai test **pass**.

**16 test `confirm-result` fail** — đây là hồi quy **thật**, nhưng ở test chứ không ở nghiệp vụ: file test mượn **cùng một** slot cho mọi fixture, đúng thứ index sinh ra để chặn. Đã sửa test cấp phát mỗi fixture một slot trống riêng (loại slot đã có lịch hẹn còn hiệu lực). Sau khi sửa: 17/17 pass.

---

## 7. Ảnh hưởng sang khu vực thành viên khác

| Khu vực | File | Mức độ |
|---|---|---|
| **Admin** | `specialties.controller.js`, `clinic-info.controller.js`, `AddSpecialty.tsx`, `EditSpecialty.tsx`, `SpecialtyCapacityFields.tsx` (mới), `types/index.ts` | Thêm field, **không đổi** hành vi cũ. Form chuyên khoa có thêm khối "Năng lực khám" |
| **Client** | `patient/booking.controller.js` | **Có đổi hành vi**: đặt trùng chuyên khoa/ngày nay bị chặn 409; giữ chỗ cũ tự bị hủy khi đặt mới |
| **Lễ tân** | `receptionist/booking.controller.js` | Chỉ sửa `$elemMatch` — không đổi hành vi, chỉ đóng lỗ hổng đua |
| **Dùng chung** | `seed-all.js`, `config/db.js`, `LichHen.js`, `scheduleGenerator.service.js` | `seed-all` từ hỏng → chạy được. `LichHen` thêm index. |
| **Test** | `doctor.confirm-result.test.js` | Sửa fixture để tuân ràng buộc 1 slot ↔ 1 lịch hẹn |

Đáng chú ý nhất cho **client**: bệnh nhân nay không đặt được 2 lượt cùng chuyên khoa trong một ngày cho cùng một người được khám. Đây là rule §5, nhưng là thay đổi mà người làm client cần biết.

---

## 8. Còn lại

### Cần chạy trên DB nhóm (chưa chạy — chờ chốt)

```bash
node src/scripts/dedupe-slot-appointments.js            # xem trước
node src/scripts/dedupe-slot-appointments.js --apply    # gỡ 5 cặp trùng
node scripts/migrations/010-backfill-chuyen-khoa-slot-config.js
```

Sau đó khởi động lại backend port 5000 để index được tạo và cấu hình có hiệu lực.

⚠️ Khởi động lại backend sẽ chạy `runScheduleAutoFill('startup')` — sinh lịch 2 tuần tới với cấu hình mới (2 slot/khung). Lịch **đã có** không bị đụng (generator bỏ qua ngày đã tồn tại), nên phải sinh lại thủ công các ngày tương lai chưa có ai đặt nếu muốn chúng theo cấu hình mới.

### Chưa làm

- **§3 `MauLichLamViec`** — bác sĩ đăng ký theo CA; `LichLamViec` thêm `ca` + `phong_id`; unique `(doctor_id, ngay, ca)` và `(phong_id, ngay, ca)`; generator ngừng auto full-day. Đây là phần lớn nhất còn lại.
- §6 `muc_uu_tien` tính động + aging 60′ + overflow control
- §11 cutoff `T-30'` + giữ chỗ co giãn + tự chuyển online→walk-in
- §12 tự gán bác sĩ + giá theo chuyên khoa
- §13 chặn lễ tân đặt hộ
- §14/§15 thang xử lý bác sĩ nghỉ / bận một khung
- Dọn 330 bản ghi nghỉ phép rác + 86 slot `booked` mồ côi + `nguon` null trên 105 lịch hẹn
