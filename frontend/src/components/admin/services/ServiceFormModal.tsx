import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import { specialtyService } from '@/services/specialty.service'
import type { ServiceFormData, ServiceItem } from '@/types'

const EMPTY_FORM: ServiceFormData = {
  ten: '',
  loai: 'related',
  gia: 0,
  mo_ta_ngan: '',
  mo_ta: '',
  chuan_bi_truoc: '',
  specialty_id: null,
  khu_vuc: [],
}

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
              Admin hiện chỉ tạo và sửa <span className="font-semibold">dịch vụ liên quan theo chuyên khoa</span>.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tùy chọn dịch vụ khám tại nhà đã được tạm ẩn khỏi UI để không ảnh hưởng luồng đặt lịch phòng khám.
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
