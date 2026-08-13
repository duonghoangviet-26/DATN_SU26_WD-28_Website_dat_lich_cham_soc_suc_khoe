# F. Kiểm chứng file E + Kế hoạch nâng cấp

> **Ngày lập:** 2026-08-14
> **Nguồn định hướng:** `docs/Hoi-dong/E-Phan-tich-chi-tiet-cac-phan-can-nang-cap-co-dan-chung.md`
> **Phương pháp:** đọc trực tiếp code trong `backend/src/{routes,controllers,services,models}` và
> `frontend/src/{pages,services}` để xác nhận từng dẫn chứng file E nêu. Không nhận định nào trong
> file này dựa trên suy diễn — mỗi kết luận đều kèm file:dòng đã mở ra đọc.
> **Phạm vi lập tài liệu:** kiểm chứng + kế hoạch (2026-08-14). **Triển khai bắt đầu cùng ngày**,
> theo đúng thứ tự Cao ở §6 — xem "Trạng thái triển khai" đầu mỗi mục §3 để biết mục nào đã code.

## 0. Trạng thái triển khai (cập nhật liên tục)

| # | Mục | Trạng thái | Nhánh/commit |
|---|---|---|---|
| C1 | Khóa `co_the_sua=false` khi hoàn tất | ✅ Đã xong | `Fix_demo` |
| C2 | Cảnh báo dị ứng khi kê thuốc (B47) | ✅ Đã xong | `Fix_demo` |
| C3 | Outcome `ket_cuc` + chuyển viện (D78/D80) | ✅ Đã xong (phần D80; D78 nút cấp cứu ở C6) | `Fix_demo` |
| C4 | Đính chính hồ sơ sau xác nhận (B54/B55) | ✅ Backend xong; **FE chưa có UI** (xem ghi chú) | `Fix_demo` |
| C5 | Hồ sơ tạm không SĐT (D81) | ✅ Đã xong cả 3 tầng + UI lễ tân | `Fix_demo` |
| C6 | Nút cấp cứu + thông báo khẩn (D78) | ⏳ Chưa làm | — |

**Ghi chú C4:** `PATCH /api/doctor/exam-session/:queueId/amendment` (`dinhChinhHoSo` trong
`examSession.service.js`) đã hoạt động đầy đủ ở backend — nhận `{ thay_doi, ly_do }`, chỉ cho
sửa 7 trường lâm sàng (không đụng sinh hiệu/đơn thuốc), validate lại qua đúng rule đã dùng ở
bước gốc (`kiemTraKetCuc`, `taoChiDinhDichVu`), ghi lịch sử có cấu trúc vào `lich_su_sua` (không
sửa đè). **Chưa có màn hình bác sĩ nào gọi endpoint này** — cần một trang "Danh sách hồ sơ đã
khám" để làm điểm vào cho việc đính chính sau khi đã hoàn tất, đây là việc UI riêng chưa nằm
trong phạm vi C4 đã lập ban đầu.

**Ghi chú C5:** nới có điều kiện qua `la_ho_so_tam`/`ma_tam` ở đúng 3 tầng đã nêu ở §3.3
(`patient-intake.controller.js`, `centralOfflineQueue.service.js:386`, `HangDoi.js` pre-validate)
— hành vi cũ (bắt buộc SĐT) giữ nguyên 100% khi không có `ma_tam`. Mã tạm sinh qua
`Counter.nextSeq` (atomic, tái dùng cơ chế `capSoThuTuCheckin` đã có) nên không đụng nhau khi
nhiều lễ tân tạo cùng lúc. Endpoint tra cứu mới `GET .../search-temp` **tách riêng**
khỏi `searchPatientProfiles` (không sửa hàm tra cứu theo SĐT đang chạy). FE: modal
`TempProfileModal.tsx` **cô lập hoàn toàn** với state tra cứu-theo-SĐT của `PatientIntake.tsx`
— chỉ trả hồ sơ ra qua callback rồi tái dùng nguyên luồng chọn chuyên khoa/tiếp nhận vào hàng
đợi trung tâm đã có sẵn, không viết lại logic đó.

Kiểm thử: **không chạy** `npm test` / `test:e2e:*` toàn bộ vì `.env` trỏ `MONGODB_URI` vào DB
chung `DATN_VITAFAMILY` (không có DB test riêng) và các file `tests/*.test.js` kết nối thẳng
DB đó — chạy đại trà có thể ghi/sửa dữ liệu demo của cả nhóm. Đã xác minh bằng: `node --check`
(cú pháp) trên mọi file sửa, `tsc --noEmit` + `eslint` cho frontend, và unit test **thuần** (không
chạm DB, ví dụ `tests/drug-allergy-check.test.js`) cho logic mới.

---

## 1. Kết luận tổng: file E đáng tin

Đã kiểm chứng lại **toàn bộ 16 mục** của file E. Kết quả:

| Trạng thái | Số mục | Ý nghĩa |
|---|---|---|
| ✅ Đúng nguyên văn | 16/16 | Mọi dẫn chứng file E nêu đều tồn tại thật trong code |
| ➕ Cần bổ sung | 4 | Khoảng trống THẬT nghiêm trọng hơn hoặc khác sắc thái so với file E mô tả |
| ❌ Sai | 0 | Không phát hiện nhận định sai |

**Khi bảo vệ, nhóm có thể dùng file E làm nguồn dẫn chứng mà không sợ bị bắt lỗi.** Bốn điểm bổ
sung ở §2 dưới đây là phần file E chưa nói tới — nắm được thì trả lời chắc hơn nữa.

### 1.1 Bảng kiểm chứng từng mục

