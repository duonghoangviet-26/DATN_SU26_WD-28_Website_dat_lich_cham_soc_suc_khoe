# Cơ Cấu Phân Cấp Trang Quản Lý Dịch Vụ (Admin) — 3 Tầng

> Ngày tạo: 2026-07-03
> Trạng thái: **Đã duyệt — chờ implement (FE)**
> Phạm vi: `/admin/services` (ManageServices.tsx) và 1 route chi tiết mới. Không đổi backend model.

---

## 1. Bối cảnh & vấn đề

Trang `/admin/services` hiện tại là 1 bảng phẳng liệt kê toàn bộ `DichVu` (cả `related` lẫn `home`), lọc bằng tab loại + tìm kiếm. Khi hệ thống có nhiều chuyên khoa và nhiều dịch vụ liên quan, bảng phẳng khó quản lý và không phản ánh đúng cách một phòng khám thực tế tổ chức dịch vụ (dịch vụ lớn → chuyên khoa/nhóm → dịch vụ con → bác sĩ áp dụng).

Yêu cầu: tổ chức lại thành cây phân cấp 3 tầng, dễ mở rộng khi phòng khám thêm dịch vụ lớn mới (VD: Khám tổng quát) trong tương lai.

---

## 2. Cấu trúc 3 tầng

```
TẦNG 1 — "Dịch vụ lớn" (hard-code trong FE, 1 config array — thêm mới chỉ cần thêm 1 dòng)
├── Khám chuyên khoa   → nguồn dữ liệu: ChuyenKhoa (CRUD đã có ở /admin/hospitals)
└── Khám tại nhà       → nguồn dữ liệu: DichVu[loai='home']
        │
        ▼ click — dropdown/accordion xổ ngay tại trang (không chuyển route)
TẦNG 2 — "Dịch vụ con"
├── Khám chuyên khoa → danh sách chuyên khoa (Tim mạch, Thần kinh, Cơ xương khớp...)
│                       lấy từ ChuyenKhoa { status: 'active' }
└── Khám tại nhà     → 2 nhóm cố định:
        ├── "Xét nghiệm"     → DichVu[loai='home'] hiện có (2 mock item) — hoạt động đầy đủ
        └── "Khám trực tiếp" → 0 dịch vụ, khóa, badge "Sắp ra mắt" — KHÔNG đổi model,
                                 KHÔNG có tính năng thật trong phạm vi DATN này
        │
        ▼ click 1 chuyên khoa con (chỉ nhánh Khám chuyên khoa mới có tầng 3)
TẦNG 3 — Trang chi tiết chuyên khoa (route mới, vì danh sách bác sĩ có thể dài)
/admin/services/chuyen-khoa/:slug
├── (A) Menu dịch vụ liên quan của khoa — DichVu[loai='related', specialty_id=X]
│       Đây là nơi Admin THỰC SỰ tạo/sửa/ẩn dịch vụ (CRUD, tái dùng ServiceFormModal có sẵn)
└── (B) Danh sách bác sĩ thuộc khoa — VIEW THAM CHIẾU, chỉ đọc
        Mỗi bác sĩ hiển thị: giá khám (BacSi.gia_kham), bảo hiểm áp dụng (BacSi.bao_hiem),
        và các dịch vụ liên quan bác sĩ đó đã tick (BacSi.related_services[])
        Sửa thông tin bác sĩ vẫn thực hiện ở trang Quản lý bác sĩ (C2) — trang này KHÔNG có
        form sửa bác sĩ, tránh tạo 2 nơi chỉnh sửa cùng 1 dữ liệu.
```

### "Xét nghiệm" nhánh Khám tại nhà — không cần route riêng

Click "Xét nghiệm" → xổ luôn bảng `DichVu[loai='home']` hiện có (tái dùng logic bảng đang có, chỉ lọc theo nhóm). Không có concept "bác sĩ theo khoa" ở nhánh home nên không cần trang chi tiết.

