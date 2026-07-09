import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { doctorProfileService } from '@/services/doctor-profile.service'
import type { DoctorProfile } from '@/types'
import { formatPrice } from '@/utils/format'
import { DOCTOR_APPROVAL_LABEL } from '@/utils/constants'

const APPROVAL_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green', pending: 'yellow', rejected: 'red', suspended: 'gray',
}

const SPECIALTIES = ['Tim mạch', 'Nhi khoa', 'Da liễu', 'Sản phụ khoa', 'Thần kinh', 'Nội tổng quát', 'Mắt', 'Tai Mũi Họng']

export default function DoctorProfile() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null)
  const [tieu_su, setTieuSu] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [form, setForm] = useState({
    ho_ten: '', chuyen_khoa: '', so_nam_kinh_nghiem: 0,
    gia_kham: 0, bang_cap: '', tieu_su: '',
  })

  useEffect(() => {
    doctorProfileService.get().then(({ profile: p, tieu_su: ts }) => {
      setProfile(p)
      setTieuSu(ts)
      setForm({
        ho_ten: p.ho_ten,
        chuyen_khoa: p.chuyen_khoa,
        so_nam_kinh_nghiem: p.so_nam_kinh_nghiem,
        gia_kham: p.gia_kham,
        bang_cap: p.bang_cap,
        tieu_su: ts,
      })
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await doctorProfileService.update(form)
      setProfile(updated)
      setTieuSu(form.tieu_su)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitReview() {
    if (!profile) return
    const updated = await doctorProfileService.submitForReview()
    setProfile(updated)
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-400">Đang tải...</div>
  if (!profile) return null

  return (
    <div>
      <PageHeader
        title="Hồ sơ bác sĩ"
        description="Quản lý thông tin hành nghề và trạng thái phê duyệt của bạn."
      >
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> Chỉnh sửa
          </button>
        )}
      </PageHeader>

      {/* Approval status banner */}
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
            <p className="mt-1.5 text-sm text-red-700 pl-7">Lý do: {profile.ly_do_tu_choi}</p>
          )}
          <button onClick={handleSubmitReview} className="mt-3 ml-7 inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 transition-colors">
            <Icon name="send" className="h-4 w-4" /> Nộp lại hồ sơ
          </button>
        </div>
      )}
      {profile.trang_thai_duyet === 'suspended' && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Icon name="ban" className="h-5 w-5 shrink-0 text-slate-500" />
          <p className="text-sm font-medium text-slate-700">Tài khoản bác sĩ của bạn đang bị tạm ngưng. Vui lòng liên hệ Admin để biết thêm chi tiết.</p>
        </div>
      )}
      {saved && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Icon name="check" className="h-4 w-4" /> Đã lưu thông tin thành công!
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Thông tin cơ bản */}
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Thông tin hành nghề</h2>
            <Badge color={APPROVAL_COLOR[profile.trang_thai_duyet]}>
              {DOCTOR_APPROVAL_LABEL[profile.trang_thai_duyet]}
            </Badge>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="input-label">Họ và tên</label>
                  <input className="input" value={form.ho_ten} onChange={(e) => setForm({ ...form, ho_ten: e.target.value })} required />
                </div>
                <div>
                  <label className="input-label">Chuyên khoa</label>
                  <select className="input" value={form.chuyen_khoa} onChange={(e) => setForm({ ...form, chuyen_khoa: e.target.value })}>
                    {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Số năm kinh nghiệm</label>
                  <input type="number" min={0} max={60} className="input" value={form.so_nam_kinh_nghiem}
                    onChange={(e) => setForm({ ...form, so_nam_kinh_nghiem: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="input-label">Phí tư vấn (VND)</label>
                  <input type="number" min={0} step={10000} className="input" value={form.gia_kham}
                    onChange={(e) => setForm({ ...form, gia_kham: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="input-label">Bằng cấp / Học vị</label>
                <input className="input" value={form.bang_cap} onChange={(e) => setForm({ ...form, bang_cap: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Tiểu sử / Giới thiệu bản thân</label>
                <textarea className="input resize-none" rows={4} value={form.tieu_su}
                  onChange={(e) => setForm({ ...form, tieu_su: e.target.value })}
                  placeholder="Mô tả về kinh nghiệm, chuyên môn và phong cách làm việc của bạn..." />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Hủy</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-4">
              {[
                { label: 'Họ và tên', value: profile.ho_ten },
                { label: 'Chuyên khoa', value: profile.chuyen_khoa },
                { label: 'Kinh nghiệm', value: `${profile.so_nam_kinh_nghiem} năm` },
                { label: 'Phí tư vấn', value: formatPrice(profile.gia_kham) },
                { label: 'Bằng cấp', value: profile.bang_cap },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4">
                  <dt className="w-36 shrink-0 text-sm text-slate-500">{label}</dt>
                  <dd className="text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-sm text-slate-500">Tiểu sử</dt>
                <dd className="text-sm leading-relaxed text-slate-700">{tieu_su}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Stats bên phải */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Chỉ số đánh giá</h3>
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-black text-amber-500">{profile.diem_danh_gia.toFixed(1)}</p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} className={`h-5 w-5 ${i <= Math.round(profile.diem_danh_gia) ? 'text-amber-400' : 'text-slate-200'}`}
                    fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-slate-500">{profile.so_danh_gia} lượt đánh giá</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Thông tin tài khoản</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-700 truncate ml-2">{profile.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd><Badge color={APPROVAL_COLOR[profile.trang_thai_duyet]}>{DOCTOR_APPROVAL_LABEL[profile.trang_thai_duyet]}</Badge></dd>
              </div>
            </dl>
          </div>

          {profile.trang_thai_duyet === 'approved' && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Icon name="check" className="h-4 w-4" />
                <p className="text-sm font-semibold">Hồ sơ đã được duyệt</p>
              </div>
              <p className="mt-1 text-xs text-green-600">Bạn đang hoạt động trên hệ thống VitaFamily.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
