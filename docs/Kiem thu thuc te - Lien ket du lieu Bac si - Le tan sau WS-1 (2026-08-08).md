# Kiểm thử thực tế — Liên kết dữ liệu Bác sĩ ↔ Lễ tân sau WS-1 (2026-08-08)

> Trả lời trực tiếp câu hỏi: sau khi WS-1 (luồng khám 4 bước) đã merge, hai chiều dữ liệu
> **bác sĩ → lễ tân** và **lễ tân → bác sĩ** có thực sự kết nối và đầy đủ hay không — kiểm bằng
> dữ liệu thật trên DB TEST (`DATN_VITAFAMILY_CLAUDE_TEST`), không suy đoán từ đọc code.
> Không chạm DB dùng chung `DATN_VITAFAMILY`.

## Tóm tắt kết quả

| Chiều dữ liệu | Đã test thật? | Kết quả |
|---|---|---|
| Bác sĩ hoàn tất ca khám (kèm dịch vụ phát sinh) → Lễ tân thấy & thu tiền đúng | **Trước hôm nay: CHƯA BAO GIỜ.** Hôm nay: có, script mới `e2e-lien-ket-bacsi-letan.js` | ✅ 21/21 — dữ liệu đầy đủ, chính xác |
| Lễ tân check-in → Bác sĩ thấy trong hàng đợi | Đã có từ WS-4 (`e2e-luong-tiep-nhan.js`), chạy lại hôm nay để đối chiếu sau WS-1 | ✅ 34/34 (nhóm 0–5) — không suy giảm. Nhóm 6–7 không hoàn tất vì lý do môi trường, xem mục riêng bên dưới, **không phải lỗi liên kết** |

**Kết luận ngắn:** dữ liệu trao đổi giữa hai vai trò **đầy đủ** ở cả hai chiều. Phát hiện đáng chú
ý nhất không phải là một lỗi, mà là một mắt xích **chưa từng được test bằng dữ liệu thật** trước
hôm nay dù đã tồn tại từ khi WS-1 merge — xem mục "Phát hiện chính".

## Phương pháp

- Toàn bộ chạy trên `DATN_VITAFAMILY_CLAUDE_TEST` (DB TEST riêng, có guard chặn chạy nhầm DB
  không chứa chữ "TEST" ở đầu mỗi script).
- Chiều A (bác sĩ → lễ tân): gọi trực tiếp `examSession.service.js` (giống cách bác sĩ lưu từng
  bước) rồi gọi trực tiếp các hàm export của `receptionist/billing.controller.js` với req/res giả
  lập — không cần bật server Express, tương tự kỹ thuật `e2e-phien-kham-4-buoc.js` đã dùng.
- Chiều B (lễ tân → bác sĩ): bật thật server Express (`node src/index.js`, PORT=5199) trỏ vào DB
  TEST, chạy `e2e-luong-tiep-nhan.js` gọi HTTP thật qua `fetch` — không mock tầng nào.
- Toàn bộ dữ liệu test tự tạo đều được dọn sạch sau khi chạy (đã xác minh lại bằng truy vấn đếm
  bản ghi còn sót — 0 bản ghi orphan).

## A. Bác sĩ → Lễ tân (dịch vụ phát sinh, hóa đơn)

Script mới: `backend/src/scripts/e2e-lien-ket-bacsi-letan.js` (`npm run test:e2e:bacsi-letan`).

**Vì sao cần viết mới:** `e2e-phien-kham-4-buoc.js` (WS-1) chỉ kiểm tới ranh giới
`hoanTatPhienKham()` trả về `co_dich_vu_can_thu` / `tong_tien_dich_vu` — chưa từng có script nào
gọi tiếp sang `receptionist/billing.controller.js` để xác nhận lễ tân **thực sự đọc được** đúng dữ
liệu đó. Đây là mắt xích duy nhất trong toàn bộ WS-1 chưa được test bằng dữ liệu thật trước hôm
nay, dù đã nằm trên nhánh đã merge.

**Kịch bản đã chạy (dữ liệu thật, không giả định):**

1. Bác sĩ hoàn tất ca khám vãng lai (offline) với 1 dịch vụ, số lượng 2 (Nội soi TMH, 250.000đ/đơn
   vị) → `hoanTatPhienKham` trả `co_dich_vu_can_thu=true`, `tong_tien_dich_vu=500.000`.