| Mã | Nhận định file E | Kiểm chứng | Ghi chú |
|---|---|---|---|
| A14 | Có hủy lượt + bắt lý do, nhưng lý do là text tự do | ✅ Đúng | ➕ Xem §2.4 — chỉ **lễ tân** bị bắt lý do, bác sĩ thì không |
| A18/D79 | Có reschedule lưu specialty cũ/mới; queue transfer chỉ nhận `dang_cho` | ✅ Đúng | ➕ Xem §2.2 — khoảng trống LỚN hơn file E mô tả |
| A24 | Model có `merged` nhưng route lễ tân không có merge/archive/delete | ✅ Đúng | `grep merge\|archive` trên toàn `routes/` = **0 kết quả** |
| A28 | Admin có restore, lễ tân không có | ✅ Đúng | `routes/admin/appointment.routes.js:22` có; route lễ tân không có dòng nào |
| A30 | Chưa có offline fallback ở FE | ✅ Đúng | Các hit "offline" ở FE đều thuộc tính năng **hàng đợi walk-in**, không phải mất mạng |
| B47 | Hiển thị dị ứng nhưng không đối chiếu thuốc | ✅ Đúng | ➕ Xem §2.1 — ràng buộc thiết kế quan trọng file E chưa nêu |
| B50/C70 | `dich_vu_tu_choi` là Mixed, chưa có luồng dùng | ✅ Đúng | Chỉ được **đọc lại** ở `admin/medical-read.controller.js:105`, **không nơi nào ghi** |
| B54/B55 | Complete không set `co_the_sua=false` | ✅ Đúng | ➕ Xem §2.3 — hiện đang được khóa **do tình cờ**, không do thiết kế |
| B57 | Không có rollback "trả khỏi phòng" | ✅ Đúng | `routes/doctor/queue.routes.js` có call/into-room/finish/skip/cancel — không có chiều ngược |
| C62 | Chỉ chuyển bác sĩ khi `dang_cho` | ✅ Đúng | `queueTransfer.service.js:42-44` |
| C69 | Chưa có trạng thái callback | ✅ Đúng | Contact task chỉ có 2 loại: `xac_nhan_den_muon`, `thong_bao_thu_cong` |
| C75 | Chưa có đổi hồ sơ gắn với lượt chờ | ✅ Đúng | Không có endpoint nào sửa `ho_so_benh_nhan_id` của `HangDoi` |
| D78 | Có `cap_cuu` trong enum, chưa có quy trình | ✅ Đúng | `models/HangDoi.js:120-124` |
| D80 | Chưa có outcome chuyển viện | ✅ Đúng | `grep chuyen_vien\|cap_cuu_ngoai_vien\|outcome` trên models+services = **0 kết quả** |
| D81 | Luồng lễ tân bắt buộc SĐT | ✅ Đúng | Chặn ở **3 tầng** — xem §3.3 |
| D82 | Chưa có consent người đi cùng | ✅ Đúng | `grep nguoi_di_cung\|consent` = **0 kết quả** |

---

## 2. Bốn phát hiện bổ sung ngoài file E

Đây là phần giá trị nhất của tài liệu này: bốn điểm mà file E **chưa nêu**, nhưng sẽ quyết định
cách nhóm trả lời và cách code sau này.

### 2.1 B47 — Dị ứng và tên thuốc đều là TEXT TỰ DO, không có mã thuốc

Đây là ràng buộc thiết kế quan trọng nhất mà file E không nói.

- `HoSoBenhNhan.di_ung` — `String`, maxlength 1000 (`models/HoSoBenhNhan.js:11`)
- `HangDoi.di_ung` — `String`, maxlength 1000 (`models/HangDoi.js:110`)
- `DonThuoc.items[].ten_thuoc` — `String`, maxlength 255 (`models/DonThuoc.js:10-15`)
- **Không có** collection danh mục thuốc, **không có** mã hoạt chất, **không có** ref sang bảng thuốc.

**Hệ quả:** rule cảnh báo dị ứng **chỉ có thể là so khớp văn bản** (chuẩn hóa dấu/hoa thường →
tách token → tìm chuỗi con), **không thể** là tra cứu mã hoạt chất như phần mềm bệnh viện thật.

**Vì sao phải nói rõ điều này khi bảo vệ:** nếu nhóm hứa "hệ thống cảnh báo dị ứng thuốc" mà hội
đồng hỏi "dựa trên danh mục hoạt chất nào?", nhóm sẽ bị bắt bí. Cách trả lời đúng là khai báo
thẳng đây là **cảnh báo mềm mức chuỗi ký tự**, có ích thật (bắt được `Penicillin` trong
`Amoxicillin + Penicillin`) nhưng **không thay thế** kiểm tra tương tác thuốc chuyên nghiệp, và bác
sĩ luôn có quyền override kèm lý do.

### 2.2 A18/D79 — Chuyển chuyên khoa hiện là BẤT KHẢ THI, không chỉ "thiếu luồng"

File E nói queue transfer "chỉ chuyển bác sĩ khi lượt còn `dang_cho`". Đúng, nhưng **chưa đủ**.
Đọc `services/queueTransfer.service.js:53-55`:

```js
if (!doctorCoChuyenKhoa(targetDoctor.specialties, entry.specialty_id)) {
  throwErr(409, 'Bác sĩ đích không cùng chuyên khoa với lượt chờ này')
}
```

Hàm này **bắt buộc bác sĩ đích phải cùng chuyên khoa với lượt chờ**. Nghĩa là kể cả khi lượt đang
`dang_cho` (trạng thái "dễ" nhất), hệ thống vẫn **chặn cứng** việc chuyển sang chuyên khoa khác.

**Kết luận đúng:** chuyển chuyên khoa hiện **không có đường nào** ở tầng hàng đợi — không phải
"thiếu luồng cho trạng thái `trong_phong`" mà là **thiếu hoàn toàn**. Đường duy nhất còn lại là
hủy lượt rồi tiếp nhận lại từ đầu.

