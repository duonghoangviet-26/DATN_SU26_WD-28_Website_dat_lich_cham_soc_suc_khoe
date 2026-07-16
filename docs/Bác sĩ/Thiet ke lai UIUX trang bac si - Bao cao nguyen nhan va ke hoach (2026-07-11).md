# Thiết kế lại UI/UX trang Bác sĩ — Báo cáo nguyên nhân & Kế hoạch (Bước 1 — chưa sửa code)

> Ngày: 2026-07-11. Phạm vi: chỉ `/doctor/*`. Không đụng Admin/bệnh nhân/y tá/API/backend/DB.
> Tài liệu này **kế thừa** `Audit - Thiet ke giao dien trang bac si (2026-07-11).md` (đã audit xong phần trùng lặp component: modal viết tay, loading/error viết tay, TH_PLAIN, toast, Button/màu trạng thái — 3 việc đầu đã code xong: Button variant + màu tập trung, sidebar soft, thẻ Dashboard, max-width layout). Tài liệu này tập trung vào vấn đề **mới và nghiêm trọng hơn**: cấu trúc bảng bị bóp méo và hệ thống responsive/container theo yêu cầu mới nhất.

---

## 1. Báo cáo nguyên nhân — vì sao bảng "Lịch hẹn của tôi" bị bóp méo

File duy nhất gây vấn đề: `frontend/src/pages/doctor/DoctorAppointments.tsx` (bảng chính, dòng ~516–633).

### 1.1. Nguyên nhân kỹ thuật gốc: bảng dùng `table-layout: auto` + 10 cột không có width control

```tsx
<table className="w-full min-w-[760px] text-sm">
  <thead>
    <tr>
      <th>Giờ khám</th><th>Mã lịch hẹn</th><th>Tên bệnh nhân</th><th>Tuổi/Giới tính</th>
      <th>Dịch vụ</th><th>Phòng</th><th>Y tá</th><th>Thanh toán</th><th>Trạng thái</th><th /* hành động */>
    </tr>
  </thead>
```

- Không có `table-fixed`, không có `<colgroup>`, không có class width nào trên từng `<th>`. Mặc định trình duyệt dùng **`table-layout: auto`**: độ rộng mỗi cột được tính từ nội dung, rồi co giãn theo tỉ lệ khi tổng độ rộng tự nhiên vượt quá container.
- **9 cột dữ liệu + 1 cột hành động = 10 cột** cho một bảng chỉ có `min-w-[760px]` — 760px chia cho 10 cột chỉ ~76px/cột, quá nhỏ cho cột chứa văn bản tiếng Việt (vd "Tên bệnh nhân", "Dịch vụ"). `min-w-[760px]` chỉ là **ngưỡng để bật cuộn ngang trong `overflow-x-auto`**, không phải độ rộng đảm bảo cho từng cột — khi viewport (trừ sidebar 260px + padding) nhỏ hơn tổng độ rộng tự nhiên nhưng vẫn lớn hơn 760px (đúng tình huống laptop 1280–1366px), trình duyệt **ưu tiên co bảng vừa khung** thay vì bật scroll, và vì các `<td>` không có `whitespace-nowrap`/`truncate`, phần bị co sẽ ép chữ xuống dòng — đây là nguyên nhân trực tiếp của "chữ xuống dòng tùy tiện", "chiều cao hàng không đều" (mỗi hàng wrap khác nhau tùy độ dài nội dung).
- `<th>` dùng `TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'` — có `whitespace-nowrap` nên **header không bao giờ xuống dòng**, nhưng `<td>` bên dưới thì có. Vì `table-layout: auto` tính độ rộng cột dựa trên **cả header lẫn body**, header ép cột phải đủ rộng cho chính nó, nhưng khi tổng các cột vượt khung, trình duyệt vẫn co — kết quả: cột "vừa đủ cho header" nhưng "không đủ cho body" → dữ liệu (dài hơn label header) bị wrap trong khi header thì không, tạo cảm giác lệch, khó đọc.

### 1.2. Hai cột lãng phí diện tích cho giá trị gần như luôn giống nhau

- **Cột "Y tá"**: dòng 599-602 trong code — `<td>Chưa phân công y tá</td>` — đây là **text tĩnh, không đến từ dữ liệu thật khác nhau theo hàng** (hệ thống chưa có module gán y tá cho lịch hẹn, xem `Audit - Ra soat trang bac si`). 100% số hàng hiển thị y hệt câu này, chiếm 1 cột trọn vẹn.
- **Cột "Tuổi/Giới tính"**: chỉ có dữ liệu khi `appt.tuoi`/`appt.gioi_tinh` tồn tại; khi không có, hiển thị `'—'`. Với dữ liệu mock hiện tại, phần lớn hàng rơi vào trường hợp này.

→ 2/9 cột dữ liệu đang chiếm không gian ngang cho nội dung gần như vô nghĩa lặp lại — đúng như mục V.2 yêu cầu: "không tạo cột chỉ hiển thị giá trị lặp lại", "không tạo cột Tuổi/Giới tính riêng nếu dữ liệu thường xuyên trống".

### 1.3. Vì sao nút "Xem chi tiết" bị xuống dòng

Cột hành động (`<td className="px-4 py-3">`) là cột **cuối cùng, không có tiêu đề, không có class width nào** — trong `table-layout: auto`, cột không có nội dung header định hình sẽ nhận phần độ rộng còn thừa **sau khi các cột khác đã lấy phần của chúng**; dưới áp lực 10 cột trong 760–1300px, cột hành động thường là cột bị siết nhỏ nhất còn lại. Nút bên trong (`inline-flex ... px-2.5 py-1 text-xs` chứa icon 12px + text "Xem chi tiết"/"Ẩn chi tiết") không có `whitespace-nowrap` riêng và không có `min-width`, nên khi ô cha hẹp hơn nội dung nút, chữ trong nút xuống dòng.

### 1.4. Vì sao badge trạng thái bị ép

Cột "Trạng thái" xếp `Badge` (chính) + có thể thêm `Badge color="gray"` "Hết hạn" trong `flex flex-col gap-1` (dòng 613-620) — khi cột này bị co hẹp theo mục 1.1, 2 badge xếp dọc trong 1 ô hẹp trông như bị "ép chồng", cộng với việc `Badge` (`Badge.tsx`) không giới hạn `white-space` nên nếu cột quá hẹp, ngay cả text bên trong badge cũng có thể ngắt dòng — tạo badge "méo" thay vì pill gọn 1 dòng.

