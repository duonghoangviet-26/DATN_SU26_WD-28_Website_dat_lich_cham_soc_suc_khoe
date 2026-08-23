import mongoose from 'mongoose'
import {
  DichVu, DonThuoc, HangDoi, HoaDon, KetQuaKham, LichHen, NhatKyThaoTac, SinhHieuKham, ThanhToan, TrangThaiPhongKham,
} from '../models/index.js'
import { soSanhThuTuHangDoi } from '../models/HangDoi.js'
// `room-status.controller.js` chỉ import models + utils/response → KHÔNG có vòng import
// ngược về service này (đã kiểm: không file nào trong nhánh đó nạp examSession.service).
import { findOrCreateRoomStatus } from '../controllers/doctor/room-status.controller.js'
import { emitDashboardAppointmentChanged } from '../realtime/socket.js'
import { startOfDayUtc } from '../utils/clinicTime.js'
import {
  CAC_BUOC,
  buocKeTiep,
  duocPhepVaoBuoc,
  kiemTraBuocChanDoan,
  kiemTraBuocTiepNhan,
  kiemTraKetCuc,
  tinhBMI,
} from './examStepRules.js'
import { kiemTraDiUngThuoc } from './drugAllergyCheck.service.js'

// ============================================================
// WS-1 — Phiên khám 4 bước. NGUỒN GHI DUY NHẤT cho hồ sơ khám.
// ============================================================
// `appointments.controller.js` (createResult / createResultByQueue / updateResult) nay gọi
// vào đây thay vì tự ghi. Có hai đường ghi song song vào cùng `KetQuaKham` là cách chắc
// chắn nhất để hai luồng lệch nhau — đúng thứ rule mục 7 cấm.

function loi(statusCode, message, data = null) {
  return Object.assign(new Error(message), { statusCode, httpStatus: statusCode, data })
}

const TU_KHOA_DICH_VU_CAN_ANH = ['noi soi', 'x quang', 'x-quang', 'sieu am', 'mri', 'ct']

function chuanHoaChuoiTimKiem(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function dichVuCanAnhKetQua(service) {
  const haystack = chuanHoaChuoiTimKiem(`${service?.ten ?? ''} ${service?.ma_dich_vu ?? ''}`)
  return TU_KHOA_DICH_VU_CAN_ANH.some((keyword) => haystack.includes(keyword))
}

function chuanHoaAnhDichVu(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      url: String(item?.url ?? '').trim(),
      mo_ta: String(item?.mo_ta ?? '').trim() || null,
      uploaded_at: item?.uploaded_at ? new Date(item.uploaded_at) : new Date(),
    }))
    .filter((item) => item.url.length > 0 && item.url.length <= 1000)
}

// ─── Helper dùng chung (chuyển từ appointments.controller.js) ────────────────
// PASTE NGUYÊN VĂN thân 3 hàm dưới đây từ appointments.controller.js, chỉ thêm `export`:

// Upsert sinh hiệu — gắn theo appointment_id (lượt online) hoặc hang_doi_id (lượt offline,
// không có LichHen). Bác sĩ tự đo/nhập ngay khi nhập kết quả khám.
export async function upsertVitals({ appointmentId, hangDoiId, memberId, doctorUserId, sinhHieu }) {
  if (!sinhHieu) return
  const { can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim } = sinhHieu
  // Lượt online đi qua phiên khám 4 bước mang CẢ HAI khóa. `SinhHieuKham` có sparse-unique
  // trên từng khóa, nên lọc theo đúng một khóa rồi upsert có thể đẻ ra bản ghi thứ hai đụng
  // khóa còn lại (E11000). Tra theo cả hai trước, có thì cập nhật theo `_id`.
  let filter = appointmentId ? { appointment_id: appointmentId } : { hang_doi_id: hangDoiId }
  if (appointmentId && hangDoiId) {
    const daCo = await SinhHieuKham.findOne({
      $or: [{ appointment_id: appointmentId }, { hang_doi_id: hangDoiId }],
    }).select('_id').lean()
    if (daCo) filter = { _id: daCo._id }
  }
  const setFields = {
    member_id: memberId ?? null,
    can_nang,
    chieu_cao,
    huyet_ap,
    nhiet_do,
    nhip_tim,
    nguoi_do_id: doctorUserId,
    thoi_diem_do: new Date(),
  }
  if (appointmentId) setFields.appointment_id = appointmentId
  if (hangDoiId) setFields.hang_doi_id = hangDoiId
  await SinhHieuKham.findOneAndUpdate(filter, { $set: setFields }, { upsert: true })
}