### 2.3 B54/B55 — Hồ sơ đang được khóa DO TÌNH CỜ, không do thiết kế

File E nói đúng rằng `hoanTatPhienKham` không set `co_the_sua=false`
(`services/examSession.service.js:423-441`). Nhưng cần nói thêm hai điều:

**Thứ nhất — guard hiện tại là code chết.** `examSession.service.js:269`:

```js
if (hoSo.status === 'da_xac_nhan' && hoSo.co_the_sua === false) {
  throw loi(409, 'Hồ sơ đã khóa, không sửa được')
}
```

`co_the_sua` mặc định `true` (`models/KetQuaKham.js:106`) và **không dòng code chạy thật nào set nó
thành `false`** — `grep co_the_sua` chỉ ra `seed-all.js` (dữ liệu mẫu) và một comment ở
`controllers/doctor/appointments.controller.js:690` tự thú nhận: *"field này chưa từng được cron
nào set false trong thực tế"*. Vậy điều kiện `&& co_the_sua === false` không bao giờ đúng → guard
không bao giờ chạy.

**Thứ hai — nhưng hồ sơ VẪN đang được bảo vệ, nhờ chỗ khác.** `examSession.service.js:264`:

```js
if (entry.trang_thai !== 'trong_phong') {
  throw loi(409, 'Chỉ nhập hồ sơ khi bệnh nhân đang trong phòng')
}
```

Sau khi complete, `HangDoi` chuyển `hoan_thanh` (`examSession.service.js:443-447`), và
`intoRoom` chỉ nhận `dang_cho`/`da_goi` (`controllers/doctor/queue.controller.js:285-287`) nên
không thể đưa bệnh nhân trở lại `trong_phong`. Kết quả: **hồ sơ đã chốt thực tế không sửa được.**

**Vì sao vẫn phải nâng cấp:** sự bảo vệ này đến từ **máy trạng thái hàng đợi**, không đến từ ý định
khóa hồ sơ. Bất kỳ ai sau này thêm một nút "mở lại phòng" hay "sửa nhầm trạng thái" — chính là mục
**B57** đang được đề xuất trong file E — sẽ **vô tình mở khóa hồ sơ y tế đã xác nhận** mà không hề
biết. Đây là loại lỗi nguy hiểm nhất: hai tính năng riêng lẻ đều đúng, ghép lại thành lỗ hổng.

> ⚠️ **Ràng buộc bắt buộc khi làm B57:** phải set `co_the_sua=false` lúc complete **TRƯỚC**, rồi
> mới được thêm bất cứ đường nào đưa bệnh nhân trở lại `trong_phong`. Thứ tự này không được đảo.

### 2.4 A14 — Bác sĩ KHÔNG bị bắt nhập lý do khi đóng lượt

`services/queueCancel.service.js:27-31` + dòng 35:

```js
export function chuanHoaLyDoHuyLuot(lyDo, batBuocLyDo) {
  const reason = String(lyDo ?? '').trim()
  if (batBuocLyDo && !reason) throwErr(400, 'Cần nhập lý do khi đóng lượt')
  return reason || null
}
// ...
const reason = chuanHoaLyDoHuyLuot(lyDo, actorRole === 'receptionist')
```

Cờ `batBuocLyDo` chỉ bật khi `actorRole === 'receptionist'`. Comment ở dòng 26 xác nhận đây là chủ
ý: *"Lễ tân bắt buộc phải nhập lý do; bác sĩ giữ hành vi cũ (không bắt buộc)."*

**Hệ quả cho báo cáo:** ngoài việc lý do là text tự do (file E đã nêu), còn có nhánh **bác sĩ đóng
lượt không lý do gì cả** → bản ghi `ly_do: null`. Báo cáo cuối ngày sẽ có những lượt đóng trắng
thông tin. Nâng cấp A14 nên xử lý cả hai nhánh, không chỉ nhánh lễ tân.

---

## 3. Chi tiết các mục ưu tiên CAO

### 3.1 B47 — Cảnh báo dị ứng khi kê thuốc

**Hiện hệ thống đã có gì**
Bác sĩ **nhìn thấy** dị ứng của bệnh nhân trong suốt phiên khám. Dữ liệu dị ứng được mang từ hồ sơ
sang hàng đợi, rồi trả lên giao diện phiên khám và hiển thị bằng màu đỏ nổi bật.

**Dẫn chứng**
- `models/HoSoBenhNhan.js:11` — `di_ung` trên hồ sơ gốc
- `models/HangDoi.js:110` — `di_ung` được sao sang lượt khám
- `services/examSession.service.js:183-184` — API phiên khám trả `di_ung` + `benh_nen` cho FE
- `frontend/src/pages/doctor/ExamSessionPage.tsx:131-136` — hiển thị cảnh báo
- `frontend/src/pages/doctor/DoctorAppointments.tsx:345-348` — hiển thị dạng chữ đỏ

**Khoảng trống**
Bước kê đơn (`examSession.service.js:318-332`) chỉ làm đúng một việc: xóa đơn cũ, ghi
`payload.thuoc` vào `DonThuoc`. **Không có một dòng nào đối chiếu `ten_thuoc` với `di_ung`.** Hệ
thống hiện là "hiển thị thông tin", chưa phải "cảnh báo chủ động".

Thêm ràng buộc đã phân tích ở §2.1: cả `di_ung` lẫn `ten_thuoc` đều là text tự do, không có mã
hoạt chất → rule chỉ có thể là so khớp văn bản.

