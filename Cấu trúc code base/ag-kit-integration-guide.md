# 🤖 Tích hợp AG Kit vào Đồ án — Hướng dẫn thực tế
> AG Kit · 20 Agents · 45 Skills · 13 Workflows · Dành cho nhóm sinh viên

---

## Mục lục

1. [AG Kit là gì — Giải thích đơn giản](#1-ag-kit-là-gì--giải-thích-đơn-giản)
2. [Cấu trúc dự án sau khi tích hợp](#2-cấu-trúc-dự-án-sau-khi-tích-hợp)
3. [Cài đặt & Setup một lần duy nhất](#3-cài-đặt--setup-một-lần-duy-nhất)
4. [Tuỳ chỉnh Memory cho dự án của nhóm](#4-tuỳ-chỉnh-memory-cho-dự-án-của-nhóm)
5. [Agents hữu ích nhất cho sinh viên](#5-agents-hữu-ích-nhất-cho-sinh-viên)
6. [Workflows — Lệnh slash nhanh](#6-workflows--lệnh-slash-nhanh)
7. [Luồng sử dụng hàng ngày của cả nhóm](#7-luồng-sử-dụng-hàng-ngày-của-cả-nhóm)
8. [Ví dụ thực tế từng tình huống](#8-ví-dụ-thực-tế-từng-tình-huống)
9. [Tạo CLAUDE.md cho Claude Code](#9-tạo-claudemd-cho-claude-code)

---

## 1. AG Kit là gì — Giải thích đơn giản

```
Bình thường bạn hỏi AI:
  "Viết cho tôi API đăng nhập"
  → AI trả lời chung chung, không biết dự án bạn dùng gì

Với AG Kit:
  "Viết cho tôi API đăng nhập"
  → AI tự động kích hoạt backend-specialist agent
  → Load skill api-patterns + nodejs-best-practices
  → Đọc memory: "project dùng Express + MongoDB + JWT"
  → Viết code đúng với stack và convention của nhóm bạn
```

**AG Kit gồm 3 thứ chính:**

| Thành phần | Là gì | Ví dụ |
|---|---|---|
| 🤖 **Agents** (20) | AI chuyên gia theo lĩnh vực | `backend-specialist`, `debugger`, `project-planner` |
| 🧩 **Skills** (45) | Kiến thức chuyên sâu theo chủ đề | `api-patterns`, `database-design`, `clean-code` |
| ⚡ **Workflows** (13) | Lệnh slash để thực hiện tác vụ | `/plan`, `/debug`, `/create`, `/brainstorm` |

**Cách hoạt động:**

```
Bạn gõ câu hỏi / lệnh
        │
        ▼
AI đọc CLAUDE.md (quy tắc dự án)
        │
        ▼
AI chọn Agent phù hợp (ví dụ: backend-specialist)
        │
        ▼
Agent load Skills cần thiết (api-patterns, nodejs-best-practices)
        │
        ▼
Đọc Memory của dự án (stack, convention, quyết định trước đó)
        │
        ▼
Trả lời/viết code đúng với dự án của bạn
```

---

## 2. Cấu trúc dự án sau khi tích hợp

```
my-project/                        ← Root của dự án (git repo)
│
├── .agents/                       ← 🤖 AG Kit (AI Toolkit cho cả nhóm)
│   ├── ARCHITECTURE.md            ← Bản đồ toàn bộ ag-kit
│   ├── agent/                     ← 20 AI specialists
│   │   ├── orchestrator.md
│   │   ├── backend-specialist.md
│   │   ├── frontend-specialist.md
│   │   ├── debugger.md
│   │   ├── project-planner.md
│   │   └── ...
│   ├── skills/                    ← 45 knowledge modules
│   │   ├── api-patterns/
│   │   ├── database-design/
│   │   ├── clean-code/
│   │   └── ...
│   ├── workflows/                 ← 13 slash commands
│   │   ├── plan.md
│   │   ├── debug.md
│   │   ├── brainstorm.md
│   │   └── ...
│   ├── memory/                    ← 📝 Tuỳ chỉnh theo dự án của nhóm
│   │   ├── MEMORY.md              ← Index (bắt buộc tuỳ chỉnh)
│   │   ├── project-conventions.md ← Convention của nhóm (bắt buộc tuỳ chỉnh)
│   │   ├── tech-decisions.md      ← Các quyết định kỹ thuật (tạo mới)
│   │   └── team-notes.md          ← Ghi chú của nhóm (tạo mới)
│   ├── rules/
│   │   └── GEMINI.md              ← Rules cho Gemini CLI
│   └── scripts/                   ← validate/verify scripts
│       ├── checklist.py
│       └── verify_all.py
│
├── CLAUDE.md                      ← 📋 Rules cho Claude Code (tạo mới)
│
├── backend/                       ← Node.js + Express
│   ├── src/
│   └── package.json
│
├── frontend/                      ← React + Vite
│   ├── src/
│   └── package.json
│
├── docs/                          ← Tài liệu đặc tả (tùy chọn)
│   ├── api-spec.md
│   ├── database-schema.md
│   └── user-stories.md
│
├── .gitignore
└── README.md
```

**Tại sao `.agents/` nằm ở root?**

Vì AI coding tool (Claude Code, Gemini CLI) đọc config từ thư mục gốc của project. Khi bạn mở terminal tại `my-project/` và chạy `claude`, nó tự động tìm và áp dụng toàn bộ `.agents/` + `CLAUDE.md`.

---

## 3. Cài đặt & Setup một lần duy nhất

### Bước 1 — Copy ag-kit vào project

```bash
# Clone ag-kit (hoặc download zip, giải nén)
git clone https://github.com/...ag-kit ag-kit-main

# Copy thư mục .agents vào root project của nhóm
cp -r ag-kit-main/.agents /path/to/my-project/.agents

# Xoá web/ (docs site, không cần cho dev hàng ngày)
# (tuỳ chọn - giữ lại nếu muốn chạy docs site nội bộ)
```

### Bước 2 — Cài Claude Code (mỗi người trong nhóm)

```bash
# Cài Node.js >= 18 trước, sau đó:
npm install -g @anthropic-ai/claude-code

# Kiểm tra
claude --version
```

### Bước 3 — Cấu hình lần đầu

```bash
cd my-project
claude   # Lần đầu sẽ hỏi đăng nhập Anthropic account
```

### Bước 4 — Thêm `.agents/` vào `.gitignore` hay không?

```gitignore
# ❌ KHÔNG nên ignore .agents/
# Vì đây là tool dùng chung cho cả nhóm
# → Commit .agents/ lên repo để mọi người dùng chung

# CHỈ ignore những file sinh ra runtime:
.agents/memory/*.tmp
.agents/.cache/
```

### Bước 5 — Tạo CLAUDE.md ở root (xem mục 9)

---

## 4. Tuỳ chỉnh Memory cho dự án của nhóm

Đây là bước **quan trọng nhất** — giúp AI hiểu đúng context dự án của nhóm.

### Sửa `.agents/memory/MEMORY.md`

```markdown
# Memory Index

## Project
- [project] Stack: React + Node/Express + MongoDB → project-conventions.md
- [project] Auth: JWT, lưu token vào localStorage → tech-decisions.md
- [project] Branch: feature/[tên-tính-năng], fix/[tên-bug] → project-conventions.md
- [project] API response format: { success, message, data } → project-conventions.md
- [project] Deadline: tháng 12/2025, hội đồng báo cáo → team-notes.md
- [project] Đề tài: Website bán hàng thời trang → team-notes.md

## Team
- [user] Backend: Minh (Node.js), Frontend: Lan (React), DB: Tuấn → team-notes.md
- [user] Dùng tiếng Việt khi giải thích, tiếng Anh cho code → team-notes.md
```

### Tạo `.agents/memory/project-conventions.md`

```markdown
---
type: project
created: 2025-09-01
updated: 2025-09-01
---

# Quy ước Dự án — [Tên Dự án]

## Tech Stack
- Frontend: React 18 + Vite + TailwindCSS
- Backend: Node.js 20 + Express 4
- Database: MongoDB + Mongoose
- Auth: JWT (HS256, expire 7d)
- Upload ảnh: Cloudinary

## Cấu trúc thư mục
- Backend theo MVC: models/ controllers/ routes/ middlewares/ services/
- Frontend: pages/admin/ pages/client/ components/admin/ components/client/ layouts/
- Services gọi API qua axiosInstance.js

## Quy ước đặt tên
- File: camelCase (userController.js)
- Component React: PascalCase (UserCard.jsx)
- Biến/hàm: camelCase (getUserById)
- Hằng số: UPPER_SNAKE (JWT_SECRET)
- Route API: kebab-case (/api/product-categories)

## API Response Format
```json
{ "success": true, "message": "...", "data": {...} }
{ "success": false, "message": "Lỗi cụ thể" }
```

## Git Workflow
- Branch: feature/[tên] hoặc fix/[tên]
- Commit: feat:, fix:, docs:, refactor: (Conventional Commits)
- PR phải review trước khi merge vào main

## Code Style
- Dùng async/await, không dùng callback
- Luôn try/catch trong controller
- Không viết logic trong route file
- Comment bằng tiếng Việt cho phần phức tạp
```

### Tạo `.agents/memory/tech-decisions.md`

```markdown
---
type: project
created: 2025-09-01
---

# Quyết định Kỹ thuật

## Database
- Chọn MongoDB vì đề tài không yêu cầu quan hệ phức tạp
- Collection: users, products, categories, orders, reviews
- ObjectId cho tất cả foreign key

## Authentication
- JWT stored in localStorage (đủ cho đồ án, không cần httpOnly cookie)
- Role: "admin" | "user"
- Route admin: /api/admin/* → verifyToken + requireRole("admin")

## File Upload
- Dùng Cloudinary (free tier đủ cho demo)
- Middleware: multer + cloudinary storage

## Frontend State
- AuthContext: thông tin user đang login
- CartContext: giỏ hàng (localStorage sync)
- Không dùng Redux (quá phức tạp cho đồ án)
```

---

## 5. Agents hữu ích nhất cho sinh viên

### 🎯 Top agents cần biết

| Agent | Khi nào dùng | Câu lệnh gợi ý |
|---|---|---|
| `project-planner` | Bắt đầu tính năng mới, chưa biết làm từ đâu | "Lên kế hoạch xây dựng tính năng giỏ hàng" |
| `backend-specialist` | Viết API, middleware, controller | "Viết API tạo đơn hàng với validation" |
| `frontend-specialist` | Viết component React, UI | "Tạo trang danh sách sản phẩm có filter và pagination" |
| `database-architect` | Thiết kế schema, query | "Thiết kế schema cho hệ thống đánh giá sản phẩm" |
| `debugger` | Gặp bug không tìm ra nguyên nhân | "Bug: giỏ hàng không cập nhật khi thêm sản phẩm" |
| `documentation-writer` | Viết đặc tả, README, báo cáo | "Viết đặc tả API cho module thanh toán" |
| `test-engineer` | Cần viết test cases | "Viết unit test cho userController" |
| `security-auditor` | Kiểm tra lỗ hổng trước khi nộp | "Review bảo mật toàn bộ authentication module" |

### Cách gọi Agent (Claude Code)

```bash
# Cách 1: Nhắc tên agent trực tiếp
"Dùng backend-specialist agent để viết API quản lý sản phẩm"

# Cách 2: Mô tả rõ tác vụ, AI tự chọn agent
"Tôi cần xây dựng tính năng tìm kiếm sản phẩm theo tên và danh mục"

# Cách 3: Dùng slash command
/plan Xây dựng module thanh toán với VNPay
```

---

## 6. Workflows — Lệnh slash nhanh

### `/plan` — Lên kế hoạch trước khi code

```
/plan Xây dựng tính năng đặt hàng và quản lý đơn hàng

→ AI sẽ:
   1. Hỏi clarifying questions (nếu còn mù mờ)
   2. Tạo file task-slug.md với:
      - Phân tích yêu cầu
      - Danh sách task breakdown
      - Files cần tạo/sửa
      - Thứ tự thực hiện
      - Estimated effort
```

**Khi nào dùng:** Bắt đầu sprint mới, thêm tính năng lớn, chưa biết bắt đầu từ đâu.

---

### `/brainstorm` — Khám phá ý tưởng

```
/brainstorm Hệ thống gợi ý sản phẩm cho user

→ AI sẽ:
   1. Đưa ra 3+ cách tiếp cận khác nhau
   2. Phân tích pros/cons từng cách
   3. Đề xuất cách phù hợp nhất với stack hiện tại
```

**Khi nào dùng:** Chưa chắc cách thiết kế, muốn so sánh các phương án.

---

### `/debug` — Debug có hệ thống

```
/debug Lỗi 500 khi gọi API POST /api/orders, nhưng GET bình thường

→ AI sẽ:
   1. Yêu cầu xem error log
   2. Phân tích nguyên nhân có thể
   3. Đưa ra các bước kiểm tra theo thứ tự
   4. Fix code nếu tìm ra vấn đề
```

**Khi nào dùng:** Bug khó, đã debug lâu không ra.

---

### `/create` — Tạo tính năng mới

```
/create Trang profile người dùng: xem thông tin, đổi avatar, đổi mật khẩu

→ AI sẽ:
   1. Kiểm tra codebase hiện tại
   2. Tạo các file cần thiết (component, route, API)
   3. Tích hợp với code đã có
```

**Khi nào dùng:** Cần tạo một tính năng hoàn chỉnh từ đầu.

---

### `/verify` — Xác nhận code chạy đúng

```
/verify Module authentication đang hoạt động đúng không?

→ AI sẽ:
   1. Đọc code
   2. Chạy test (nếu có)
   3. Kiểm tra các edge case
   4. Báo cáo những điểm yếu
```

**Khi nào dùng:** Trước khi commit, trước khi demo.

---

### `/remember` — Lưu quyết định vào memory

```
/remember Chúng tôi quyết định dùng Cloudinary thay vì lưu ảnh local
          vì deploy trên server free không có persistent storage

→ AI sẽ lưu vào .agents/memory/tech-decisions.md
```

**Khi nào dùng:** Vừa có quyết định kỹ thuật quan trọng, muốn AI nhớ cho lần sau.

---

### `/status` — Kiểm tra trạng thái project

```
/status

→ AI đọc codebase và báo cáo:
   - Các tính năng đã có
   - TODO còn lại
   - Potential issues
   - Suggestions để cải thiện
```

**Khi nào dùng:** Đầu buổi làm việc, review tiến độ.

---

## 7. Luồng sử dụng hàng ngày của cả nhóm

### Bắt đầu buổi làm việc

```bash
cd my-project
claude               # Mở Claude Code

# Kiểm tra tiến độ
/status

# Đọc plan hôm nay
"Tôi cần làm gì trong sprint này?"
```

### Nhận task mới

```bash
# 1. Brainstorm nếu chưa rõ hướng
/brainstorm Tính năng coupon/mã giảm giá

# 2. Plan trước khi code
/plan Xây dựng hệ thống coupon

# 3. Bắt đầu code
/create Coupon model, API CRUD cho admin, áp dụng khi checkout
```

### Trong quá trình code

```bash
# Hỏi về implementation
"backend-specialist: Viết validator cho coupon (check hết hạn, đã dùng chưa)"

# Review code vừa viết
"Kiểm tra file controllers/coupon.controller.js có vấn đề gì không?"

# Debug khi gặp lỗi
/debug Lỗi 'Cannot read properties of undefined' tại cart.controller.js line 45
```

### Trước khi commit

```bash
# Verify code
/verify Module coupon hoàn chỉnh chưa?

# Review security
"security-auditor: Check file middlewares/auth.middleware.js"

# Lưu quyết định quan trọng vào memory
/remember Coupon chỉ áp dụng 1 lần/user, check theo userId + couponCode
```

---

## 8. Ví dụ thực tế từng tình huống

### Tình huống 1: Thành viên mới clone project về

```bash
git clone https://github.com/nhom/my-project
cd my-project

# Đọc memory để hiểu project
"Đọc .agents/memory/ và giới thiệu cho tôi về dự án này"

# → AI tóm tắt: stack, convention, quyết định đã có, việc cần làm
```

### Tình huống 2: Viết đặc tả API cho báo cáo

```bash
"documentation-writer: Viết đặc tả API đầy đủ cho tất cả endpoint trong routes/
 Format: Method, URL, Request body, Response, Auth required"

# → AI đọc toàn bộ routes/ và tạo file docs/api-spec.md
```

### Tình huống 3: Chuẩn bị báo cáo đồ án

```bash
"project-planner: Tôi cần báo cáo đồ án cuối kỳ tuần sau.
 Đọc toàn bộ codebase và giúp tôi viết phần 'Mô tả hệ thống' và 'Sơ đồ luồng chức năng'"
```

### Tình huống 4: Gặp bug lúc demo

```bash
/debug Khi thêm vào giỏ hàng, số lượng hiển thị trên icon navbar không cập nhật

# AI sẽ:
# 1. Tìm CartContext
# 2. Trace luồng data từ addToCart → CartContext → Navbar
# 3. Tìm ra nguyên nhân (thường là re-render issue)
# 4. Fix ngay
```

### Tình huống 5: Review code trước khi nộp

```bash
"code-archaeologist: Đọc toàn bộ backend/src/ và báo cáo:
 1. Code nào vi phạm clean code?
 2. Security issues?
 3. Missing error handling?
 4. Đề xuất cải thiện"
```

---

## 9. Tạo CLAUDE.md cho Claude Code

`CLAUDE.md` là file đặt ở root project, Claude Code đọc tự động mỗi khi start.
Đây là "bản tóm tắt dự án" cho AI — **quan trọng nhất**.

### Tạo file `CLAUDE.md` ở root project

```markdown
# CLAUDE.md — [Tên Dự án]

> File này được Claude Code đọc tự động. Cập nhật khi có thay đổi lớn.

---

## 🎯 Dự án

**Tên:** Website Bán Hàng Thời Trang — [Tên Nhóm]
**Loại:** Đồ án môn [Tên Môn] — [Tên Trường]
**Deadline:** Tháng 12/2025

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js 20 + Express 4 |
| Database | MongoDB + Mongoose |
| Auth | JWT (7d expire, localStorage) |
| Upload | Cloudinary |
| Deploy | Vercel (FE) + Render (BE) |

---

## 📁 Cấu trúc

```
my-project/
├── backend/src/
│   ├── models/         ← MongoDB schemas
│   ├── controllers/    ← Business logic
│   ├── routes/         ← API endpoints
│   ├── middlewares/    ← auth, role, upload
│   └── services/       ← External services
└── frontend/src/
    ├── pages/admin/    ← Trang quản trị
    ├── pages/client/   ← Trang người dùng
    ├── components/     ← Reusable components
    ├── layouts/        ← AdminLayout, ClientLayout
    ├── services/       ← API calls (axios)
    └── context/        ← AuthContext, CartContext
```

---

## ⚙️ API Conventions

- Base URL: `http://localhost:5000/api`
- Auth header: `Authorization: Bearer <token>`
- Response format:
  ```json
  { "success": true, "message": "...", "data": {...} }
  ```
- Admin routes: `/api/admin/*` cần role = "admin"

---

## 📝 Code Conventions

- **Ngôn ngữ code:** Tiếng Anh
- **Comment:** Tiếng Việt cho logic phức tạp
- **Naming:** camelCase (biến/hàm), PascalCase (Component), UPPER_SNAKE (constant)
- **Async:** Dùng async/await, luôn có try/catch trong controller
- **Git:** feature/[tên] hoặc fix/[tên]

---

## 🤖 AG Kit Usage

- **Đọc `.agents/ARCHITECTURE.md`** để biết available agents và skills
- **Đọc `.agents/memory/`** để nắm context dự án
- **Dùng agent phù hợp** cho từng tác vụ
- **Dùng `/plan` trước** khi bắt đầu tính năng mới

---

## 🚫 Không làm những điều này

- Không commit file `.env`
- Không commit `node_modules/`
- Không push thẳng lên `main` (luôn tạo branch)
- Không hardcode secret/password trong code
- Không xoá file `.agents/memory/` (chứa context quan trọng)
```

---

## 📌 Tóm tắt — Nhóm cần làm gì

### Setup một lần (người lead làm)

```bash
# 1. Copy .agents/ vào project root
# 2. Tạo CLAUDE.md ở root
# 3. Tuỳ chỉnh .agents/memory/ theo dự án
# 4. Commit lên repo
git add .agents/ CLAUDE.md
git commit -m "feat: integrate ag-kit AI toolkit"
```

### Mỗi thành viên làm một lần

```bash
# 1. Cài Claude Code
npm install -g @anthropic-ai/claude-code

# 2. Pull code mới nhất
git pull

# 3. Chạy và làm quen
cd my-project
claude
"Đọc CLAUDE.md và .agents/memory/ và giới thiệu cho tôi về project"
```

### Mỗi ngày làm việc

```
1. Mở terminal → cd my-project → claude
2. /status để xem trạng thái
3. Dùng agent/workflow phù hợp cho task của ngày
4. /remember khi có quyết định quan trọng
5. Commit code + update memory nếu cần
```

---

> **Ghi nhớ:** AG Kit không tự code thay bạn — nó giúp bạn code *đúng hướng*, *nhanh hơn*, và *nhất quán* trong cả nhóm. Càng bổ sung nhiều context vào `memory/`, AI càng hiểu dự án và trả lời chính xác hơn.
```
