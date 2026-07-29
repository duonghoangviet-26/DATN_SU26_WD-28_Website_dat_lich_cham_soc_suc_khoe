# Phân tích lỗ hổng — Luồng đặt lịch Online + Offline (2026-07-25)

> **Nguồn vào:** `De_xuat_luong_dat_lich_Online_Offline.md` (đề xuất của nhóm)
> **Đối chiếu:** `.claude/rules/lich-lam-viec-bac-si.md` (rule đang đóng băng) + code thực tế nhánh `Bac_si`
> **Kết quả:** 25 lỗ hổng, 3 quyết định nghiệp vụ mới, 3 điều chỉnh chính sách theo yêu cầu người dùng.
> **Phạm vi:** phòng khám tư 1 chuyên khoa **Tai Mũi Họng**. Mọi quy tắc dưới đây phải mở rộng được sang chuyên khoa khác **bằng cấu hình, không sửa code logic**.

---

## 1. Ba mâu thuẫn gốc giữa đề xuất và hệ thống hiện tại

| | Đề xuất | Rule / code hiện tại | Đã chốt |
|---|---|---|---|
| Chọn bác sĩ | Bệnh nhân **không** chọn, hệ thống tự gán | `createBooking` **bắt buộc** `doctor_id`; rule §5 "1 lượt/**bác sĩ**/ngày" | **Tự gán mặc định + vẫn cho chọn đích danh** khi khách có nguyện vọng hoặc tái khám |
| Sức chứa | Tổng sức chứa **động**, không chia cứng | Tách `loai_slot` online/walk-in, quota **70/30**, walk-in không lấn online | **Giữ quota 70/30 + tự giải phóng hai chiều** — quota là *chính sách giữ chỗ có thời hạn*, không phải vách ngăn |
| Mốc giờ | Đóng đặt online `T-30'`, grace 10' | Không có cutoff; cửa sổ ưu tiên `±30'` (`HangDoi.js:11`) | **Cutoff `T-30'`, giữ chỗ co giãn, grace `15'`** |

Thêm 3 điều chỉnh chính sách do người dùng chốt trong phiên này:

- **Không hoàn tiền trong mọi trường hợp** — thay thế rule §5 ("hủy trước ca → hoàn 100%").
- **Khách xin dời lịch: 1 lần duy nhất** — siết rule §9 ("đổi lịch ≤ 3").
- **Không nhận đặt hộ qua điện thoại** — lễ tân chỉ báo mức độ còn trống để khách qua khám trực tiếp.

---

## 2. Mô hình chốt

### 2.1 Sức chứa: quota có thời hạn

```
Khung 30'  ──►  slot online (70%)  ──[tới mốc T-30']──►  slot walk-in
           └─►  slot walk-in (30%)  ── không bao giờ chảy ngược ──┘
```

Hai chiều giải phóng:

1. **Online → walk-in (tự động):** tới `T-30'`, slot online chưa bán của khung đó tự chuyển thành walk-in. Đây là thứ đề xuất muốn nhưng chưa mô tả ai làm.
2. **Walk-in không lấn online (bất biến):** trước cutoff, khách đến trực tiếp **không** được lấy slot online của khung hiện tại — đó là phần bảo vệ giá trị của việc đặt lịch. Bù lại, khách được xếp vào slot walk-in của **khung kế tiếp**, và mọi khung đã qua cutoff đều mở hết cho họ.

### 2.2 Thang thời gian của một khung bắt đầu lúc `T`

| Mốc | Sự kiện |
|---|---|
| `T-30'` | **Đóng đặt online.** Slot online chưa bán → chuyển walk-in. Cũng là hạn chót xin dời lịch |
| `T-15'` | Hạn chót mọi giữ chỗ chờ thanh toán của khung này |
| `T` → `T+15'` | **Grace.** Khách online giữ ưu tiên `online_uu_tien` |
| `T+15'` → hết ca | Trễ: vẫn được khám, tụt xuống mức `offline`, **không mất tiền** |
| Hết ca chưa đến | `no_show`, mất 100% |

