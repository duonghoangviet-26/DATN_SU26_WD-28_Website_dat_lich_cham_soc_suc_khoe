import ThongTinPhongKham from '../../models/ThongTinPhongKham.js'

const CLINIC_FIELDS = [
  'ten',
  'trang_thai',
  'dia_chi',
  'so_dien_thoai',
  'email',
  'gio_lam_viec',
  'mo_ta',
  'logo_url',
  'ban_do_url',
  'bao_hiem',
]

function applySession(query, session) {
  return session ? query.session(session) : query
}

export function sanitizeClinicPayload(payload = {}) {
  const clinicPayload = {}

  for (const field of CLINIC_FIELDS) {
    if (!(field in payload)) continue

    if (field === 'bao_hiem') {
      clinicPayload.bao_hiem = {
        nha_nuoc: Boolean(payload.bao_hiem?.nha_nuoc),
        bao_lanh: Boolean(payload.bao_hiem?.bao_lanh),
      }
      continue
    }

    clinicPayload[field] = payload[field]
  }

  return clinicPayload
}

export async function getSingletonClinic(session = null) {
  const query = ThongTinPhongKham.findOne().sort({ ngay_tao: 1 })
  return applySession(query, session)
}

export async function getSingletonClinicIdOrThrow(session = null) {
  const clinic = await getSingletonClinic(session)
  if (!clinic) {
    throw new Error('He thong chua co thong tin phong kham')
  }
  return clinic._id
}