### Vì sao tách rõ (A) và (B) ở Tầng 3

Tránh lặp lại lỗi đã gặp trong session này (nhầm lẫn "bác sĩ" và "nhân viên lấy mẫu tại nhà" trên cùng 1 cột dữ liệu). Ở Tầng 3: (A) là đối tượng CRUD thật của trang này; (B) chỉ giúp Admin đối chiếu bác sĩ nào áp dụng dịch vụ nào với giá/bảo hiểm gì — không phải nơi sửa bác sĩ.

---

## 3. Tham chiếu thực tế

Bố cục phần (B) — giá khám, danh sách "giá dịch vụ liên quan (theo chỉ định bác sĩ)", loại bảo hiểm áp dụng — tham khảo từ ảnh chụp 1 trang bác sĩ y tế thực tế do người dùng cung cấp, khớp đúng với field đã có sẵn trong model: `BacSi.gia_kham`, `DichVu.loai='related'`, `BacSi.bao_hiem`.

---

## 4. Data model — không đổi

| Nhu cầu | Nguồn dữ liệu | Đủ dùng? |
|---|---|---|
| Danh sách chuyên khoa con | `ChuyenKhoa { status: 'active' }` | ✅ Đã có |
| Menu dịch vụ liên quan của khoa | `DichVu { loai:'related', specialty_id }` | ✅ Đã có |
| Bác sĩ theo khoa + giá + bảo hiểm | `BacSi { specialties[], gia_kham, bao_hiem }` | ✅ Đã có |
| Dịch vụ bác sĩ đã áp dụng | `BacSi.related_services[]` (ref DichVu) | ✅ Đã có |
| Dịch vụ tại nhà (Xét nghiệm) | `DichVu { loai:'home' }` | ✅ Đã có |

Không cần thêm bảng/field mới ở backend. Toàn bộ thay đổi nằm ở tầng FE (cấu trúc component + mock data mẫu).

---

## 5. Mock data cần bổ sung

- `mock/hospitals.ts` (`mockSpecialties`): thêm chuyên khoa mẫu để Tầng 3 có dữ liệu demo thật — ví dụ "Cột sống", "Cơ xương khớp", "Chấn thương chỉnh hình" (hiện chỉ có Tim mạch, Nhi khoa, Da liễu, Sản phụ khoa, Thần kinh, Nội tổng quát, Mắt, TMH).
- `mock/services.ts`: thêm vài `DichVu` loại `related` gắn với chuyên khoa mới.
- `mock/doctors.ts`: gắn `related_services` cho 1–2 bác sĩ mẫu thuộc chuyên khoa mới, để phần (B) ở Tầng 3 có nội dung hiển thị.

---

## 6. File FE cần tạo/sửa

| File | Thay đổi |
|---|---|
| `pages/admin/ManageServices.tsx` | Sửa — thay bảng phẳng bằng UI 2 tầng: card "dịch vụ lớn" → accordion "dịch vụ con" |
| `pages/admin/ManageServiceSpecialtyDetail.tsx` | **Tạo mới** — route `/admin/services/chuyen-khoa/:slug`, gồm phần (A) bảng related-service (tái dùng `ServiceFormModal`) + phần (B) doctor reference cards |
| `routes/AppRoutes.tsx` | Sửa — thêm route mới trong nhánh `/admin` |
| `services/service.service.ts` | Không đổi signature `getAll()` — lọc theo `specialty_id` thực hiện client-side trong component Tầng 3 |

---

## 7. Ngoài phạm vi (out of scope)

- CRUD động cho "dịch vụ lớn" (Tầng 1) — cố định trong code, không có giao diện thêm/sửa/xóa nhóm lớn.
- "Khám trực tiếp tại nhà" — chỉ hiển thị placeholder khóa, không có dịch vụ/booking thật, không đổi `BacSi.loai` hay `DichVu` model.
- Sửa thông tin bác sĩ từ trang dịch vụ — vẫn dùng trang Quản lý bác sĩ (C2) hiện có.