Giữ chỗ chờ thanh toán **co giãn**: `min(15', T-15' − now)`. Slot bị bỏ dở luôn được nhả **trước** cutoff, không bao giờ chết qua cutoff.

### 2.3 Thang xử lý tiền (không hoàn tiền)

```
Đến trong grace (T → T+15')          → khám, ưu tiên online
Trễ > 15' nhưng còn trong ca          → khám, tụt xuống mức offline, KHÔNG mất tiền
Đã check-in, hết ca chưa được gọi     → dời lịch, KHÔNG mất tiền, không tính hạn mức
Hết ca không đến                      → no_show, mất 100%
Khách chủ động hủy                    → mất 100%
Khách xin dời (trước T-30')           → được 1 lần duy nhất
Lỗi phòng khám                        → dời tùy tình huống, không tính hạn mức
```

---

## 3. Danh mục 25 lỗ hổng

### Nhóm A — Lỗ hổng trong chính đề xuất (L1–L9)

#### L1. Cutoff bị vô hiệu bởi cơ chế giữ chỗ thanh toán
**Tình huống:** khách bấm đặt lúc `T-31'`, giữ chỗ 15' → ghế khoá tới `T-16'`. Cron nhả slot chạy mỗi 15' (`cron/index.js:39`) → thực tế tới `T-1'` mới trả về. Lễ tân từ chối khách đứng trước mặt trong khi ghế trống.
**Khắc phục:** giữ chỗ co giãn `min(15', T-15' − now)`; nhả slot **lazy** ngay khi có ai đọc lịch, không chờ cron; hạ chu kỳ cron 15' → 5' làm lưới an toàn.

#### L2. Không ai thực thi việc "đóng đặt online"
**Tình huống:** đề xuất tuyên bố đóng đặt online nhưng không chỉ định tác nhân nào chuyển slot online dư sang walk-in. Không có tác nhân thì mốc `T-30'` chỉ là câu chữ.
**Khắc phục:** chuyển trạng thái **lazy** tại thời điểm đọc lịch (cả API bệnh nhân lẫn lễ tân) + cron 5' quét bù. Mỗi lần chuyển ghi nhật ký để đối chiếu.

#### L3. Giải phóng một chiều gây từ chối oan
**Tình huống:** 09:00 slot walk-in đã hết, còn 1 slot online trống, chưa tới cutoff. Khách đứng ở quầy bị đuổi trong khi phòng khám còn ghế.
**Khắc phục:** giữ nguyên tắc không lấn (bảo vệ khách online), nhưng lễ tân **được xếp khách vào slot walk-in khung kế tiếp**, và mọi khung đã qua cutoff mở hết. Từ chối chỉ xảy ra khi **toàn bộ** khung còn lại của ca đã đầy.

#### L4. "Mất ưu tiên" bị hiểu lẫn với "mất tiền"
**Tình huống:** khách trễ 20', bị đẩy xuống cuối hàng, tới hết ca vẫn chưa được gọi. Hệ thống nên coi là no-show (mất 100%) hay chuyển lịch (giữ tiền)?
**Khắc phục:** tách bạch bằng **sự kiện check-in**, xem thang tiền mục 2.3. Đã bước chân tới quầy thì không bao giờ mất tiền; chỉ "hết ca mà không có bản ghi `HangDoi`" mới là no-show.