### 1.5. Vì sao chưa có phân cấp nội dung

- Cột "Mã lịch hẹn" (`font-mono text-xs text-slate-500`, dòng 564-566) đứng ngay sau cột "Giờ khám" và trước "Tên bệnh nhân" — về mặt bố cục ngang, nó chiếm 1 cột full ngang bằng với "Tên bệnh nhân" dù mã lịch hẹn là thông tin phụ, ít quan trọng hơn nhiều so với tên bệnh nhân — đúng như mục V.1 nhận định "Mã lịch hẹn được ưu tiên ngang gần bằng tên bệnh nhân".
- Toàn bảng dùng chung 1 cỡ chữ `text-sm`/`text-xs` gần như đồng đều cho mọi loại dữ liệu (tên bệnh nhân, mã lịch hẹn, dịch vụ, trạng thái) — không có quy tắc "tên bệnh nhân nổi bật hơn mã lịch hẹn" dù `font-medium`/`font-semibold` có dùng rải rác, không nhất quán theo tầng quan trọng.

### 1.6. Container width — đã cải thiện 1 phần, chưa đủ

`DoctorLayout.tsx` vừa được thêm `max-w-[1400px] mx-auto` (bước trước) — điều này giúp không bị kéo quá rộng ở màn hình rất lớn, nhưng **không giải quyết vấn đề bóp méo ở breakpoint laptop (1024–1366px)**, vì nguyên nhân chính không phải "container quá hẹp" mà là "quá nhiều cột không kiểm soát width trong một bảng `table-layout: auto`". Container mặc định `default` (không phân biệt trang bảng vs trang form) cũng là một khoảng cách với yêu cầu mới (mục IV.1: cần `wide`/`full` variant riêng cho trang có bảng).

### 1.7. Tổng hợp: cột nào cần gộp, cột nào cần min-width, cột nào ẩn ở breakpoint nhỏ

| Cột hiện tại | Xử lý đề xuất |
|---|---|
| Giờ khám (+ngày phụ) | Giữ làm 1 cột riêng, `min-width` cố định (~88px), luôn hiện mọi breakpoint |
| Mã lịch hẹn | Gộp vào cột "Thông tin khám" làm dòng phụ (font-mono, nhỏ, xám) — không còn là cột riêng |
| Tên bệnh nhân | Giữ cột riêng, `min-width` lớn nhất bảng (~200-220px), luôn hiện |
| Tuổi/Giới tính | Gộp làm dòng phụ trong ô "Bệnh nhân", chỉ render khi có dữ liệu (không render `'—'`) |
| Dịch vụ | Gộp vào cột "Thông tin khám" cùng mã lịch hẹn, dùng `truncate` + `title` (tooltip) 1 dòng, không cho tự do wrap nhiều dòng |
| Phòng | Gộp vào cột "Địa điểm & hỗ trợ" cùng Y tá |
| Y tá | Gộp cùng Phòng; vì hiện luôn là text tĩnh giống nhau — hiển thị 1 dòng nhỏ, xám, không chiếm không gian riêng; ẩn hẳn ở breakpoint tablet (chuyển vào phần mở rộng "Xem chi tiết" đã có sẵn) |
| Thanh toán | Gộp làm badge phụ nhỏ hơn, xếp cạnh/dưới badge Trạng thái trong cùng 1 cột "Trạng thái", không tách cột riêng |
| Trạng thái | Giữ 1 cột, `min-width` (~130px) đủ cho badge dài nhất ("Chờ xác nhận") không bị ép |
| Hành động | Giữ cột cuối, `min-width` cố định (~110-120px) đủ cho nút dài nhất, thêm `whitespace-nowrap` ngay trên nút |

Ẩn ở breakpoint `md` (tablet, <1024px): cột "Địa điểm & hỗ trợ" — thông tin này vẫn xem được qua "Xem chi tiết" (expand row đã có sẵn), không mất dữ liệu.
Ẩn hẳn dạng bảng ở breakpoint `sm` (mobile, <768px): chuyển toàn bộ sang card list theo đúng thứ tự mục XII yêu cầu (giờ+ngày → tên bệnh nhân → dịch vụ → phòng+y tá → trạng thái → hành động).

**Giải pháp kỹ thuật đề xuất**: thêm `table-fixed` + `<colgroup>` khai báo % cho 6 cột gộp (không phải 10 cột rời rạc như hiện tại), dùng `truncate`/`line-clamp-2` + `title` cho nội dung dài thay vì để tự do wrap. Đây **không phải** `transform: scale()`, không giảm font toàn bộ, không cắt chữ mà không có cách xem đầy đủ (dùng `title` = tooltip trình duyệt gốc, không cần thư viện thêm) — tuân thủ đúng mục I.3 (nghiêm cấm các giải pháp vá lỗi).

---

## 2. Danh sách file