export async function taoChiDinhDichVu(value, specialtyId, doctorId) {
  if (!Array.isArray(value)) {
    return { ok: false, status: 400, message: 'Danh sách dịch vụ phát sinh không hợp lệ' }
  }

  const requested = value.map((item) => ({
    service_id: item?.service_id,
    so_luong: Number(item?.so_luong ?? 1),
    hinh_anh: chuanHoaAnhDichVu(item?.hinh_anh),
  }))
  if (requested.length > 20) return { ok: false, status: 400, message: 'Tối đa 20 dịch vụ phát sinh cho một ca khám' }
  if (requested.some((item) => !item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id) || !Number.isInteger(item.so_luong) || item.so_luong < 1)) {
    return { ok: false, status: 400, message: 'Dịch vụ hoặc số lượng chỉ định không hợp lệ' }
  }
  if (requested.some((item) => item.hinh_anh.length > 10)) {
    return { ok: false, status: 400, message: 'Mỗi dịch vụ chỉ được đính kèm tối đa 10 ảnh' }
  }

  const ids = requested.map((item) => String(item.service_id))
  if (new Set(ids).size !== ids.length) return { ok: false, status: 400, message: 'Không được chỉ định trùng cùng một dịch vụ' }

  const services = await DichVu.find({
    _id: { $in: ids },
    status: 'active',
    loai: 'related',
    $or: [{ specialty_id: specialtyId }, { specialty_id: null }],
  }).select('ten gia ma_dich_vu').lean()
  if (services.length !== requested.length) {
    return { ok: false, status: 400, message: 'Có dịch vụ không còn hoạt động hoặc không thuộc chuyên khoa của ca khám' }
  }

  const byId = new Map(services.map((service) => [String(service._id), service]))
  const thieuAnh = requested
    .map((item) => ({ item, service: byId.get(String(item.service_id)) }))
    .filter(({ item, service }) => service && dichVuCanAnhKetQua(service) && item.hinh_anh.length === 0)
  if (thieuAnh.length > 0) {
    const names = thieuAnh.map(({ service }) => service.ten).join(', ')
    return { ok: false, status: 400, message: `Cần đính kèm ảnh kết quả cho dịch vụ: ${names}` }
  }

  return {
    ok: true,
    lines: requested.map((item) => {
      const service = byId.get(String(item.service_id))
      return {
        service_id: service._id,
        ten: service.ten,
        so_luong: item.so_luong,
        don_gia: service.gia,
        thanh_tien: service.gia * item.so_luong,
        chi_dinh_boi_bac_si_id: doctorId,
        hinh_anh: item.hinh_anh,
      }
    }),
  }
}

// Lõi dùng chung cho hai biến thể dưới. `chiOffline` quyết định có ép `nguon='offline'` hay không.
async function timLuotKhamCuaBacSi(queueId, docId, { chiOffline }) {
  if (!mongoose.Types.ObjectId.isValid(queueId)) {
    throw Object.assign(new Error('Mã lượt khám không hợp lệ'), { httpStatus: 400 })
  }
  const filter = { _id: queueId, doctor_id: docId }
  if (chiOffline) filter.nguon = 'offline'
  const entry = await HangDoi.findOne(filter).lean()
  if (!entry) {
    const msg = chiOffline ? 'Không tìm thấy lượt khám offline' : 'Không tìm thấy lượt khám'
    throw Object.assign(new Error(msg), { httpStatus: 404 })
  }
  if (!['trong_phong', 'hoan_thanh', 'cho_dich_vu'].includes(entry.trang_thai)) {
    throw Object.assign(new Error('Chỉ nhập kết quả khi bệnh nhân đang khám hoặc đã kết thúc khám'), { httpStatus: 409 })
  }
  return entry
}

/**
 * Lượt khám VÃNG LAI của bác sĩ — chỉ `nguon='offline'`.
 *
 * GIỮ NGUYÊN hành vi cho các endpoint form phẳng cũ trong `appointments.controller.js`
 * (`listRelatedServices?queue_id=`, `getResultByQueue`, `createResultByQueue`). Ba endpoint
 * đó ghi/đọc `KetQuaKham` theo `hang_doi_id`; lượt ONLINE ở luồng cũ đi đường riêng theo
 * `appointment_id` (`createResult`/`updateResult`/`getResult`), nên nếu bỏ chặn ở đây thì
 * một lịch hẹn online có thể có HAI hồ sơ song song (một theo appointment_id, một theo
 * hang_doi_id) — đúng thứ mà index sparse-unique kép của `KetQuaKham` cố tránh.
 */
export async function getOwnedOfflineQueue(queueId, docId) {
  return timLuotKhamCuaBacSi(queueId, docId, { chiOffline: true })
}

/**
 * Lượt khám của bác sĩ cho PHIÊN KHÁM 4 BƯỚC — nhận cả `online` lẫn `offline`.
 *
 * Luồng 4 bước là đường ghi hồ sơ DUY NHẤT của trang khám mới: trang hàng đợi đẩy MỌI bệnh
 * nhân `trong_phong` vào đây, không phân biệt nguồn. Dùng `getOwnedOfflineQueue` ở đây khiến
 * bệnh nhân đặt online bấm "Vào phòng khám" là 404 vĩnh viễn (nút "Kết thúc khám" cũ đã bị gỡ
 * khỏi UI trong cùng commit, nên họ không còn đường nào hoàn tất ca khám).
 *
 * An toàn vì luồng mới gắn hồ sơ theo CẢ HAI khóa cho lượt online (xem `taoNhapNeuChua`):
 * `appointment_id` + `hang_doi_id`, nên vẫn chỉ có một hồ sơ cho một lịch hẹn.
 */
export async function getOwnedQueueForExam(queueId, docId) {
  return timLuotKhamCuaBacSi(queueId, docId, { chiOffline: false })
}

/**
 * Đọc toàn bộ trạng thái một phiên khám: lượt hàng đợi, nháp hồ sơ, sinh hiệu, đơn thuốc,
 * và danh sách dịch vụ chỉ định được của chuyên khoa.
 *
 * Trả một lần đủ dữ liệu cho cả 5 bước: trang khám mở ra là dùng được ngay, không phải
 * gọi 5 API rời rạc rồi ghép — bác sĩ đang có bệnh nhân ngồi trước mặt.
 */
