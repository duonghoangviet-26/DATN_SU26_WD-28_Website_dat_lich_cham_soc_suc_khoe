import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import { specialtyService } from '@/services/specialty.service'
import type { ServiceFormData, ServiceItem, ServicePackageType, ServiceTargetAudience } from '@/types'

const EMPTY_FORM: ServiceFormData = {
  ten: '',
  loai: 'related',
  gia: 0,
  mo_ta_ngan: '',
  mo_ta: '',
  chuan_bi_truoc: '',
  specialty_id: null,
  la_goi: false,
  doi_tuong_ap_dung: null,
  loai_goi: null,
  so_nguoi_ap_dung: null,
  dich_vu_con: [],
  phan_tram_giam_gia: null,
  khu_vuc: [],
}

const DOI_TUONG_OPTIONS: { value: ServiceTargetAudience; label: string }[] = [
  { value: 'tre_em', label: 'Trẻ em' },
  { value: 'nguoi_lon', label: 'Người lớn' },
  { value: 'gia_dinh', label: 'Gia đình' },
  { value: 'khong_gioi_han', label: 'Không giới hạn' },
]

const LOAI_GOI_OPTIONS: { value: ServicePackageType; label: string; hint: string }[] = [
  { value: 'goi_don', label: 'Gói đơn', hint: 'Áp dụng cho một người, phù hợp gói cá nhân.' },
  { value: 'goi_gia_dinh', label: 'Gói gia đình', hint: 'Áp dụng cho nhiều thành viên, có mức giảm theo nhóm.' },
]

function validate(data: ServiceFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = data.ten.trim()

  if (!name) errors.ten = 'Vui lòng nhập tên dịch vụ'
  else if (name.length > 255) errors.ten = 'Tên không vượt quá 255 ký tự'

  if (!data.gia || data.gia <= 0) errors.gia = 'Giá phải lớn hơn 0'
  else if (!Number.isInteger(data.gia)) errors.gia = 'Giá phải là số nguyên (VNĐ)'
  else if (data.gia > 100_000_000) errors.gia = 'Giá không vượt quá 100 triệu'

  if (!data.specialty_id) {
    errors.specialty_id = 'Dịch vụ liên quan bắt buộc chọn chuyên khoa'
  }

  if (data.chuan_bi_truoc && data.chuan_bi_truoc.trim().length > 1000) {
    errors.chuan_bi_truoc = 'Hướng dẫn chuẩn bị không vượt quá 1000 ký tự'
  }

  if (data.la_goi) {
    if (!data.loai_goi) errors.loai_goi = 'Vui lòng chọn loại gói'
    if (data.loai_goi === 'goi_gia_dinh') {
      if (!data.so_nguoi_ap_dung || data.so_nguoi_ap_dung < 2) {
        errors.so_nguoi_ap_dung = 'Gói gia đình cần ít nhất 2 người'
      }
    }
    if (data.loai_goi === 'goi_don' && data.so_nguoi_ap_dung && data.so_nguoi_ap_dung !== 1) {
      errors.so_nguoi_ap_dung = 'Gói đơn chỉ áp dụng cho 1 người'
    }
    if (data.phan_tram_giam_gia != null && (data.phan_tram_giam_gia < 0 || data.phan_tram_giam_gia > 90)) {
      errors.phan_tram_giam_gia = 'Phần trăm giảm giá phải từ 0 đến 90'
    }
  }

  if (data.mo_ta_ngan && data.mo_ta_ngan.length > 500) {
    errors.mo_ta_ngan = 'Mô tả ngắn không vượt quá 500 ký tự'
  }

  if (data.mo_ta && data.mo_ta.length > 5000) {
    errors.mo_ta = 'Mô tả không vượt quá 5000 ký tự'
  }

  return errors
}

interface Props {
  open: boolean
  service: ServiceItem | null
  initialSpecialtyId?: string
  onClose: () => void
  onSave: (data: ServiceFormData, mo_ta_thay_doi?: string) => Promise<void>
}

