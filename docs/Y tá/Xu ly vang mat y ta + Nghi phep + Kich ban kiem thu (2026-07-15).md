# Xử lý vắng mặt Y tá + Nghỉ phép + Kịch bản kiểm thử

> Ngày: 2026-07-15 · Tiếp nối `Chot thiet ke DB...` · Xử lý "single point of failure" của y tá.
> **2 quyết định đã chốt:**
> - **Dự phòng:** khi y tá vắng → **Lễ tân + Admin** được tạm điều khiển phòng; y tá tới thì tiếp quản.
> - **Nghỉ phép:** **Y tá tự xin → Admin duyệt** (nhân bản pattern `NghiPhepBacSi`) → thêm model `NghiPhepYTa`.

---

## 1. Nguyên tắc xử lý vắng mặt

Y tá là người điều phối chính, nhưng **không được là điểm chết**. 3 lớp phòng vệ:

1. **Reassign (đổi y tá):** admin đổi `LichLamViec.nurse_id` sang y tá khác → `TrangThaiPhongKham.nurse_id` cập nhật theo. Áp dụng cho nghỉ báo trước & nghỉ đột xuất.
2. **Dự phòng (fallback):** khi chưa kịp có y tá thay, **lễ tân/admin** tạm điều khiển (bật "sẵn sàng", gọi bệnh nhân). Ghi rõ ai đang điều khiển để tiếp quản.
3. **Cảnh báo:** y tá phụ trách chưa có mặt sau X phút đầu ca → thông báo admin.

**Phân biệt với nghỉ phép bác sĩ:** bác sĩ nghỉ → **khóa slot** (không có bác sĩ = không khám). Y tá nghỉ → **KHÔNG khóa** (bác sĩ vẫn khám) mà **gán y tá thay / dự phòng**. Đây là khác biệt cốt lõi giữa `NghiPhepYTa` và `NghiPhepBacSi`.

---

## 2. Bổ sung DB (chốt)

### 2.1 Model mới `NghiPhepYTa` (nhân bản `NghiPhepBacSi`)
`backend/src/models/NghiPhepYTa.js` · collection `nghi_phep_y_ta`

```js
{
  y_ta_id:        ObjectId ref 'NguoiDung', required,   // y tá = NguoiDung role='nurse' (không có model YTa riêng)
  tu_ngay:        Date, required,
  den_ngay:       Date, required,
  gio_bat_dau:    String (HH:MM), default null,         // nghỉ đúng 1 ca; null = cả ngày
  gio_ket_thuc:   String (HH:MM), default null,
  ly_do:          String, maxlength 500,
  trang_thai:     enum ['cho_duyet','da_duyet','tu_choi','da_huy'], default 'cho_duyet',
  nguoi_duyet_id: ObjectId ref 'NguoiDung', default null,
  thoi_diem_duyet:Date, default null,
  ghi_chu:        String, maxlength 500,
  // KHÁC NghiPhepBacSi: nghỉ y tá cần người thay, không khóa ca
  y_ta_thay_id:   ObjectId ref 'NguoiDung', default null,  // admin chọn lúc DUYỆT
}
```
- Ràng buộc: `den_ngay >= tu_ngay`; không xin nghỉ ngày quá khứ; không trùng đơn `da_duyet`/`cho_duyet` cùng khoảng.
- **Khi admin DUYỆT:** yêu cầu chọn `y_ta_thay_id` → hệ thống cập nhật `LichLamViec.nurse_id = y_ta_thay_id` cho các ngày/ca bị ảnh hưởng của y tá xin nghỉ. (Nếu để trống y tá thay → dùng lớp dự phòng lễ tân/admin.)

### 2.2 `TrangThaiPhongKham` — thêm 3 trường phục vụ dự phòng
Thêm vào model (mục 2 file thiết kế):
```js
nguoi_dieu_khien_id:      { ObjectId ref 'NguoiDung', default null },  // ai ĐANG điều khiển thực tế
nguoi_dieu_khien_vai_tro: { String, default null },                   // 'nurse' | 'receptionist' | 'admin'
y_ta_co_mat:              { Boolean, default false },                 // y tá phụ trách đã tiếp quản chưa (cảnh báo đến muộn)
```
> `nurse_id` = y tá **được phân công**; `nguoi_dieu_khien_id` = người **thực tế đang bấm nút** (có thể là lễ tân dự phòng). UI hiển thị "Đang do Lễ tân X điều khiển tạm" khi 2 giá trị khác nhau.