export async function layPhienKham({ queueId, docId }) {
  const entry = await getOwnedQueueForExam(queueId, docId)

  const [hoSo, sinhHieu, dichVuKhaDung, lichHen] = await Promise.all([
    KetQuaKham.findOne({ hang_doi_id: entry._id }).lean(),
    SinhHieuKham.findOne({ hang_doi_id: entry._id }).lean(),
    DichVu.find({ loai: 'related', specialty_id: entry.specialty_id, status: 'active' })
      .select('_id ten gia ma_dich_vu').sort({ ten: 1 }).lean(),
    entry.appointment_id
      ? LichHen.findById(entry.appointment_id).select('ly_do_kham payment_status gia_kham').lean()
      : null,
  ])

  const thuoc = hoSo
    ? (await DonThuoc.findOne({ medical_record_id: hoSo._id }).lean())?.items ?? []
    : []

  // C4 — thông tin thu ngân đi kèm hồ sơ, để màn "Bệnh nhân đã khám" xem đủ mà không cần
  // gọi thêm API riêng. Tra theo hang_doi_id trước (offline chỉ có khóa này), rồi appointment_id.
  const hoaDon = await HoaDon.findOne({
    $or: [{ hang_doi_id: entry._id }, ...(entry.appointment_id ? [{ appointment_id: entry.appointment_id }] : [])],
  }).select('tong_tien_kham tong_tien_phat_sinh tong_thanh_toan trang_thai_hoa_don chi_tiet_thu_phi da_xac_nhan_thu_ngan').lean()
  const thanhToan = hoaDon
    ? await ThanhToan.find({
        $or: [
          { hoa_don_id: hoaDon._id },
          ...(entry.appointment_id ? [{ appointment_id: entry.appointment_id }] : []),
          { hang_doi_id: entry._id },
        ],
        status: 'paid',
      }).select('so_tien loai_thanh_toan phuong_thuc ngay_thanh_toan thoi_diem_thanh_toan').lean()
    : []
  const tongDaThu = thanhToan.reduce((sum, payment) => sum + (Number(payment.so_tien) || 0), 0)
  const tongPhaiThu = hoaDon?.tong_thanh_toan ?? (lichHen?.gia_kham ?? 0)
  const conThieu = Math.max(0, tongPhaiThu - tongDaThu)

  return {
    queue: {
      id: String(entry._id),
      ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id ? String(entry.ho_so_benh_nhan_id) : null,
      ten_benh_nhan: entry.ten_benh_nhan,
      so_dien_thoai: entry.so_dien_thoai ?? null,
      tuoi: entry.tuoi ?? null,
      ngay_sinh: entry.ngay_sinh ?? null,
      gioi_tinh: entry.gioi_tinh ?? null,
      nhom_mau: entry.nhom_mau ?? null,
      di_ung: entry.di_ung ?? null,
      benh_nen: entry.benh_nen ?? null,
      ghi_chu: entry.ghi_chu ?? null,
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      nguon: entry.nguon,
      trang_thai: entry.trang_thai,
      phong_kham: entry.phong_kham ?? null,
      appointment_id: entry.appointment_id ? String(entry.appointment_id) : null,
      ly_do_kham: lichHen?.ly_do_kham ?? null,
    },
    ho_so: hoSo
      ? {
          id: String(hoSo._id),
          status: hoSo.status,
          trieu_chung_ban_dau: hoSo.trieu_chung_ban_dau ?? null,
          chan_doan: hoSo.chan_doan ?? null,
          huong_dan_dieu_tri: hoSo.huong_dan_dieu_tri ?? null,
          ghi_chu: hoSo.ghi_chu ?? null,
          ngay_tai_kham: hoSo.ngay_tai_kham ?? null,
          dich_vu_phat_sinh: hoSo.dich_vu_phat_sinh ?? [],
          ket_cuc: hoSo.ket_cuc ?? 'dieu_tri_thuong',
          chuyen_vien_thong_tin: hoSo.chuyen_vien_thong_tin ?? null,
          // C4 — lịch sử chỉnh sửa/đính chính, để màn "Bệnh nhân đã khám" biết ai đã sửa gì.
          lich_su_sua: (hoSo.lich_su_sua ?? []).map((h) => ({
            thoi_diem_sua: h.thoi_diem_sua,
            noi_dung: h.noi_dung,
            la_dinh_chinh: h.la_dinh_chinh ?? false,
          })),
        }
      : null,
    sinh_hieu: sinhHieu
      ? {
          can_nang: sinhHieu.can_nang, chieu_cao: sinhHieu.chieu_cao,
          huyet_ap: sinhHieu.huyet_ap, nhiet_do: sinhHieu.nhiet_do, nhip_tim: sinhHieu.nhip_tim,
        }
      : null,
    buoc_hien_tai: hoSo?.buoc_hien_tai ?? 'tiep_nhan',
    bmi: tinhBMI(sinhHieu?.can_nang ?? null, sinhHieu?.chieu_cao ?? null),
    thuoc,
    hoa_don: hoaDon
      ? {
          tong_tien_kham: hoaDon.tong_tien_kham,
          tong_tien_phat_sinh: hoaDon.tong_tien_phat_sinh,
          tong_thanh_toan: hoaDon.tong_thanh_toan,
          trang_thai_hoa_don: hoaDon.trang_thai_hoa_don,
          chi_tiet_thu_phi: hoaDon.chi_tiet_thu_phi ?? [],
          da_xac_nhan_thu_ngan: hoaDon.da_xac_nhan_thu_ngan ?? false,
          tong_da_thu: tongDaThu,
          con_thieu: conThieu,
          thanh_toan: thanhToan.map((payment) => ({
            so_tien: payment.so_tien,
            loai_thanh_toan: payment.loai_thanh_toan,
            phuong_thuc: payment.phuong_thuc,
            thoi_diem: payment.ngay_thanh_toan ?? payment.thoi_diem_thanh_toan ?? null,
          })),
        }
      : {
          tong_tien_kham: lichHen?.gia_kham ?? 0,
          tong_tien_phat_sinh: 0,
          tong_thanh_toan: lichHen?.gia_kham ?? 0,
          trang_thai_hoa_don: lichHen?.payment_status === 'paid' ? 'da_thanh_toan_du' : 'chua_thanh_toan',
          chi_tiet_thu_phi: [],
          da_xac_nhan_thu_ngan: false,
          tong_da_thu: lichHen?.payment_status === 'paid' ? (lichHen?.gia_kham ?? 0) : 0,
          con_thieu: lichHen?.payment_status === 'paid' ? 0 : (lichHen?.gia_kham ?? 0),
          thanh_toan: [],
        },
    dich_vu_kha_dung: dichVuKhaDung.map((d) => ({
      service_id: String(d._id), ten: d.ten, gia: d.gia, ma_dich_vu: d.ma_dich_vu ?? null,
    })),
  }
}

