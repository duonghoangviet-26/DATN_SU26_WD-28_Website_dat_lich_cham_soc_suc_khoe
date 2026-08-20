import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Toast from '@/components/common/Toast'
import Icon from '@/components/admin/icons'
import { doctorProfileService } from '@/services/doctor-profile.service'
import { patientBookingService } from '@/services/patient-booking.service'
import type { DoctorApproval, DoctorSelfProfile } from '@/types'
import { formatPrice } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

type ProfileForm = {
  ho_ten: string
  so_dien_thoai: string
  anh_dai_dien: string
  so_nam_kinh_nghiem: number
  gia_kham: number
  bang_cap: string
  tieu_su: string
  chuc_danh: string
  chuc_vu_hien_tai: string
  ma_cchn: string
  gioi_thieu_ngan: string
  bang_cap_hoc_vi_tags: string
  ngon_ngu: string
  the_manh_chuyen_mon: string
  benh_ly_dieu_tri: string
  thanh_vien_hoi: string
  qua_trinh_dao_tao: { ten_bang: string; truong: string; tu_nam: string; den_nam: string }[]
  qua_trinh_cong_tac: { noi_cong_tac: string; chuc_vu: string; tu_nam: string; den_nam: string }[]
  giai_thuong: { ten: string; nam: string }[]
}

const approvalLabel: Record<DoctorApproval, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  suspended: 'Tạm ngưng',
}

const approvalColor: Record<DoctorApproval, 'green' | 'red' | 'yellow' | 'gray'> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  suspended: 'gray',
}

const emptyForm: ProfileForm = {
  ho_ten: '',
  so_dien_thoai: '',
  anh_dai_dien: '',
  so_nam_kinh_nghiem: 0,
  gia_kham: 0,
  bang_cap: '',
  tieu_su: '',
  chuc_danh: '',
  chuc_vu_hien_tai: '',
  ma_cchn: '',
  gioi_thieu_ngan: '',
  bang_cap_hoc_vi_tags: '',
  ngon_ngu: '',
  the_manh_chuyen_mon: '',
  benh_ly_dieu_tri: '',
  thanh_vien_hoi: '',
  qua_trinh_dao_tao: [],
  qua_trinh_cong_tac: [],
  giai_thuong: []
}

const cp1252CodeByChar: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
}

function hasMojibake(value: string) {
  const codes = Array.from(value, (char) => char.charCodeAt(0))
  for (let index = 0; index < codes.length; index += 1) {
    const current = codes[index]
    const next = codes[index + 1]

    if (current === 0x00c3 || current === 0x00c2 || current === 0x00c4 || current === 0x00c5 || current === 0x00c6) {
      return true
    }

    if (current === 0x00e1 && (next === 0x00ba || next === 0x00bb)) {
      return true
    }

    if (current === 0x00e2 && (next === 0x0080 || next === 0x0082 || next === 0x0094)) {
      return true
    }
  }

  return false
}

function toUtf8Text(value: string | null | undefined, fallback = 'Chưa cập nhật') {
  if (!value) return fallback
  if (!hasMojibake(value)) return value

  try {
    const bytes = Array.from(value, (char) => {
      const code = char.charCodeAt(0)
      return cp1252CodeByChar[code] ?? (code <= 0xff ? code : 0x3f)
    })
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
  } catch {
    return value
  }
}