**Hướng nâng cấp**
1. Thêm `backend/src/services/drugAllergyCheck.service.js`, thuần tính toán, không chạm DB:
   `kiemTraDiUngThuoc({ diUng, thuoc }) → [{ ten_thuoc, tu_khoa_trung, muc_do }]`.
   Chuẩn hóa: bỏ dấu tiếng Việt → lowercase → tách token theo `,;/+` → so khớp chuỗi con hai chiều.
2. FE gọi trước khi lưu bước `ke_don`, hiện modal đỏ chặn, buộc bác sĩ xác nhận có lý do.
3. BE kiểm lại trong `luuBuoc` bước `ke_don` — chống bỏ qua FE. Nếu có cảnh báo mà payload không
   kèm `ly_do_bo_qua_canh_bao` → trả 409.
4. Lưu vết override vào `KetQuaKham.lich_su_sua` để đối chiếu về sau.

**Câu trả lời hội đồng**
> "Hiện bác sĩ đã **nhìn thấy** dị ứng ngay trên màn hình phiên khám — dẫn chứng ở
> `examSession.service.js` dòng 183 trả dữ liệu và `ExamSessionPage.tsx` dòng 131 hiển thị đỏ.
> Nhưng nhóm **không nói là hệ thống đã cảnh báo tự động**, vì bước kê đơn hiện chỉ lưu
> `payload.thuoc` chứ chưa đối chiếu. Phần nâng cấp là thêm rule so khớp ở cả frontend và backend.
> Nhóm cũng xin nói rõ giới hạn: do `ten_thuoc` và `di_ung` trong hệ thống đều là văn bản tự do,
> chưa có danh mục hoạt chất, nên đây sẽ là **cảnh báo mềm mức chuỗi ký tự** — bắt được trường hợp
> tên thuốc chứa tên chất gây dị ứng, và luôn cho bác sĩ override kèm lý do. Nó hỗ trợ bác sĩ chứ
> không thay thế trách nhiệm chuyên môn."

---

### 3.2 B54/B55 — Đính chính hồ sơ sau khi đã xác nhận

**Hiện hệ thống đã có gì**
Có đủ khung trạng thái duyệt hồ sơ, có audit lịch sử sửa, và luồng cũ đã chặn sửa hồ sơ đã xác nhận.

**Dẫn chứng**
- `models/KetQuaKham.js:76-79` — enum `ban_nhap`/`cho_xac_nhan`/`da_xac_nhan`/`yeu_cau_chinh_sua`
- `models/KetQuaKham.js:106,128` — `co_the_sua` + `lich_su_sua`
- `controllers/doctor/appointments.controller.js:694` — luồng cũ chặn `if (!result.co_the_sua)`
- `services/examSession.service.js:423-441` — complete ghi `da_xac_nhan` + push `lich_su_sua`
- `frontend/src/components/doctor/ExamResultModal.tsx:137` — FE tự khóa readonly khi `da_xac_nhan`

**Khoảng trống**
Hai vấn đề, chi tiết đầy đủ ở **§2.3**:
1. `co_the_sua` **chưa từng được set `false`** ở bất kỳ code chạy thật nào → guard ở
   `examSession.service.js:269` là **code chết**.
2. Hồ sơ hiện vẫn an toàn, nhưng **nhờ máy trạng thái hàng đợi** (`luuBuoc` đòi `trong_phong`, mà
   lượt đã complete thì `hoan_thanh`), **không phải nhờ ý định khóa hồ sơ**.
3. Chưa có khái niệm **bản đính chính** — sửa sau xác nhận hiện là sửa đè, không có version.

**Hướng nâng cấp**
1. Set `co_the_sua: false` ngay trong `$set` của transaction complete
   (`examSession.service.js:423-441`) — sửa 1 dòng, biến guard chết thành guard thật.
2. Siết `luuBuoc`: chặn theo `status === 'da_xac_nhan'` **độc lập** với `co_the_sua`, để không phụ
   thuộc vào trạng thái hàng đợi.
3. Thêm endpoint đính chính `PATCH /api/doctor/exam-session/:id/amendment`: **không sửa đè** bản
   gốc, mà push bản ghi mới vào `lich_su_sua` gồm trường thay đổi, giá trị cũ, giá trị mới, lý do,
   người sửa, thời điểm.
4. Nếu đính chính chạm `dich_vu_phat_sinh` → sinh contact task cho lễ tân xử lý lại hóa đơn.

**Câu trả lời hội đồng**
> "Hồ sơ khám đã xác nhận hiện **không sửa được** — nhóm đã kiểm chứng bằng cách đọc luồng: sau khi
> hoàn tất, lượt chuyển `hoan_thanh`, mà bước nhập hồ sơ đòi bệnh nhân phải `trong_phong`
> (`examSession.service.js:264`), và không có đường nào đưa bệnh nhân trở lại phòng.
> Nhưng nhóm xin nói thẳng một điểm yếu thiết kế: sự bảo vệ đó đến từ **máy trạng thái hàng đợi**,
> không đến từ việc khóa hồ sơ. Field `co_the_sua` được thiết kế để khóa nhưng chưa bao giờ được
> set. Nghĩa là nếu sau này thêm chức năng 'trả bệnh nhân khỏi phòng do nhầm', chúng em sẽ vô tình
> mở khóa hồ sơ y tế đã xác nhận. Vì vậy nhóm xếp mục này ưu tiên Cao và đặt ràng buộc: **phải khóa
> hồ sơ trước, mới được làm chức năng rollback phòng.** Nâng cấp đầy đủ là biến việc sửa sau xác
> nhận thành **quy trình đính chính có version**, giữ nguyên bản gốc."

---

### 3.3 D81 — Bệnh nhân không có số điện thoại

**Hiện hệ thống đã có gì**
Model hồ sơ **cho phép** thiếu SĐT: `models/HoSoBenhNhan.js:6` khai `so_dien_thoai` với
`default: null`. Nghĩa là tầng dữ liệu đã sẵn sàng.

