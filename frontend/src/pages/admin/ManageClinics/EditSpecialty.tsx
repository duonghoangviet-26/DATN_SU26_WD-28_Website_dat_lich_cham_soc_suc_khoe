import { useEffect, useState } from 'react'
import type { SpecialtyItem } from '@/types'
import { clinicService } from '@/services/clinic.service'
import Icon from '@/components/admin/icons'

interface Props {
  specialty: SpecialtyItem
  onSaved: (updated: SpecialtyItem) => void
  onCancel: () => void
}

export default function EditSpecialty({ specialty, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    ten: specialty.ten,
    mo_ta: specialty.mo_ta || '',
    icon_url: specialty.icon_url || '',
    thu_tu: specialty.thu_tu || 0,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      ten: specialty.ten,
      mo_ta: specialty.mo_ta ?? '',
      icon_url: specialty.icon_url ?? '',
      thu_tu: specialty.thu_tu,
    })
    setError(null)
  }, [specialty])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === 'thu_tu' ? Number(value) : value }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      setError(null)
      const url = await clinicService.uploadImage(file)
      setForm((prev) => ({ ...prev, icon_url: url }))
    } catch (_) {
      setError('Lỗi khi tải ảnh lên')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ten.trim()) {
      setError('Tên chuyên khoa là bắt buộc')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const updated = await clinicService.updateSpecialty(specialty._id, {
        ten: form.ten.trim(),
        mo_ta: form.mo_ta || undefined,
        icon_url: form.icon_url || undefined,
        thu_tu: form.thu_tu,
      })
      onSaved(updated)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Lỗi khi cập nhật'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">
          Chỉnh sửa: <span className="text-brand-600">{specialty.ten}</span>
        </h2>
        <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-500">
        Slug hiện tại: <span className="font-mono font-medium text-slate-700">{specialty.slug}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
             Tên chuyên khoa <span className="text-red-500">*</span>
          </label>
          <input name="ten" value={form.ten} onChange={handleChange} className="input w-full" />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea
            name="mo_ta"
            value={form.mo_ta}
            onChange={handleChange}
            rows={3}
            className="input w-full resize-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Hình ảnh / Icon</label>
          <div className="flex items-center gap-3">
            {form.icon_url ? (
              <img src={form.icon_url} alt="Icon" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <Icon name="image" className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-600 hover:file:bg-brand-100"
                disabled={uploading}
              />
              {uploading && <p className="mt-1 text-xs text-brand-600">Đang tải lên...</p>}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Thứ tự hiển thị</label>
          <input
            name="thu_tu"
            type="number"
            min={0}
            value={form.thu_tu}
            onChange={handleChange}
            className="input w-full"
          />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
            Hủy
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  )
}