function toForm(profile: DoctorSelfProfile): ProfileForm {
  return {
    ho_ten: toUtf8Text(profile.ho_ten, ''),
    so_dien_thoai: profile.so_dien_thoai ?? '',
    anh_dai_dien: profile.anh_dai_dien ?? '',
    so_nam_kinh_nghiem: profile.so_nam_kinh_nghiem ?? 0,
    gia_kham: profile.gia_kham ?? 0,
    bang_cap: toUtf8Text(profile.bang_cap, ''),
    tieu_su: toUtf8Text(profile.tieu_su, ''),
    chuc_danh: toUtf8Text(profile.chuc_danh, ''),
    chuc_vu_hien_tai: toUtf8Text(profile.chuc_vu_hien_tai, ''),
    ma_cchn: profile.ma_cchn ?? '',
    gioi_thieu_ngan: toUtf8Text(profile.gioi_thieu_ngan, ''),
    bang_cap_hoc_vi_tags: (profile.bang_cap_hoc_vi_tags ?? []).join(', '),
    ngon_ngu: (profile.ngon_ngu ?? []).join(', '),
    the_manh_chuyen_mon: (profile.the_manh_chuyen_mon ?? []).join(', '),
    benh_ly_dieu_tri: (profile.benh_ly_dieu_tri ?? []).join(', '),
    thanh_vien_hoi: (profile.thanh_vien_hoi ?? []).join(', '),
    qua_trinh_dao_tao: (profile.qua_trinh_dao_tao ?? []).map(item => ({
      ten_bang: toUtf8Text(item.ten_bang, ''),
      truong: toUtf8Text(item.truong, ''),
      tu_nam: item.tu_nam ? String(item.tu_nam) : '',
      den_nam: item.den_nam ? String(item.den_nam) : ''
    })),
    qua_trinh_cong_tac: (profile.qua_trinh_cong_tac ?? []).map(item => ({
      noi_cong_tac: toUtf8Text(item.noi_cong_tac, ''),
      chuc_vu: toUtf8Text(item.chuc_vu, ''),
      tu_nam: item.tu_nam ? String(item.tu_nam) : '',
      den_nam: item.den_nam ? String(item.den_nam) : ''
    })),
    giai_thuong: (profile.giai_thuong ?? []).map(item => ({
      ten: toUtf8Text(item.ten, ''),
      nam: item.nam ? String(item.nam) : ''
    }))
  }
}