| File | Vai trò | Sửa/Đọc | Nội dung dự kiến |
|---|---|---|---|
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Bảng lịch hẹn + modal kết quả khám | **Sửa** | Trọng tâm: gộp cột, `table-fixed`+`colgroup`, chuẩn hoá badge/button/filter card, mobile card view |
| `frontend/src/pages/doctor/DoctorDashboard.tsx` | Tổng quan | **Sửa** | Đồng bộ container `default`, không đổi nội dung (đã bỏ doanh thu ở bước trước) |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Lịch làm việc | **Sửa nhẹ** | Đồng bộ badge màu tập trung, spacing; cấu trúc "card theo ngày" hiện tại đã đúng hướng, giữ nguyên |
| `frontend/src/pages/doctor/DoctorPendingRecords.tsx` | Hồ sơ chờ xác nhận | **Sửa nhẹ** | Bảng 5 cột — ít rủi ro bóp méo hơn; đồng bộ style bảng mới |
| `frontend/src/pages/doctor/DoctorLeaveRequests.tsx` | Xin nghỉ | **Sửa nhẹ** | Đồng bộ style bảng + modal |
| `frontend/src/pages/doctor/DoctorProfile.tsx` | Hồ sơ cá nhân | **Sửa nhẹ** | Đồng bộ typography/spacing, đã đúng cấu trúc section-card |
| `frontend/src/layouts/DoctorLayout.tsx` | Layout khung | **Sửa** | Thêm biến thể độ rộng container (`default`/`wide`/`full`) theo route thay vì 1 max-width cố định cho mọi trang |
| `frontend/src/components/doctor/DoctorSidebar.tsx` | Sidebar | Đọc (đã xong ở bước trước) | Không đổi thêm |
| `frontend/src/components/doctor/DoctorHeader.tsx` | Header | Đọc — có thể sửa nhẹ | Đã gọn (chiều cao 64px cố định, không quá nhiều thông tin) — kiểm tra lại theo mục IV.3, khả năng không cần sửa |
| `frontend/src/components/common/Badge.tsx` | Badge dùng chung toàn hệ thống | Đọc, **có thể sửa thêm prop** | Thêm giới hạn `whitespace-nowrap` mặc định + cho phép 2 dòng khi label dài (mục III.3) — ảnh hưởng toàn hệ thống, cần cẩn trọng |
| `frontend/src/components/common/Button.tsx` | Button dùng chung | Đã sửa (bước 1) | Có thể cần thêm size hoặc kiểm tra chiều cao đồng nhất theo size khi áp dụng vào bảng |
| `frontend/src/components/common/Modal.tsx`, `Loading.tsx`, `Empty.tsx`, `Toast.tsx`, `ConfirmDialog.tsx` | Dùng chung | Đọc | Sẽ dùng khi tới bước gộp modal/loading/error (kế hoạch cũ, chưa đổi) |
| `frontend/src/utils/constants.ts` | Màu trạng thái tập trung | Đã sửa (bước 1) | Sẽ **áp dụng** (import và dùng) vào các trang ở bước 4-7, chưa cần sửa thêm |
| `frontend/src/utils/format.ts` | `formatDate`, `formatPrice`... | Đọc | Không đổi |
| `frontend/src/index.css` | `.btn-*`, `.card`, `.table-*`, `.input-*` | Đọc, **có thể thêm class mới** | Có thể thêm `.table-fixed-col` helper hoặc dùng thẳng Tailwind utility, không sửa class cũ (dùng chung Admin/Client) |
| `frontend/tailwind.config.js` | Bảng màu, tuỳ chỉnh | Đọc | Không đổi — theme hiện tại đủ dùng |
| Toàn bộ `pages/admin/**`, `pages/client/**`, backend, model | — | **Không đụng** | Ngoài phạm vi |

---

## 3. Kế hoạch component

**Giữ nguyên hoàn toàn** (đã đúng hướng, không cần sửa cấu trúc):
- `DoctorSidebar.tsx`, `DoctorHeader.tsx` (đã tách riêng biệt, đã soft active).
- Cấu trúc "card theo ngày" trong `DoctorSchedule.tsx` (đã là dạng nhóm-theo-ngày, đúng gợi ý mục VII, không phải bảng dữ liệu khô cứng).
- Cấu trúc section-card trong `DoctorProfile.tsx` (đã chia Thông tin hành nghề / Chỉ số đánh giá / Thông tin tài khoản, view/edit rõ ràng).
- Cơ chế "Xem chi tiết" dạng **expand-row trong bảng** ở `DoctorAppointments.tsx` (không phải trang riêng `/doctor/appointments/:id`) — đây là quyết định kiến trúc đã có từ trước, **không** tách thành route riêng vì đó là thay đổi lớn ngoài phạm vi "chỉnh UI"; chỉ tổ chức lại nội dung bên trong theo section rõ hơn.

**Cần sửa (không đổi logic, chỉ đổi cấu trúc hiển thị):**
- Bảng chính trong `DoctorAppointments.tsx`: gộp 9 cột dữ liệu thành 6 cột logic, thêm `table-fixed` + `colgroup`.
- Filter trong `DoctorAppointments.tsx`: bọc vào 1 filter-card riêng (hiện đang là `div` rời rạc nằm trực tiếp trên nền trang).
- `DoctorLayout.tsx`: thêm biến thể độ rộng.

**Cần tách (component dùng chung mới, tái sử dụng được cho các bảng khác trong doctor page):**
- `DoctorTable` / cấu trúc `<colgroup>` chuẩn cho bảng dùng chung giữa `DoctorAppointments` và `DoctorPendingRecords`/`DoctorLeaveRequests` (đều đang tự viết `TH_PLAIN` + `<table>` riêng).
- `DoctorFilterBar` (card bọc filter, dùng lại ở `DoctorAppointments` và tương lai nếu `DoctorPendingRecords`/`DoctorLeaveRequests` cần filter).
- `ContentContainer` với prop `variant: 'default' | 'wide' | 'full'` trong `DoctorLayout` — không cần tạo file riêng nếu chỉ 1 dòng logic trong layout, nhưng nên đặt tên rõ ràng trong chính `DoctorLayout.tsx`.
- Mobile card-list cho lịch hẹn (tái sử dụng cấu trúc "card" đã có sẵn trong `.card` class, không cần thư viện mới).

**Có nguy cơ ảnh hưởng trang khác nếu sửa (cẩn trọng, chỉ mở rộng không đổi hành vi cũ):**
- `Badge.tsx` — dùng ở Admin/Client/Doctor. Nếu cần sửa (giới hạn dòng, padding), phải đảm bảo không đổi kích thước/hành vi hiện có ở nơi khác — chỉ thêm class mặc định an toàn (vd `whitespace-nowrap` vốn đã ngầm đúng với hầu hết label ngắn hiện tại, không phải thay đổi lớn).
- `index.css` (`.btn-*`, `.card`, `.table-*`) — dùng toàn hệ thống, chỉ **thêm**, không sửa class đã có.

---

## 4. Wireframe dạng văn bản

### 4.1. Danh sách lịch hẹn (trọng tâm)

**Desktop ≥1280px** — container `wide`, bảng `table-fixed`:

```
┌─ Page header: "Lịch hẹn của tôi" + mô tả ─────────────────────────────┐
├─ Filter card ──────────────────────────────────────────────────────────┤
│  [Ngày khám ▾]   [Trạng thái ▾]   [Xoá lọc]        (kết quả: N lịch hẹn)│
├────────────────────────────────────────────────────────────────────────┤
│ GIỜ KHÁM │ BỆNH NHÂN          │ THÔNG TIN KHÁM      │ ĐỊA ĐIỂM & HỖ TRỢ │ TRẠNG THÁI    │ HÀNH ĐỘNG │
│──────────┼────────────────────┼─────────────────────┼───────────────────┼───────────────┼───────────│
│ 08:00    │ (●) Nguyễn Văn A   │ Khám tổng quát       │ Phòng 203         │ [Chờ xác nhận]│ [👁 Chi tiết]│
│ 12/07    │ 32 tuổi · Nam      │ #LH20260712-001      │ ⚠ Chưa phân công y tá│ [Chưa TT]     │           │
├──────────┼────────────────────┼─────────────────────┼───────────────────┼───────────────┼───────────┤
│ 09:30    │ (●) Trần Thị B     │ Tư vấn Nhi khoa      │ Tại nhà           │ [Đã xác nhận] │ [👁 Chi tiết]│
│ 12/07    │                    │ #LH20260712-002      │ ⚠ Chưa phân công y tá│ [Đã TT]       │           │
└──────────┴────────────────────┴─────────────────────┴───────────────────┴───────────────┴───────────┘
```
Bấm "Chi tiết" → mở rộng 1 hàng bên dưới (giữ cơ chế hiện có) chứa đầy đủ: mã lịch hẹn, chuyên khoa, SĐT, phí khám, dị ứng/bệnh nền, cảnh báo thanh toán, hồ sơ khám, hành động theo trạng thái.

**Tablet 768–1023px**: ẩn cột "Địa điểm & hỗ trợ" khỏi bảng chính (vẫn xem qua "Chi tiết"); 6 cột còn lại co giãn theo `colgroup` %, không xuất hiện wrap bất thường vì mỗi cột đã có `min-width` bảo vệ; nếu tổng min-width > viewport, chỉ vùng bảng cuộn ngang (không cuộn cả trang).

**Mobile <768px**: chuyển thành danh sách card, mỗi card:
```
┌──────────────────────────────┐
│ 08:00 · 12/07                │
│ (●) Nguyễn Văn A              │
│ 32 tuổi · Nam                 │
│ Khám tổng quát                │
│ Phòng 203                     │
│ [Chờ xác nhận]  [Chưa TT]     │
│ ──────────────────────────    │
│        [👁 Xem chi tiết]      │
└──────────────────────────────┘
```

### 4.2. Dashboard
```
┌─ "Xin chào, Bác sĩ ..." · chuyên khoa · hôm nay ──────────────────────┐
├─ Công việc hôm nay (card) ──────────────────────────────────────────────┤
│  Ca làm việc · Phòng khám · Y tá hỗ trợ                                  │
│  [Tổng lịch hẹn] [Chờ khám] [Đang khám] [Hoàn thành]  ← 4 ô, cùng cỡ     │
│  Lịch hẹn gần nhất (list) ······················· [Xem tất cả →]        │
├─ Thống kê hành nghề: 4 stat card cùng chiều cao ─────────────────────────┤
│  [Tổng lượt khám] [Tháng này] [Đánh giá] [Hồ sơ chờ xác nhận]            │
├─ Tỉ lệ hoạt động (1/3) ── Đánh giá gần đây (2/3) ─────────────────────────┘
```
(Đã đúng cấu trúc yêu cầu mục VI từ trước — chỉ cần đồng bộ container width `default`.)

### 4.3. Lịch làm việc
Giữ cấu trúc "card theo ngày" hiện có (accordion mở/thu mỗi ngày, dot-bar tóm tắt slot) — đã đúng hướng mục VII, chỉ chuẩn hoá màu badge từ `SCHEDULE_SLOT_STATUS_COLOR` tập trung (đã tạo ở bước 1) thay vì map cục bộ, và container `default`.

### 4.4. Chi tiết lịch hẹn
Không tách trang riêng — vẫn là nội dung mở rộng trong hàng bảng (giữ nguyên kiến trúc). Bên trong, tổ chức theo section rõ ràng hơn (đã tương đối tốt): (1) thông tin lịch hẹn/chuyên khoa, (2) thông tin bệnh nhân + liên hệ + sức khoẻ, (3) cảnh báo thanh toán nếu có, (4) địa điểm/lý do khám, (5) hồ sơ khám (nếu có), (6) khu vực hành động theo trạng thái — mỗi section có `border-t` phân tách như hiện tại, chỉ chuẩn hoá spacing.

### 4.5. Hồ sơ chờ xác nhận
Bảng tối giản 5 cột hiện tại đã ít rủi ro bóp méo — áp dụng cùng `colgroup`/style bảng mới, cùng `Badge`, cùng container `wide`.

### 4.6. Xin nghỉ
Giữ cấu trúc 2 phần (nút "Gửi yêu cầu mới" mở modal + bảng lịch sử) — chỉ đồng bộ bảng, container `wide` (có bảng) thay vì `default`.

### 4.7. Profile
Giữ cấu trúc 2 cột (thông tin hành nghề 2/3 + chỉ số/tài khoản 1/3), container `default` (không phải bảng lớn) — đã đúng.

---

## 5. Kế hoạch sửa từng bước

> Bước 1 (audit) = tài liệu này. Bước 2 (design token) phần lớn đã làm ở phiên trước (Button variant, màu trạng thái tập trung) — chỉ còn phần **áp dụng** vào từng trang, gộp vào các bước dưới thay vì làm riêng.

