import { useState } from 'react'
import type { HospitalItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import Icon from '@/components/admin/icons'

interface Props {
  clinic?: HospitalItem | null
  onSaved: (updated: HospitalItem) => void
  onCancel: () => void
}

// Form thêm/sửa thông tin chi nhánh
export default function EditClinic({ clinic, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    ten: clinic?.ten ?? '',
    dia_chi: clinic?.dia_chi ?? '',
    so_dien_thoai: clinic?.so_dien_thoai ?? '',
    email: clinic?.email ?? '',
    gio_lam_viec: clinic?.gio_lam_viec ?? '',
    mo_ta: clinic?.mo_ta ?? '',
    logo_url: clinic?.logo_url ?? '',
    ban_do_url: clinic?.ban_do_url ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      setError(null)
      const url = await hospitalService.uploadImage(file)
      setForm((prev) => ({ ...prev, logo_url: url }))
    } catch (err) {
      setError('Lỗi khi tải ảnh lên')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ten.trim()) {
      setError('Tên chi nhánh là bắt buộc')
      return
    }
    try {
      setSaving(true)
      setError(null)
      let updated: HospitalItem
      if (clinic && clinic._id) {
        updated = await hospitalService.updateClinicInfo(clinic._id, form)
      } else {
        updated = await hospitalService.createClinic(form)
      }
      onSaved(updated)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi khi lưu thông tin'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa thông tin phòng khám</h2>
        <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        {/* Tên */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tên phòng khám <span className="text-red-500">*</span>
          </label>
          <input
            name="ten"
            value={form.ten}
            onChange={handleChange}
            className="input w-full"
            placeholder="VD: VitaFamily Clinic"
          />
        </div>

        {/* Địa chỉ */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Địa chỉ</label>
          <input
            name="dia_chi"
            value={form.dia_chi}
            onChange={handleChange}
            className="input w-full"
            placeholder="VD: 123 Nguyễn Văn A, Q.1, TP.HCM"
          />
        </div>

        {/* SĐT */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Số điện thoại</label>
          <input
            name="so_dien_thoai"
            value={form.so_dien_thoai}
            onChange={handleChange}
            className="input w-full"
            placeholder="0909 123 456"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="input w-full"
            placeholder="contact@vitafamily.vn"
          />
        </div>

        {/* Giờ làm việc */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Giờ làm việc</label>
          <input
            name="gio_lam_viec"
            value={form.gio_lam_viec}
            onChange={handleChange}
            className="input w-full"
            placeholder="VD: 8:00 – 17:00 Thứ 2 – Thứ 7"
          />
        </div>

        {/* Mô tả */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea
            name="mo_ta"
            value={form.mo_ta}
            onChange={handleChange}
            rows={3}
            className="input w-full resize-none"
            placeholder="Giới thiệu ngắn về phòng khám..."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">URL Bản đồ (Google Maps embed)</label>
          <input
            name="ban_do_url"
            value={form.ban_do_url}
            onChange={handleChange}
            className="input w-full"
            placeholder="https://maps.google.com/..."
          />
        </div>

        {/* Buttons */}
        <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
            Huỷ
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  )
}