export default function DoctorProfile() {
  const [profile, setProfile] = useState<DoctorSelfProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [reviews, setReviews] = useState<any[]>([])

  useEffect(() => {
    let mounted = true

    doctorProfileService
      .get()
      .then((data) => {
        if (!mounted) return
        setProfile(data)
        setForm(toForm(data))
        return patientBookingService.getDoctorReviews(data.id)
      })
      .then((reviewsData) => {
        if (!mounted || !reviewsData) return
        setReviews(reviewsData)
      })
      .catch((error) => {
        if (!mounted) return
        setSaveError(error?.response?.data?.message || 'Không thể tải hồ sơ bác sĩ.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const specialtyText = useMemo(() => {
    if (!profile?.specialties?.length) return 'Chưa được gán chuyên khoa'
    return profile.specialties.map((specialty) => toUtf8Text(specialty.ten, '')).filter(Boolean).join(', ')
  }, [profile])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')
    setSaving(true)

    const parseArrayString = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean)
    const parseNum = (str: string) => str.trim() ? Number(str) : null

    try {
      const updated = await doctorProfileService.update({
        ho_ten: form.ho_ten.trim(),
        so_dien_thoai: form.so_dien_thoai.trim() || null,
        anh_dai_dien: form.anh_dai_dien.trim() || null,
        so_nam_kinh_nghiem: form.so_nam_kinh_nghiem,
        gia_kham: form.gia_kham,
        bang_cap: form.bang_cap.trim(),
        tieu_su: form.tieu_su.trim(),
        chuc_danh: form.chuc_danh.trim(),
        chuc_vu_hien_tai: form.chuc_vu_hien_tai.trim(),
        ma_cchn: form.ma_cchn.trim(),
        gioi_thieu_ngan: form.gioi_thieu_ngan.trim(),
        bang_cap_hoc_vi_tags: parseArrayString(form.bang_cap_hoc_vi_tags),
        ngon_ngu: parseArrayString(form.ngon_ngu),
        the_manh_chuyen_mon: parseArrayString(form.the_manh_chuyen_mon),
        benh_ly_dieu_tri: parseArrayString(form.benh_ly_dieu_tri),
        thanh_vien_hoi: parseArrayString(form.thanh_vien_hoi),
        qua_trinh_dao_tao: form.qua_trinh_dao_tao.map(item => ({
          ten_bang: item.ten_bang.trim(),
          truong: item.truong.trim(),
          tu_nam: parseNum(item.tu_nam),
          den_nam: parseNum(item.den_nam)
        })).filter(item => item.ten_bang),
        qua_trinh_cong_tac: form.qua_trinh_cong_tac.map(item => ({
          noi_cong_tac: item.noi_cong_tac.trim(),
          chuc_vu: item.chuc_vu.trim(),
          tu_nam: parseNum(item.tu_nam),
          den_nam: parseNum(item.den_nam)
        })).filter(item => item.noi_cong_tac),
        giai_thuong: form.giai_thuong.map(item => ({
          ten: item.ten.trim(),
          nam: parseNum(item.nam)
        })).filter(item => item.ten)
      })
      setProfile(updated)
      setForm(toForm(updated))
      setEditing(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (error: any) {
      setSaveError(error?.response?.data?.message || 'Không thể lưu thông tin. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (profile) setForm(toForm(profile))
    setEditing(false)
    setSaveError('')
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Đang tải hồ sơ...</div>
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        Không tìm thấy hồ sơ bác sĩ.
      </div>
    )
  }

  const statusLabel = approvalLabel[profile.trang_thai_duyet] || 'Không xác định'
  const statusColor = approvalColor[profile.trang_thai_duyet] || 'gray'

  return (
    <div>
      {saveError && (
        <Toast key={saveError} message={toUtf8Text(saveError, 'Không thể xử lý yêu cầu.')} type="error" onClose={() => setSaveError('')} />
      )}

      <PageHeader
        title="Hồ sơ bác sĩ"
        description="Thông tin chuyên môn hiển thị trên hệ thống đặt lịch và hồ sơ khám."
      >
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Chỉnh sửa
          </button>
        )}
      </PageHeader>

      <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,118,110,0.45)]">
        <div className="flex flex-col gap-5 bg-[linear-gradient(120deg,#f0fdfa_0%,#ffffff_55%,#f8fafc_100%)] p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-teal-100 text-3xl font-black text-teal-700 shadow-sm">
            {resolveMediaUrl(profile.anh_dai_dien) ? (
              <img src={resolveMediaUrl(profile.anh_dai_dien) || undefined} alt={`Ảnh đại diện ${toUtf8Text(profile.ho_ten, 'bác sĩ')}`} className="h-full w-full object-cover" />
            ) : (
              toUtf8Text(profile.ho_ten, 'BS').split(' ').pop()?.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Hồ sơ chuyên môn</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{toUtf8Text(profile.ho_ten)}</h1>
            <p className="mt-1 text-sm text-slate-600">{specialtyText} · {profile.phong_kham_mac_dinh || 'Chưa cập nhật phòng khám'}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-left shadow-sm sm:min-w-44">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trạng thái hồ sơ</p>
            <div className="mt-1"><Badge color={statusColor}>{statusLabel}</Badge></div>
          </div>
        </div>
      </section>

      {profile.trang_thai_duyet === 'pending' && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <Icon name="clock" className="h-5 w-5 shrink-0 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800">
            Hồ sơ của bạn đang chờ Admin xét duyệt. Vui lòng đợi thông báo qua email.
          </p>
        </div>
      )}

      {profile.trang_thai_duyet === 'rejected' && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium text-red-800">Hồ sơ bị từ chối</p>
          </div>
          {profile.ly_do_tu_choi && (
            <p className="mt-1.5 pl-7 text-sm text-red-700">Lý do: {toUtf8Text(profile.ly_do_tu_choi, '')}</p>
          )}
          <p className="mt-1.5 pl-7 text-xs text-red-500">
            Vui lòng liên hệ Admin để được hướng dẫn nộp lại hồ sơ.
          </p>
        </div>
      )}

      {profile.trang_thai_duyet === 'suspended' && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Icon name="ban" className="h-5 w-5 shrink-0 text-slate-500" />
          <p className="text-sm font-medium text-slate-700">
            Tài khoản bác sĩ của bạn đang bị tạm ngưng. Vui lòng liên hệ Admin để biết thêm chi tiết.
          </p>
        </div>
      )}

      {saved && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Icon name="check" className="h-4 w-4" />
          Đã lưu thông tin thành công!
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card rounded-3xl p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-slate-800">Thông tin hành nghề</h2>
            <Badge color={statusColor}>{statusLabel}</Badge>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION: THÔNG TIN CƠ BẢN */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-2">Thông tin cơ bản</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="input-label">Họ và tên</label>
                    <input
                      className="input"
                      value={form.ho_ten}
                      onChange={(event) => setForm({ ...form, ho_ten: event.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Chức danh (VD: PGS. TS. BSCKII)</label>
                    <input
                      className="input"
                      value={form.chuc_danh}
                      onChange={(event) => setForm({ ...form, chuc_danh: event.target.value })}
                      placeholder="Nhập chức danh của bạn"
                    />
                  </div>
                  <div>
                    <label className="input-label">Số điện thoại</label>
                    <input
                      className="input"
                      value={form.so_dien_thoai}
                      onChange={(event) => setForm({ ...form, so_dien_thoai: event.target.value })}
                      placeholder="Nhập số điện thoại liên hệ"
                    />
                  </div>
                  <div>
                    <label className="input-label">Mã CCHN</label>
                    <input
                      className="input"
                      value={form.ma_cchn}
                      onChange={(event) => setForm({ ...form, ma_cchn: event.target.value })}
                      placeholder="Mã chứng chỉ hành nghề"
                    />
                  </div>
                  <div>
                    <label className="input-label">Đường dẫn ảnh đại diện</label>
                    <input
                      className="input"
                      value={form.anh_dai_dien}
                      onChange={(event) => setForm({ ...form, anh_dai_dien: event.target.value })}
                      placeholder="https://... hoặc /uploads/..."
                    />
                  </div>
                  <div>
                    <label className="input-label">Chuyên khoa</label>
                    <p className="input flex items-center bg-slate-50 text-slate-500">{specialtyText}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Chuyên khoa do Admin gán. Liên hệ Admin để thay đổi.
                    </p>
                  </div>
                  <div>
                    <label className="input-label">Số năm kinh nghiệm</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className="input"
                      value={form.so_nam_kinh_nghiem}
                      onChange={(event) => setForm({ ...form, so_nam_kinh_nghiem: Number(event.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Phí tư vấn (VNĐ)</label>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      className="input"
                      value={form.gia_kham}
                      onChange={(event) => setForm({ ...form, gia_kham: Number(event.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: THÔNG TIN CHUYÊN MÔN */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-2">Thông tin chuyên môn</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="input-label">Chức vụ hiện tại</label>
                    <input
                      className="input"
                      value={form.chuc_vu_hien_tai}
                      onChange={(event) => setForm({ ...form, chuc_vu_hien_tai: event.target.value })}
                      placeholder="VD: Trưởng khoa Tai Mũi Họng"
                    />
                  </div>
                  <div>
                    <label className="input-label">Bằng cấp tóm tắt</label>
                    <input
                      className="input"
                      value={form.bang_cap}
                      onChange={(event) => setForm({ ...form, bang_cap: event.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Thẻ bằng cấp / Học vị (cách nhau bằng dấu phẩy)</label>
                    <input
                      className="input"
                      value={form.bang_cap_hoc_vi_tags}
                      onChange={(event) => setForm({ ...form, bang_cap_hoc_vi_tags: event.target.value })}
                      placeholder="VD: Bác sĩ chuyên khoa II, Thạc sĩ"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Ngôn ngữ (cách nhau bằng dấu phẩy)</label>
                    <input
                      className="input"
                      value={form.ngon_ngu}
                      onChange={(event) => setForm({ ...form, ngon_ngu: event.target.value })}
                      placeholder="VD: Tiếng Việt, Tiếng Anh"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Thế mạnh chuyên môn (cách nhau bằng dấu phẩy)</label>
                    <input
                      className="input"
                      value={form.the_manh_chuyen_mon}
                      onChange={(event) => setForm({ ...form, the_manh_chuyen_mon: event.target.value })}
                      placeholder="VD: Phẫu thuật nội soi xoang, Vá nhĩ"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Bệnh lý điều trị (cách nhau bằng dấu phẩy)</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={form.benh_ly_dieu_tri}
                      onChange={(event) => setForm({ ...form, benh_ly_dieu_tri: event.target.value })}
                      placeholder="VD: Viêm xoang cấp, Viêm tai giữa, Amidan"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Thành viên hội đồng / Hiệp hội (cách nhau bằng dấu phẩy)</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={form.thanh_vien_hoi}
                      onChange={(event) => setForm({ ...form, thanh_vien_hoi: event.target.value })}
                      placeholder="VD: Hội Tai Mũi Họng Việt Nam, Hội Phẫu thuật Cổ mặt"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: GIỚI THIỆU & TIỂU SỬ */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-2">Giới thiệu & Tiểu sử</h3>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Giới thiệu ngắn (Slogan / Triết lý làm việc)</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={form.gioi_thieu_ngan}
                      onChange={(event) => setForm({ ...form, gioi_thieu_ngan: event.target.value })}
                      placeholder="VD: Luôn tận tâm vì sức khỏe người bệnh..."
                    />
                  </div>
                  <div>
                    <label className="input-label">Tiểu sử chi tiết</label>
                    <textarea
                      className="input resize-y min-h-[120px]"
                      rows={6}
                      value={form.tieu_su}
                      onChange={(event) => setForm({ ...form, tieu_su: event.target.value })}
                      placeholder="Mô tả về kinh nghiệm, chuyên môn và phong cách làm việc của bạn..."
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: QUÁ TRÌNH ĐÀO TẠO */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quá trình đào tạo</h3>
                  <button 
                    type="button" 
                    onClick={() => setForm({ ...form, qua_trinh_dao_tao: [...form.qua_trinh_dao_tao, { ten_bang: '', truong: '', tu_nam: '', den_nam: '' }] })}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg"
                  >
                    + Thêm quá trình
                  </button>
                </div>
                {form.qua_trinh_dao_tao.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có thông tin quá trình đào tạo.</p>}
                <div className="space-y-3">
                  {form.qua_trinh_dao_tao.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                      <button 
                        type="button" 
                        onClick={() => setForm({ ...form, qua_trinh_dao_tao: form.qua_trinh_dao_tao.filter((_, i) => i !== idx) })}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        title="Xóa"
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                      <div className="flex-1 space-y-3">
                        <input className="input" placeholder="Tên bằng cấp (VD: Bác sĩ Y Khoa) *" value={item.ten_bang} onChange={e => { const newArr = [...form.qua_trinh_dao_tao]; newArr[idx].ten_bang = e.target.value; setForm({ ...form, qua_trinh_dao_tao: newArr }) }} required />
                        <input className="input" placeholder="Trường đào tạo (VD: Đại học Y Hà Nội)" value={item.truong} onChange={e => { const newArr = [...form.qua_trinh_dao_tao]; newArr[idx].truong = e.target.value; setForm({ ...form, qua_trinh_dao_tao: newArr }) }} />
                      </div>
                      <div className="flex gap-2 sm:w-48 sm:flex-col shrink-0">
                        <input type="number" className="input" placeholder="Từ năm" value={item.tu_nam} onChange={e => { const newArr = [...form.qua_trinh_dao_tao]; newArr[idx].tu_nam = e.target.value; setForm({ ...form, qua_trinh_dao_tao: newArr }) }} />
                        <input type="number" className="input" placeholder="Đến năm" value={item.den_nam} onChange={e => { const newArr = [...form.qua_trinh_dao_tao]; newArr[idx].den_nam = e.target.value; setForm({ ...form, qua_trinh_dao_tao: newArr }) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION: QUÁ TRÌNH CÔNG TÁC */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quá trình công tác</h3>
                  <button 
                    type="button" 
                    onClick={() => setForm({ ...form, qua_trinh_cong_tac: [...form.qua_trinh_cong_tac, { noi_cong_tac: '', chuc_vu: '', tu_nam: '', den_nam: '' }] })}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg"
                  >
                    + Thêm công tác
                  </button>
                </div>
                {form.qua_trinh_cong_tac.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có thông tin quá trình công tác.</p>}
                <div className="space-y-3">
                  {form.qua_trinh_cong_tac.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                      <button 
                        type="button" 
                        onClick={() => setForm({ ...form, qua_trinh_cong_tac: form.qua_trinh_cong_tac.filter((_, i) => i !== idx) })}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        title="Xóa"
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                      <div className="flex-1 space-y-3">
                        <input className="input" placeholder="Nơi công tác (VD: Bệnh viện Bạch Mai) *" value={item.noi_cong_tac} onChange={e => { const newArr = [...form.qua_trinh_cong_tac]; newArr[idx].noi_cong_tac = e.target.value; setForm({ ...form, qua_trinh_cong_tac: newArr }) }} required />
                        <input className="input" placeholder="Chức vụ (VD: Bác sĩ điều trị)" value={item.chuc_vu} onChange={e => { const newArr = [...form.qua_trinh_cong_tac]; newArr[idx].chuc_vu = e.target.value; setForm({ ...form, qua_trinh_cong_tac: newArr }) }} />
                      </div>
                      <div className="flex gap-2 sm:w-48 sm:flex-col shrink-0">
                        <input type="number" className="input" placeholder="Từ năm" value={item.tu_nam} onChange={e => { const newArr = [...form.qua_trinh_cong_tac]; newArr[idx].tu_nam = e.target.value; setForm({ ...form, qua_trinh_cong_tac: newArr }) }} />
                        <input type="number" className="input" placeholder="Đến năm (Bỏ trống nếu đang làm)" value={item.den_nam} onChange={e => { const newArr = [...form.qua_trinh_cong_tac]; newArr[idx].den_nam = e.target.value; setForm({ ...form, qua_trinh_cong_tac: newArr }) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION: GIẢI THƯỞNG */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Giải thưởng & Danh hiệu</h3>
                  <button 
                    type="button" 
                    onClick={() => setForm({ ...form, giai_thuong: [...form.giai_thuong, { ten: '', nam: '' }] })}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg"
                  >
                    + Thêm giải thưởng
                  </button>
                </div>
                {form.giai_thuong.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có thông tin giải thưởng.</p>}
                <div className="space-y-3">
                  {form.giai_thuong.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative items-start">
                      <button 
                        type="button" 
                        onClick={() => setForm({ ...form, giai_thuong: form.giai_thuong.filter((_, i) => i !== idx) })}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        title="Xóa"
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                      <input className="input flex-1" placeholder="Tên giải thưởng *" value={item.ten} onChange={e => { const newArr = [...form.giai_thuong]; newArr[idx].ten = e.target.value; setForm({ ...form, giai_thuong: newArr }) }} required />
                      <input type="number" className="input w-32 shrink-0" placeholder="Năm" value={item.nam} onChange={e => { const newArr = [...form.giai_thuong]; newArr[idx].nam = e.target.value; setForm({ ...form, giai_thuong: newArr }) }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn-primary px-8" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-6">
              {/* CƠ BẢN */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Thông tin cơ bản</h3>
                {[
                  { label: 'Họ và tên', value: toUtf8Text(profile.ho_ten) },
                  { label: 'Chức danh', value: toUtf8Text(profile.chuc_danh) },
                  { label: 'Chuyên khoa', value: specialtyText },
                  { label: 'Số năm kinh nghiệm', value: `${profile.so_nam_kinh_nghiem ?? 0} năm` },
                  { label: 'Phí tư vấn', value: formatPrice(profile.gia_kham ?? 0) },
                  { label: 'Mã CCHN', value: profile.ma_cchn || 'Chưa cập nhật' },
                  { label: 'Số điện thoại', value: profile.so_dien_thoai || 'Chưa cập nhật' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <dt className="w-40 shrink-0 text-sm text-slate-500">{label}</dt>
                    <dd className="text-sm font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
              </div>

              {/* CHUYÊN MÔN */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Chuyên môn</h3>
                <div className="flex gap-4">
                  <dt className="w-40 shrink-0 text-sm text-slate-500">Chức vụ hiện tại</dt>
                  <dd className="text-sm font-medium text-slate-800">{toUtf8Text(profile.chuc_vu_hien_tai)}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-40 shrink-0 text-sm text-slate-500">Bằng cấp</dt>
                  <dd className="text-sm font-medium text-slate-800">{toUtf8Text(profile.bang_cap)}</dd>
                </div>
                {profile.bang_cap_hoc_vi_tags && profile.bang_cap_hoc_vi_tags.length > 0 && (
                  <div className="flex gap-4">
                    <dt className="w-40 shrink-0 text-sm text-slate-500">Học vị (Tags)</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {profile.bang_cap_hoc_vi_tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200">{tag}</span>
                      ))}
                    </dd>
                  </div>
                )}
                {profile.ngon_ngu && profile.ngon_ngu.length > 0 && (
                  <div className="flex gap-4">
                    <dt className="w-40 shrink-0 text-sm text-slate-500">Ngôn ngữ</dt>
                    <dd className="text-sm font-medium text-slate-800">{profile.ngon_ngu.join(', ')}</dd>
                  </div>
                )}
                {profile.the_manh_chuyen_mon && profile.the_manh_chuyen_mon.length > 0 && (
                  <div className="flex gap-4">
                    <dt className="w-40 shrink-0 text-sm text-slate-500">Thế mạnh</dt>
                    <dd className="text-sm font-medium text-slate-800">{profile.the_manh_chuyen_mon.join(', ')}</dd>
                  </div>
                )}
                {profile.benh_ly_dieu_tri && profile.benh_ly_dieu_tri.length > 0 && (
                  <div className="flex gap-4">
                    <dt className="w-40 shrink-0 text-sm text-slate-500">Bệnh lý điều trị</dt>
                    <dd className="text-sm font-medium text-slate-800">{profile.benh_ly_dieu_tri.join(', ')}</dd>
                  </div>
                )}
              </div>

              {/* GIỚI THIỆU */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Tiểu sử & Giới thiệu</h3>
                {profile.gioi_thieu_ngan && (
                  <div className="flex flex-col gap-1.5">
                    <dt className="text-sm font-semibold text-slate-500">Giới thiệu ngắn (Slogan)</dt>
                    <dd className="text-sm text-slate-800 italic">"{toUtf8Text(profile.gioi_thieu_ngan)}"</dd>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <dt className="text-sm font-semibold text-slate-500">Tiểu sử chi tiết</dt>
                  <dd className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{toUtf8Text(profile.tieu_su)}</dd>
                </div>
              </div>

              {/* QUÁ TRÌNH */}
              {(profile.qua_trinh_dao_tao?.length ?? 0) > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Đào tạo</h3>
                  <div className="space-y-3 text-sm">
                    {profile.qua_trinh_dao_tao.map((dt, i) => (
                      <div key={i} className="flex justify-between items-start gap-4 p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-800">{toUtf8Text(dt.ten_bang)}</p>
                          <p className="text-xs text-slate-500">{toUtf8Text(dt.truong)}</p>
                        </div>
                        {(dt.tu_nam || dt.den_nam) && (
                          <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                            {dt.tu_nam} - {dt.den_nam || 'Nay'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(profile.qua_trinh_cong_tac?.length ?? 0) > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Công tác</h3>
                  <div className="space-y-3 text-sm">
                    {profile.qua_trinh_cong_tac.map((ct, i) => (
                      <div key={i} className="flex justify-between items-start gap-4 p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-800">{toUtf8Text(ct.chuc_vu || 'Bác sĩ')}</p>
                          <p className="text-xs text-slate-500">{toUtf8Text(ct.noi_cong_tac)}</p>
                        </div>
                        {(ct.tu_nam || ct.den_nam) && (
                          <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                            {ct.tu_nam} - {ct.den_nam || 'Nay'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(profile.giai_thuong?.length ?? 0) > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Giải thưởng</h3>
                  <div className="space-y-2 text-sm">
                    {profile.giai_thuong.map((gt, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-800">🏆 {toUtf8Text(gt.ten)}</span>
                        {gt.nam && <span className="text-xs font-mono text-slate-500">{gt.nam}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="space-y-4">
          <div className="card rounded-3xl p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Chỉ số đánh giá</h3>
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-black text-amber-500">{(profile.diem_danh_gia ?? 0).toFixed(1)}</p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`h-5 w-5 ${star <= Math.round(profile.diem_danh_gia ?? 0) ? 'text-amber-400' : 'text-slate-200'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-slate-500">{profile.tong_danh_gia ?? 0} lượt đánh giá</p>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Nhận xét mới nhất</h4>
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Chưa có lượt đánh giá nào.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {reviews.map((r) => {
                    const ratingDoc = r.chi_tiet?.danh_gia_bac_si || r.so_sao || 5
                    return (
                      <div key={r.id || r._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{r.benh_nhan?.ho_ten || 'Bệnh nhân'}</span>
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-[10px] ${i < ratingDoc ? 'text-amber-400' : 'text-slate-200'}`}>⭐</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600 italic">
                          "{r.nhan_xet || 'Đã khám thành công và để lại đánh giá.'}"
                        </p>
                        <p className="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-100/50 text-right">
                          {new Date(r.ngay_tao || new Date()).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card rounded-3xl p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Thông tin tài khoản</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="ml-2 truncate font-medium text-slate-700">{profile.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd>
                  <Badge color={statusColor}>{statusLabel}</Badge>
                </dd>
              </div>
            </dl>
          </div>

          {profile.trang_thai_duyet === 'approved' && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Icon name="check" className="h-4 w-4" />
                <p className="text-sm font-semibold">Hồ sơ đã được duyệt</p>
              </div>
              <p className="mt-1 text-xs text-green-600">Bạn đang hoạt động trên hệ thống ViteFamily.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