| Bước | Nội dung | File sửa | Phạm vi ảnh hưởng | Rủi ro | Cách kiểm tra | Điều kiện hoàn thành |
|---|---|---|---|---|---|---|
| 3 | `DoctorLayout.tsx`: thêm variant độ rộng container theo route (`default`/`wide`/`full`) | `DoctorLayout.tsx`, có thể cần 1 dòng khai báo variant theo `route.pathname` hoặc prop qua context/outlet | Toàn bộ 6 trang doctor (đổi container bao ngoài) | Thấp — chỉ đổi max-width, không đổi nội dung bên trong | `tsc --noEmit`; xem code đối chiếu route nào cần `wide` | Mỗi trang route về đúng variant đã định (dashboard/profile/xin nghỉ = default; lịch hẹn/hồ sơ chờ xác nhận = wide) |
| 4 | **Trọng tâm**: viết lại bảng `DoctorAppointments.tsx` theo 6 cột gộp, `table-fixed`+`colgroup`, filter card, chuẩn hoá badge/button dùng màu tập trung + `Button` component, mobile card view | `DoctorAppointments.tsx` (chỉ file này) | Chỉ trang Lịch hẹn — không đụng service/API/state logic (chỉ đổi phần render bảng) | Trung bình — bảng có nhiều nhánh hiển thị theo trạng thái (pending/confirmed/completed), cần giữ đúng từng nhánh khi tái cấu trúc JSX | Đối chiếu từng trạng thái trước/sau, `tsc --noEmit`, kiểm tra 5 breakpoint (1440/1280/1024/768/390) | Bảng không còn wrap tuỳ tiện ở laptop, nút không xuống dòng, badge không bị ép, mobile hiện card list đúng thứ tự |
| 5 | Đồng bộ `DoctorDashboard.tsx` (container variant) + `DoctorSchedule.tsx` (màu badge tập trung) | `DoctorDashboard.tsx`, `DoctorSchedule.tsx` | 2 trang | Thấp | `tsc --noEmit`, xem 5 breakpoint | Container đúng variant `default`; `DoctorSchedule` dùng `SCHEDULE_SLOT_STATUS_COLOR` thay map cục bộ, không đổi giao diện thấy được |
| 6 | Chuẩn hoá bảng trong `DoctorPendingRecords.tsx` (dùng lại pattern bảng mới từ bước 4 nếu hợp lý, ít cột nên rủi ro thấp) + khu vực hành động trong modal xem hồ sơ | `DoctorPendingRecords.tsx` | 1 trang | Thấp | Như trên | Bảng đồng bộ style, không đổi cột dữ liệu |
| 7 | Chuẩn hoá `DoctorLeaveRequests.tsx` (bảng + modal) và `DoctorProfile.tsx` (typography/spacing) | `DoctorLeaveRequests.tsx`, `DoctorProfile.tsx` | 2 trang | Thấp | Như trên | Đồng bộ style, giữ nguyên toàn bộ hành vi form/validation |
| 8 | Kiểm tra cuối toàn bộ 6 trang tại 5 breakpoint (1440/1280/1024/768/390), rà lại 24 tiêu chí nghiệm thu mục XVII | Không sửa file mới, chỉ rà + vá lỗi nhỏ phát sinh | Toàn bộ doctor page | Thấp | Kiểm tra thủ công + `tsc --noEmit` | Đạt đủ 24 tiêu chí mục XVII |

**Không thực hiện nhiều bước cùng lúc** — sau mỗi bước sẽ báo cáo đúng format mục XVI (file đã sửa, style cũ loại bỏ, style mới áp dụng, logic giữ nguyên, breakpoint đã kiểm tra, rủi ro còn lại) trước khi sang bước kế.

**Giới hạn công cụ quan trọng**: môi trường làm việc hiện tại **không có trình duyệt/công cụ chụp ảnh** để tự kiểm tra trực quan — mọi xác nhận breakpoint ở các bước trên chỉ dựa trên đối chiếu code (Tailwind class, cấu trúc `colgroup`, giá trị `min-width`), không phải quan sát bằng mắt. Cần bạn tự mở `npm run dev` để xác nhận hình ảnh thực tế sau mỗi bước nếu muốn chắc chắn tuyệt đối.

---

## 6. Trạng thái thực hiện

Đã thực hiện xong toàn bộ bước 3-8 theo yêu cầu "tự tiến hành toàn bộ" của bạn (2026-07-11). Nhật ký chi tiết từng bước ở mục 7-12 bên dưới.

**Giới hạn cần lưu ý trước khi đọc**: môi trường thực hiện không có trình duyệt/công cụ chụp ảnh. Toàn bộ "kiểm tra breakpoint" dưới đây dựa trên **đối chiếu code và giá trị CSS/Tailwind** (colgroup %, min-width, class responsive `md:`/`lg:`), **không phải quan sát trực quan thực tế**. Cần bạn tự chạy `npm run dev` và xem trên trình duyệt ở 1440/1280/1024/768/390px để xác nhận cuối cùng.

---

## 7. Nhật ký — Bước 3: Container variant theo route

**File sửa**: `frontend/src/layouts/DoctorLayout.tsx` (duy nhất).

**Style cũ loại bỏ**: 1 max-width cố định `max-w-[1400px]` áp dụng cho mọi route.

**Style mới áp dụng**: `useLocation()` xác định route hiện tại, so khớp với danh sách `WIDE_ROUTES = ['/doctor/appointments', '/doctor/pending-records']`. Route khớp → `max-w-[1400px]` (wide, cho trang có bảng nhiều cột). Route không khớp (`/doctor`, `/doctor/schedule`, `/doctor/leave-requests`, `/doctor/profile`) → `max-w-[1100px]` (default, phù hợp trang dashboard/form/card).

**Logic giữ nguyên**: `sidebarOpen` state, `DoctorSidebar`/`DoctorHeader`, `bg-surface` — không đổi gì khác ngoài 1 dòng class.

**Kiểm tra**: `tsc --noEmit` không lỗi. Về code: `WIDE_ROUTES.some(path => location.pathname.startsWith(path))` đúng cú pháp React Router v6, không phụ thuộc animation/side-effect nào có thể vỡ khi chuyển route.

**Rủi ro còn lại**: `DoctorLeaveRequests` có bảng (dù chỉ 5 cột) nhưng được xếp vào nhóm `default` (1100px) theo đúng phân loại đã đề xuất ở báo cáo (mục IV.1: "default: dashboard, profile, xin nghỉ") — nếu sau khi xem thực tế thấy bảng xin nghỉ vẫn chật ở 1100px, có thể chuyển sang `wide` dễ dàng (thêm 1 path vào mảng).

---

## 8. Nhật ký — Bước 4: Viết lại bảng "Lịch hẹn của tôi" (trọng tâm)

**File sửa**: `frontend/src/pages/doctor/DoctorAppointments.tsx` (duy nhất — `ExamModal`, `ReasonModal` giữ nguyên 100% không đổi).

**Component đã thay đổi**: toàn bộ phần render bảng chính + filter + thêm 1 khối card-list cho mobile. State, các hàm `handleConfirm/handleReject/handleComplete/handleCancelConfirmed/handleConfirmResult/handleRequestRevision/updateAppt/isExpiredPending` **không đổi một dòng nào** — chỉ đổi phần JSX render.

