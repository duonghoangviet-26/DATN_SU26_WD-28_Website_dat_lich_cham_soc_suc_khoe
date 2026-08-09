import mongoose from 'mongoose'
import {
  Counter,
  DichVu,
  HangDoi,
  HoaDon,
  ThanhToan,
} from '../../models/index.js'
import { layGiaKhamChuyenKhoa } from '../../services/doctorAssignment.service.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
import { created, fail, ok } from '../../utils/response.js'

const TRANG_THAI_DUOC_LAP_HOA_DON = ['hoan_thanh', 'cho_dich_vu']

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function ngayHoaDonPart(date) {
  return `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

async function nextInvoiceNumber(date) {
  const part = ngayHoaDonPart(date)
  const seq = await Counter.nextSeq(`so_hoa_don_${part}`)
  return `HD-${part}-${String(seq).padStart(4, '0')}`
}

async function getQueue(queueId) {
  if (!mongoose.Types.ObjectId.isValid(queueId)) throw loi(400, 'Mã hàng đợi không hợp lệ')
  const entry = await HangDoi.findById(queueId).lean()
  if (!entry) throw loi(404, 'Không tìm thấy lượt khám')
  if (!entry.ho_so_benh_nhan_id) throw loi(400, 'Lượt khám chưa được gắn hồ sơ bệnh nhân')
  if (!TRANG_THAI_DUOC_LAP_HOA_DON.includes(entry.trang_thai)) {
    throw loi(409, 'Chỉ lập hóa đơn sau khi lượt khám đã kết thúc hoặc chờ dịch vụ')
  }
  return entry
}

function serialize(invoice, paid = 0) {
  return {
    id: invoice._id,
    hang_doi_id: invoice.hang_doi_id,
    ho_so_benh_nhan_id: invoice.ho_so_benh_nhan_id,
    so_hoa_don: invoice.so_hoa_don,
    tong_tien_kham: invoice.tong_tien_kham,
    chi_tiet_thu_phi: invoice.chi_tiet_thu_phi.map((line) => ({
      ...line,
      service_id: line.service_id ?? null,
    })),
    tong_tien_phat_sinh: invoice.tong_tien_phat_sinh,
    tong_thanh_toan: invoice.tong_thanh_toan,
    tong_da_thu: paid,
    con_phai_thu: Math.max(0, invoice.tong_thanh_toan - paid),
    trang_thai_hoa_don: invoice.trang_thai_hoa_don,
  }
}

function serializePayment(payment) {
  if (!payment) return null
  return {
    id: payment._id,
    hoa_don_id: payment.hoa_don_id,
    hang_doi_id: payment.hang_doi_id,
    so_tien: payment.so_tien,
    phuong_thuc: payment.phuong_thuc,
    status: payment.status,
    ma_giao_dich: payment.ma_giao_dich,
    ngay_tao: payment.ngay_tao,
    ngay_thanh_toan: payment.ngay_thanh_toan,
  }
}

async function getPaidTotal(invoiceId) {
  const payments = await ThanhToan.find({ hoa_don_id: invoiceId, status: 'paid' }).select('so_tien').lean()
  return payments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
}

async function getPendingTotal(invoiceId) {
  const payments = await ThanhToan.find({ hoa_don_id: invoiceId, status: 'pending' }).select('so_tien').lean()
  return payments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
}

async function getPendingPayment(invoiceId) {
  return ThanhToan.findOne({ hoa_don_id: invoiceId, status: 'pending' })
    .sort({ ngay_tao: -1 })
    .lean()
}

export async function getOfflineInvoice(req, res) {
  try {
    const entry = await getQueue(req.params.queueId)
    const invoice = await HoaDon.findOne({ hang_doi_id: entry._id }).lean()
    if (!invoice) return ok(res, { invoice: null, hang_doi: entry })
    return ok(res, {
      invoice: serialize(invoice, await getPaidTotal(invoice._id)),
      pending_payment: serializePayment(await getPendingPayment(invoice._id)),
      hang_doi: entry,
    })
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

async function getOfflinePayment(queueId, paymentId) {
  const entry = await getQueue(queueId)
  if (!mongoose.Types.ObjectId.isValid(paymentId)) throw loi(400, 'Ma giao dich khong hop le')

  const payment = await ThanhToan.findOne({
    _id: paymentId,
    hang_doi_id: entry._id,
    hoa_don_id: { $ne: null },
  }).lean()
  if (!payment) throw loi(404, 'Khong tim thay giao dich cua luot kham')
  return { entry, payment }
}

export async function confirmOfflinePayment(req, res) {
  try {
    const { entry, payment: existing } = await getOfflinePayment(req.params.queueId, req.params.paymentId)
    if (existing.phuong_thuc !== 'chuyen_khoan') throw loi(400, 'Chi xac nhan giao dich chuyen khoan offline')
    if (existing.status !== 'pending') throw loi(409, 'Giao dich khong con o trang thai cho xac nhan')

    const now = new Date()
    const payment = await ThanhToan.findOneAndUpdate(
      { _id: existing._id, hang_doi_id: entry._id, status: 'pending' },
      {
        $set: {
          status: 'paid',
          ngay_thanh_toan: now,
          thoi_diem_thanh_toan: now,
          nguoi_thu_id: req.user?._id ?? req.user?.id ?? null,
          gateway_response: {
            ...(existing.gateway_response || {}),
            confirmed_by: 'receptionist',
            confirmed_at: now.toISOString(),
          },
        },
      },
      { new: true },
    ).lean()
    if (!payment) throw loi(409, 'Giao dich da duoc xu ly o tab khac')

    await tinhTrangThaiHoaDon(payment.hoa_don_id)
    const invoice = await HoaDon.findById(payment.hoa_don_id).lean()

    // Ghi nhật ký thao tác lễ tân (WS-4). Biến thực tế trong hàm là `payment` (không phải
    // `thanhToan` như bản mô tả gốc) — dùng đúng tên biến sẵn có.
    await ghiNhatKyLeTan({
      hanhDong: 'LT_XAC_NHAN_THANH_TOAN',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      loaiDoiTuong: 'payment',
      doiTuongId: payment._id,
      duLieuMoi: {
        ten_benh_nhan: entry.ten_benh_nhan,
        so_tien: payment.so_tien,
        hinh_thuc: payment.phuong_thuc ?? 'tien_mat',
        hoa_don_id: String(payment.hoa_don_id ?? ''),
        ma_hoa_don: invoice?.so_hoa_don ?? null,
      },
    })

    return ok(res, {
      payment: serializePayment(payment),
      invoice: serialize(invoice, await getPaidTotal(payment.hoa_don_id)),
    }, 'Da xac nhan giao dich chuyen khoan')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function cancelOfflinePayment(req, res) {
  try {
    const { entry, payment: existing } = await getOfflinePayment(req.params.queueId, req.params.paymentId)
    if (existing.phuong_thuc !== 'chuyen_khoan') throw loi(400, 'Chi huy giao dich chuyen khoan offline')
    if (existing.status !== 'pending') throw loi(409, 'Giao dich khong con o trang thai cho xu ly')

    const now = new Date()
    const payment = await ThanhToan.findOneAndUpdate(
      { _id: existing._id, hang_doi_id: entry._id, status: 'pending' },
      {
        $set: {
          status: 'failed',
          gateway_response: {
            ...(existing.gateway_response || {}),
            cancelled_by: 'receptionist',
            cancelled_at: now.toISOString(),
            cancel_reason: req.body?.ly_do?.trim() || 'Le tan huy giao dich cho xac nhan',
          },
        },
      },
      { new: true },
    ).lean()
    if (!payment) throw loi(409, 'Giao dich da duoc xu ly o tab khac')

    const invoice = await HoaDon.findById(payment.hoa_don_id).lean()
    return ok(res, {
      payment: serializePayment(payment),
      invoice: serialize(invoice, await getPaidTotal(payment.hoa_don_id)),
    }, 'Da huy giao dich chuyen khoan')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function listOfflineQueues(req, res) {
  try {
    const entries = await HangDoi.find({
      nguon: 'offline',
      trang_thai: { $in: TRANG_THAI_DUOC_LAP_HOA_DON },
    }).sort({ checkin_time: -1 }).limit(100).lean()
    const invoiceIds = entries.map((entry) => entry._id)
    const invoices = await HoaDon.find({ hang_doi_id: { $in: invoiceIds } })
      .select('hang_doi_id so_hoa_don tong_thanh_toan tong_da_thu trang_thai_hoa_don')
      .lean()
    const invoiceByQueue = new Map(invoices.map((invoice) => [String(invoice.hang_doi_id), invoice]))
    return ok(res, entries.map((entry) => ({
      id: entry._id,
      ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id,
      ten_benh_nhan: entry.ten_benh_nhan,
      so_dien_thoai: entry.so_dien_thoai,
      trang_thai: entry.trang_thai,
      checkin_time: entry.checkin_time,
      specialty_id: entry.specialty_id,
      invoice: invoiceByQueue.get(String(entry._id)) ?? null,
    })))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function listRelatedServices(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.query.specialty_id)) {
      return fail(res, 400, 'Chuyen khoa khong hop le')
    }
    const services = await DichVu.find({
      status: 'active',
      loai: 'related',
      $or: [{ specialty_id: req.query.specialty_id }, { specialty_id: null }],
    }).select('_id ten gia specialty_id').sort({ ten: 1 }).lean()
    return ok(res, services)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function createOfflineInvoice(req, res) {
  try {
    const entry = await getQueue(req.params.queueId)
    const { gia_kham } = await layGiaKhamChuyenKhoa(entry.specialty_id)
    const requestedServices = Array.isArray(req.body.dich_vu_phat_sinh) ? req.body.dich_vu_phat_sinh : []
    const serviceIds = requestedServices.map((item) => item.service_id).filter((id) => mongoose.Types.ObjectId.isValid(id))
    const services = await DichVu.find({
      _id: { $in: serviceIds },
      status: 'active',
      loai: 'related',
      $or: [{ specialty_id: entry.specialty_id }, { specialty_id: null }],
    }).select('ten gia specialty_id').lean()
    const serviceById = new Map(services.map((service) => [String(service._id), service]))

    const serviceLines = requestedServices.map((item) => {
      const service = serviceById.get(String(item.service_id))
      if (!service) throw loi(400, `Dịch vụ không hợp lệ: ${item.service_id}`)
      const soLuong = Number(item.so_luong ?? 1)
      if (!Number.isInteger(soLuong) || soLuong < 1) throw loi(400, `Số lượng không hợp lệ cho dịch vụ ${service.ten}`)
      return {
        loai: 'dich_vu',
        service_id: service._id,
        ten: service.ten,
        so_tien: service.gia,
        so_luong: soLuong,
        thanh_tien: service.gia * soLuong,
        ghi_chu: item.ghi_chu?.trim() || null,
        created_at: new Date(),
      }
    })

    const current = await HoaDon.findOne({ hang_doi_id: entry._id })
    if (current && req.body.phuong_thuc) {
      const pendingTotal = await getPendingTotal(current._id)
      if (pendingTotal > 0) {
        throw loi(409, 'Hoa don dang co giao dich chuyen khoan cho thanh toan, hay xac nhan hoac huy giao dich truoc khi lap lai')
      }
    }
    const existingServiceIds = new Set(
      (current?.chi_tiet_thu_phi ?? [])
        .filter((line) => line.loai === 'dich_vu' && line.service_id)
        .map((line) => String(line.service_id)),
    )
    const existingServiceLines = (current?.chi_tiet_thu_phi ?? [])
      .filter((line) => line.loai === 'dich_vu')
    const newServiceLines = serviceLines
      .filter((line) => !existingServiceIds.has(String(line.service_id)))
    const allServiceLines = [...existingServiceLines, ...newServiceLines]
    const chiTietThuPhi = [
      { loai: 'phi_kham', ten: 'Phí khám Tai Mũi Họng', so_tien: gia_kham, so_luong: 1, thanh_tien: gia_kham, created_at: new Date() },
      ...allServiceLines,
    ]
    const tongTienPhatSinh = allServiceLines.reduce((sum, line) => sum + line.thanh_tien, 0)
    const tongThanhToan = gia_kham + tongTienPhatSinh
    const invoice = current ?? new HoaDon({
      hang_doi_id: entry._id,
      ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id,
      so_hoa_don: await nextInvoiceNumber(new Date()),
    })
    const paid = current ? await getPaidTotal(current._id) : 0
    if (paid > tongThanhToan) throw loi(409, 'Tổng hóa đơn mới nhỏ hơn số tiền đã thu')

    invoice.ho_so_benh_nhan_id = entry.ho_so_benh_nhan_id
    invoice.specialty_id = entry.specialty_id
    invoice.tong_tien_kham = gia_kham
    invoice.chi_tiet_thu_phi = chiTietThuPhi
    invoice.tong_tien_phat_sinh = tongTienPhatSinh
    invoice.tong_thanh_toan = tongThanhToan
    invoice.trang_thai_hoa_don = paid >= tongThanhToan ? 'da_thanh_toan_du' : paid > 0 ? 'da_dat_coc' : 'chua_thanh_toan'
    await invoice.save()

    let payment = null
    const paymentMethod = req.body.phuong_thuc
    const conPhaiThu = Math.max(0, tongThanhToan - paid)
    if (paymentMethod && conPhaiThu > 0) {
      if (!['tien_mat', 'chuyen_khoan'].includes(paymentMethod)) throw loi(400, 'Phương thức thanh toán không hợp lệ')
      const isPaid = paymentMethod === 'tien_mat'
      payment = await ThanhToan.create({
        hoa_don_id: invoice._id,
        hang_doi_id: entry._id,
        ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id,
        so_tien: conPhaiThu,
        loai_thanh_toan: 'thanh_toan_bo_sung',
        phuong_thuc: paymentMethod,
        status: isPaid ? 'paid' : 'pending',
        ngay_thanh_toan: isPaid ? new Date() : null,
        thoi_diem_thanh_toan: isPaid ? new Date() : null,
        nguoi_thu_id: req.user?._id ?? req.user?.id ?? null,
      })
      if (isPaid) await tinhTrangThaiHoaDon(invoice._id)

      // Thanh toán tiền mặt được chốt NGAY lúc lập hóa đơn (không qua confirmOfflinePayment
      // như chuyển khoản), nên phải ghi nhật ký ở đây — nếu không, nguồn thu tiền mặt (phổ biến
      // nhất ở quầy) sẽ không có dấu vết ai thu. Chỉ ghi khi ĐÃ thu thật (isPaid); giao dịch
      // chuyển khoản `pending` chưa thu, không được ghi LT_XAC_NHAN_THANH_TOAN ở đây.
      if (isPaid) {
        await ghiNhatKyLeTan({
          hanhDong: 'LT_XAC_NHAN_THANH_TOAN',
          actorUserId: req.user.id,
          actorRole: req.user.role,
          loaiDoiTuong: 'payment',
          doiTuongId: payment._id,
          duLieuMoi: {
            ten_benh_nhan: entry.ten_benh_nhan,
            so_tien: payment.so_tien,
            hinh_thuc: paymentMethod,
            hoa_don_id: String(invoice._id),
            ma_hoa_don: invoice.so_hoa_don ?? null,
          },
        })
      }
    }

    await ghiNhatKyLeTan({
      hanhDong: 'LT_LAP_HOA_DON',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      loaiDoiTuong: 'invoice',
      doiTuongId: invoice._id,
      duLieuMoi: {
        ten_benh_nhan: entry.ten_benh_nhan,
        ma_hoa_don: invoice.so_hoa_don ?? null,
        tong_tien: invoice.tong_thanh_toan ?? null,
        so_khoan: Array.isArray(invoice.chi_tiet_thu_phi) ? invoice.chi_tiet_thu_phi.length : 0,
      },
    })

    const freshInvoice = await HoaDon.findById(invoice._id).lean()
    return created(res, {
      invoice: serialize(freshInvoice, await getPaidTotal(invoice._id)),
      payment,
      pending_payment: serializePayment(await getPendingPayment(invoice._id)),
    }, 'Đã lập hóa đơn offline')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
