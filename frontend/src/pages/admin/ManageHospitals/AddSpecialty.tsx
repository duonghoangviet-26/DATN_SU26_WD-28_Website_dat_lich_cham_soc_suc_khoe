import { useState } from 'react'
import type { SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import Icon from '@/components/admin/icons'

interface Props {
  onSaved: (specialty: SpecialtyItem) => void
  onCancel: () => void
}

// Form thêm chuyên khoa mới. Slug tự sinh ở backend từ tên.
export default function AddSpecialty({ onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ ten: '', mo_ta: '', icon_url: '', thu_tu: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const created = await hospitalService.createSpecialty({
        ten: form.ten.trim(),
        mo_ta: form.mo_ta || undefined,
        icon_url: form.icon_url || undefined,
        thu_tu: form.thu_tu,
      })
      onSaved(created)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi khi thêm chuyên khoa'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Thêm chuyên khoa mới</h2>
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
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tên chuyên khoa <span className="text-red-500">*</span>
          </label>
          <input
            name="ten"
            value={form.ten}
            onChange={handleChange}
            className="input w-full"
            placeholder="VD: Nội khoa"
          />
          <p className="mt-1 text-xs text-slate-400">Slug URL sẽ được tự động tạo từ tên này</p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea
            name="mo_ta"
            value={form.mo_ta}
            onChange={handleChange}
            rows={3}
            className="input w-full resize-none"
            placeholder="Mô tả ngắn về chuyên khoa này..."
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
            {saving ? 'Đang thêm...' : 'Thêm mới'}
          </button>
        </div>
      </form>
    </div>
  )
}