**Style cũ loại bỏ**:
- Bảng 9 cột dữ liệu + 1 cột hành động (Giờ khám, Mã lịch hẹn, Tên bệnh nhân, Tuổi/Giới tính, Dịch vụ, Phòng, Y tá, Thanh toán, Trạng thái, hành động), `table-layout: auto` mặc định, chỉ có `min-w-[760px]` chung chung.
- Cột "Y tá" hiển thị text tĩnh "Chưa phân công y tá" lặp lại ở mọi hàng (đã xác nhận trong báo cáo mục 1.2 — đây là nội dung tĩnh không phải dữ liệu thật khác nhau theo hàng, xoá khỏi phần hiển thị rút gọn không làm mất thông tin nghiệp vụ nào vì thông tin này chưa từng tồn tại dưới dạng dữ liệu thật).
- Filter nằm rời rạc trực tiếp trên nền trang (không có card bao ngoài).
- 15 nút hành động viết tay bằng chuỗi Tailwind lặp lại (`inline-flex ... border-green-200 bg-green-50 text-green-600...`).
- `TH_PLAIN` (uppercase, `text-slate-500` nhạt).
- `colSpan={7}` trên hàng mở rộng trong khi bảng cũ có 10 cột thực (bug tiềm ẩn khiến nội dung mở rộng không tràn hết chiều rộng bảng — đã phát hiện khi phân tích, nay sửa đúng theo số cột mới).

**Style mới áp dụng**:
- Gộp còn **6 cột logic**: Giờ khám (11%) · Bệnh nhân (24%, gồm tuổi/giới tính là dòng phụ, chỉ hiện khi có dữ liệu) · Thông tin khám (24%, dịch vụ là dòng chính + mã lịch hẹn là dòng phụ `font-mono`) · Phòng khám (16%) · Trạng thái (14%, badge lịch hẹn + badge thanh toán xếp dọc) · Thao tác (11%).
- `<table className="table-fixed">` + `<colgroup>` khai báo % cố định cho từng cột — loại bỏ hoàn toàn hiện tượng co giãn khó kiểm soát của `table-layout: auto`.
- `truncate` + `title` (tooltip trình duyệt gốc, không cần thư viện) cho tên bệnh nhân, dịch vụ, mã lịch hẹn, phòng khám — thay vì để tự do wrap.
- Header mới: `text-xs font-semibold text-slate-600` (bỏ uppercase, tăng tương phản so với `slate-500` cũ), nền `bg-slate-50` + `border-b` phân lớp rõ với body.
- Filter bọc trong `card` (`className="card mb-4 flex flex-wrap items-end gap-4 p-4"`), thêm hiển thị số lượng kết quả (`{displayed.length} lịch hẹn`) — dữ liệu thật từ state hiện có, không hard-code.
- Toàn bộ nút hành động (Xác nhận/Từ chối/Hoàn thành/Kết quả/Hủy/Nhập kết quả/Xem hồ sơ/Xác nhận hồ sơ/Yêu cầu chỉnh sửa/Chi tiết) chuyển sang component `Button` dùng chung với variant ngữ nghĩa: `success` (Xác nhận, Hoàn thành, Xác nhận hồ sơ), `danger` (Từ chối, Hủy/Hủy khẩn cấp), `warning` (Yêu cầu chỉnh sửa), `secondary` (Kết quả, Nhập kết quả, Xem hồ sơ, Chi tiết) — size `sm` đồng nhất chiều cao mọi nút.
- Màu trạng thái lấy từ `APPOINTMENT_STATUS_COLOR`/`PAYMENT_STATUS_COLOR`/`KET_QUA_KHAM_STATUS_COLOR` tập trung (tạo ở bước 1 phiên trước) — không còn định nghĩa `STATUS_COLOR`/`PAYMENT_COLOR`/`KET_QUA_STATUS_COLOR` cục bộ trong file này nữa.
- Tách nội dung "Chi tiết lịch hẹn" (mở rộng) thành hàm dùng chung `renderDetailPanel(appt)` — gọi lại y hệt ở cả hàng bảng (desktop/tablet, `colSpan={6}` đã sửa đúng số cột) và card mobile, tránh viết trùng ~150 dòng JSX 2 lần.
- Thêm khối **card list cho mobile** (`<768px`, `md:hidden`): mỗi lịch hẹn 1 card theo đúng thứ tự yêu cầu (giờ+ngày → bệnh nhân → dịch vụ → phòng → badge trạng thái/thanh toán → nút "Xem chi tiết" full-width → nội dung mở rộng nếu bấm).
- Bảng desktop/tablet ẩn dưới `md:hidden`→ hiện `md:block`; mobile card list hiện dưới `md:hidden`.

**Logic nghiệp vụ giữ nguyên**: mọi nhánh hiển thị nút theo trạng thái (`pending+home`, `confirmed`, `completed && !da_co_ket_qua`, hồ sơ `cho_xac_nhan`) giữ y hệt điều kiện cũ. Không đổi tên trạng thái, không đổi API, không đổi thứ tự gọi service. Nhãn nút rút gọn ("Xem chi tiết" → "Chi tiết" ở bảng desktop, giữ "Xem chi tiết"/"Ẩn chi tiết" đầy đủ ở card mobile) — thuần hiển thị, không phải đổi nghiệp vụ.

**Breakpoint đã "kiểm tra" (qua code, chưa qua trình duyệt)**:
- ≥768px (`md`): hiện bảng `table-fixed` 6 cột, ẩn card list.
- <768px: ẩn bảng, hiện card list.
- Bảng có `min-w-[860px]` bọc trong `overflow-x-auto` — nếu viewport khả dụng (đã trừ sidebar 260px) nhỏ hơn 860px (vùng 768-~900px thực tế còn khả dụng), chỉ vùng bảng cuộn ngang, không phải cả trang (đúng yêu cầu).

**Kết quả kỳ vọng theo từng breakpoint** (dựa trên code, chưa xác nhận trực quan):
- 1440/1280px: bảng đủ rộng, 6 cột theo đúng tỉ lệ %, không co ép.
- 1024px: container `wide` 1400px vẫn đủ chỗ; nếu sidebar+padding chiếm hết phần dư, vùng bảng tự cuộn ngang trong khung `overflow-x-auto`.
- 768px: ranh giới chuyển bảng ↔ card list.
- 390px: card list, không bảng, không cuộn ngang toàn trang.