### 2.3 Phân quyền (logic, không phải schema)
- Endpoint điều khiển phòng / gọi bệnh nhân / check-in: chấp nhận role `nurse` **HOẶC** `receptionist`/`admin` (dự phòng).
- Nurse chỉ thao tác được trên bác sĩ mình phụ trách (`LichLamViec.nurse_id = mình`). Lễ tân/admin thao tác được mọi phòng.
- Mọi thao tác ghi `NhatKyThaoTac` với `vai_tro` thật (`nurse`/`receptionist`/`admin`) → truy vết ai làm.

---

## 3. Luồng xử lý từng tình huống

| Tình huống | Luồng xử lý |
|---|---|
| **Nghỉ báo trước** | Y tá gửi `NghiPhepYTa` (cho_duyet) → admin duyệt + chọn `y_ta_thay_id` → hệ thống set `LichLamViec.nurse_id = y_ta_thay` các ngày liên quan → ngày đó y tá thay điều phối bình thường |
| **Nghỉ đột xuất giữa ngày** | Admin (hoặc y tá báo) → admin bấm "Đổi y tá" trên `LichLamViec` hôm nay → `TrangThaiPhongKham.nurse_id` chuyển sang y tá mới → hàng đợi (`HangDoi` theo `doctor_id`) giữ nguyên, y tá mới tiếp tục |
| **Đến muộn đầu ca** | Bác sĩ tới, y tá chưa → `y_ta_co_mat=false`. Lễ tân/admin bật "sẵn sàng" + gọi bệnh nhân (ghi `nguoi_dieu_khien_vai_tro='receptionist'`). Cron/logic cảnh báo admin nếu quá X phút. Y tá tới → bấm "Tiếp quản" → `y_ta_co_mat=true`, `nguoi_dieu_khien_id=nurse` |
| **Rời giữa ca (họp/ăn)** | Y tá chuyển bác sĩ sang `tam_nghi` (nếu không có bệnh nhân trong phòng), HOẶC lễ tân/admin dự phòng tiếp tục hàng đợi |
| **Không có y tá thay + lễ tân bận** | Admin trực tiếp dự phòng (role admin luôn có quyền) |
| **Xin nghỉ bị từ chối** | Admin `tu_choi` + `ghi_chu` lý do → y tá vẫn phụ trách, không đổi `LichLamViec` |
| **Hủy đơn nghỉ đã duyệt** | Y tá/admin `da_huy` → nếu đã reassign, admin cân nhắc gán lại y tá gốc |

---

## 4. KỊCH BẢN KIỂM THỬ (test catalog)

> Định dạng: Mã · Tình huống · Tiền điều kiện · Hành động · Kết quả mong đợi. Dùng cho test tay + viết integration test sau.

### Nhóm A — Nghỉ phép y tá (`NghiPhepYTa`)
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| A1 | Xin nghỉ hợp lệ | Y tá có ca tương lai | POST đơn nghỉ `tu_ngay < den_ngay`, tương lai | 201, `trang_thai='cho_duyet'` |
| A2 | Xin nghỉ ngày quá khứ | — | POST `tu_ngay` < hôm nay | 400 "không xin nghỉ ngày quá khứ" |
| A3 | `den_ngay < tu_ngay` | — | POST đảo ngày | 400 "den_ngay phai >= tu_ngay" |
| A4 | Trùng đơn đang chờ/đã duyệt | Đã có đơn `cho_duyet` cùng khoảng | POST đơn chồng lấn | 409 "đã có đơn nghỉ khoảng này" |
| A5 | Admin duyệt + gán y tá thay | Có đơn `cho_duyet`, có y tá rảnh | PATCH duyệt kèm `y_ta_thay_id` | 200, `da_duyet`; `LichLamViec.nurse_id` các ngày liên quan = y tá thay |
| A6 | Admin duyệt KHÔNG chọn y tá thay | Có đơn `cho_duyet` | PATCH duyệt, `y_ta_thay_id=null` | 200, `da_duyet`; ca để trống nurse → rơi vào lớp dự phòng (cảnh báo) |
| A7 | Admin từ chối | Có đơn `cho_duyet` | PATCH từ chối + ghi_chu | 200, `tu_choi`; `LichLamViec` không đổi |
| A8 | Y tá hủy đơn của mình | Đơn `cho_duyet` của y tá A | Y tá A hủy | 200, `da_huy` |
| A9 | Y tá B xem/sửa đơn của y tá A | Đơn thuộc A | B thao tác | 403 |
| A10 | Y tá tự duyệt đơn của mình | Y tá gửi đơn | Y tá gọi endpoint duyệt | 403 (chỉ admin duyệt) |