**Dẫn chứng — SĐT bị chặn ở 3 tầng độc lập**

| Tầng | Vị trí | Hành vi |
|---|---|---|
| Controller | `receptionist/patient-intake.controller.js:503-506` | `if (!isValidPhone(...)) return fail(res, 400, 'Số điện thoại không đúng định dạng')` |
| Service | `services/centralOfflineQueue.service.js:386` | `if (!profile.so_dien_thoai) throw loi(400, 'Ho so benh nhan chua co so dien thoai')` |
| Model | `models/HangDoi.js:186-187` | `pre('validate')`: `if (nguon === 'offline' && !so_dien_thoai) throw` |

Frontend cũng validate (`PatientIntake.tsx:440-441, 496-505`), nhưng đó chỉ là lớp UX — ba tầng
trên mới là lớp chặn thật.

**Khoảng trống**
Bệnh nhân không có/không nhớ SĐT (người già, trẻ nhỏ đi một mình, người mất giấy tờ) **không tiếp
nhận được theo luồng chuẩn**. Đây là tình huống có thật ở quầy, và hệ thống hiện bó tay.

➕ **Bổ sung ngoài file E:** `so_dien_thoai_tim_kiem` (`HoSoBenhNhan.js:7`) là khóa tra cứu chính
của lễ tân (`patient-intake.controller.js:313-317`). Hồ sơ tạm không có SĐT sẽ **không tìm lại
được** bằng công cụ hiện có → bắt buộc phải sinh **mã tạm** và cho phép tra cứu theo mã đó, nếu
không hồ sơ tạo ra sẽ thành hồ sơ mồ côi.

**Hướng nâng cấp** (theo nguyên tắc: chỉ nới, không phá luồng cũ)
1. Thêm `HoSoBenhNhan.ma_tam` (String, sparse unique) + `la_ho_so_tam` (Boolean, default false).
2. Sinh mã dạng `TEMP-YYYYMMDD-xxx` khi lễ tân bật cờ "bệnh nhân không có số điện thoại".
3. Nới **có điều kiện** ở cả 3 tầng — chỉ bỏ qua kiểm SĐT khi `la_ho_so_tam === true`, giữ nguyên
   hành vi cũ cho mọi trường hợp còn lại:
   - `patient-intake.controller.js` — nhánh tạo hồ sơ tạm, bắt buộc họ tên + năm sinh + giới tính
     + ghi chú nhận diện thay cho SĐT.
   - `centralOfflineQueue.service.js:386` — cho qua nếu có `ma_tam`.
   - `HangDoi.js:186-187` — cho qua nếu lượt gắn hồ sơ tạm.
4. Mở rộng tìm kiếm lễ tân: tra được theo `ma_tam`.
5. Cho lễ tân bổ sung SĐT sau, hoặc gộp vào hồ sơ chính (liên thông mục **A24**).

**Câu trả lời hội đồng**
> "Nhóm xin nói thẳng: tình huống này **hệ thống hiện chưa hỗ trợ**. Bằng chứng cụ thể là số điện
> thoại đang bị bắt buộc ở **ba tầng độc lập** — controller tiếp nhận dòng 503, service hàng đợi
> trung tâm dòng 386, và cả `pre('validate')` của model `HangDoi` dòng 186. Điều thú vị là model hồ
> sơ bệnh nhân lại **cho phép** SĐT null ngay từ đầu, nên tầng dữ liệu đã sẵn sàng, chỉ có tầng
> nghiệp vụ đang siết.
> Hướng nâng cấp là hồ sơ tạm có mã định danh `TEMP-YYYYMMDD-xxx`, tiếp nhận bằng họ tên + năm sinh
> + giới tính + đặc điểm nhận diện. Một điểm nhóm đặc biệt lưu ý: hiện lễ tân tra cứu bệnh nhân
> **bằng số điện thoại**, nên nếu chỉ bỏ ràng buộc mà không sinh mã tra cứu thay thế thì hồ sơ tạm
> sẽ thành hồ sơ mồ côi không bao giờ tìm lại được. Vì vậy mã tạm là phần bắt buộc, không phải phần
> trang trí."

---

### 3.4 D78/D80 — Cấp cứu tại quầy và chuyển viện

**Hiện hệ thống đã có gì**
Có **mức ưu tiên** cấp cứu trong hàng đợi và nó thật sự được dùng để sắp thứ tự.

**Dẫn chứng**
- `models/HangDoi.js:120-124` — enum `muc_uu_tien_tiep_nhan`: `binh_thuong`/`uu_tien`/`cap_cuu`
- `services/centralOfflineQueue.service.js:445` — lưu mức ưu tiên khi vào hàng đợi trung tâm
- `services/centralOfflineQueue.service.js:490-491` — sắp xếp, `cap_cuu` lên đầu

**Khoảng trống**
- **D78:** mới là **một giá trị enum để sắp xếp**, chưa phải quy trình cấp cứu. Không có nút khẩn
  riêng trên UI, không có thông báo realtime cho bác sĩ, không có biên bản ca khẩn.
- **D80:** `grep chuyen_vien|cap_cuu_ngoai_vien|noi_chuyen_den|outcome` trên toàn bộ
  `models/` + `services/` trả về **0 kết quả**. `KetQuaKham` chỉ có `status` (trạng thái **duyệt hồ
  sơ**) và `buoc_hien_tai` (con trỏ tiến độ) — **không có trường nào mô tả kết cục y tế của ca khám**.

Đây là khoảng trống sạch nhất trong toàn bộ file E: không có gì để tranh luận, đơn giản là chưa có.