/** Bảo đảm có bản ghi nháp để gắn dữ liệu bước 1. */
async function taoNhapNeuChua(entry, doctorUserId, docId) {
  const daCo = await KetQuaKham.findOne({ hang_doi_id: entry._id })
  if (daCo) return daCo

  // Lượt ONLINE: hồ sơ phải mang CẢ `appointment_id`. Thiếu nó thì bệnh nhân không xem được
  // kết quả (patient/records tra theo `appointment_id`) và lễ tân không lập được hóa đơn dịch
  // vụ phát sinh (billing.controller tra `{ appointment_id, status:'da_xac_nhan' }` cho ca
  // online). Schema đã tính sẵn: "online mang cả hai, offline chỉ hang_doi_id".
  if (entry.appointment_id) {
    const hoSoTheoLichHen = await KetQuaKham.findOne({ appointment_id: entry.appointment_id }).select('_id').lean()
    // Đã có hồ sơ nhập bằng form phẳng cũ → tạo thêm sẽ đụng sparse-unique `appointment_id`
    // và trả lỗi Mongo thô. Chặn sớm với thông báo đọc được.
    if (hoSoTheoLichHen) {
      throw loi(409, 'Lịch hẹn này đã có hồ sơ khám nhập bằng luồng cũ, không mở phiên khám mới được')
    }
  }

  return KetQuaKham.create({
    hang_doi_id: entry._id,
    // KHÔNG set null: index sparse-unique bỏ qua field VẮNG MẶT, nhưng vẫn đánh chỉ mục
    // giá trị null → nhiều hồ sơ offline cùng null sẽ đụng nhau.
    ...(entry.appointment_id ? { appointment_id: entry.appointment_id } : {}),
    ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id ?? null,
    nguoi_nhap_id: doctorUserId,
    bac_si_phu_trach_id: docId,
    status: 'ban_nhap',
    buoc_hien_tai: 'tiep_nhan',
    // `chan_doan` là required ở schema nhưng bước 1 chưa có. Đặt chỗ giữ, bước 2 ghi đè.
    // Không đặt sẽ ném ValidationError ngay lúc bấm "Tiếp tục" ở bước 1.
    chan_doan: '(đang khám)',
  })
}

/**
 * Lưu nháp một bước rồi đẩy con trỏ sang bước kế tiếp.
 *
 * Không có nút "Lưu" thủ công trên UI — mỗi lần bấm "Tiếp tục" là một lần gọi hàm này.
 * Bác sĩ đóng tab giữa chừng vẫn mở lại đúng chỗ đang dở.
 */
