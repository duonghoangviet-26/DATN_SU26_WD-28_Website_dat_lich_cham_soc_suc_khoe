import { useEffect, useState } from 'react'
import type { HospitalItem } from '@/types'
import { clinicService } from '@/services/clinic.service'
import Icon from '@/components/admin/icons'

interface Props {
  clinic?: HospitalItem | null
  loading?: boolean
  onSaved: (updated: HospitalItem) => void
  onCancel: () => void
  onViewLogs: () => void
}

export default function EditClinic({ clinic, loading = false, onSaved, onCancel, onViewLogs }: Props) {
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

  useEffect(() => {
    setForm({
      ten: clinic?.ten ?? '',
      dia_chi: clinic?.dia_chi ?? '',
      so_dien_thoai: clinic?.so_dien_thoai ?? '',
      email: clinic?.email ?? '',
      gio_lam_viec: clinic?.gio_lam_viec ?? '',
      mo_ta: clinic?.mo_ta ?? '',
      logo_url: clinic?.logo_url ?? '',
      ban_do_url: clinic?.ban_do_url ?? '',
    })
    setError(null)
  }, [clinic])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError(null)
      const url = await clinicService.uploadImage(file)
      setForm((prev) => ({ ...prev, logo_url: url }))
    } catch (_) {
      setError('Loi khi tai anh len')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ten.trim()) {
      setError('Ten phong kham la bat buoc')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const updated = await clinicService.saveCurrentClinic(form)
      onSaved(updated)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Loi khi luu thong tin'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {clinic ? 'Thong tin phong kham' : 'Khoi tao thong tin phong kham'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            He thong admin chi quan ly 1 co so duy nhat. Toan bo chuyen khoa se gan vao ban ghi nay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewLogs}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Icon name="clock" className="h-4 w-4" />
            Lich su
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            disabled={saving || loading}
          >
            <Icon name="refresh-cw" className="h-4 w-4" />
            Tai lai
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-slate-400">
          Dang tai thong tin phong kham...
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Ten phong kham <span className="text-red-500">*</span>
              </label>
              <input
                name="ten"
                value={form.ten}
                onChange={handleChange}
                className="input w-full"
                placeholder="VD: VitaFamily Clinic"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Dia chi</label>
              <input
                name="dia_chi"
                value={form.dia_chi}
                onChange={handleChange}
                className="input w-full"
                placeholder="VD: 123 Nguyen Van A, Quan 1, TP.HCM"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">So dien thoai</label>
              <input
                name="so_dien_thoai"
                value={form.so_dien_thoai}
                onChange={handleChange}
                className="input w-full"
                placeholder="0909 123 456"
              />
            </div>

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

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Gio lam viec</label>
              <input
                name="gio_lam_viec"
                value={form.gio_lam_viec}
                onChange={handleChange}
                className="input w-full"
                placeholder="VD: 8:00 - 17:00 Thu 2 - Thu 7"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mo ta</label>
              <textarea
                name="mo_ta"
                value={form.mo_ta}
                onChange={handleChange}
                rows={3}
                className="input w-full resize-none"
                placeholder="Gioi thieu ngan ve phong kham..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Logo</label>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                    <Icon name="hospital" className="h-5 w-5" />
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
                  {uploading && <p className="mt-1 text-xs text-brand-600">Dang tai len...</p>}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">URL ban do</label>
              <input
                name="ban_do_url"
                value={form.ban_do_url}
                onChange={handleChange}
                className="input w-full"
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
                Dat lai
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Dang luu...' : clinic ? 'Luu thay doi' : 'Tao phong kham'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
