import { useEffect, useState } from 'react'
import type { ServiceItem, ServiceFormData, ServiceType } from '@/types'
import Icon from '@/components/admin/icons'
import { specialtyService } from '@/services/specialty.service'

// 13 quận/huyện nội thành Hà Nội
// Khi gắn BE: có thể mở rộng thành 30 quận/huyện
const HN_DISTRICTS = [
  'Hoàn Kiếm', 'Ba Đình',     'Đống Đa',   'Hai Bà Trưng',
  'Hoàng Mai',  'Thanh Xuân',  'Nam Từ Liêm', 'Bắc Từ Liêm',
  'Tây Hồ',    'Cầu Giấy',   'Long Biên',  'Hà Đông', 'Gia Lâm',
]

const EMPTY_FORM: ServiceFormData = {
  ten: '', loai: 'related', gia: 0,
  mo_ta_ngan: '', mo_ta: '',
  chuan_bi_truoc: '',
  specialty_id: null, khu_vuc: [],
}

// ─── Validation theo 13 rule từ tài liệu ─────────────────────────────────────
function validate(data: ServiceFormData): Record<string, string> {
  const e: Record<string, string> = {}
  const tenTrimmed = data.ten.trim()
  if (!tenTrimmed)              e.ten = 'Vui lòng nhập tên dịch vụ'
  else if (tenTrimmed.length > 255) e.ten = 'Tên không vượt quá 255 ký tự'
  if (!data.gia || data.gia <= 0)          e.gia = 'Giá phải lớn hơn 0'
  else if (!Number.isInteger(data.gia))    e.gia = 'Giá phải là số nguyên (VNĐ)'
  else if (data.gia > 100_000_000)         e.gia = 'Giá không vượt quá 100 triệu'
  if (data.loai === 'related' && !data.specialty_id) e.specialty_id = 'Dịch vụ liên quan bắt buộc chọn chuyên khoa'
  if (data.loai === 'home') {
    if (!data.gio_dat_truoc_toi_thieu || data.gio_dat_truoc_toi_thieu < 1) e.gio_dat_truoc_toi_thieu = 'Tối thiểu đặt trước 1 giờ'
    else if (data.gio_dat_truoc_toi_thieu > 48) e.gio_dat_truoc_toi_thieu = 'Tối đa đặt trước 48 giờ'
    if (!data.khu_vuc || data.khu_vuc.length === 0) e.khu_vuc = 'Chọn ít nhất 1 khu vực phục vụ'
  }
  if (data.loai === 'related' && data.chuan_bi_truoc && data.chuan_bi_truoc.trim().length > 1000)
    e.chuan_bi_truoc = 'Hướng dẫn chuẩn bị không vượt 1000 ký tự'
  if (data.mo_ta_ngan && data.mo_ta_ngan.length > 500) e.mo_ta_ngan = 'Mô tả ngắn không vượt 500 ký tự'
  if (data.mo_ta && data.mo_ta.length > 5000)           e.mo_ta    = 'Mô tả không vượt 5000 ký tự'
  return e
}

interface Props {
  open: boolean
  service: ServiceItem | null   // null = Thêm mới, ServiceItem = Sửa
  onClose: () => void
  onSave: (data: ServiceFormData, mo_ta_thay_doi?: string) => Promise<void>
}