**Hướng nâng cấp**
1. Thêm vào `KetQuaKham` một nhóm field mới (chỉ thêm, không đụng field cũ):
   - `ket_cuc` — enum `dieu_tri_thuong` (default) / `chuyen_chuyen_khoa` / `chuyen_vien` /
     `cap_cuu_ngoai_vien`
   - `chuyen_vien_thong_tin` — sub-schema: `noi_chuyen_den`, `ly_do`, `tinh_trang_luc_chuyen`,
     `giay_to_kem_theo`, `thoi_diem`
   Để `dieu_tri_thuong` làm mặc định → **toàn bộ hồ sơ cũ vẫn hợp lệ**, không cần migration dữ liệu.
2. Bước `chan_doan` của phiên khám thêm ô chọn kết cục; chọn chuyển viện → hiện form bắt buộc.
3. Nút "Cấp cứu" ở màn tiếp nhận lễ tân → set `muc_uu_tien_tiep_nhan='cap_cuu'` + bắt nhập lý do,
   dấu hiệu, người xác nhận + bắn realtime qua `doctorQueueRealtime.service.js` (đã có sẵn).
4. Báo cáo cuối ngày lọc theo `ket_cuc` và theo `muc_uu_tien_tiep_nhan='cap_cuu'`.

**Câu trả lời hội đồng**
> "Với **cấp cứu**: hệ thống đã có mức ưu tiên `cap_cuu` trong hàng đợi và nó thật sự được dùng để
> đẩy bệnh nhân lên đầu — dẫn chứng ở `centralOfflineQueue.service.js` dòng 490. Nhưng nhóm không
> nói đó là quy trình cấp cứu hoàn chỉnh: nó mới là **một mức ưu tiên sắp xếp**, chưa có nút khẩn
> riêng, chưa có thông báo khẩn, chưa có biên bản ca.
> Với **chuyển viện**: nhóm xác nhận **hệ thống chưa có**. Chúng em đã tìm toàn bộ models và
> services, không có trường nào kiểu `chuyen_vien` hay `outcome`. Hiện `KetQuaKham` chỉ có trạng
> thái duyệt hồ sơ và bước khám, tức là mô tả **hồ sơ đang ở đâu trong quy trình**, chứ không mô tả
> **ca khám kết thúc ra sao**. Bác sĩ chỉ có thể ghi vào ô hướng dẫn điều trị dạng văn bản, nên hệ
> thống không thống kê được. Nhóm nhận đây là thiếu sót về tính thực tế y tế và đã đưa vào nhóm ưu
> tiên Cao, với thiết kế thêm trường `ket_cuc` mặc định `dieu_tri_thuong` để không phá dữ liệu cũ."

---

## 4. Chi tiết các mục ưu tiên TRUNG BÌNH

### 4.1 B50/C70 — Bệnh nhân từ chối dịch vụ phát sinh

**Đã có:** chỉ định dịch vụ có kiểm soát (`examSession.service.js:64-106` validate dịch vụ phải
`active`, đúng chuyên khoa, tối đa 20, không trùng), billing đọc sang hóa đơn
(`billing.controller.js:164,247`), có confirm/cancel chuyển khoản
(`routes/receptionist/billing.routes.js:9-10`).

**Khoảng trống (đã kiểm chứng chặt):** `dich_vu_tu_choi` tồn tại ở `models/KetQuaKham.js:112` dưới
dạng `[Mixed]`, kèm comment thú nhận *"hiện chưa có luồng dùng"*. `grep` toàn repo cho ra **đúng 3
dòng**: khai báo model, comment, và **một chỗ đọc lại** ở `admin/medical-read.controller.js:105`.
**Không nơi nào ghi vào field này.** Nó là field chết.

Phân biệt quan trọng: "chưa thanh toán" (đã có xử lý) ≠ "từ chối làm dịch vụ" (chưa có). Hiện hai
tình huống này rơi vào cùng một trạng thái, nên báo cáo không phân biệt được **bác sĩ chưa chỉ
định** với **bệnh nhân từ chối**.

**Nâng cấp:** gõ kiểu `dich_vu_tu_choi` thành sub-schema (`service_id`, `ten`, `so_luong`, `gia`,
`ly_do`, `nguoi_ghi_nhan_id`, `thoi_diem`) — cùng cách `dich_vu_phat_sinh` đã được gõ kiểu ở
`KetQuaKham.js:23-33`, nên có tiền lệ trong chính codebase. Thêm nút "Bệnh nhân từ chối" ở màn
thanh toán lễ tân, chuyển dòng từ `dich_vu_phat_sinh` sang `dich_vu_tu_choi` và loại khỏi hóa đơn.

### 4.2 A18/D79 — Chuyển chuyên khoa

**Đã có:** reschedule của lễ tân lưu `specialty_cu_id`/`specialty_moi_id`
(`receptionist/appointment.controller.js:912-917`), admin reschedule cập nhật specialty theo slot
mới (`admin/appointment.controller.js:1117,1131-1132`).

**Khoảng trống:** xem **§2.2** — chuyển chuyên khoa ở tầng hàng đợi hiện **bất khả thi**, bị chặn
cứng bởi `queueTransfer.service.js:53-55` kể cả khi lượt đang `dang_cho`.

**Nâng cấp:** thêm tham số `chuyen_khoa_moi_id` cho `transferQueueEntry`, khi có thì bỏ qua kiểm
`doctorCoChuyenKhoa` nhưng **bắt buộc lý do + ghi audit specialty cũ/mới**. Kết hợp với `ket_cuc =
'chuyen_chuyen_khoa'` ở mục D80 để bác sĩ phát hiện trong phòng có đường xử lý.

### 4.3 A24 — Gộp hồ sơ bệnh nhân

