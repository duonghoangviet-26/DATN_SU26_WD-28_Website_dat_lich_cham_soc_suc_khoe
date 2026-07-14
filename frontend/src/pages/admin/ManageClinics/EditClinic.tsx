import { useEffect, useState } from 'react'
import type { ClinicItem } from '@/types'
import { clinicService } from '@/services/clinic.service'
import Icon from '@/components/admin/icons'

interface Props {
  clinic?: ClinicItem | null
  loading?: boolean
  onSaved: (updated: ClinicItem) => void
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
      setError('Lỗi khi tải ảnh lên')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ten.trim()) {
      setError('Tên phòng khám là bắt buộc')
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
        'Lỗi khi lưu thông tin'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Chế độ chỉnh sửa
            </span>
            <span className="text-xs font-medium text-slate-400">
              {clinic ? 'Cập nhật cơ sở đang vận hành' : 'Khởi tạo cơ sở đầu tiên'}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-800">
            {clinic ? 'Cập nhật thông tin phòng khám' : 'Khởi tạo thông tin phòng khám'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Giữ thông tin ngắn gọn, rõ ràng để các khu vực admin, doctor và client đều dùng chung một nguồn dữ liệu.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onViewLogs}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Icon name="clock" className="h-4 w-4" />
            Lịch sử
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            disabled={saving || loading}
          >
            <Icon name="x" className="h-4 w-4" />
            Đóng chỉnh sửa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-slate-400">
          Đang tải thông tin phòng khám...
        </div>
      ) : (
        <>
          {error && (
            <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 sm:mx-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên phòng khám" required>
                  <input
                    name="ten"
                    value={form.ten}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="VD: VitaFamily Clinic"
                  />
                </Field>

                <Field label="Giờ làm việc">
                  <input
                    name="gio_lam_viec"
                    value={form.gio_lam_viec}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="08:00 - 20:00 Thứ 2 - Chủ Nhật"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Địa chỉ">
                    <input
                      name="dia_chi"
                      value={form.dia_chi}
                      onChange={handleChange}
                      className="input w-full"
                      placeholder="VD: 123 Nguyễn Văn A, Quận 1, TP.HCM"
                    />
                  </Field>
                </div>

                <Field label="Số điện thoại">
                  <input
                    name="so_dien_thoai"
                    value={form.so_dien_thoai}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="0909 123 456"
                  />
                </Field>

                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="contact@vitafamily.vn"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Mô tả ngắn">
                    <textarea
                      name="mo_ta"
                      value={form.mo_ta}
                      onChange={handleChange}
                      rows={4}
                      className="input w-full resize-none"
                      placeholder="Giới thiệu ngắn về phòng khám, định hướng và thế mạnh vận hành..."
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logo và nhận diện</p>
                  <div className="mt-4 flex items-center gap-3">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                        <Icon name="hospital" className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-semibold file:text-brand-600 hover:file:bg-brand-100"
                        disabled={uploading}
                      />
                      <p className="mt-2 text-xs text-slate-400">
                        {uploading ? 'Đang tải logo lên...' : 'Nên dùng ảnh vuông, nền rõ và kích thước nhẹ.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <Field label="URL bản đồ">
                    <input
                      name="ban_do_url"
                      value={form.ban_do_url}
                      onChange={handleChange}
                      className="input w-full"
                      placeholder="https://maps.google.com/..."
                    />
                  </Field>
                  <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-500">
                    Link bản đồ sẽ được dùng để mở nhanh vị trí phòng khám tại các màn hình thông tin.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Xem nhanh</p>
                  <div className="mt-3 space-y-3 text-sm">
                    <InfoRow label="Tên hiển thị" value={form.ten || 'Chưa nhập'} />
                    <InfoRow label="Liên hệ" value={form.so_dien_thoai || form.email || 'Chưa cập nhật'} />
                    <InfoRow label="Trạng thái" value={clinic ? 'Đang vận hành' : 'Chưa khởi tạo'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6 lg:col-span-2">
              <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
                Hủy
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Đang lưu...' : clinic ? 'Lưu thay đổi' : 'Tạo phòng khám'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  )
}
