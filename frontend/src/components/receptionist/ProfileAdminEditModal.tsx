import { useMemo, useState } from 'react'
import {
  PatientProfile,
  UpdateProfileAdministrativePayload,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

const FIELD_LABELS: Record<string, string> = {
  ho_ten: 'Họ tên',
  so_dien_thoai: 'Số điện thoại',
  ngay_sinh: 'Ngày sinh',
  gioi_tinh: 'Giới tính',
  nhom_mau: 'Nhóm máu',
  di_ung: 'Dị ứng',
  benh_nen: 'Bệnh nền',
  dia_chi: 'Địa chỉ',
  ghi_chu: 'Ghi chú',
}

function isoToInputDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function displayValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật'
  if (field === 'ngay_sinh') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN')
  }
  if (field === 'gioi_tinh') {
    return ({ nam: 'Nam', nu: 'Nữ', khac: 'Khác' } as Record<string, string>)[String(value)] ?? String(value)
  }
  return String(value)
}

interface FormState {
  ho_ten: string
  so_dien_thoai: string
  ngay_sinh: string
  gioi_tinh: '' | 'nam' | 'nu' | 'khac'
  nhom_mau: '' | 'A' | 'B' | 'AB' | 'O'
  di_ung: string
  benh_nen: string
  dia_chi: string
  ghi_chu: string
}

function toFormState(profile: PatientProfile): FormState {
  return {
    ho_ten: profile.ho_ten ?? '',
    so_dien_thoai: profile.so_dien_thoai ?? '',
    ngay_sinh: isoToInputDate(profile.ngay_sinh),
    gioi_tinh: profile.gioi_tinh ?? '',
    nhom_mau: profile.nhom_mau ?? '',
    di_ung: profile.di_ung ?? '',
    benh_nen: profile.benh_nen ?? '',
    dia_chi: profile.dia_chi ?? '',
    ghi_chu: profile.ghi_chu ?? '',
  }
}

interface ProfileAdminEditModalProps {
  profile: PatientProfile
  onClose: () => void
  onSaved: (result: { profile: PatientProfile; changed_fields: string[] }) => void
}

export default function ProfileAdminEditModal({ profile, onClose, onSaved }: ProfileAdminEditModalProps) {
  const initial = useMemo(() => toFormState(profile), [profile])
  const [form, setForm] = useState<FormState>(initial)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [neutralNotice, setNeutralNotice] = useState('')

  const changedFields = useMemo(() => {
    const fields: Array<keyof FormState> = ['ho_ten', 'so_dien_thoai', 'ngay_sinh', 'gioi_tinh', 'nhom_mau', 'di_ung', 'benh_nen', 'dia_chi', 'ghi_chu']
    return fields.filter((field) => form[field] !== initial[field])
  }, [form, initial])

  const canSave = changedFields.length > 0 && reason.trim().length > 0 && !saving

  const buildPayload = (): UpdateProfileAdministrativePayload => {
    const payload: UpdateProfileAdministrativePayload = { ly_do_cap_nhat: reason.trim() }
    for (const field of changedFields) {
      if (field === 'ngay_sinh') {
        payload.ngay_sinh = form.ngay_sinh ? new Date(form.ngay_sinh).toISOString() : null
      } else if (field === 'gioi_tinh') {
        payload.gioi_tinh = form.gioi_tinh || null
      } else if (field === 'nhom_mau') {
        payload.nhom_mau = form.nhom_mau || null
      } else {
        (payload as unknown as Record<string, unknown>)[field] = form[field] || null
      }
    }
    return payload
  }

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    setNeutralNotice('')
    try {
      const result = await receptionistPatientIntakeService.updateProfileAdministrative(profile.id, buildPayload())
      onSaved({ profile: result.profile, changed_fields: result.changed_fields })
    } catch (requestError: any) {
      const status = requestError?.response?.status
      const message = requestError?.response?.data?.message || ''
      if (status === 400 && /khong co thong tin|không có thông tin/i.test(message)) {
        setNeutralNotice('Không có gì thay đổi so với hồ sơ hiện tại.')
      } else if (status === 403) {
        setError('Lễ tân không có quyền sửa trường chuyên môn.')
      } else if (status === 404) {
        setError('Hồ sơ không tồn tại hoặc đã ngừng hoạt động.')
      } else {
        setError(message || 'Không thể lưu thông tin hành chính.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800">Sửa thông tin hành chính</h3>
        <p className="mt-1 text-sm text-slate-500">Chỉ áp dụng cho thông tin hành chính. Không được sửa chẩn đoán, đơn thuốc hay dữ liệu chuyên môn khác.</p>

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {neutralNotice && <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{neutralNotice}</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Họ tên
            <input value={form.ho_ten} onChange={(event) => setForm({ ...form, ho_ten: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Số điện thoại
            <input value={form.so_dien_thoai} onChange={(event) => setForm({ ...form, so_dien_thoai: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ngày sinh
            <input type="date" value={form.ngay_sinh} onChange={(event) => setForm({ ...form, ngay_sinh: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Giới tính
            <select value={form.gioi_tinh} onChange={(event) => setForm({ ...form, gioi_tinh: event.target.value as FormState['gioi_tinh'] })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              <option value="">Chưa cập nhật</option>
              <option value="nam">Nam</option>
              <option value="nu">Nữ</option>
              <option value="khac">Khác</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nhóm máu
            <select value={form.nhom_mau} onChange={(event) => setForm({ ...form, nhom_mau: event.target.value as FormState['nhom_mau'] })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              <option value="">Chưa cập nhật</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="AB">AB</option>
              <option value="O">O</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Địa chỉ
            <textarea rows={2} value={form.dia_chi} onChange={(event) => setForm({ ...form, dia_chi: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Dị ứng
            <textarea rows={2} value={form.di_ung} onChange={(event) => setForm({ ...form, di_ung: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Bệnh nền
            <textarea rows={2} value={form.benh_nen} onChange={(event) => setForm({ ...form, benh_nen: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Ghi chú
            <textarea rows={2} value={form.ghi_chu} onChange={(event) => setForm({ ...form, ghi_chu: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
        </div>

        {changedFields.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Xem trước thay đổi ({changedFields.length} trường)</p>
            <div className="mt-2 space-y-1.5">
              {changedFields.map((field) => (
                <div key={field} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
                  <span className="font-semibold">{FIELD_LABELS[field]}:</span>
                  <span className="rounded bg-white/70 px-2 py-0.5 line-through">{displayValue(field, initial[field])}</span>
                  <span>→</span>
                  <span className="rounded bg-white px-2 py-0.5 font-semibold">{displayValue(field, form[field])}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Lý do cập nhật *
          <textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Vd: bệnh nhân báo cập nhật lại số điện thoại liên hệ" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
          <button type="button" onClick={submit} disabled={!canSave} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}