export async function luuBuoc({ queueId, docId, doctorUserId, buoc, payload = {} }) {
  if (!CAC_BUOC.includes(buoc) || buoc === 'hoan_tat') {
    throw loi(400, `Bước không hợp lệ: ${buoc}`)
  }

  const entry = await getOwnedQueueForExam(queueId, docId)
  if (entry.trang_thai !== 'trong_phong') {
    throw loi(409, 'Chỉ nhập hồ sơ khi bệnh nhân đang trong phòng')
  }

  const hoSo = await taoNhapNeuChua(entry, doctorUserId, docId)
  if (hoSo.status === 'da_xac_nhan' && hoSo.co_the_sua === false) {
    throw loi(409, 'Hồ sơ đã khóa, không sửa được')
  }
  if (!duocPhepVaoBuoc(buoc, hoSo.buoc_hien_tai ?? 'tiep_nhan')) {
    throw loi(409, 'Không được bỏ qua bước trước đó')
  }

  const capNhat = {}

  if (buoc === 'tiep_nhan') {
    const kq = kiemTraBuocTiepNhan(payload)
    if (!kq.ok) throw loi(400, kq.loi.join('; '))

    capNhat.trieu_chung_ban_dau = String(payload.trieu_chung_ban_dau).trim()
    await upsertVitals({
      hangDoiId: entry._id,
      // Lượt online: gắn thêm `appointment_id` cho nhất quán với hồ sơ khám ở trên.
      appointmentId: entry.appointment_id ?? null,
      memberId: entry.member_id ?? null,
      doctorUserId,
      sinhHieu: {
        can_nang:  payload.can_nang  ?? null,
        chieu_cao: payload.chieu_cao ?? null,
        huyet_ap:  payload.huyet_ap  ?? null,
        nhiet_do:  payload.nhiet_do  ?? null,
        nhip_tim:  payload.nhip_tim  ?? null,
      },
    })
  }

  if (buoc === 'chan_doan') {
    const kq = kiemTraBuocChanDoan(payload)
    if (!kq.ok) throw loi(400, kq.loi.join('; '))
    const ketCucKq = kiemTraKetCuc(payload)
    if (!ketCucKq.ok) throw loi(400, ketCucKq.loi.join('; '))

    capNhat.chan_doan = String(payload.chan_doan).trim()
    capNhat.huong_dan_dieu_tri = payload.huong_dan_dieu_tri?.trim() || null
    capNhat.ghi_chu = payload.ghi_chu?.trim() || null
    capNhat.ngay_tai_kham = payload.ngay_tai_kham ? new Date(payload.ngay_tai_kham) : null
    capNhat.chi_dinh_tai_kham = Boolean(payload.ngay_tai_kham)
    // D78/D80 — luôn ghi đè cả hai field cùng lúc: nếu bác sĩ sửa lại từ 'chuyen_vien' về
    // 'dieu_tri_thuong', thong_tin_chuyen cũ (null từ kiemTraKetCuc) phải xóa theo, không để
    // sót thông tin chuyển viện của một quyết định đã bị đổi ý.
    capNhat.ket_cuc = ketCucKq.ketCuc
    capNhat.chuyen_vien_thong_tin = ketCucKq.thongTinChuyen
  }

  if (buoc === 'dich_vu') {
    // Quyết định Q1: bệnh nhân LUÔN ở trong phòng — không đổi trạng thái hàng đợi.
    // Quyết định Q2: bác sĩ chỉ ghi chỉ định, KHÔNG thu tiền.
    const chiDinh = await taoChiDinhDichVu(payload.dich_vu_phat_sinh ?? [], entry.specialty_id, docId)
    if (!chiDinh.ok) throw loi(chiDinh.status ?? 400, chiDinh.message)
    capNhat.dich_vu_phat_sinh = chiDinh.lines
  }

  if (buoc === 'ke_don') {
    const items = Array.isArray(payload.thuoc) ? payload.thuoc : []

    // B47 — cảnh báo dị ứng: so khớp CHUỖI mềm (không có danh mục hoạt chất trong hệ thống,
    // xem docs/Hoi-dong/F-*.md mục 2.1). Phát hiện trùng mà bác sĩ chưa xác nhận bất chấp thì
    // chặn lưu; xác nhận rồi thì bắt buộc kèm lý do và ghi audit riêng để đối chiếu sau này.
    const canhBaoDiUng = kiemTraDiUngThuoc({ diUng: entry.di_ung, thuoc: items })
    const xacNhanBatChap = payload.xac_nhan_bat_chap_di_ung === true
    if (canhBaoDiUng.length > 0 && !xacNhanBatChap) {
      throw loi(
        409,
        'Phát hiện thuốc trùng khả nghi với dị ứng đã ghi nhận — cần bác sĩ xác nhận trước khi lưu',
        { canh_bao_di_ung: canhBaoDiUng },
      )
    }
    let lyDoBatChapDiUng = null
    if (canhBaoDiUng.length > 0 && xacNhanBatChap) {
      lyDoBatChapDiUng = String(payload.ly_do_bat_chap_di_ung ?? '').trim()
      if (!lyDoBatChapDiUng) throw loi(400, 'Cần nhập lý do khi kê thuốc bất chấp cảnh báo dị ứng')
    }

    await DonThuoc.deleteMany({ medical_record_id: hoSo._id })
    if (items.length) {
      await DonThuoc.create({
        ket_qua_kham_id: hoSo._id,
        medical_record_id: hoSo._id,
        member_id: entry.member_id ?? null,
        ten_khach: entry.ten_benh_nhan,
        doctor_id: docId,
        nguon: 'bac_si',
        items,
      })
    }
    if (lyDoBatChapDiUng) {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: doctorUserId,
        vai_tro: 'doctor',
        hanh_dong: 'KE_THUOC_BAT_CHAP_CANH_BAO_DI_UNG',
        loai_doi_tuong: 'examination_result',
        doi_tuong_id: hoSo._id,
        ly_do: lyDoBatChapDiUng,
        du_lieu_moi: { canh_bao_di_ung: canhBaoDiUng },
      })
    }
  }

  // Con trỏ chỉ TIẾN, không lùi: bác sĩ quay lại sửa bước 1 khi đang ở bước 4 thì
  // vẫn ở bước 4, không bị đẩy ngược về bước 2.
  const buocSau = buocKeTiep(buoc)
  const hienTai = hoSo.buoc_hien_tai ?? 'tiep_nhan'
  if (CAC_BUOC.indexOf(buocSau) > CAC_BUOC.indexOf(hienTai)) {
    capNhat.buoc_hien_tai = buocSau
  }

  await KetQuaKham.updateOne({ _id: hoSo._id }, { $set: capNhat })
  return layPhienKham({ queueId, docId })
}

/**
 * Bệnh nhân kế tiếp trong hàng đợi của bác sĩ, theo đúng thứ tự ưu tiên ĐỘNG (rule mục 6).
 *
 * Trả kèm khi hoàn tất ca để bác sĩ bấm "Gọi" ngay tại chỗ. Không có nó, bác sĩ phải quay
 * về trang hàng đợi sau mỗi ca — thao tác thừa lặp lại 30 lần một ngày.
 */
async function timBenhNhanKeTiep(docId, now = new Date()) {
  const ngayHienTai = startOfDayUtc(now)
  const ngayKeTiep = new Date(ngayHienTai)
  ngayKeTiep.setUTCDate(ngayKeTiep.getUTCDate() + 1)

  const dangCho = await HangDoi.find({
    doctor_id: docId,
    trang_thai: { $in: ['dang_cho', 'da_goi'] },
    checkin_time: { $gte: ngayHienTai, $lt: ngayKeTiep },
  }).lean()
  if (dangCho.length === 0) return null

  const [ke] = [...dangCho].sort((a, b) => soSanhThuTuHangDoi(a, b, now))
  return {
    queue_id: String(ke._id),
    ten_benh_nhan: ke.ten_benh_nhan,
    ma_so_thu_tu: ke.ma_so_thu_tu ?? null,
    nguon: ke.nguon,
    trang_thai: ke.trang_thai,
  }
}

