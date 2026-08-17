import { created, fail, ok } from '../../utils/response.js'
import {
  ganKhachOfflineChoBacSi,
  layDanhSachHangDoiOffline,
  huyKhachOfflineTrungTam,
  layGoiYDieuPhoiOffline,
  tinhSucChuaHangDoiOfflineTrungTam,
  tiepNhanOfflineVaoHangDoiTrungTam,
  traKhachOfflineVeHangDoiTrungTam,
} from '../../services/centralOfflineQueue.service.js'

function actor(req) {
  return {
    actorUserId: req.user?._id ?? req.user?.id ?? null,
    actorRole: 'receptionist',
  }
}

export const getCapacity = async (req, res) => {
  try {
    const data = await tinhSucChuaHangDoiOfflineTrungTam({
      specialtyId: req.query.specialty_id ?? null,
      includeNewPatient: String(req.query.include_new_patient ?? 'true') !== 'false',
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const list = async (req, res) => {
  try {
    const data = await layDanhSachHangDoiOffline({
      specialtyId: req.query.specialty_id ?? null,
      status: req.query.status ?? null,
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const listToday = async (req, res) => {
  try {
    const data = await layDanhSachHangDoiOffline({
      specialtyId: req.query.specialty_id ?? null,
      status: req.query.status ?? null,
      doctorId: req.query.doctor_id ?? null,
      search: req.query.search ?? null,
      nguon: req.query.nguon && req.query.nguon !== 'all' ? req.query.nguon : null,
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const intake = async (req, res) => {
  try {
    const result = await tiepNhanOfflineVaoHangDoiTrungTam({
      hoSoBenhNhanId: req.body.ho_so_benh_nhan_id,
      specialtyId: req.body.specialty_id,
      xacNhanCanhBao: Boolean(req.body.xac_nhan_canh_bao),
      ...actor(req),
    })
    return created(res, result, 'Da tiep nhan khach vang lai vao hang doi trung tam')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const dispatchSuggestions = async (req, res) => {
  try {
    const data = await layGoiYDieuPhoiOffline({
      specialtyId: req.query.specialty_id ?? null,
      entryId: req.query.queue_id ?? null,
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const assign = async (req, res) => {
  try {
    const result = await ganKhachOfflineChoBacSi({
      entryId: req.params.id,
      doctorId: req.body.doctor_id,
      lyDo: req.body.ly_do ?? null,
      ...actor(req),
    })
    return ok(res, result, 'Da dieu phoi khach vang lai cho bac si')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const returnCentral = async (req, res) => {
  try {
    const result = await traKhachOfflineVeHangDoiTrungTam({
      entryId: req.params.id,
      lyDo: req.body.ly_do,
      ...actor(req),
    })
    return ok(res, result, 'Da tra khach ve hang doi trung tam')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const cancelCentral = async (req, res) => {
  try {
    const result = await huyKhachOfflineTrungTam({
      entryId: req.params.id,
      lyDo: req.body.ly_do,
      ...actor(req),
    })
    return ok(res, result, 'Da huy luot cho trung tam')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export default {
  list,
  listToday,
  getCapacity,
  intake,
  dispatchSuggestions,
  assign,
  returnCentral,
  cancelCentral,
}