**Đã có:** sửa hành chính bắt buộc lý do (`patient-intake.controller.js:72-78`), ghi audit
`UPDATE_PATIENT_PROFILE_ADMINISTRATIVE` (dòng 595-614), model có `trang_thai: merged`
(`HoSoBenhNhan.js:20`), và code **cố ý không tự gộp** khi trùng SĐT (dòng 534-537).

**Khoảng trống:** `grep merge|archive` trên toàn `routes/` = **0 kết quả**. Không có endpoint gộp ở
bất kỳ vai trò nào — kể cả admin.

➕ **Bổ sung:** `HoSoBenhNhan` có **unique partial index** trên `member_id` và `khach_vang_lai_id`
(`HoSoBenhNhan.js:29-36`). Luồng gộp **bắt buộc** phải gỡ liên kết ở hồ sơ nguồn trước khi gán sang
hồ sơ đích, nếu không sẽ đụng unique index và lỗi E11000. Đây là chi tiết kỹ thuật phải tính từ đầu.

**Nâng cấp:** không cho lễ tân xóa cứng. Thêm `POST /api/admin/patient-profiles/:id/merge` cho
admin, chuyển liên kết `LichHen`/`HangDoi`/`KetQuaKham`/`HoaDon`/`DonThuoc` sang hồ sơ đích trong
một transaction, set hồ sơ nguồn `trang_thai='merged'`, audit đầy đủ.

### 4.4 B57/C62/C75 — Sửa nhầm queue/hồ sơ/bác sĩ

Ba mục cùng bản chất: hệ thống đang **bảo vệ bằng cách khóa**, nhưng thiếu **đường sửa lỗi hợp lệ**.

| Mục | Chặn ở đâu | Thiếu gì |
|---|---|---|
| B57 | `queue.routes.js` không có route ngược từ `trong_phong` | `return-from-room-before-exam` |
| C62 | `queueTransfer.service.js:42-44` chỉ nhận `dang_cho` | Đường xử lý cho `da_goi` |
| C75 | Không endpoint nào sửa `HangDoi.ho_so_benh_nhan_id` | `replace-queue-patient-profile` |

> ⚠️ **B57 bị chặn bởi B54/B55.** Xem §2.3: làm B57 trước khi khóa hồ sơ = mở lỗ hổng sửa hồ sơ y tế
> đã xác nhận. Thứ tự bắt buộc: **B54/B55 → rồi mới B57.**

---

## 5. Chi tiết các mục ưu tiên THẤP

### 5.1 A30 — Offline recovery
**Đã có:** DB là nguồn sự thật, realtime chỉ là lớp phủ; hoàn tất khám ghi DB trong transaction
trước, audit/realtime đặt sau (`examSession.service.js:492-528`) → mất realtime không mất dữ liệu.
**Khoảng trống:** các hit "offline" ở frontend đều thuộc tính năng **hàng đợi khách vãng lai**,
không phải fallback mất mạng. Mất kết nối hoàn toàn thì không có quy trình kỹ thuật.
**Nâng cấp:** khuyến nghị **mô tả bằng quy trình giấy trước, code sau** — biểu mẫu tiếp nhận tạm có
mã, nhập bù + chống trùng khi hệ thống trở lại.

### 5.2 C69 — Gọi bệnh nhân quay lại phòng
**Đã có:** contact task cho lễ tân (`routes/receptionist/contact-tasks.routes.js`), queue có đủ
action gọi/vào phòng/bỏ lượt.
**Khoảng trống:** contact task chỉ có **2 loại** — `xac_nhan_den_muon` và `thong_bao_thu_cong`
(`services/contactTasks.service.js:128`). Không có loại callback.
**Nâng cấp:** thêm `loai_viec: 'goi_lai_benh_nhan'` — tái dùng hạ tầng contact task đã có, chi phí
thấp.

### 5.3 A14 — Chuẩn hóa lý do đóng lượt
Xem **§2.4**. Thêm enum `ly_do_loai` (`benh_nhan_tu_ve`/`nhap_nham`/`bac_si_khong_tiep_nhan`/`khac`)
bên cạnh `ly_do` text đang có, và **bắt buộc cả bác sĩ** nhập lý do, không chỉ lễ tân.

### 5.4 A28 — Lễ tân khôi phục lịch hủy
**Đã có:** admin restore có kiểm `cancelled` + slot còn trống
(`admin/appointment.controller.js:919-952`); route lễ tân không có restore.
**Khuyến nghị:** **giữ nguyên**. Đây là thiết kế đúng, không phải thiếu sót. Nếu cần, thêm "Tạo lịch
mới từ lịch đã hủy" cho lễ tân — an toàn hơn restore vì không phá quy tắc giữ chỗ.

### 5.5 D82 — Consent người đi cùng
**Đã có:** `LichHen.nguoi_dat_ho_id` (dòng 18), `nguoi_dat_ho_ten` (dòng 73),
`dieu_khoan_version` + `dieu_khoan_dong_y_luc` (dòng 108-109) → **đã có tiền lệ lưu bằng chứng đồng
ý** trong hệ thống.
**Khoảng trống:** `grep nguoi_di_cung|consent` = **0 kết quả**.
**Nâng cấp:** thêm `nguoi_di_cung` vào `HangDoi` (họ tên, quan hệ, SĐT, `dong_y_chia_se_thong_tin`,
phạm vi) — mô phỏng đúng cách `dieu_khoan_*` đã làm ở `LichHen`.

---

## 6. Kế hoạch task

Nguyên tắc xuyên suốt (theo yêu cầu: **nâng cấp, không thay đổi luồng quan trọng**):
- Mọi thay đổi là **field mới / endpoint mới / nhánh mới có cờ điều kiện**.
- Không đổi chữ ký hàm hay hành vi mặc định của endpoint đang chạy.
- Field enum mới luôn có **giá trị mặc định khớp hành vi cũ** → dữ liệu cũ vẫn hợp lệ, không migration.

