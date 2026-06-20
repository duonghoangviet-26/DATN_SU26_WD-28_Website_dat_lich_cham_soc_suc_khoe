import { useState, useEffect } from 'react'
import type { SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import Icon from '@/components/admin/icons'

interface Props {
  specialty: SpecialtyItem
  onSaved: (updated: SpecialtyItem) => void
  onCancel: () => void
}

// Form chỉnh sửa chuyên khoa. Slug sẽ tự tính lại ở backend từ tên mới.
export default function EditSpecialty({ specialty, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    ten: specialty.ten,
    mo_ta: specialty.mo_ta ?? '',
    icon_url: specialty.icon_url ?? '',
    thu_tu: specialty.thu_tu,
  })
  const [saving, setSaving] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ten.trim()) {
      setError('Tên chuyên khoa là bắt buộc')
      return
    }
    try {
      setSaving(true)
      setError(null)
      const updated = await hospitalService.updateSpecialty(specialty._id, {
        ten: form.ten.trim(),
        mo_ta: form.mo_ta || undefined,
        icon_url: form.icon_url || undefined,
        thu_tu: form.thu_tu,
      })
      onSaved(updated)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi khi cập nhật'
      setError(msg)
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
        {' '}→ sẽ cập nhật tự động nếu đổi tên
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
          <input
            name="ten"
            value={form.ten}
            onChange={handleChange}
            className="input w-full"
          />
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">URL Icon</label>
          <input
            name="icon_url"
            value={form.icon_url}
            onChange={handleChange}
            className="input w-full"
            placeholder="https://..."
          />
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