### Nhóm B — Đổi y tá (reassign)
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| B1 | Đổi y tá báo trước | `LichLamViec` ngày mai có nurse A | Admin đổi sang nurse B | 200; `nurse_id=B` |
| B2 | Đổi y tá đột xuất giữa ngày | Hôm nay đang khám, `TrangThaiPhongKham.nurse_id=A` | Admin đổi sang B | `TrangThaiPhongKham.nurse_id=B`; hàng đợi `HangDoi` giữ nguyên (không mất bệnh nhân đang chờ) |
| B3 | Y tá cũ mất quyền sau khi đổi | Sau B2 | Nurse A thao tác phòng đó | 403 (A không còn phụ trách) |
| B4 | Y tá mới nhận quyền | Sau B2 | Nurse B bật "sẵn sàng" | 200 |
| B5 | Đổi sang y tá đang bận ca khác trùng giờ | B đã phụ trách bác sĩ khác cùng khung giờ | Admin đổi sang B | Cảnh báo/chặn trùng lịch y tá (tùy quyết định — hiện y tá có thể nhiều bác sĩ, cần xác nhận) |

### Nhóm C — Đến muộn / vắng đầu ca (dự phòng)
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| C1 | Lễ tân dự phòng bật "sẵn sàng" | Bác sĩ tới, y tá chưa (`y_ta_co_mat=false`) | Lễ tân bật "sẵn sàng" | 200; `nguoi_dieu_khien_vai_tro='receptionist'`; audit ghi lễ tân |
| C2 | Lễ tân dự phòng gọi bệnh nhân | Có `HangDoi` chờ | Lễ tân "gọi bệnh nhân" | 200; thông báo tạo bình thường |
| C3 | Cảnh báo y tá đến muộn | Quá X phút đầu ca chưa có y tá thao tác | (cron/logic) | Thông báo tới admin "y tá chưa có mặt" |
| C4 | Y tá tiếp quản | Sau C1, y tá tới | Y tá bấm "Tiếp quản" | `y_ta_co_mat=true`, `nguoi_dieu_khien_id`=y tá |
| C5 | Admin dự phòng khi lễ tân cũng bận | Không y tá, không lễ tân | Admin thao tác | 200; audit ghi admin |
| C6 | Y tá của bác sĩ KHÁC cố dự phòng | Nurse A phụ trách BS1 | A thao tác phòng BS2 | 403 (A không phụ trách BS2; chỉ lễ tân/admin mới dự phòng chéo) |

### Nhóm D — Rời giữa ca & bàn giao
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| D1 | Y tá cho bác sĩ `tam_nghi` khi phòng trống | Không có bệnh nhân trong phòng | Y tá set `tam_nghi` | 200 |
| D2 | Cấm `tam_nghi` khi đang có bệnh nhân | `benh_nhan_hien_tai_id != null` | Y tá set `tam_nghi` | 409 "còn bệnh nhân trong phòng" |
| D3 | Lễ tân tiếp tục hàng đợi khi y tá rời | Y tá rời, `tam_nghi`? | Lễ tân bật lại "sẵn sàng" + gọi | 200 (dự phòng) |

