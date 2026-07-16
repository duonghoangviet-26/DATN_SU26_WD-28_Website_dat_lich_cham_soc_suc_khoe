# Triển khai — Tab thời gian & tìm kiếm lịch hẹn bác sĩ (mục D)

> Kế thừa thiết kế đã duyệt trước đó: [[Thiet ke tim kiem va loc lich hen bac si - Bao cao truoc khi code (2026-07-11)]] (đã viết xong, chưa triển khai) + [[Audit - Logic 6 ngay lam viec (2026-07-08)]]. 2 quyết định mới chốt ngày 2026-07-16 trước khi code.

## Quyết định mới (2026-07-16)

1. **"Sắp tới" bị giới hạn theo luật 6 ngày làm việc** — không hiện toàn bộ tương lai, chỉ hiện đúng cửa sổ 6 ngày làm việc kế tiếp (bỏ qua Chủ nhật), cùng thuật toán `isWorkingDay` bên backend (`scheduleGenerator.service.js`). Xa hơn cửa sổ này vẫn xem được qua tab "Tất cả".
2. **Tab "Đã qua" (lịch sử) mặc định RỖNG** — khác thiết kế 07-11 (vốn hiện sẵn toàn bộ). Chỉ hiện danh sách khi có từ khóa tìm kiếm hoặc đã chọn 1 ngày cụ thể.

## Thay đổi so với thiết kế 07-11

- Giữ nguyên kiến trúc cốt lõi: tải `getAll({})` **1 lần** lúc vào trang, mọi lọc/tab xử lý bằng `useMemo` phía client (không gọi lại API khi đổi filter).
- Giữ: tab thời gian, tìm kiếm theo bệnh nhân/mã lịch hẹn/SĐT, lọc trạng thái, chọn 1 ngày cụ thể, URL query tối thiểu (`tab`, `status`, `q`).
- **Bỏ khỏi lần triển khai này** (không thuộc yêu cầu gốc mục D, để tránh phình phạm vi): sắp xếp tùy chọn tăng/giảm, bộ lọc nâng cao theo dịch vụ khám, khoảng ngày from–to (giữ lại lọc 1 ngày cụ thể như hiện có — đã đáp ứng đúng yêu cầu "chọn lịch hẹn trong ngày bao nhiêu đó"). Có thể bổ sung sau nếu cần, ghi nhận là nợ kỹ thuật nhẹ.
- **Tiện sửa luôn bug múi giờ** đã phát hiện ở audit 07-11: `todayStr` đổi từ `new Date().toISOString().slice(0,10)` sang `toLocalDateStr()` (đã có sẵn trong `utils/format.ts`, dùng đúng ở `DoctorSchedule.tsx`) — tránh lệch 1 ngày trong khung 00:00–07:00 giờ VN.

## Cấu trúc state (áp dụng)

```ts
type TimeTab = 'today' | 'upcoming' | 'past' | 'all'

const todayStr = toLocalDateStr()
const [all, setAll] = useState<DoctorAppointmentDetail[]>([])       // tai 1 lan
const [timeTab, setTimeTab] = useState<TimeTab>('today')           // mac dinh Hom nay
const [searchTerm, setSearchTerm] = useState('')
const [filterStatus, setFilterStatus] = useState<'' | AppointmentStatus>('')
const [filterDate, setFilterDate] = useState('')                   // chon 1 ngay cu the (giu nguyen UI cu)
```

`getAll({})` gọi 1 lần trong `useEffect` rỗng deps (không còn phụ thuộc `filterDate`/`filterStatus`).

Cửa sổ 6 ngày làm việc tính bằng hàm thuần `getUpcomingWorkingDays(fromDateStr, 6)`: đi tới từng ngày kế tiếp `fromDateStr`, bỏ qua Chủ nhật (`getDay() === 0`), trả về **`Set<string>`** đúng 6 ngày làm việc cụ thể (không phải 1 khoảng `[from, to]`) — tránh trường hợp dữ liệu lỡ dính đúng ngày Chủ nhật trong khoảng vẫn lọt qua nếu chỉ so sánh biên trên/dưới. Khớp tinh thần "lọc phòng vệ, loại bỏ Chủ nhật dù dữ liệu lỡ dính" đã nêu trong audit 07-08.

## Test / kiểm chứng

Đây là thay đổi thuần frontend (không đụng backend/API), không có test tích hợp `node:test` tương ứng. Đã chạy `tsc --noEmit` và `eslint` trên file — không lỗi/cảnh báo mới. **Chưa xác nhận bằng cách bấm thử trực tiếp trên trình duyệt** — môi trường phiên làm việc này không có công cụ điều khiển trình duyệt (Playwright/Puppeteer); dev server đang chạy sẵn ở `http://localhost:5173`, cần bạn tự mở tab "Sắp tới"/"Đã qua" để xác nhận trực quan trước khi merge.