2. Lễ tân gọi `GET /receptionist/payments/cases/:id?source=offline` — nhận đúng: 1 dòng dịch vụ,
   số lượng 2, đơn giá 250.000 (server tính lại từ `DichVu.gia`, **không** lấy giá client gửi vì
   luồng khám không hề gửi giá), `tong_tien_phat_sinh=500.000`, tổng cộng phí khám + dịch vụ =
   700.000, trạng thái `chua_thanh_toan`.
3. Ca này xuất hiện đúng trong `GET /receptionist/payments/cases?view=pending` (danh sách "chờ
   thanh toán" của lễ tân).
4. Lễ tân lập hóa đơn + thu tiền mặt (`POST .../invoice`) → `trang_thai_hoa_don=da_thanh_toan_du`,
   `da_xac_nhan_thu_ngan=true`, tổng đã thu khớp tổng phải thu.
5. Sau khi thu tiền, ca **rời khỏi** tab "chờ thanh toán" và **xuất hiện** đúng ở tab "đã thanh
   toán" — không bị kẹt ở cả hai hoặc mất khỏi cả hai.
6. Lặp lại toàn bộ cho ca **đặt online** (không chỉ vãng lai) — cùng kết quả đúng.

**21/21 bước kiểm đạt.** Không có bước nào cần sửa code — đây là kết quả xác nhận, không phải
lỗi cần vá.

## Phát hiện chính — không phải lỗi, nhưng cần ghi lại để không hiểu nhầm sau này

`hoanTatPhienKham()` (WS-1) đặt thẳng `LichHen.status = 'completed'` cho ca đặt online. Luồng cũ
(`queue.controller.js` `finish()`) đặt `'waiting_record'` trước, chỉ lên `'completed'` sau khi lễ
tân thu đủ tiền (qua `hoanTatLuotKhamOnlineNeuDaThuDu` trong `billing.controller.js`).

**Đã kiểm chứng bằng dữ liệu thật (nhóm B1 trong script mới):** việc "nhảy cóc" qua
`'waiting_record'` **không làm mất khả năng lễ tân nhìn thấy ca cần thu tiền**, vì
`billing.controller.js` có sẵn:

```js
const ONLINE_ELIGIBLE = ['waiting_record', 'completed']
```

— nhận cả hai trạng thái. Ca online hoàn tất qua luồng 4 bước mới vẫn `GET` được (HTTP 200), vẫn
xuất hiện đúng ở tab "chờ thanh toán", vẫn tính đúng `dich_vu_chi_dinh`. **Kết luận: không cần sửa
gì** — hành vi hiện tại đúng theo dữ liệu thực tế, dù khác cách đặt trạng thái so với luồng cũ.

Hệ quả duy nhất (không chặn merge, chỉ để biết): hàm `hoanTatLuotKhamOnlineNeuDaThuDu` trở thành
không bao giờ có tác dụng cho ca đi qua luồng 4 bước mới (vì không còn ở `'waiting_record'` để nó
chuyển) — hàm này chỉ còn ý nghĩa với ca đi qua `finish()` cũ. Không ảnh hưởng tính đúng của dữ
liệu lễ tân thấy, chỉ là code chết một phần cho nhánh mới.

## B. Lễ tân → Bác sĩ (check-in → hàng đợi)

Đã có `e2e-luong-tiep-nhan.js` từ WS-4 (36/36 khi đó). Chạy lại **live** hôm nay qua server thật để
đối chiếu sau khi WS-1 chạm vào các file dùng chung (`examSession.service.js`,
`room-status.controller.js`, `TrangThaiPhongKham`).

**Nhóm 0–5 (xác thực route, tiếp nhận tạo hàng đợi, bác sĩ thấy dữ liệu, ràng buộc 1 lượt/lịch,
quét no_show cuối ca): 34/34 đạt.** Không suy giảm sau WS-1 — dữ liệu tiếp nhận của lễ tân
(`ho_so_benh_nhan_id`, `so_dien_thoai`, `ho_ten`, giờ hẹn gốc) truyền đúng, đầy đủ sang hàng đợi mà
bác sĩ đọc.

**Nhóm 6–7 không hoàn tất — vì lý do môi trường chạy test, không phải lỗi liên kết dữ liệu:**
- Nhóm 6 ("vào phòng") thất bại với `409 Bác sĩ đang ngoài ca hoặc trong giờ nghỉ` — vì kịch bản
  chạy vào buổi tối (ngoài giờ hành chính phòng khám 08:00–17:30 cấu hình trong DB TEST), không
  liên quan gì tới WS-1.
- Nhóm 7 (dời lịch) dừng giữa chừng vì trùng khóa `schedule_id + slot_id` — do một lượt chạy trước
  đó của cùng script bị dừng giữa chừng (lúc tôi còn đang dựng fixture) để lại trạng thái slot
  không hoàn toàn khớp giả định thứ tự mảng của script. Không liên quan WS-1; dữ liệu orphan đã
  được `donDep()` của chính script dọn sạch (đã xác minh lại bằng đếm bản ghi).
- Khuyến nghị: chạy lại `e2e-luong-tiep-nhan.js` trong giờ hành chính khi cần xác nhận trọn vẹn cả
  7 nhóm — không phải việc phải làm ngay, vì phần liên quan trực tiếp câu hỏi hôm nay (lễ tân tiếp
  nhận → bác sĩ nhận được dữ liệu) đã đạt 100% ở nhóm 0–5.

## Phát hiện phụ — DB TEST thiếu fixture bệnh nhân/lễ tân

`DATN_VITAFAMILY_CLAUDE_TEST` tại thời điểm kiểm tra: **0 bản ghi `HoSoBenhNhan`** trong toàn bộ
DB (dù đã có sẵn tài khoản + nhóm gia đình + thành viên gia đình từ trước). Đây là lý do
`e2e-luong-tiep-nhan.js` chưa từng chạy được trên DB TEST hiện tại trước hôm nay — nó cần ít nhất
1 hồ sơ bệnh nhân `active` để tra cứu check-in. (Tài khoản lễ tân thì đã có sẵn
`reception@vitafamily.vn`, không thiếu — lúc đầu tôi tưởng thiếu do gõ nhầm tên collection khi
kiểm tra, đã tự sửa.)

Đã tạo tạm 1 `HoSoBenhNhan` gắn vào thành viên gia đình có sẵn ("Lê Văn Nam") để chạy được kịch
bản, **đã xóa lại đúng bản ghi đó sau khi test xong** (không đụng gia đình/thành viên có sẵn).
Khuyến nghị: nếu nhóm muốn `e2e-luong-tiep-nhan.js` tự chạy được mà không cần vá tay mỗi lần, thêm
1 bước seed hồ sơ bệnh nhân mẫu vào `seed-all.js` hoặc một script seed riêng cho DB TEST.

## Việc đã thêm vào repo

- `backend/src/scripts/e2e-lien-ket-bacsi-letan.js` — script test mới, giữ lại lâu dài (theo đúng
  quy ước thư mục `scripts/e2e-*.js` đã có), lấp đúng mắt xích trước đây chưa test.
- `backend/package.json` — thêm `"test:e2e:bacsi-letan": "node src/scripts/e2e-lien-ket-bacsi-letan.js"`.

## Trả lời trực tiếp câu hỏi "dữ liệu đã đầy đủ hay chưa"

**Có, đầy đủ ở cả hai chiều**, đã kiểm bằng dữ liệu thật chứ không chỉ đọc code:
- Bác sĩ → lễ tân: tên dịch vụ, số lượng, đơn giá (tính lại phía server), thành tiền, tổng tiền
  khám + phát sinh, tên bệnh nhân, trạng thái hóa đơn — tất cả khớp đúng, cho cả ca vãng lai và ca
  đặt online.
- Lễ tân → bác sĩ: tên, số điện thoại, giờ hẹn gốc, mốc thời gian (`da_toi_khung`,
  `tre_qua_grace`), bậc ưu tiên động — tất cả truyền đúng, đầy đủ sang phía bác sĩ ngay sau khi lễ
  tân tiếp nhận.

Không có trường dữ liệu nào bị thiếu hoặc sai ở hai chiều đã kiểm. Vấn đề duy nhất cần biết
(`waiting_record` bị bỏ qua) đã xác minh là vô hại nhờ `billing.controller.js` đã tính đến cả hai
trạng thái từ trước.