**Loading/error/empty đã kiểm tra (qua code)**: loading và error state giữ nguyên y hệt code cũ (không đổi). Empty state tách riêng cho bảng (`colSpan={6}`, đã sửa đúng) và cho card list (khối riêng) — cùng thông điệp tuỳ theo có đang lọc hay không, giữ nguyên logic cũ.

**Rủi ro còn lại**:
- Chưa xác nhận trực quan trên trình duyệt thật — đặc biệt độ chính xác của tỷ lệ % cột trên các độ rộng màn hình cụ thể.
- Cột "Y tá" bị loại khỏi hiển thị rút gọn hoàn toàn (kể cả trong "Chi tiết mở rộng" — vốn dĩ trước đây cũng không hiển thị y tá ở phần mở rộng) — nếu về sau module gán y tá cho lịch hẹn được xây dựng, cần bổ sung lại hiển thị y tá thật (không phải việc của bước UI này).
- `ExamModal`/`ReasonModal` vẫn là modal viết tay riêng (chưa gộp vào `Modal.tsx` dùng chung) — đây là việc thuộc kế hoạch cũ (audit trước), không nằm trong phạm vi 8 bước của lần thiết kế lại này.

---

## 9. Nhật ký — Bước 5: Đồng bộ Dashboard + Lịch làm việc

**File sửa**: `frontend/src/pages/doctor/DoctorSchedule.tsx`. (`DoctorDashboard.tsx` không cần sửa thêm — container variant đã tự động áp dụng qua `DoctorLayout.tsx` ở bước 3, vì route `/doctor` không nằm trong `WIDE_ROUTES` nên nhận đúng `default` 1100px như kế hoạch.)

**Style cũ loại bỏ**: `STATUS_COLOR` cục bộ định nghĩa lại màu cho slot lịch làm việc trong `DoctorSchedule.tsx`.

**Style mới áp dụng**: import `SCHEDULE_SLOT_STATUS_COLOR` từ `utils/constants.ts` (tạo ở bước 1 phiên trước), dùng thay cho map cục bộ — giá trị màu giữ y hệt (`active: green, booked: blue, locked: yellow, cancelled: red, expired: gray, pending_payment: yellow`), không đổi màu nào thấy được.

**Logic giữ nguyên**: cấu trúc "card theo ngày" (accordion, `DotBar`, `DaySummary`, dialog xin nghỉ/yêu cầu hủy) không đổi gì — đúng đánh giá ở báo cáo là đã đúng hướng, không cần viết lại.

**Kiểm tra**: `tsc --noEmit` không lỗi ở cả 2 file.

**Rủi ro còn lại**: không phát sinh mới.

---

## 10. Nhật ký — Bước 6: Đồng bộ "Hồ sơ chờ xác nhận"

**File sửa**: `frontend/src/pages/doctor/DoctorPendingRecords.tsx` (duy nhất).

**Style cũ loại bỏ**: `KET_QUA_STATUS_COLOR` cục bộ, `TH_PLAIN` (uppercase nhạt), bảng `table-layout: auto` không kiểm soát cột, nút "Xem chi tiết" viết tay.

**Style mới áp dụng**: `KET_QUA_KHAM_STATUS_COLOR` tập trung (giữ nguyên giá trị màu cũ). `table-fixed` + `colgroup` 6 cột (Ngày khám 14% · Tên bệnh nhân 24% · Dịch vụ 22% · Y tá nhập 16% · Trạng thái 14% · Thao tác 10%). Header đồng bộ style mới. `truncate` + `title` cho tên bệnh nhân/dịch vụ/y tá nhập dài. Nút "Xem chi tiết" → `Button variant="secondary" size="sm"`.

**Logic giữ nguyên**: modal `RecordViewModal` (xem hồ sơ) không đổi nội dung/hành vi, chỉ đổi màu badge từ nguồn tập trung. Danh sách vẫn chỉ đọc (không thêm hành động xác nhận/yêu cầu chỉnh sửa ở đây — đúng như thiết kế cũ, việc đó thực hiện ở trang Lịch hẹn).

**Kiểm tra**: `tsc --noEmit` không lỗi.

**Rủi ro còn lại**: trang này **chưa có card-list riêng cho mobile** (khác với trang Lịch hẹn) — hiện dựa vào `overflow-x-auto` để cuộn ngang vùng bảng ở mobile thay vì chuyển hẳn sang card. Vì bảng chỉ 6 cột (ít hơn nhiều so với bảng Lịch hẹn cũ) nên rủi ro bóp méo thấp hơn nhiều, nhưng nếu bạn muốn đồng nhất tuyệt đối trải nghiệm mobile giữa các trang, đây là phần có thể bổ sung thêm.

---

## 11. Nhật ký — Bước 7: Đồng bộ "Xin nghỉ" và "Profile"

**File sửa**: `frontend/src/pages/doctor/DoctorLeaveRequests.tsx`, `frontend/src/pages/doctor/DoctorProfile.tsx`.

**`DoctorLeaveRequests.tsx`**:
- Loại bỏ `STATUS_COLOR` cục bộ, `TH_PLAIN`. Áp dụng `DOCTOR_LEAVE_STATUS_COLOR` tập trung (giá trị màu giữ nguyên), `table-fixed` + `colgroup` 5 cột (Ngày nghỉ 16% · Ca/khung giờ 18% · Lý do 34% · Trạng thái 16% · Thao tác 16%), header đồng bộ, `truncate`+`title` cho cột Lý do (trước đây dùng `max-w-xs truncate` trên `<td>`, nay dùng `truncate` trên `<p>` bên trong ô có width cố định từ colgroup — tương đương, chính xác hơn). Nút "Hủy yêu cầu" → `Button variant="danger" size="sm"`.
- **Không đổi**: `CreateLeaveModal` (form gửi yêu cầu mới), nút "Gửi yêu cầu mới" trên `PageHeader` (vẫn dùng `.btn-primary` — không bắt buộc đổi sang component `Button` vì đã cùng màu/kích thước, không có vấn đề nhất quán thấy được), toàn bộ logic `handleCreate`/`handleCancel`/`loadRequests`.