### Ưu tiên CAO

| # | Task | File dự kiến sửa | Rủi ro | Ghi chú |
|---|---|---|---|---|
| C1 | Khóa hồ sơ sau complete (`co_the_sua=false`) | `services/examSession.service.js` (1 dòng trong `$set`) | Rất thấp | **Làm đầu tiên** — chặn cửa cho C4 |
| C2 | Rule cảnh báo dị ứng | **Mới:** `services/drugAllergyCheck.service.js`; sửa `examSession.service.js` (bước `ke_don`), `ExamSessionPage.tsx` | Thấp | Thuần thêm; không đụng dữ liệu cũ |
| C3 | Outcome khám `ket_cuc` + chuyển viện | `models/KetQuaKham.js`, `services/examSession.service.js`, `ExamSessionPage.tsx` | Thấp | Default `dieu_tri_thuong` → hồ sơ cũ vẫn hợp lệ |
| C4 | Endpoint đính chính có version | `routes/doctor/exam-session.routes.js`, `services/examSession.service.js` | Trung bình | **Phụ thuộc C1** |
| C5 | Hồ sơ tạm không SĐT | `models/HoSoBenhNhan.js`, `models/HangDoi.js`, `patient-intake.controller.js`, `centralOfflineQueue.service.js`, `PatientIntake.tsx` | **Cao** | Chạm 3 tầng chặn — cần cờ `la_ho_so_tam`, tuyệt đối không bỏ ràng buộc vô điều kiện |
| C6 | Nút cấp cứu + thông báo khẩn | `patient-intake.controller.js`, `doctorQueueRealtime.service.js`, `PatientIntake.tsx` | Thấp | Tái dùng enum `cap_cuu` + realtime đã có |

**Thứ tự bắt buộc:** `C1 → C4`. `C1` cũng phải xong trước bất kỳ task B57 nào ở nhóm Trung bình.

### Ưu tiên TRUNG BÌNH

| # | Task | File dự kiến sửa | Ghi chú |
|---|---|---|---|
| M1 | Gõ kiểu + luồng `dich_vu_tu_choi` | `models/KetQuaKham.js`, `billing.controller.js`, `Payments.tsx` | Có tiền lệ: `dich_vu_phat_sinh` đã gõ kiểu |
| M2 | Chuyển chuyên khoa ở hàng đợi | `services/queueTransfer.service.js` (nới §2.2), `Dashboard.tsx` | Ghép với `ket_cuc='chuyen_chuyen_khoa'` của C3 |
| M3 | Gộp hồ sơ (admin) | **Mới:** endpoint admin merge; `HoSoBenhNhan.js` | ⚠️ Phải gỡ unique index `member_id`/`khach_vang_lai_id` trước khi gán |
| M4 | Trả bệnh nhân khỏi phòng (B57) | `routes/doctor/queue.routes.js`, `queue.controller.js` | ⚠️ **Phụ thuộc C1** — xem §2.3 |
| M5 | Thay hồ sơ của lượt chờ (C75) | **Mới:** action trong `queue.controller.js` | Chỉ cho khi chưa `trong_phong` |

### Ưu tiên THẤP

| # | Task | Ghi chú |
|---|---|---|
| L1 | Enum lý do đóng lượt + bắt buộc lý do cho bác sĩ | `queueCancel.service.js` — xem §2.4 |
| L2 | Contact task `goi_lai_benh_nhan` | Tái dùng hạ tầng có sẵn, chi phí thấp |
| L3 | Consent người đi cùng | `models/HangDoi.js` — mô phỏng `dieu_khoan_*` của `LichHen` |
| L4 | A30 offline recovery | **Khuyến nghị mô tả quy trình giấy, chưa code** |
| L5 | A28 lễ tân restore | **Khuyến nghị giữ nguyên** — thiết kế hiện tại đúng |

---

## 7. Ba nguyên tắc khi trả lời hội đồng

**1. Không nói "hệ thống đã có" cho mục file E đánh dấu Một phần.**
Nói theo cấu trúc: *đã có gì (kèm file:dòng) → giới hạn hiện tại → hướng nâng cấp → vì sao thiết kế
hiện tại vẫn an toàn.*

**2. Biến khoảng trống thành điểm cộng bằng cách giải thích lý do khóa.**
Nhiều mục "thiếu" thực chất là **cố ý khóa để bảo vệ dữ liệu**: lễ tân không hủy được lượt
`trong_phong`, không restore được lịch, không gộp được hồ sơ. Đó là quyết định thiết kế, không phải
quên. Nói rõ: *"nhóm chọn khóa chặt rồi mở dần có kiểm soát, thay vì mở sẵn quyền rồi vá sau."*

**3. Chủ động nêu điểm yếu ở §2.3 nếu bị hỏi sâu về toàn vẹn hồ sơ.**
Việc nhóm **tự phát hiện** rằng hồ sơ đang được khóa nhờ máy trạng thái hàng đợi chứ không nhờ
`co_the_sua`, và **tự đặt ràng buộc thứ tự** giữa B54/B55 và B57, là bằng chứng nhóm hiểu hệ thống ở
mức kiến trúc chứ không chỉ mức tính năng. Đây là câu trả lời ghi điểm mạnh nhất trong cả tài liệu.

---

## 8. Tham chiếu

- `docs/Hoi-dong/E-Phan-tich-chi-tiet-cac-phan-can-nang-cap-co-dan-chung.md` — nguồn định hướng
- `docs/Hoi-dong/{A,B,C,D}-*.md` — bộ câu hỏi gốc
- `.claude/rules/lich-lam-viec-bac-si.md` — nghiệp vụ lịch hẹn (bất biến, không đụng trong kế hoạch này)