/**
 * Chốt ca khám: hồ sơ → `da_xac_nhan`, lượt → `hoan_thanh`, lịch hẹn → `completed`.
 *
 * Ba bản ghi này phải cùng đúng hoặc cùng sai. Chốt hồ sơ mà lượt còn `trong_phong` sẽ
 * khóa phòng vĩnh viễn; chốt lượt mà lịch hẹn còn `checked_in` sẽ khiến cron `no_show`
 * cuối ca hiểu nhầm — nên gói trong MỘT transaction.
 */
export async function hoanTatPhienKham({ queueId, docId, doctorUserId, now = new Date() }) {
  const entry = await getOwnedQueueForExam(queueId, docId)
  const hoSo = await KetQuaKham.findOne({ hang_doi_id: entry._id })
  if (!hoSo) throw loi(409, 'Chưa có hồ sơ khám cho lượt này')

  // Phát hiện qua e2e Task 7 (check 10): thiếu chặn này thì gọi complete lần 2 vẫn trả 200,
  // ghi đè lại đúng những field vừa chốt — vô hại về dữ liệu nhưng im lặng, dễ che giấu bug
  // ở FE (double-submit) và làm sai lệch `benh_nhan_ke_tiep` trả về lần 2 nếu hàng đợi đã đổi.
  if (hoSo.status === 'da_xac_nhan') {
    throw loi(409, 'Ca khám này đã được hoàn tất trước đó')
  }

  // Không cho chốt khi chưa đi qua chẩn đoán — đúng lỗi hội đồng nêu.
  if (!hoSo.chan_doan || hoSo.chan_doan === '(đang khám)') {
    throw loi(400, 'Chưa nhập chẩn đoán, không chốt được ca khám')
  }
  if (!hoSo.trieu_chung_ban_dau) {
    throw loi(400, 'Chưa ghi triệu chứng ở bước tiếp nhận')
  }

  const coDichVu = Array.isArray(hoSo.dich_vu_phat_sinh) && hoSo.dich_vu_phat_sinh.length > 0
  const tongTienDichVu = coDichVu
    ? hoSo.dich_vu_phat_sinh.reduce((s, d) => s + (d.thanh_tien ?? 0), 0)
    : 0

  // ── Nhả phòng khám ──────────────────────────────────────────────────────────────────────
  // Lấy bản ghi phòng NGOÀI transaction (findOrCreateRoomStatus có thể phải `create`, không
  // nhận session) rồi mới đổi + save {session} bên trong — đúng thứ tự `finish()` cũ đã dùng.
  // Đặt SAU mọi guard ở trên, đặc biệt là chặn hoàn tất lần 2: gọi complete lần 2 phải 409
  // trước khi chạm tới phòng, nếu không sẽ nhả oan phòng đang phục vụ bệnh nhân kế tiếp.
  const room = await findOrCreateRoomStatus(entry.doctor_id)
  const tuRoom = room?.trang_thai ?? null
  // Chỉ nhả khi phòng THẬT SỰ đang giữ đúng bệnh nhân này. Khác `finish()` cũ (trả 409 rồi
  // dừng): ở đây hồ sơ khám đã nhập xong, chặn lại sẽ khóa bác sĩ vĩnh viễn trong khi trạng
  // thái phòng lệch chỉ là chuyện bên lề — nên bỏ qua bước nhả phòng chứ không hủy cả ca.
  const nhaPhong = !!room && String(room.benh_nhan_hien_tai_id) === String(entry._id)
  const tbTruoc = room?.thoi_gian_kham_tb_phut ?? 0

  let apptOldStatus = null
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await KetQuaKham.updateOne(
        { _id: hoSo._id },
        {
          $set: {
            status: 'da_xac_nhan',
            buoc_hien_tai: 'hoan_tat',
            nguoi_xac_nhan_id: doctorUserId,
            thoi_diem_xac_nhan: now,
            // Khóa hồ sơ ngay khi chốt ca — trước đây co_the_sua chưa từng bị đặt false ở
            // đường ghi thật nào, nên guard ở luuBuoc (dòng ~269) là code chết. Sửa sau xác
            // nhận phải đi qua endpoint đính chính (xem amendment), không sửa đè trực tiếp.
            co_the_sua: false,
          },
          $push: {
            lich_su_sua: {
              nguoi_sua_id: doctorUserId,
              thoi_diem_sua: now,
              noi_dung: 'Bác sĩ hoàn tất phiên khám 4 bước',
            },
          },
        },
        { session },
      )

      await HangDoi.updateOne(
        { _id: entry._id },
        { $set: { trang_thai: 'hoan_thanh', thoi_diem_ket_thuc: now } },
        { session },
      )

      // Nhả phòng: trạng thái `dang_don_phong` + xóa bệnh nhân hiện tại, y như `finish()` cũ.
      // Thiếu đoạn này thì phòng kẹt `dang_kham` và bệnh nhân kế tiếp không vào phòng được
      // ("Phòng chưa sẵn sàng" 409) — bác sĩ hết đường khám tiếp trong ngày.
      if (nhaPhong) {
        const datPhong = {
          trang_thai: 'san_sang',
          benh_nhan_hien_tai_id: null,
          thoi_diem_doi: now,
        }
        if (entry.thoi_diem_vao_phong) {
          const phutThucTe = Math.max(1, Math.round((now - entry.thoi_diem_vao_phong) / 60000))
          // Tính từ `tbTruoc` chụp một lần ngoài transaction. `withTransaction` có thể chạy
          // lại callback; đọc `room.thoi_gian_kham_tb_phut` sau khi chính lần trước đã sửa sẽ
          // làm trung bình trượt lệch dần.
          datPhong.thoi_gian_kham_tb_phut = Math.round(0.7 * tbTruoc + 0.3 * phutThucTe)
        }
        // updateOne chứ không `.save()`: giống hai bản ghi trên, và chạy lại được nguyên vẹn
        // nếu transaction retry (document mongoose đã save một lần sẽ hết `modifiedPaths`).
        // Điều kiện `benh_nhan_hien_tai_id` lặp lại guard ở trên ngay tại thời điểm ghi.
        await TrangThaiPhongKham.updateOne(
          { _id: room._id, benh_nhan_hien_tai_id: entry._id },
          { $set: datPhong },
          { session },
        )
      }

      // ⚠️ findOneAndUpdate chứ KHÔNG phải .save(): `LichHen.pre('validate')` kiểm cả những
      // field ca khám không hề chạm, và với bản ghi cũ thiếu field nào đó sẽ ném lỗi vô nghĩa
      // — cùng cái bẫy đã ghi ở `doiTrangThaiLichHen` trong queue.controller.js.
      // `new: false` để lấy trạng thái CŨ, phục vụ emit realtime sau khi commit.
      if (entry.appointment_id) {
        const truoc = await LichHen.findOneAndUpdate(
          { _id: entry.appointment_id },
          { $set: { status: 'completed' } },
          { new: false, session },
        ).select('status').lean()
        apptOldStatus = truoc?.status ?? null
      }
    })
  } finally {
    await session.endSession()
  }

  // Sau commit mới báo realtime (ngoài transaction để tránh emit lặp nếu withTransaction retry).
  // `emitDashboardAppointmentChanged` tự bỏ qua khi trạng thái cũ = mới, nên lượt offline
  // (không có appointment_id → apptOldStatus = null) và lịch vốn đã 'completed' đều không emit.
  if (apptOldStatus) emitDashboardAppointmentChanged(apptOldStatus, 'completed')

  // Ghi nhật ký NGOÀI transaction, nuốt lỗi: cùng nguyên tắc "audit không được làm hỏng
  // nghiệp vụ" đã áp dụng ở `ghiNhatKyLeTan` (WS-4). Ba bản ghi nghiệp vụ đã chốt xong ở
  // trên — audit thất bại không được phép kéo cả việc hoàn tất ca khám thất bại theo.
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: doctorUserId,
      vai_tro: 'doctor',
      hanh_dong: 'DOCTOR_COMPLETE_EXAM',
      loai_doi_tuong: 'examination_result',
      doi_tuong_id: hoSo._id,
    })
  } catch (err) {
    console.error('[examSession] Không ghi được nhật ký DOCTOR_COMPLETE_EXAM:', err.message)
  }

  // Nhật ký đổi trạng thái phòng — cùng hình dạng bản ghi mà `finish()` cũ ghi, để báo cáo
  // trạng thái phòng không bị đứt đoạn khi ca khám đi qua luồng 4 bước thay vì luồng cũ.
  if (nhaPhong) {
    try {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: doctorUserId,
        vai_tro: 'doctor',
        hanh_dong: 'CHANGE_DOCTOR_STATUS',
        loai_doi_tuong: 'room_status',
        doi_tuong_id: entry.doctor_id,
        du_lieu_cu: { trang_thai: tuRoom },
        du_lieu_moi: { trang_thai: 'san_sang' },
      })
    } catch (err) {
      console.error('[examSession] Không ghi được nhật ký CHANGE_DOCTOR_STATUS:', err.message)
    }
  }

  return {
    ho_so_id: String(hoSo._id),
    benh_nhan_ke_tiep: await timBenhNhanKeTiep(docId, now),
    co_dich_vu_can_thu: coDichVu,
    tong_tien_dich_vu: tongTienDichVu,
    ten_benh_nhan: entry.ten_benh_nhan,
  }
}