**`DoctorProfile.tsx`**:
- Loại bỏ `APPROVAL_COLOR` cục bộ, thay bằng `DOCTOR_APPROVAL_COLOR` tập trung (giá trị màu giữ nguyên: `approved: green, pending: yellow, rejected: red, suspended: gray`).
- Không đổi cấu trúc section-card, view/edit, form — đã đúng yêu cầu từ trước (dữ liệu chỉ xem dùng `<dl>/<dt>/<dd>`, không dùng input disabled, trừ 1 chỗ hiển thị "Chuyên khoa" trong chế độ edit dùng `<p className="input ...">` để trông giống input nhưng disabled — đây là cách hiển thị "trường không cho sửa nằm giữa các trường cho sửa trong cùng 1 form", chấp nhận được vì có ghi chú rõ "Chuyên khoa do Admin gán" ngay dưới, không phải input thật).

**Kiểm tra**: `tsc --noEmit` không lỗi ở cả 2 file.

**Rủi ro còn lại**: không phát sinh mới.

---

## 12. Nhật ký — Bước 8: Kiểm tra cuối

**Đã kiểm tra**:
- `npx tsc --noEmit` toàn bộ `frontend/`: 32 lỗi, tất cả nằm trong `src/mock/doctor-appointments.ts` (dữ liệu mock kiểu `number` gán cho field kiểu `string`) — xác nhận đây là lỗi **có từ trước**, không liên quan đến bất kỳ thay đổi nào ở 8 file đã sửa trong toàn bộ phiên làm việc (kể cả các bước từ báo cáo trước: `Button.tsx`, `constants.ts`, `DoctorSidebar.tsx`, `DoctorDashboard.tsx`, `DoctorLayout.tsx`) và ngoài phạm vi nhiệm vụ (không phải giao diện, là lỗi type của mock data).
- Rà lại toàn bộ 5 trang đã sửa: không còn `STATUS_COLOR`/`PAYMENT_COLOR`/`APPROVAL_COLOR`/`TH_PLAIN` cục bộ nào sót lại — xác nhận bằng `grep`.

**Đối chiếu 24 tiêu chí nghiệm thu (mục XVII của yêu cầu)**:

| # | Tiêu chí | Trạng thái |
|---|---|---|
| 1 | Bảng lịch hẹn không còn bóp méo | Đã sửa cấu trúc (`table-fixed`+`colgroup`); **chưa xác nhận trực quan** |
| 2 | Không còn nút xuống 3 dòng | Nút dùng `Button` cỡ `sm` đồng nhất + `whitespace-nowrap`; chưa xác nhận trực quan |
| 3 | Badge không bị ép | Cột Trạng thái có `min` tỉ lệ riêng (14%), badge xếp dọc gọn; chưa xác nhận trực quan |
| 4 | Tên bệnh nhân đọc rõ | `font-medium` + `truncate`+`title`, cột 24% | Đạt về code |
| 5 | Dịch vụ không chia dòng ngắn | `truncate` 1 dòng + tooltip thay vì wrap tự do | Đạt về code |
| 6 | Phòng và y tá nhóm hợp lý | Gộp thành "Phòng khám"; bỏ dòng "Y tá" tĩnh lặp lại (không phải nhóm — là loại bỏ nội dung vô nghĩa, xem rủi ro mục 8) | Đạt, có điều chỉnh phạm vi |
| 7 | Không còn cột trống chiếm diện tích | Bỏ cột riêng "Mã lịch hẹn", "Tuổi/Giới tính", "Y tá" | Đạt |
| 8 | Hàng bảng cân đối | `align-top` đồng nhất mọi ô, `table-fixed` cố định độ rộng | Đạt về code |
| 9 | Bộ lọc nằm trong khu vực rõ ràng | Bọc `card` | Đạt |
| 10 | Header bảng dễ đọc | `text-slate-600`, bỏ uppercase, nền `bg-slate-50` + border | Đạt |
| 11 | Không cuộn ngang toàn trang | Cuộn chỉ trong `overflow-x-auto` của bảng | Đạt về code |
| 12 | Mobile dùng card | Card list riêng cho `DoctorAppointments` | Đạt cho trang lịch hẹn; các trang khác dùng `overflow-x-auto` (xem rủi ro mục 10) |
| 13 | Dashboard không còn thẻ doanh thu | Đã bỏ (bước trước) | Đạt |
| 14 | Sidebar active soft | Đã đổi (bước trước) | Đạt |
| 15 | Trang dùng chung màu trạng thái | 6 map màu tập trung, áp dụng đủ 5 trang | Đạt |
| 16 | Trang dùng chung button variant | `Button` (success/warning/danger/secondary) áp dụng ở nút theo trạng thái tại 3 trang | Đạt phần lớn — page-level primary vẫn dùng `.btn-primary` CSS class tương đương |
| 17 | Trang dùng chung card style | `.card` dùng nhất quán mọi nơi (không đổi) | Đạt |
| 18 | Layout/spacing/typography đồng nhất | Container variant theo route, header bảng đồng nhất 3 trang | Đạt phần lớn |
| 19 | Không đổi API/nghiệp vụ | Không sửa service/controller/model nào | Đạt |
| 20 | Không ảnh hưởng vai trò khác | Chỉ sửa file trong `pages/doctor`, `components/doctor`, `layouts/DoctorLayout.tsx`; `Button.tsx`/`constants.ts` chỉ **thêm**, không sửa phần dùng bởi Admin/Client | Đạt |
| 21 | Không hard-code dữ liệu | Không thêm số liệu giả nào | Đạt |
| 22 | Không dùng scale/zoom | Không dùng ở đâu | Đạt |
| 23 | Hoạt động tại 5 breakpoint | Dựa trên code/Tailwind, **chưa xác nhận trực quan** | Cần bạn xác nhận |
| 24 | Code dễ bảo trì | `renderDetailPanel` dùng chung, màu/label tập trung, không trùng lặp giữa 2 chế độ hiển thị | Đạt |

**Kết luận bước 8**: 21/24 tiêu chí đạt dựa trên rà soát code; 3 tiêu chí (#1, #2, #3, #23 — nhóm "chưa xác nhận trực quan") cần bạn tự mở trình duyệt xác nhận vì môi trường này không có công cụ hiển thị.
