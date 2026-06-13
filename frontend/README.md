# VitaFamily — Frontend (Giao diện)

Giao diện người dùng hệ thống VitaFamily. **React 18 + Vite + TailwindCSS**.

## Chạy thử

```bash
cd frontend
npm install
npm run dev               # chạy ở http://localhost:5173
```

Đăng nhập trang Admin bằng tài khoản demo: **admin@vitafamily.vn / 123456**
→ tự chuyển vào `/admin`.

## Ý tưởng cốt lõi: tách dữ liệu khỏi giao diện

Trang **không bao giờ** gọi mock trực tiếp — luôn đi qua **service**:

```
Page  →  service (services/*.service.js)  →  (bây giờ) mock data
                                              (sau này)  axios gọi API thật
```

Khi có backend thật, chỉ cần sửa phần thân hàm trong file service (đã có sẵn ví dụ
trong comment), **giao diện giữ nguyên không phải sửa**.

## Cấu trúc thư mục

```
frontend/src/
├── mock/           ← Dữ liệu fix cứng (XÓA khi có DB thật)
├── services/       ← axiosInstance.js + *.service.js  ← chỗ duy nhất chạm dữ liệu
├── layouts/        ← AdminLayout, ClientLayout, AuthLayout
├── pages/
│   ├── admin/      ← Dashboard, ManageUsers (MẪU), Placeholder...
│   ├── client/     ← Home
│   └── auth/       ← Login
├── components/
│   ├── admin/      ← Sidebar, AdminHeader, icons
│   └── common/     ← Badge, ConfirmDialog, PageHeader
├── context/        ← AuthContext (thông tin đăng nhập)
├── routes/         ← AppRoutes, ProtectedRoute, adminMenu
└── utils/          ← format, constants
```

## Làm một trang Admin mới (theo mẫu)

1. Tạo file mock trong `src/mock/` (vd `doctors.js`).
2. Tạo service trong `src/services/` (vd `doctor.service.js`) trả về mock.
3. Tạo page trong `src/pages/admin/` — học theo **`ManageUsers.jsx`**.
4. Khai báo route trong `src/routes/AppRoutes.jsx` (thay `<Placeholder/>`).
5. Mục menu đã có sẵn trong `src/routes/adminMenu.js`.

## Quy ước

- Component: `PascalCase.jsx` · biến/hàm: `camelCase` · hằng số: `UPPER_SNAKE`.
- Import dùng alias `@/` (trỏ về `src/`).
- Tên trường dữ liệu giữ tiếng Việt khớp database (`ho_ten`, `mat_khau`...).
