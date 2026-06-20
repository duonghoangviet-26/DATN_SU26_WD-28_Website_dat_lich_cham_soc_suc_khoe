# Bản đồ tài liệu VitaFamily

> Bạn đang tìm gì? Tìm nhanh tại đây.

---

## Mới vào dự án — đọc theo thứ tự này

1. **`CLAUDE.md`** (root) — Tổng quan toàn bộ: stack, cấu trúc, convention, luồng làm việc
2. **`docs/features.md`** — 20 chức năng, ai làm gì, luồng hoạt động
3. **`docs/database.md`** — 27 bảng dữ liệu, quan hệ giữa các bảng

---

## Tài liệu theo mục đích

| Tôi muốn... | Đọc file này |
|---|---|
| Hiểu tổng quan dự án | `CLAUDE.md` |
| Biết chi tiết 1 chức năng (vd: Đặt lịch) | `docs/features.md` → mục A5 |
| Thiết kế bảng / viết model | `docs/database.md` |
| Phân tích chi tiết C4 — Quản lý dịch vụ | `docs/Admin/Chi tiết quản lý dịch vụ.md` |
| Đặc tả gốc đầy đủ nhất | `Tài liệu dự án/Đặc tả/Dac_Ta_Du_An_VitaFamily.md` |
| Chi tiết từng chức năng (PDF) | `Tài liệu dự án/Chức Năng Chính/*.pdf` |
| SQL schema gốc (MySQL) | `Tài liệu dự án/Cơ sở dữ liệu/VitaFamily_Database.sql` |
| Làm trang Admin mới | `frontend/README.md` |
| Viết API mới (controller/route/middleware) | `backend/README.md` |
| Convention của nhóm | `.agents/memory/project-conventions.md` |
| Quyết định kỹ thuật đã chốt | `.agents/memory/tech-decisions.md` |

---

## Tài liệu gốc (nguồn chính xác nhất)

```
Tài liệu dự án/
├── Đặc tả/
│   ├── Dac_Ta_Du_An_VitaFamily.md    ← Đặc tả dạng Markdown (AI đọc được)
│   └── Đặc tả dự án pdf.pdf          ← Bản PDF đầy đủ
├── Chức Năng Chính/
│   ├── Đăng Ký Đăng Nhập.pdf         ← A1
│   ├── Quản lý hồ sơ gia đình.pdf    ← A2
│   ├── Hồ sơ khám bệnh.pdf           ← A3
│   ├── Dơn thuộc nhắc uống thuốc.pdf ← A4
│   ├── Đặt lịch khám.pdf             ← A5
│   ├── Chat bot.pdf                   ← A6
│   ├── Thông báo.pdf                  ← A7
│   ├── Hồ sơ bác sĩ.pdf              ← B1
│   ├── Lịch làm việc.pdf             ← B2
│   ├── Xác nhận lịch hẹn.pdf         ← B3
│   ├── Kết quả khám kê đơn.pdf       ← B4
│   ├── Thống kê cá nhân.pdf          ← B5
│   ├── Quản lý người dùng.pdf        ← C1
│   ├── Duyệt hồ sơ bác sĩ.pdf        ← C2
│   ├── Quản lý bệnh viện chuyên khoa.pdf ← C3
│   ├── Quản lý dịch vụ.pdf           ← C4
│   ├── Quản lý lịch hẹn toàn hệ thống.pdf ← C5
│   ├── quản lý đánh giá.pdf          ← C6
│   ├── Thông báo hệ thống.pdf        ← C7
│   └── Quản lý thanh toán.pdf        ← C8
└── Cơ sở dữ liệu/
    └── VitaFamily_Database.sql        ← 27 bảng MySQL (dùng làm tham chiếu thiết kế)
```

---

> **Lưu ý database:** File `.sql` viết theo MySQL nhưng nhóm đã chọn **MongoDB**.
> Dùng file này để tham chiếu cấu trúc dữ liệu, không chạy trực tiếp.
