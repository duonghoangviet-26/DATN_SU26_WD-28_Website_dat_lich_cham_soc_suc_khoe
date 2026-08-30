import { LichHen, KetQuaKham, DonThuoc, BacSi, NguoiDung, LichSuLichHen, KetQuaKhamTai, KetQuaKhamMui, KetQuaKhamHong } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { buildSlotDateTime } from '../../utils/clinicTime.js'
import { withOptionalTransaction } from '../../services/bookingPaymentState.service.js'

// ============================================================
// A3 — Lịch sử khám & Kết quả (Bệnh nhân)
// Routes: /api/patient/records
// ============================================================

function ownedByUser(userId) {
  return {
    $or: [
      { user_id: userId },
      // Hỗ trợ dữ liệu lịch cũ được tạo qua luồng đặt hộ / lễ tân nhưng vẫn
      // thuộc tài khoản này. Không dùng họ tên vì tên có thể thay đổi.
      { nguoi_tao_id: userId },
      { nguoi_dat_ho_id: userId },
    ],
    da_xoa_boi_benh_nhan: { $ne: true },
  }
}

const EDITABLE_APPOINTMENT_STATUSES = ['pending', 'confirmed']

function appointmentError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// ─── GET /api/patient/records?status=&page=&limit= ──────────────────────────
export async function listRecords(req, res) {
  try {
    const { status, page = 1, limit = 100 } = req.query
    const filter = ownedByUser(req.user.id)
    if (status) filter.status = status

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await LichHen.countDocuments(filter)

    const appointments = await LichHen.find(filter)
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    // Lấy tên bác sĩ cho từng lịch hẹn
    const doctorIds = [...new Set(appointments.map((a) => a.doctor_id.toString()))]
    const docList = await BacSi.find({ _id: { $in: doctorIds } })
      .populate('user_id', 'ho_ten anh_dai_dien')
      .select('user_id')
      .lean()
    const docMap = Object.fromEntries(docList.map((d) => [d._id.toString(), d.user_id]))

    // Lấy trạng thái đã có kết quả khám (KetQuaKham) của các lịch hẹn
    const appointmentIds = appointments.map((a) => a._id)
    const examResults = await KetQuaKham.find({ appointment_id: { $in: appointmentIds } })
      .select('appointment_id')
      .lean()
    const completedAppointmentIds = new Set(
      appointments.filter((a) => a.status === 'completed').map((a) => a._id.toString()),
    )
    const resultAppIds = new Set(
      examResults
        .map((r) => r.appointment_id?.toString())
        .filter((id) => id && completedAppointmentIds.has(id)),
    )

    const data = appointments.map((a) => ({
      id:             a._id,
      loai_kham:      a.loai_kham,
      ngay_kham:      a.ngay_kham,
      gio_kham:       a.gio_kham,
      ten_dich_vu:    a.ten_dich_vu,
      phong_kham:     a.phong_kham || 'Phòng 102 - Tầng 1',
      dia_chi_kham:   a.dia_chi_kham,
      status:         a.status,
      payment_status: a.payment_status,
      gia_kham:       a.gia_kham,
      payment_deadline: a.payment_deadline,
      ly_do_huy:      a.ly_do_huy,
      ten_khach:           a.ten_khach           || null,
      so_dien_thoai_khach: a.so_dien_thoai_khach || null,
      nam_sinh_khach:      a.nam_sinh_khach      || null,
      member_id:           a.member_id           || null,
      ho_so_benh_nhan_id:  a.ho_so_benh_nhan_id  || null,
      bac_si: {
        ho_ten:       docMap[a.doctor_id.toString()]?.ho_ten       ?? 'Không rõ',
        anh_dai_dien: docMap[a.doctor_id.toString()]?.anh_dai_dien ?? null,
      },
      da_co_ket_qua:  resultAppIds.has(a._id.toString()),
    }))

    return ok(res, { total, page: Number(page), limit: Number(limit), data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/records/medical-results ───────────────────────────────
export async function listMedicalResults(req, res) {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query
    const filter = { ...ownedByUser(req.user.id), status: 'completed' }

    if (startDate || endDate) {
      filter.ngay_kham = {}
      if (startDate) filter.ngay_kham.$gte = new Date(`${startDate}T00:00:00.000Z`)
      if (endDate) filter.ngay_kham.$lte = new Date(`${endDate}T23:59:59.999Z`)
    }

    // Fetch ALL appointments matching the date and user filter to sort them
    const allSortedAppointments = await LichHen.find(filter)
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .select('_id')
      .lean()
      
    const allAppointmentIds = allSortedAppointments.map((a) => a._id)

    // Fetch ALL exam results for these appointments to know which ones actually have results
    const allExamResults = await KetQuaKham.find({ appointment_id: { $in: allAppointmentIds } })
      .select('appointment_id')
      .lean()
      
    const appointmentsWithResultsIds = new Set(allExamResults.map((r) => r.appointment_id.toString()))

    // Filter appointments to only those with results, maintaining sort order
    const validAppointments = allSortedAppointments.filter((a) => appointmentsWithResultsIds.has(a._id.toString()))
    
    const total = validAppointments.length
    const skip = (Number(page) - 1) * Number(limit)
    
    const paginatedAppIds = validAppointments.slice(skip, skip + Number(limit)).map((a) => a._id)

    if (paginatedAppIds.length === 0) {
      return ok(res, { total, page: Number(page), limit: Number(limit), data: [] })
    }

    // Now fetch full documents for the paginated page
    const appointments = await LichHen.find({ _id: { $in: paginatedAppIds } })
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .lean()

    const appointmentIds = appointments.map((a) => a._id)
    const doctorIds = [...new Set(appointments.map((a) => a.doctor_id.toString()))]

    const [docList, examResults, taiResults, muiResults, hongResults] = await Promise.all([
      BacSi.find({ _id: { $in: doctorIds } })
        .populate('user_id', 'ho_ten anh_dai_dien')
        .select('user_id')
        .lean(),
      KetQuaKham.find({ appointment_id: { $in: appointmentIds } }).lean(),
      KetQuaKhamTai.find({ appointment_id: { $in: appointmentIds } }).lean(),
      KetQuaKhamMui.find({ appointment_id: { $in: appointmentIds } }).lean(),
      KetQuaKhamHong.find({ appointment_id: { $in: appointmentIds } }).lean(),
    ])

    const docMap = Object.fromEntries(docList.map((d) => [d._id.toString(), d.user_id]))
    const examResultMap = Object.fromEntries(examResults.map((r) => [r.appointment_id.toString(), r]))

    const specialtyImageMap = new Map()
    const appendSpecialtyList = (list) => {
      for (const item of list) {
        const key = item.appointment_id?.toString()
        if (!key) continue
        if (!specialtyImageMap.has(key)) specialtyImageMap.set(key, [])
        specialtyImageMap.get(key).push(item)
      }
    }
    appendSpecialtyList(taiResults)
    appendSpecialtyList(muiResults)
    appendSpecialtyList(hongResults)

    const resultIds = examResults.map((r) => r._id)
    const prescriptions = await DonThuoc.find({
      $or: [
        { medical_record_id: { $in: resultIds } },
        { ket_qua_kham_id: { $in: resultIds } }
      ]
    }).lean()

    const prescriptionMap = Object.fromEntries(prescriptions.map((p) => {
      const key = (p.ket_qua_kham_id || p.medical_record_id).toString()
      return [key, p.items]
    }))

    const data = appointments.map((a) => {
      const ketQua = examResultMap[a._id.toString()]
      const thuoc = ketQua ? (prescriptionMap[ketQua._id.toString()] || []) : []
      const specList = specialtyImageMap.get(a._id.toString()) || []
      const hinhAnhNoiSoi = extractEndoscopyImages(ketQua, specList)

      return {
        id: a._id,
        ngay_kham: a.ngay_kham,
        gio_kham: a.gio_kham,
        ten_dich_vu: a.ten_dich_vu,
        phong_kham: a.phong_kham || 'Phòng 102 - Tầng 1',
        dia_chi_kham: a.dia_chi_kham,
        ten_khach: a.ten_khach || null,
        member_id: a.member_id || null,
        ho_so_benh_nhan_id: a.ho_so_benh_nhan_id || null,
        bac_si: {
          ho_ten: docMap[a.doctor_id.toString()]?.ho_ten ?? 'Không rõ',
          anh_dai_dien: docMap[a.doctor_id.toString()]?.anh_dai_dien ?? null,
        },
        ket_qua: ketQua ? {
          id: ketQua._id,
          chan_doan: ketQua.chan_doan,
          huong_dan_dieu_tri: ketQua.huong_dan_dieu_tri,
          ghi_chu: ketQua.ghi_chu,
          ngay_tai_kham: ketQua.ngay_tai_kham,
          ngay_tao: ketQua.ngay_tao,
          thuoc: thuoc,
          hinh_anh_noi_soi: hinhAnhNoiSoi,
        } : null
      }
    })

    return ok(res, { total, page: Number(page), limit: Number(limit), data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

function extractEndoscopyImages(ketQua, specialtyRecords = []) {
  const images = []
  const seenUrls = new Set()

  const addImg = (img) => {
    if (!img) return
    let url = ''
    let mo_ta = null
    let uploaded_at = null

    if (typeof img === 'string') {
      url = img
    } else if (typeof img === 'object') {
      url = img.url || img.hinh_anh || img.image_url || ''
      mo_ta = img.mo_ta || img.description || img.ghi_chu || null
      uploaded_at = img.uploaded_at || img.ngay_tao || null
    }

    if (url && !seenUrls.has(url)) {
      seenUrls.add(url)
      images.push({ url, mo_ta, uploaded_at })
    }
  }

  for (const item of specialtyRecords) {
    for (const img of item?.hinh_anh_noi_soi || []) addImg(img)
  }

  if (ketQua) {
    for (const img of ketQua.hinh_anh_noi_soi || []) addImg(img)
    for (const img of ketQua.hinh_anh_kham || []) addImg(img)
    for (const img of ketQua.hinh_anh || []) addImg(img)

    for (const dv of ketQua.dich_vu_phat_sinh || []) {
      for (const img of dv.hinh_anh_ket_qua || []) addImg(img)
      for (const img of dv.hinh_anh_noi_soi || []) addImg(img)
      for (const img of dv.hinh_anh || []) addImg(img)
    }
  }

  return images
}

// ─── GET /api/patient/records/:id ───────────────────────────────────────────
export async function getRecord(req, res) {
  try {
    const a = await LichHen.findOne({ _id: req.params.id, ...ownedByUser(req.user.id) }).lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const [doc, ketQua, taiResults, muiResults, hongResults] = await Promise.all([
      BacSi.findById(a.doctor_id).populate('user_id', 'ho_ten anh_dai_dien so_dien_thoai').select('user_id').lean(),
      a.status === 'completed' ? KetQuaKham.findOne({ appointment_id: a._id }).lean() : null,
      a.status === 'completed' ? KetQuaKhamTai.find({ appointment_id: a._id }).lean() : [],
      a.status === 'completed' ? KetQuaKhamMui.find({ appointment_id: a._id }).lean() : [],
      a.status === 'completed' ? KetQuaKhamHong.find({ appointment_id: a._id }).lean() : [],
    ])

    let prescription = null
    if (ketQua) {
      prescription = await DonThuoc.findOne({
        $or: [
          { medical_record_id: ketQua._id },
          { ket_qua_kham_id: ketQua._id }
        ]
      }).lean()
    }

    const hinhAnhNoiSoi = extractEndoscopyImages(ketQua, [...taiResults, ...muiResults, ...hongResults])

    return ok(res, {
      id:             a._id,
      loai_kham:      a.loai_kham,
      ngay_kham:      a.ngay_kham,
      gio_kham:       a.gio_kham,
      ten_dich_vu:    a.ten_dich_vu,
      phong_kham:     a.phong_kham || 'Phòng 102 - Tầng 1',
      dia_chi_kham:   a.dia_chi_kham,
      ly_do_kham:     a.ly_do_kham,
      status:         a.status,
      payment_status: a.payment_status,
      gia_kham:       a.gia_kham,
      payment_deadline: a.payment_deadline,
      ly_do_huy:      a.ly_do_huy,
      ten_khach:           a.ten_khach           || null,
      so_dien_thoai_khach: a.so_dien_thoai_khach || null,
      nam_sinh_khach:      a.nam_sinh_khach      || null,
      member_id:           a.member_id           || null,
      ho_so_benh_nhan_id:  a.ho_so_benh_nhan_id  || null,
      bac_si: {
        ho_ten:        doc?.user_id?.ho_ten       ?? 'Không rõ',
        anh_dai_dien:  doc?.user_id?.anh_dai_dien ?? null,
        so_dien_thoai: doc?.user_id?.so_dien_thoai ?? null,
      },
      ket_qua: ketQua ? {
        id:                 ketQua._id,
        chan_doan:          ketQua.chan_doan,
        huong_dan_dieu_tri: ketQua.huong_dan_dieu_tri,
        ghi_chu:            ketQua.ghi_chu,
        ngay_tai_kham:      ketQua.ngay_tai_kham,
        ngay_tao:           ketQua.ngay_tao,
        thuoc: prescription?.items ?? [],
        hinh_anh_noi_soi: hinhAnhNoiSoi,
      } : null,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// PATCH /api/patient/records/:id/contact
// Chỉ sửa snapshot liên hệ của đúng lịch hẹn này; không sửa hồ sơ tài khoản.
export async function updateAppointmentContact(req, res) {
  try {
    const hoTen = String(req.body?.ho_ten ?? '').trim()
    const soDienThoai = String(req.body?.so_dien_thoai ?? '').trim()

    if (hoTen.length < 2 || hoTen.length > 100) {
      return fail(res, 400, 'Họ tên phải có từ 2 đến 100 ký tự')
    }
    if (!/^[\p{L}\s.'-]+$/u.test(hoTen)) {
      return fail(res, 400, 'Họ tên chỉ được chứa chữ cái và khoảng trắng')
    }
    if (!/^0\d{9}$/.test(soDienThoai)) {
      return fail(res, 400, 'Số điện thoại phải gồm 10 số và bắt đầu bằng số 0')
    }

    const updated = await withOptionalTransaction(async (session) => {
      const appointment = await LichHen.findOne({
        _id: req.params.id,
        ...ownedByUser(req.user.id),
      }).session(session)

      if (!appointment) throw appointmentError(404, 'Không tìm thấy lịch hẹn')
      if (!EDITABLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        throw appointmentError(409, 'Lịch hẹn chỉ được sửa khi đang chờ xác nhận hoặc đã xác nhận')
      }

      const appointmentTime = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
      if (!appointmentTime || appointmentTime.getTime() <= Date.now()) {
        throw appointmentError(409, 'Lịch hẹn đã qua thời gian chỉnh sửa')
      }

      const oldName = appointment.ten_khach ?? null
      const oldPhone = appointment.so_dien_thoai_khach ?? null
      appointment.ten_khach = hoTen
      appointment.so_dien_thoai_khach = soDienThoai
      await appointment.save({ session })

      await LichSuLichHen.create([{
        appointment_id: appointment._id,
        tu_trang_thai: appointment.status,
        den_trang_thai: appointment.status,
        loai_thay_doi: 'patient_contact_update',
        ly_do_thay_doi: 'Bệnh nhân cập nhật thông tin liên hệ cho lịch hẹn',
        nguoi_thay_doi_id: req.user.id,
        nguoi_thuc_hien_id: req.user.id,
        vai_tro: 'user',
        kenh_thay_doi: 'patient_profile',
        ly_do: JSON.stringify({
          ten_khach_cu: oldName,
          so_dien_thoai_khach_cu: oldPhone,
          ten_khach_moi: hoTen,
          so_dien_thoai_khach_moi: soDienThoai,
        }),
      }], { session })

      return appointment
    })

    return ok(res, {
      id: updated._id,
      ten_khach: updated.ten_khach,
      so_dien_thoai_khach: updated.so_dien_thoai_khach,
    }, 'Cập nhật thông tin lịch hẹn thành công')
  } catch (err) {
    return fail(res, err.statusCode ?? 500, err.statusCode ? err.message : 'Không thể cập nhật thông tin lịch hẹn')
  }
}

// DELETE /api/patient/records/batch-cancelled
export async function deleteBatchCancelledAppointments(req, res) {
  try {
    const result = await LichHen.updateMany(
      {
        ...ownedByUser(req.user.id),
        status: { $in: ['cancelled', 'no_show', 'skipped'] },
      },
      { $set: { da_xoa_boi_benh_nhan: true } }
    )

    return ok(res, { deletedCount: result.modifiedCount }, `Đã xóa ${result.modifiedCount} lịch hẹn đã hủy khỏi danh sách`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// DELETE /api/patient/records/:id
export async function deleteCancelledAppointment(req, res) {
  try {
    const appointment = await LichHen.findOne({
      _id: req.params.id,
      ...ownedByUser(req.user.id),
    })

    if (!appointment) {
      return fail(res, 404, 'Không tìm thấy lịch hẹn')
    }

    if (!['cancelled', 'no_show', 'skipped'].includes(appointment.status)) {
      return fail(res, 400, 'Chỉ được phép xóa lịch hẹn ở trạng thái đã hủy hoặc không đến')
    }

    appointment.da_xoa_boi_benh_nhan = true
    await appointment.save()

    return ok(res, { id: appointment._id }, 'Đã xóa lịch hẹn khỏi danh sách của bạn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