#### L5. Khách vãng lai bị bỏ đói (starvation)
**Tình huống:** khách đến 08:00 không có hẹn. Cứ mỗi khung lại có khách online check-in đúng giờ, luôn được chèn lên trên. Khách vãng lai có thể chờ tới trưa.
**Khắc phục:** **aging** — chờ quá 2 khung (60') thì tự nâng một bậc ưu tiên. Trần chờ hữu hạn, không phá thứ tự trong điều kiện bình thường.

#### L6. Hệ thống đang phạt người đến sớm
**Tình huống:** khách hẹn 10:00, đến 08:50 để chờ. `tinhMucUuTien` (`HangDoi.js:14-21`) tính `|lệch| = 70' > 30'` → trả `online_thuong`, xếp **sau** người check-in lúc 09:45. Đến sớm bị phạt.
**Khắc phục:** bậc ưu tiên phải **tính động lúc query** — đúng tinh thần rule §6 ("không lưu `thu_tu`, tính động"), nhưng `muc_uu_tien` hiện lại bị lưu cứng lúc check-in. Định nghĩa lại 3 bậc cho hết mơ hồ:

| Bậc | Điều kiện |
|---|---|
| `online_uu_tien` | Online, **đã tới khung của mình** (`now ≥ T`) và check-in **≤ `T+15'`** |
| `online_thuong` | Online, đã check-in nhưng **chưa tới khung của mình** (đến sớm). Tới `T` thì **tự động lên** `online_uu_tien` |
| `offline` | Walk-in, **hoặc** online check-in **sau `T+15'`** |

Đến sớm chỉ phải chờ tới lượt khung của mình rồi được nâng bậc tự động — không còn bị đẩy xuống dưới người đến muộn hơn. Vẫn giữ nguyên tắc **không được gọi trước đầu khung của mình**, trừ khi bác sĩ rảnh và không còn ai thuộc khung hiện tại.

#### L7. Bác sĩ nghỉ đột xuất khi khách đã trả tiền
**Tình huống:** câu hỏi #3 của nhóm. Rule cũ chỉ nói "thông báo bệnh nhân", không nói xử lý tiền và chỗ.
**Khắc phục (theo chính sách không hoàn tiền):**
1. Tự tìm bác sĩ cùng chuyên khoa còn slot online **cùng khung** → chuyển, giữ nguyên giá, thông báo.
2. Không có → đề nghị khung/ngày gần nhất, tiền giữ nguyên.
3. Khách không đồng ý mốc nào → giữ quyền dời mở, **không hoàn tiền**.
Lần dời này mang `ly_do_doi = phong_kham`, **không tính** vào hạn mức 1 lần của khách.

#### L8. Ca khám kéo dài vượt dự kiến
**Tình huống:** câu hỏi #4 của nhóm. Một ca nội soi kéo dài, khung sau dồn 40'. Khách khung sau đến đúng giờ vẫn phải chờ, trong khi lễ tân vẫn tiếp tục nhận thêm walk-in cho các khung sau — đổ thêm dầu vào lửa.
**Khắc phục — overflow control theo độ trễ tích luỹ của ca:**
- Trễ ≥ **1 khung (30')** → tự động **ngừng bán slot walk-in** cho các khung còn lại của ca + cảnh báo lễ tân.
- Trễ ≥ **2 khung (60')** → **chặn cả đặt online** vào các khung còn lại của ca đó; khách mới được điều sang bác sĩ khác hoặc ngày khác.
Ngưỡng là cấu hình, không hardcode.

#### L9. Có giới hạn khách offline mỗi khung không?
**Tình huống:** câu hỏi #5 của nhóm. Nếu chỉ dựa vào tổng sức chứa, lễ tân sẽ nhận vượt trần lúc đông.
**Khắc phục:** **có** — giới hạn chính là số slot walk-in của khung, cộng quyền mượn khung kế tiếp (L3). **Trần overbook = 0**: hết là từ chối rõ ràng kèm gợi ý khung trống gần nhất. Không có "nhận đại rồi tính sau".

---

### Nhóm B — Phát sinh từ quyết định tự gán bác sĩ (L10–L13)

#### L10. Giá khám nhảy khi tự gán
**Tình huống:** mỗi bác sĩ một giá (`BacSi.gia_kham`, dùng ở `patient/booking.controller.js:380`). Khách chọn khung 09:00, hệ thống gán bác sĩ A giá 300k; khách khác cùng khung được gán bác sĩ B giá 250k → "tại sao người này khám rẻ hơn tôi?".

**Đối chiếu thực tế thị trường (tra cứu 2026-07-25):**

| Nơi | Cách phân giá |
|---|---|
| BV Việt Đức | 500.000đ (GS/PGS/TS/BSCKII là trưởng–phó khoa) · 300.000đ (ThS/BS/BSCKI) |
| BV Bạch Mai | 3 bậc: 400.000đ (GS/PGS) · 350.000đ (TS/BSCKII) · 300.000đ (ThS/BS) |
| BookingCare | Miễn phí đặt lịch; phí khám theo bảng giá niêm yết của cơ sở, hiển thị ngay dưới lịch khám của bác sĩ |
| Pháp lý | TT 13/2023/TT-BYT cho phép phân mức giá theo *trình độ chuyên môn của người cung cấp dịch vụ* |

→ Giá khác nhau là **chuẩn ngành và hợp pháp**, nhưng phân theo **hạng công khai**, không theo từng cá nhân tuỳ hứng. Câu hỏi "sao người kia rẻ hơn" được trả lời bằng bảng giá niêm yết.

**Khắc phục cho VitaFamily:** dùng **một giá duy nhất theo chuyên khoa** (`ChuyenKhoa.gia_kham`). Phòng khám tư một chuyên khoa TMH, đội ngũ chưa phân hạng học hàm — thêm bậc giá chỉ làm phức tạp đồ án mà không thêm giá trị. Giữ `BacSi.gia_kham` như field kỹ thuật nhưng **không dùng để tính tiền**. Giá phải hiển thị **trước** khi giữ chỗ.
**Khi mở rộng:** thêm `hang_bac_si` (enum) + bảng giá theo hạng, kèm luật **nâng hạng miễn phí** — nếu chỉ còn bác sĩ hạng cao hơn rảnh, khách được khám hạng cao với giá đã báo. Tự gán **không bao giờ** được tính cao hơn giá khách đã thấy.

#### L11. Không có luật gán → dồn tải
**Tình huống:** không quy định thì code sẽ lấy bác sĩ đầu danh sách; một người kín lịch trong khi người khác trống.
**Khắc phục — thứ tự xác định (deterministic), không random:**
1. Bác sĩ đã khám cho bệnh nhân này gần nhất, nếu còn slot online cùng khung (giữ mạch tái khám).
2. Bác sĩ có ít lịch nhất trong ca.
3. Tie-break theo `doctor_id` tăng dần — để kết quả lặp lại được khi kiểm thử.

#### L12. "1 lượt/bác sĩ/ngày" vô nghĩa khi tự gán — và code không kiểm tra gì cả
**Tình huống:** rule §5 giới hạn theo bác sĩ, nhưng khi hệ thống tự gán thì khách không kiểm soát được mình gặp ai → giới hạn vô nghĩa. Nặng hơn: `createBooking` hiện **không có bất kỳ kiểm tra trùng lặp nào**, khách đặt bao nhiêu lượt cùng ngày cũng được.
**Khắc phục:** đổi thành **1 lượt / chuyên khoa / ngày / người được khám**, trong đó "người được khám" tính theo `member_id` — **không** phải `user_id`, vì một tài khoản đặt cho cả gia đình.

#### L13. Giữ nhiều slot bằng cách bỏ thanh toán rồi đặt lại
**Tình huống:** khách đặt khung 09:00 rồi không trả tiền, quay lại đặt 09:30, rồi 10:00 — ba slot cùng bị khoá `pending_payment`.
**Khắc phục:** tối đa **1 `pending_payment` đang hoạt động** trên mỗi người được khám; đặt mới thì huỷ giữ chỗ cũ ngay lập tức.

---

### Nhóm C — Lỗ hổng đang nằm sẵn trong code (L14–L20)

#### L14. Nghiệp vụ 70/30 hiện KHÔNG chạy — P0
**Bằng chứng:** `backend/src/models/ChuyenKhoa.js` **không còn** 3 field `thoi_gian_kham_trung_binh_phut`, `so_slot_moi_khung`, `ty_le_online_phan_tram` (mất sau khi merge `main` — commit `ca685dc`), trong khi `scheduleGenerator.service.js:56` vẫn `.select('so_slot_moi_khung ty_le_online_phan_tram')`. Mongoose loại bỏ path không khai báo trong schema → luôn `undefined` → rơi vào fallback dòng 58-59: **1 slot/khung, 100% online**.
**Hệ quả:** dữ liệu demo đang sinh 15 slot/ngày, toàn bộ online — không phải 30 slot/ngày với tỉ lệ 70/30 như rule §2 mô tả. Mọi luật walk-in hiện không có chỗ nào để áp dụng.
**Khắc phục:** khôi phục 3 field vào model (kèm `pre('validate')` chặn admin override lên cao hơn mức an toàn), chạy lại `backfill-chuyen-khoa-slot-config.js`, sinh lại lịch cho các ngày tương lai chưa có ai đặt.

#### L15. Claim slot có thể cướp nhầm slot người khác
**Bằng chứng:** `patient/booking.controller.js:353-374` đặt các điều kiện `'slots._id'`, `'slots.status'`, `'slots.benh_nhan_id'`, `'slots.loai_slot'` **ngang cấp** trong filter. MongoDB khớp mỗi điều kiện trên **phần tử bất kỳ** của mảng, không bắt buộc cùng một phần tử. Chỉ cần trong ngày còn *một* slot `active` là điều kiện `'slots.status': 'active'` thoả, kể cả khi slot đang bị nhắm tới đã `pending_payment`.
**Khắc phục:** gói toàn bộ vào một `$elemMatch`:
```js
slots: { $elemMatch: {
  _id: slot_id, status: 'active', benh_nhan_id: null,
  loai_slot: { $ne: 'walk_in' }, bi_khoa_boi_nghi_phep: { $ne: true },
} }
```
Cùng lỗi ở `receptionist/booking.controller.js:197-201`.

#### L16. Lệch múi giờ 7 tiếng
**Bằng chứng:** `buildSlotDateTime` (`patient/booking.controller.js:41-47`) dùng `setUTCHours` — chuỗi `"08:00"` thành 08:00Z tức **15:00 giờ VN**. Do đó `isSlotInPast` cho phép đặt slot đã trôi qua. Trong khi `cancelBooking:511-513` lại dùng `setHours` (giờ local). Hai nơi hai hệ quy chiếu.
**Khắc phục:** một hàm chuẩn duy nhất quy đổi `(ngày, "HH:MM") → Date` theo `Asia/Ho_Chi_Minh`, dùng chung toàn hệ thống. **Bắt buộc phải sửa trước**, vì mọi mốc `T-30'`, `T-15'`, `T+15'` của thiết kế này đều tính từ giờ khám.

#### L17. Ràng buộc "1 slot ↔ 1 lịch hẹn" chỉ tồn tại trong code
**Bằng chứng:** rule §7 quy định bất biến này nhưng `LichHen` không có index nào đảm bảo. Chỉ cần một đường ghi bỏ sót là sinh hai lịch hẹn trên cùng slot.
**Khắc phục:** unique partial index `{ schedule_id: 1, slot_id: 1 }` với điều kiện `status != 'cancelled'`.

#### L18. Đánh giá bác sĩ không cần từng khám xong
**Bằng chứng:** `createDoctorReview` (`patient/booking.controller.js:595-601`) chỉ kiểm tra **tồn tại lịch hẹn bất kỳ** với bác sĩ đó, không lọc `status: 'completed'`. Khách đặt rồi huỷ vẫn viết được đánh giá, và điểm này lại ghi đè `BacSi.diem_danh_gia`.
**Khắc phục:** chỉ cho đánh giá lịch hẹn `status: 'completed'`, mỗi lịch một đánh giá.

#### L19. Cron nhả slot quá hạn chạy 15'
**Bằng chứng:** `cron/index.js:39`. Với cutoff `T-30'`, độ trễ này ăn hết nửa cửa sổ bán lại.
**Khắc phục:** 5' + nhả lazy khi đọc (đi kèm L1).

#### L20. Lễ tân đang đặt hộ được vào slot online của ngày bất kỳ
**Bằng chứng:** `receptionist/booking.controller.js` — `getSlots:146-148` **không lọc `loai_slot`**, `createBooking:169-186` nhận bất kỳ `ngay_kham` tương lai nào. Nghĩa là đặt hộ qua điện thoại đang ăn thẳng vào quota dành cho khách đặt online, không phải quota walk-in.
**Khắc phục (theo chính sách đã chốt — không nhận đặt hộ):**
- Lễ tân **chỉ tra cứu** và báo **mức độ** còn trống ("còn nhiều / còn ít / đã đầy"), kèm cảnh báo không giữ chỗ. Không trả về con số chính xác để tránh thành lời hứa; ghi nhật ký cuộc tra cứu để đối chiếu khi khách khiếu nại.
- Ràng buộc kỹ thuật để chính sách không bị lách: lễ tân chỉ tạo được lượt cho **khung đang diễn ra hoặc khung kế tiếp trong cùng ca của hôm nay**, và **chỉ vào slot `loai_slot = 'walk_in'`**.
- Lý do bỏ đặt hộ: khách đặt qua điện thoại không thanh toán trước, tỉ lệ không đến cao → giữ chỗ gần như công cốc.

---

### Nhóm D — Phát sinh từ chính sách không hoàn tiền (L21–L25)

#### L21. Thu tiền không hoàn mà không có bằng chứng khách đã đồng ý
**Tình huống:** khách mất 100% vì không đến, khiếu nại "tôi không hề biết là không được hoàn".
**Khắc phục:** checkbox bắt buộc trước bước thanh toán; lưu `dieu_khoan_version` và thời điểm đồng ý vào `LichHen`. **Không có bằng chứng đồng ý thì không được thu tiền.**

#### L22. Nhầm lẫn giữa "trễ nhưng có đến" và "không đến"
**Tình huống:** khách trễ 40', lễ tân bực mình đánh dấu no-show → khách mất tiền oan dù đã có mặt.
**Khắc phục:** `no_show` **chỉ được đặt tự động** khi kết thúc ca và **không tồn tại bản ghi `HangDoi`** cho lịch hẹn đó. Lễ tân và bác sĩ **không được set tay** trạng thái này.

#### L23. Lỗi phòng khám bị ghi thành lỗi khách
**Tình huống:** bác sĩ nghỉ, thông báo không tới nơi, khách không đến → bị tính no-show và mất tiền, trong khi lỗi thuộc phòng khám.
**Khắc phục:** `ly_do_doi` là trường bắt buộc; giá trị `phong_kham` phải kèm người duyệt và lý do, ghi nhật ký. Lịch hẹn thuộc ca có bác sĩ nghỉ **không bao giờ** được tự động chuyển sang `no_show`.

#### L24. Dời lịch lấy slot ở đâu
**Tình huống:** cho lịch dời lấn slot walk-in là phá nguyên tắc 70/30; không cho gì cả thì khách không dời được vào khung đông.
**Khắc phục:** lịch dời **được ưu tiên hơn đặt mới** trên slot online (đã trả tiền rồi), nhưng **không được lấn** slot walk-in. Hết slot online thì gợi ý khung khác.

#### L25. Né mất tiền bằng cách dời phút chót
**Tình huống:** khách biết mình sắp trễ, bấm dời lúc `T-5'`. Slot đã không kịp bán cho ai — phòng khám mất trắng chỗ đó mà khách vẫn giữ nguyên quyền lợi.
**Khắc phục:** dời chỉ thực hiện được **trước `T-30'` của khung cũ** — trùng mốc đóng đặt online, để slot còn kịp trả về cho khách walk-in. Sau mốc đó chỉ còn hai lựa chọn: đến khám, hoặc mất.

---

## 4. Việc cần làm

### P0 — không làm thì rule chỉ là giấy
| # | Việc | File |
|---|---|---|
| L14 | Khôi phục 3 field cấu hình chuyên khoa + backfill + sinh lại lịch | `models/ChuyenKhoa.js`, `scripts/backfill-chuyen-khoa-slot-config.js` |
| L16 | Hàm chuẩn giờ `Asia/Ho_Chi_Minh` dùng chung | `patient/booking.controller.js`, `receptionist/booking.controller.js` |
| L15 | Đổi claim slot sang `$elemMatch` | hai `booking.controller.js` |
| L12 | Chặn trùng lượt: 1 lượt/chuyên khoa/ngày/`member_id` | `patient/booking.controller.js` |

### P1 — nghiệp vụ chính của thiết kế này
| # | Việc |
|---|---|
| L1, L2, L19 | Cutoff `T-30'` + giữ chỗ co giãn + nhả lazy + cron 5' |
| L3, L9 | Quy tắc mượn khung kế tiếp, trần overbook = 0 |
| L6 | Tính bậc ưu tiên động lúc query, bỏ phạt đến sớm |
| L4, L22 | Tách bạch check-in / no-show; `no_show` chỉ đặt tự động |
| L10, L11 | Giá theo chuyên khoa + thuật toán tự gán xác định |
| L20 | Chặn lễ tân đặt hộ: chỉ hôm nay, chỉ slot walk-in |
| L21, L24, L25 | Điều khoản không hoàn tiền + luật dời lịch 1 lần trước `T-30'` |

### P2 — hoàn thiện
L5 (aging), L7 (thang 3 bước khi bác sĩ nghỉ), L8 (overflow control), L13, L17, L18, L23.

---

## 5. Những gì KHÔNG đổi

- Kiến trúc `slots[]` embedded trong `LichLamViec` (Lựa chọn A) — không tách collection `KhungGio`/`Slot`.
- `HangDoi`: không lưu `thu_tu`, online + walk-in chung một hàng đợi, chỉ tạo khi check-in.
- Ba tầng thời gian `CA → KHUNG GIỜ (30') → SLOT`.
- Ca sáng 08:00–11:30 (7 khung), ca chiều 13:30–17:30 (8 khung), nghỉ trưa 11:30–13:30.
- Thêm chuyên khoa mới = cấu hình, không sửa code logic.

---

## Nguồn tham khảo (mục L10)

- [Bảng giá khám theo yêu cầu BV Việt Đức](https://myhealthvn.com/huong-dan/bang-gia-kham-theo-yeu-cau-benh-vien-viet-duc/)
- [Thông tư 13/2023/TT-BYT — khung giá và phương pháp định giá dịch vụ khám chữa bệnh theo yêu cầu](https://thuvienphapluat.vn/van-ban/Tai-chinh-nha-nuoc/Thong-tu-13-2023-TT-BYT-phuong-phap-dinh-gia-dich-vu-kham-benh-chua-benh-theo-yeu-cau-548486.aspx)
- [BookingCare — Giá và thanh toán](https://bookingcare.vn/benh-nhan-thuong-hoi/gia-va-thanh-toan-f6)
- [Bộ Y tế ban hành khung giá dịch vụ khám chữa bệnh theo yêu cầu tại bệnh viện công](https://luatvietnam.vn/tin-van-ban-moi/bang-gia-dich-vu-kham-chua-benh-theo-yeu-cau-tai-benh-vien-cong-186-94654-article.html)
- [Dịch vụ y tế theo yêu cầu: "Khám giáo sư" và chuyện viện phí đúng đủ](https://cuoituan.tuoitre.vn/dich-vu-y-te-theo-yeu-cau-kham-giao-su-va-chuyen-vien-phi-dung-du-20230106155534237.htm)