export default function ServiceFormModal({ open, service, onClose, onSave }: Props) {
  const isEdit = service !== null
  const [form, setForm]           = useState<ServiceFormData>(EMPTY_FORM)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [motaThayDoi, setMotaThayDoi] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [specialties, setSpecialties] = useState<{ id: string; ten: string }[]>([])

  useEffect(() => {
    specialtyService.getAll().then(setSpecialties).catch(() => {})
  }, [])

  // Populate form khi mở / đổi service
  useEffect(() => {
    if (!open) return
    if (service) {
      setForm({
        ten: service.ten,
        loai: service.loai,
        gia: service.gia,
        mo_ta_ngan: service.mo_ta_ngan ?? '',
        mo_ta: service.mo_ta ?? '',
        chuan_bi_truoc: service.chuan_bi_truoc ?? '',
        gio_dat_truoc_toi_thieu: service.gio_dat_truoc_toi_thieu ?? undefined,
        specialty_id: service.specialty_id ?? null,
        khu_vuc: service.khu_vuc ?? [],
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setMotaThayDoi('')
  }, [open, service])

  function handleLoaiChange(loai: ServiceType) {
    setForm((f) => ({
      ...f,
      loai,
      // Khi chuyển sang home: giữ lại gio_dat_truoc_toi_thieu nếu đã có, không reset về 4
      gio_dat_truoc_toi_thieu: loai === 'home' ? (f.gio_dat_truoc_toi_thieu ?? 4) : undefined,
      khu_vuc: loai === 'home' ? (f.khu_vuc ?? []) : [],
      // Khi chuyển sang home: xóa chuan_bi_truoc (home không dùng)
      // Khi chuyển sang related: giữ lại nếu đã nhập
      chuan_bi_truoc: loai === 'home' ? '' : (f.chuan_bi_truoc ?? ''),
    }))
  }

  function setField(field: keyof ServiceFormData, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  function toggleDistrict(district: string, checked: boolean) {
    const current = form.khu_vuc ?? []
    setField('khu_vuc', checked ? [...current, district] : current.filter((k) => k !== district))
  }

  async function handleSubmit() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      await onSave(form, isEdit ? motaThayDoi : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? `Sửa dịch vụ — ${service.ma_dich_vu}` : 'Thêm dịch vụ mới'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">

          {/* Mã dịch vụ — readonly */}
          <FormField label="Mã dịch vụ">
            <input
              type="text"
              value={isEdit ? service.ma_dich_vu : 'Tự động'}
              disabled
              className="input w-full cursor-not-allowed bg-slate-50 text-slate-400"
            />
          </FormField>

          {/* Tên dịch vụ */}
          <FormField label="Tên dịch vụ" required error={errors.ten}>
            <input
              type="text"
              value={form.ten}
              onChange={(e) => setField('ten', e.target.value)}
              placeholder="VD: Khám tổng quát tại viện"
              maxLength={255}
              className={`input w-full ${errors.ten ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
          </FormField>

          {/* Loại hình — Radio cards */}
          <FormField label="Loại hình" required>
            <div className="grid grid-cols-2 gap-3">
              {([
                {
                  value: 'related' as ServiceType,
                  title: 'Dịch vụ liên quan',
                  desc: 'Xét nghiệm, chẩn đoán hình ảnh… Theo chỉ định bác sĩ, không đặt lịch riêng.',
                },
                {
                  value: 'home' as ServiceType,
                  title: 'Tại nhà',
                  desc: 'Bác sĩ đến nhà bệnh nhân. Slot max 1 người, cần bác sĩ confirm.',
                },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLoaiChange(opt.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.loai === opt.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${
                        form.loai === opt.value
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-slate-300'
                      }`}
                    />
                    <span className="font-medium text-slate-800">{opt.title}</span>
                  </div>
                  <p className="mt-1 pl-[22px] text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </FormField>

          {/* Info: thông số cố định theo loại hình */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Thông số cố định hệ thống</p>
            <p className="text-slate-700">
              Thời lượng:{' '}
              <span className="font-semibold">{form.loai === 'home' ? '60 phút' : '30 phút'}</span>
              {' · '}
              Lịch:{' '}
              <span className="font-semibold">Thứ 2–Thứ 7, 08:00–17:00</span>
            </p>
          </div>

          {/* Chuyên khoa — chỉ hiện với related (home không cần) */}
          {form.loai === 'related' && (
            <FormField label="Chuyên khoa liên quan" required error={errors.specialty_id}>
              <select
                value={form.specialty_id ?? ''}
                onChange={(e) => setField('specialty_id', e.target.value || null)}
                className={`input w-full ${errors.specialty_id ? 'border-red-300' : ''}`}
              >
                <option value="">— Chọn chuyên khoa —</option>
                {specialties.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.ten}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* Giá — hiện với mọi loại */}
          <FormField label="Giá dịch vụ (VNĐ)" required error={errors.gia}>
            <input
              type="number"
              value={form.gia || ''}
              onChange={(e) => setField('gia', Math.floor(Number(e.target.value)))}
              min={1}
              step={1000}
              placeholder="200000"
              className={`input w-full ${errors.gia ? 'border-red-300' : ''}`}
            />
            <p className="mt-1 text-xs text-slate-400">
              {form.loai === 'related'
                ? 'Giá tham khảo — bệnh nhân không đặt lịch riêng cho dịch vụ này'
                : 'Bệnh nhân trả đúng số này khi đặt lịch'}
            </p>
          </FormField>

          {/* Đặt trước — chỉ hiện với home. Thời lượng & lịch áp dụng cố định (60ph, T2–T7 08:00–17:00) */}
          {form.loai === 'home' && (
            <FormField label="Đặt trước tối thiểu (giờ)" required error={errors.gio_dat_truoc_toi_thieu}>
              <input
                type="number"
                value={form.gio_dat_truoc_toi_thieu || ''}
                onChange={(e) => setField('gio_dat_truoc_toi_thieu', Number(e.target.value))}
                min={1}
                max={48}
                className={`input w-full ${errors.gio_dat_truoc_toi_thieu ? 'border-red-300' : ''}`}
              />
              <p className="mt-1 text-xs text-slate-400">Mặc định: 4 giờ. Thời lượng 60 phút, lịch T2–T7 08:00–17:00.</p>
            </FormField>
          )}

          {/* Khu vực hỗ trợ — bắt buộc với home (ít nhất 1 quận) */}
          {form.loai === 'home' && (
            <FormField label="Khu vực phục vụ" required error={errors.khu_vuc}>
              <div className={`grid grid-cols-3 gap-x-4 gap-y-2.5 rounded-xl border p-4 ${errors.khu_vuc ? 'border-red-300' : 'border-slate-200'}`}>
                {HN_DISTRICTS.map((d) => (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={(form.khu_vuc ?? []).includes(d)}
                      onChange={(e) => toggleDistrict(d, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                    />
                    {d}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Giá nên bao gồm phí đi lại. Slot tại nhà tối đa 1 bệnh nhân, bác sĩ cần confirm thủ công.
              </p>
            </FormField>
          )}

          {/* Hướng dẫn chuẩn bị — chỉ với dịch vụ liên quan (related) */}
          {form.loai === 'related' && (
            <FormField label="Hướng dẫn chuẩn bị cho bệnh nhân" error={errors.chuan_bi_truoc}>
              <div className="relative">
                <textarea
                  value={form.chuan_bi_truoc ?? ''}
                  onChange={(e) => setField('chuan_bi_truoc', e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="VD: Nhịn ăn ít nhất 8 giờ trước xét nghiệm máu..."
                  className={`input w-full resize-y ${errors.chuan_bi_truoc ? 'border-red-300' : ''}`}
                />
                <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                  {(form.chuan_bi_truoc ?? '').length}/1000
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Hiển thị cho bệnh nhân trước khi thực hiện (nhịn ăn, tháo trang sức, v.v.). Để trống nếu không cần chuẩn bị.
              </p>
            </FormField>
          )}

          {/* Mô tả ngắn */}
          <FormField label="Mô tả ngắn" error={errors.mo_ta_ngan}>
            <div className="relative">
              <input
                type="text"
                value={form.mo_ta_ngan ?? ''}
                onChange={(e) => setField('mo_ta_ngan', e.target.value)}
                maxLength={500}
                placeholder="Hiển thị trong danh sách dịch vụ"
                className={`input w-full pr-16 ${errors.mo_ta_ngan ? 'border-red-300' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {(form.mo_ta_ngan ?? '').length}/500
              </span>
            </div>
          </FormField>

          {/* Mô tả chi tiết */}
          <FormField label="Mô tả chi tiết" error={errors.mo_ta}>
            <textarea
              value={form.mo_ta ?? ''}
              onChange={(e) => setField('mo_ta', e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Hiển thị trong trang đặt lịch của bệnh nhân"
              className={`input w-full resize-y ${errors.mo_ta ? 'border-red-300' : ''}`}
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">
              {(form.mo_ta ?? '').length}/5000
            </p>
          </FormField>

          {/* Mô tả cập nhật — chỉ hiện khi Sửa */}
          {isEdit && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <label className="mb-1.5 block text-sm font-medium text-blue-800">
                Mô tả cập nhật{' '}
                <span className="font-normal">(ghi vào lịch sử thay đổi)</span>
              </label>
              <div className="relative">
                <textarea
                  value={motaThayDoi}
                  onChange={(e) => setMotaThayDoi(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="VD: Tăng giá từ 200.000đ lên 250.000đ..."
                  className="input w-full resize-none bg-white"
                />
                <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                  {motaThayDoi.length}/300
                </span>
              </div>
              <p className="mt-1.5 text-xs text-blue-600">
                Để trống → ghi mặc định "Cập nhật thông tin dịch vụ"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary disabled:opacity-60"
          >
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper component nội bộ ──────────────────────────────────────────────────
function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