// ============================================================
// B54/B55 — Đính chính hồ sơ ĐÃ XÁC NHẬN (status='da_xac_nhan').
// ============================================================
// Từ C1, hồ sơ đã xác nhận bị khóa (co_the_sua=false, luuBuoc chặn theo status). Đây là
// đường DUY NHẤT sửa hồ sơ sau khi khóa: KHÔNG sửa đè, chỉ set field mới + push một bản ghi
// có cấu trúc vào lich_su_sua (trường đổi, giá trị cũ/mới, lý do, người sửa, thời điểm) —
// giữ nguyên toàn bộ lịch sử, không xóa dấu vết bản gốc.
const TRUONG_DINH_CHINH_DUOC_PHEP = [
  'chan_doan', 'huong_dan_dieu_tri', 'ghi_chu', 'ngay_tai_kham',
  'ket_cuc', 'chuyen_vien_thong_tin', 'dich_vu_phat_sinh',
]

export async function dinhChinhHoSo({ queueId, docId, doctorUserId, thayDoi = {}, lyDo }) {
  const reason = String(lyDo ?? '').trim()
  if (!reason) throw loi(400, 'Cần nhập lý do khi đính chính hồ sơ')

  const entry = await getOwnedQueueForExam(queueId, docId)
  const hoSo = await KetQuaKham.findOne({ hang_doi_id: entry._id })
  if (!hoSo) throw loi(409, 'Chưa có hồ sơ khám cho lượt này')
  if (hoSo.status !== 'da_xac_nhan') {
    throw loi(409, 'Chỉ đính chính hồ sơ đã xác nhận — hồ sơ chưa xác nhận thì sửa trực tiếp qua các bước')
  }

  const truongGui = Object.keys(thayDoi).filter((t) => TRUONG_DINH_CHINH_DUOC_PHEP.includes(t))
  if (truongGui.length === 0) throw loi(400, 'Không có trường hợp lệ để đính chính')

  const capNhat = {}
  const giaTriCu = {}
  const giaTriMoi = {}

  function ghiNeuDoi(truong, moi) {
    const cu = hoSo[truong] ?? null
    if (JSON.stringify(cu) === JSON.stringify(moi ?? null)) return
    capNhat[truong] = moi
    giaTriCu[truong] = cu
    giaTriMoi[truong] = moi ?? null
  }

  if (truongGui.includes('chan_doan')) {
    const v = String(thayDoi.chan_doan ?? '').trim()
    if (!v) throw loi(400, 'Chẩn đoán không được để trống')
    ghiNeuDoi('chan_doan', v)
  }
  if (truongGui.includes('huong_dan_dieu_tri')) {
    ghiNeuDoi('huong_dan_dieu_tri', String(thayDoi.huong_dan_dieu_tri ?? '').trim() || null)
  }
  if (truongGui.includes('ghi_chu')) {
    ghiNeuDoi('ghi_chu', String(thayDoi.ghi_chu ?? '').trim() || null)
  }
  if (truongGui.includes('ngay_tai_kham')) {
    ghiNeuDoi('ngay_tai_kham', thayDoi.ngay_tai_kham ? new Date(thayDoi.ngay_tai_kham) : null)
  }

  // ket_cuc + chuyen_vien_thong_tin đi CÙNG NHAU qua rule mục 3.4 — đổi cái này mà không đổi
  // cái kia (vd đổi 'chuyen_vien' nhưng không gửi kèm nơi chuyển) vẫn phải bị chặn ở đây,
  // đúng ràng buộc bước 'chan_doan' gốc, không mở ngoại lệ riêng cho luồng đính chính.
  if (truongGui.includes('ket_cuc') || truongGui.includes('chuyen_vien_thong_tin')) {
    const kq = kiemTraKetCuc({
      ket_cuc: thayDoi.ket_cuc ?? hoSo.ket_cuc,
      chuyen_vien_thong_tin: thayDoi.chuyen_vien_thong_tin ?? hoSo.chuyen_vien_thong_tin,
    })
    if (!kq.ok) throw loi(400, kq.loi.join('; '))
    ghiNeuDoi('ket_cuc', kq.ketCuc)
    ghiNeuDoi('chuyen_vien_thong_tin', kq.thongTinChuyen)
  }

  // Đi qua taoChiDinhDichVu như bước 'dich_vu' gốc — không nhận thẳng thanh_tien/gia từ
  // client, tránh đính chính trở thành đường tắt sửa giá tiền không qua kiểm tra.
  if (truongGui.includes('dich_vu_phat_sinh')) {
    const chiDinh = await taoChiDinhDichVu(thayDoi.dich_vu_phat_sinh ?? [], entry.specialty_id, docId)
    if (!chiDinh.ok) throw loi(chiDinh.status ?? 400, chiDinh.message)
    ghiNeuDoi('dich_vu_phat_sinh', chiDinh.lines)
  }

  const truongThayDoi = Object.keys(capNhat)
  if (truongThayDoi.length === 0) throw loi(400, 'Không có thay đổi nào so với hồ sơ hiện tại')

  await KetQuaKham.updateOne(
    { _id: hoSo._id },
    {
      $set: capNhat,
      $push: {
        lich_su_sua: {
          nguoi_sua_id: doctorUserId,
          thoi_diem_sua: new Date(),
          noi_dung: `Đính chính: ${truongThayDoi.join(', ')} — Lý do: ${reason}`,
          la_dinh_chinh: true,
          truong_thay_doi: truongThayDoi,
          gia_tri_cu: giaTriCu,
          gia_tri_moi: giaTriMoi,
        },
      },
    },
  )

  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: doctorUserId,
    vai_tro: 'doctor',
    hanh_dong: 'UPDATE_EXAMINATION_RESULT',
    loai_doi_tuong: 'examination_result',
    doi_tuong_id: hoSo._id,
    ly_do: reason,
    du_lieu_cu: giaTriCu,
    du_lieu_moi: giaTriMoi,
  })

  // Dịch vụ phát sinh đã ảnh hưởng hóa đơn nếu lễ tân đã lập — chỉ MỞ ENUM/ghi nhật ký ở
  // đây, KHÔNG tự động sửa lại hóa đơn (đó là quyết định nghiệp vụ của lễ tân, ngoài phạm
  // vi việc bác sĩ đính chính hồ sơ khám). Best-effort, không chặn việc đính chính đã chốt.
  if (truongThayDoi.includes('dich_vu_phat_sinh')) {
    try {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: doctorUserId,
        vai_tro: 'doctor',
        hanh_dong: 'DINH_CHINH_ANH_HUONG_HOA_DON',
        loai_doi_tuong: 'examination_result',
        doi_tuong_id: hoSo._id,
        ly_do: reason,
        du_lieu_moi: { dich_vu_phat_sinh: giaTriMoi.dich_vu_phat_sinh },
      })
    } catch (err) {
      console.error('[examSession] Không ghi được nhật ký DINH_CHINH_ANH_HUONG_HOA_DON:', err.message)
    }
  }

  return layPhienKham({ queueId, docId })
}