export default function ServiceFormModal({
  open,
  service,
  initialSpecialtyId,
  onClose,
  onSave,
}: Props) {
  const isEdit = service !== null
  const [form, setForm] = useState<ServiceFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [changeNote, setChangeNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [specialties, setSpecialties] = useState<{ id: string; ten: string }[]>([])

  useEffect(() => {
    specialtyService.getAll().then(setSpecialties).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return

    if (service) {
      setForm({
        ten: service.ten,
        loai: 'related',
        gia: service.gia,
        mo_ta_ngan: service.mo_ta_ngan ?? '',
        mo_ta: service.mo_ta ?? '',
        chuan_bi_truoc: service.chuan_bi_truoc ?? '',
        specialty_id: service.specialty_id ?? null,
        la_goi: service.la_goi ?? false,
        doi_tuong_ap_dung: service.doi_tuong_ap_dung ?? null,
        loai_goi: service.loai_goi ?? null,
        so_nguoi_ap_dung: service.so_nguoi_ap_dung ?? null,
        dich_vu_con: service.dich_vu_con ?? [],
        phan_tram_giam_gia: service.phan_tram_giam_gia ?? null,
        khu_vuc: [],
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        specialty_id: initialSpecialtyId ?? null,
      })
    }

    setErrors({})
    setChangeNote('')
  }, [open, service, initialSpecialtyId])

  function setField(field: keyof ServiceFormData, value: unknown) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  async function handleSubmit() {
    const nextErrors = validate(form)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      await onSave(
        {
          ...form,
          loai: 'related',
          khu_vuc: [],
        },
        isEdit ? changeNote : undefined
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? `Sửa dịch vụ - ${service.ma_dich_vu}` : 'Thêm dịch vụ mới'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <FormField label="Mã dịch vụ">
            <input
              type="text"
              value={isEdit ? service.ma_dich_vu : 'Tự động'}
              disabled
              className="input w-full cursor-not-allowed bg-slate-50 text-slate-400"
            />
          </FormField>

          <FormField label="Tên dịch vụ" required error={errors.ten}>
            <input
              type="text"
              value={form.ten}
              onChange={(event) => setField('ten', event.target.value)}
              placeholder="VD: Nội soi tai"
              maxLength={255}
              className={`input w-full ${errors.ten ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
          </FormField>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Phạm vi giao diện hiện tại
            </p>
            <p className="text-slate-700">
              Admin chỉ tạo và sửa <span className="font-semibold">dịch vụ liên quan theo chuyên khoa</span>.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Dịch vụ đặt lịch tại nhà đã ngừng hỗ trợ tạo mới; dữ liệu cũ chỉ dùng để đối soát lịch sử.
            </p>
          </div>

          <FormField label="Chuyên khoa liên quan" required error={errors.specialty_id}>
            <select
              value={form.specialty_id ?? ''}
              onChange={(event) => setField('specialty_id', event.target.value || null)}
              className={`input w-full ${errors.specialty_id ? 'border-red-300' : ''}`}
            >
              <option value="">— Chọn chuyên khoa —</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.ten}
                </option>
              ))}
            </select>
          </FormField>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.la_goi ?? false}
                onChange={(event) => {
                  const checked = event.target.checked
                  setForm((current) => ({
                    ...current,
                    la_goi: checked,
                    doi_tuong_ap_dung: checked ? current.doi_tuong_ap_dung : null,
                    loai_goi: checked ? current.loai_goi ?? 'goi_don' : null,
                    so_nguoi_ap_dung: checked ? current.so_nguoi_ap_dung ?? 1 : null,
                    phan_tram_giam_gia: checked ? current.phan_tram_giam_gia ?? 0 : null,
                    dich_vu_con: checked ? current.dich_vu_con ?? [] : [],
                  }))
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700">Đánh dấu là gói dịch vụ</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Bật tùy chọn này khi dịch vụ là gói theo chuyên khoa, theo đối tượng hoặc theo năm.
                </span>
              </span>
            </label>
          </div>

          {form.la_goi && (
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
              <FormField label="Loại gói" required error={errors.loai_goi}>
                <div className="grid gap-2">
                  {LOAI_GOI_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                        form.loai_goi === option.value
                          ? 'border-brand-300 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        value={option.value}
                        checked={form.loai_goi === option.value}
                        onChange={() => {
                          const nextType = option.value
                          setForm((current) => ({
                            ...current,
                            loai_goi: nextType,
                            so_nguoi_ap_dung: nextType === 'goi_don' ? 1 : Math.max(current.so_nguoi_ap_dung ?? 3, 2),
                            doi_tuong_ap_dung: nextType === 'goi_gia_dinh' ? 'gia_dinh' : current.doi_tuong_ap_dung,
                            phan_tram_giam_gia: nextType === 'goi_gia_dinh'
                              ? current.phan_tram_giam_gia ?? 15
                              : current.phan_tram_giam_gia ?? 0,
                          }))
                        }}
                        className="sr-only"
                      />
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-75">{option.hint}</span>
                    </label>
                  ))}
                </div>
              </FormField>

              <div className="grid gap-4">
                <FormField label="Số người áp dụng" required error={errors.so_nguoi_ap_dung}>
                  <input
                    type="number"
                    value={form.so_nguoi_ap_dung ?? ''}
                    onChange={(event) => setField('so_nguoi_ap_dung', Math.floor(Number(event.target.value)))}
                    min={form.loai_goi === 'goi_gia_dinh' ? 2 : 1}
                    max={12}
                    disabled={form.loai_goi === 'goi_don'}
                    className={`input w-full ${errors.so_nguoi_ap_dung ? 'border-red-300' : ''}`}
                  />
                </FormField>

                <FormField label="Phần trăm giảm giá" error={errors.phan_tram_giam_gia}>
                  <input
                    type="number"
                    value={form.phan_tram_giam_gia ?? ''}
                    onChange={(event) => setField('phan_tram_giam_gia', Math.floor(Number(event.target.value)))}
                    min={0}
                    max={90}
                    className={`input w-full ${errors.phan_tram_giam_gia ? 'border-red-300' : ''}`}
                  />
                </FormField>
              </div>
            </div>
          )}

          <FormField label="Đối tượng áp dụng">
            <select
              value={form.doi_tuong_ap_dung ?? ''}
              onChange={(event) =>
                setField('doi_tuong_ap_dung', event.target.value ? event.target.value as ServiceTargetAudience : null)
              }
              className="input w-full"
              disabled={!(form.la_goi ?? false)}
            >
              <option value="">— Không chọn —</option>
              {DOI_TUONG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Trường này là tùy chọn. Nếu chưa rõ đối tượng áp dụng, có thể để trống.
            </p>
          </FormField>

          <FormField label="Giá dịch vụ (VNĐ)" required error={errors.gia}>
            <input
              type="number"
              value={form.gia || ''}
              onChange={(event) => setField('gia', Math.floor(Number(event.target.value)))}
              min={1}
              step={1000}
              placeholder="200000"
              className={`input w-full ${errors.gia ? 'border-red-300' : ''}`}
            />
            <p className="mt-1 text-xs text-slate-400">
              Giá tham khảo. Bệnh nhân không đặt lịch riêng cho dịch vụ này.
            </p>
          </FormField>

          <FormField label="Hướng dẫn chuẩn bị cho bệnh nhân" error={errors.chuan_bi_truoc}>
            <div className="relative">
              <textarea
                value={form.chuan_bi_truoc ?? ''}
                onChange={(event) => setField('chuan_bi_truoc', event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="VD: Nhịn ăn ít nhất 8 giờ trước xét nghiệm máu..."
                className={`input w-full resize-y ${errors.chuan_bi_truoc ? 'border-red-300' : ''}`}
              />
              <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                {(form.chuan_bi_truoc ?? '').length}/1000
              </span>
            </div>
          </FormField>

          <FormField label="Mô tả ngắn" error={errors.mo_ta_ngan}>
            <div className="relative">
              <input
                type="text"
                value={form.mo_ta_ngan ?? ''}
                onChange={(event) => setField('mo_ta_ngan', event.target.value)}
                maxLength={500}
                placeholder="Hiển thị trong danh sách dịch vụ"
                className={`input w-full pr-16 ${errors.mo_ta_ngan ? 'border-red-300' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {(form.mo_ta_ngan ?? '').length}/500
              </span>
            </div>
          </FormField>

          <FormField label="Mô tả chi tiết" error={errors.mo_ta}>
            <textarea
              value={form.mo_ta ?? ''}
              onChange={(event) => setField('mo_ta', event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Hiển thị trong trang đặt lịch của bệnh nhân"
              className={`input w-full resize-y ${errors.mo_ta ? 'border-red-300' : ''}`}
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">
              {(form.mo_ta ?? '').length}/5000
            </p>
          </FormField>

          {isEdit && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <label className="mb-1.5 block text-sm font-medium text-blue-800">
                Mô tả cập nhật <span className="font-normal">(ghi vào lịch sử thay đổi)</span>
              </label>
              <div className="relative">
                <textarea
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="VD: Cập nhật giá và mô tả dịch vụ..."
                  className="input w-full resize-none bg-white"
                />
                <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                  {changeNote.length}/300
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