### Nhóm E — Ràng buộc trạng thái phòng (presence-gate)
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| E1 | Không cho `dang_kham` phòng trống | `benh_nhan_hien_tai_id=null` | Set `dang_kham` | 409 "phải có bệnh nhân có mặt" |
| E2 | Không nhảy `dang_kham → san_sang` | Đang `dang_kham` | Set thẳng `san_sang` | 409 "phải qua dọn phòng" |
| E3 | Bệnh nhân `skipped` không được vào phòng | Entry `skipped` | Gán vào phòng | 409 "bệnh nhân đã bị bỏ lượt" |
| E4 | Luồng chuẩn | — | `san_sang→` gọi `→dang_kham→dang_don_phong→san_sang` | 200 mỗi bước; audit đủ |

### Nhóm F — Hàng đợi & ngưỡng nhận
| Mã | Tình huống | Tiền điều kiện | Hành động | Kết quả mong đợi |
|---|---|---|---|---|
| F1 | Online đúng cửa sổ ±30' | Lịch online, check-in lệch ≤30' | Tạo `HangDoi` | `muc_uu_tien='online_uu_tien'` |
| F2 | Online trễ >30' | Check-in trễ 45' | Tạo `HangDoi` | `muc_uu_tien='offline'` (mất ưu tiên) |
| F3 | Offline | Khách vãng lai | Tạo `HangDoi` | `muc_uu_tien='offline'`, sắp sau online cùng giờ |
| F4 | Ngưỡng nhận quá tải | Dự kiến xong > giờ kết thúc ca | Check-in thêm | Cảnh báo/chặn, đề xuất "hẹn đợt sau" |
| F5 | No-show sau 10' | Đã gọi 2 lần, quá 10' | (cron/logic) | `trang_thai='skipped'`, giải phóng lượt |
| F6 | Ca kéo dài → giãn ước tính | 1 ca lâu bất thường | Cập nhật TB | `thoi_gian_cho_uoc_tinh` các bệnh nhân sau tăng |

### Nhóm G — Phân quyền & audit
| Mã | Tình huống | Hành động | Kết quả mong đợi |
|---|---|---|---|
| G1 | Không đăng nhập | Gọi endpoint y tá | 401 |
| G2 | Role `user`/`doctor` gọi endpoint điều khiển phòng | — | 403 |
| G3 | Mọi thao tác đổi trạng thái | — | Ghi `NhatKyThaoTac` đúng `vai_tro` + `du_lieu_cu/moi` |
| G4 | Y tá nhập hồ sơ lịch hẹn không thuộc bác sĩ mình | — | 403/404 |

---

## 5. Ảnh hưởng tới Plan & danh sách bảng

- **Plan 1 (DB nền tảng):** +model `NghiPhepYTa`, +3 trường `TrangThaiPhongKham` (`nguoi_dieu_khien_id`, `nguoi_dieu_khien_vai_tro`, `y_ta_co_mat`).
- **Plan mới "Nghỉ phép & Dự phòng y tá":** endpoint xin/duyệt/từ chối/hủy nghỉ + đổi y tá (reassign) + tiếp quản + cảnh báo đến muộn. Phụ thuộc Plan 1, 2.
- **Phân quyền dự phòng** thấm vào Plan 2 & 3 (middleware chấp nhận nurse/receptionist/admin cho endpoint điều khiển).

Tổng bảng mới sau vòng này: **`HangDoi`, `TrangThaiPhongKham`, `NghiPhepYTa`** (3 model mới) + 4 model sửa nhẹ.

---

## 6. Điểm cần bạn xác nhận thêm (nhỏ)

1. **B5:** 1 y tá có được phụ trách >1 bác sĩ cùng khung giờ không? Nếu KHÔNG → thêm kiểm tra trùng lịch y tá khi reassign. Nếu CÓ (y tá chạy 2 phòng) → bỏ kiểm tra.
2. **C3:** ngưỡng "X phút" cảnh báo đến muộn = bao nhiêu? (đề xuất 15 phút)
3. **F4:** khi quá tải → **chặn cứng** không cho check-in, hay chỉ **cảnh báo** cho lễ tân tự quyết? (đề xuất: cảnh báo, lễ tân quyết)
