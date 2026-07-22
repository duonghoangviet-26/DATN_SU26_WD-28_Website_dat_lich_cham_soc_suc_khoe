import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Toast from '@/components/common/Toast'
import Icon from '@/components/admin/icons'
import { doctorProfileService } from '@/services/doctor-profile.service'
import type { DoctorApproval, DoctorSelfProfile } from '@/types'
import { formatPrice } from '@/utils/format'

type ProfileForm = {
  ho_ten: string
  so_nam_kinh_nghiem: number
  gia_kham: number
  bang_cap: string
  tieu_su: string
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
  so_nam_kinh_nghiem: 0,
  gia_kham: 0,
  bang_cap: '',
  tieu_su: '',
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
    so_nam_kinh_nghiem: profile.so_nam_kinh_nghiem ?? 0,
    gia_kham: profile.gia_kham ?? 0,
    bang_cap: toUtf8Text(profile.bang_cap, ''),
    tieu_su: toUtf8Text(profile.tieu_su, ''),
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

  useEffect(() => {
    let mounted = true

    doctorProfileService
      .get()
      .then((data) => {
        if (!mounted) return
        setProfile(data)
        setForm(toForm(data))
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

    try {
      const updated = await doctorProfileService.update({
        ho_ten: form.ho_ten.trim(),
        so_nam_kinh_nghiem: form.so_nam_kinh_nghiem,
        gia_kham: form.gia_kham,
        bang_cap: form.bang_cap.trim(),
        tieu_su: form.tieu_su.trim(),
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
        description="Quản lý thông tin hành nghề và trạng thái phê duyệt của bạn."
      >
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Chỉnh sửa
          </button>
        )}
      </PageHeader>

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
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-slate-800">Thông tin hành nghề</h2>
            <Badge color={statusColor}>{statusLabel}</Badge>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
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
                  <label className="input-label">Chuyên khoa</label>
                  <p className="input flex items-center bg-slate-50 text-slate-500">{specialtyText}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Chuyên khoa do Admin gán khi duyệt hồ sơ. Liên hệ Admin để thay đổi.
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

              <div>
                <label className="input-label">Bằng cấp / Học vị</label>
                <input
                  className="input"
                  value={form.bang_cap}
                  onChange={(event) => setForm({ ...form, bang_cap: event.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Tiểu sử / Giới thiệu bản thân</label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  value={form.tieu_su}
                  onChange={(event) => setForm({ ...form, tieu_su: event.target.value })}
                  placeholder="Mô tả về kinh nghiệm, chuyên môn và phong cách làm việc của bạn..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-4">
              {[
                { label: 'Họ và tên', value: toUtf8Text(profile.ho_ten) },
                { label: 'Chuyên khoa', value: specialtyText },
                { label: 'Kinh nghiệm', value: `${profile.so_nam_kinh_nghiem ?? 0} năm` },
                { label: 'Phí tư vấn', value: formatPrice(profile.gia_kham ?? 0) },
                { label: 'Bằng cấp', value: toUtf8Text(profile.bang_cap) },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4">
                  <dt className="w-36 shrink-0 text-sm text-slate-500">{label}</dt>
                  <dd className="text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}

              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-sm text-slate-500">Tiểu sử</dt>
                <dd className="text-sm leading-relaxed text-slate-700">{toUtf8Text(profile.tieu_su)}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
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
          </div>

          <div className="card p-5">
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
