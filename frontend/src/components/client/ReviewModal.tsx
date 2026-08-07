import { useState } from 'react'
import { Star, Sparkles } from 'lucide-react'
import Modal from '@/components/common/Modal'
import type { PendingReviewAppointment } from '@/services/patient-review.service'
import { patientReviewService } from '@/services/patient-review.service'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: PendingReviewAppointment | null
  onSuccess: () => void
}

const CRITERIA_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: 'Chưa hài lòng', color: 'text-red-500 bg-red-50 border-red-200' },
  2: { text: 'Cần cải thiện', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  3: { text: 'Khá tốt', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  4: { text: 'Hài lòng', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  5: { text: 'Tuyệt vời', color: 'text-teal-600 bg-teal-50 border-teal-200' },
}

const QUICK_TAGS = [
  'Bác sĩ ân cần & tận tâm',
  'Thủ tục check-in nhanh',
  'Tư vấn rõ ràng, dễ hiểu',
  'Phòng khám sạch đẹp',
  'Không phải chờ đợi lâu',
]

interface StarSelectorProps {
  label: string
  icon: string
  subLabel?: string
  value: number
  onChange: (val: number) => void
}

function StarSelector({ label, icon, subLabel, value, onChange }: StarSelectorProps) {
  const [hoverVal, setHoverVal] = useState(0)
  const activeVal = hoverVal || value
  const tag = CRITERIA_LABELS[activeVal]

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-xs font-bold text-slate-800">{label}</p>
            {subLabel && <p className="text-[10px] text-slate-400">{subLabel}</p>}
          </div>
        </div>
        {tag && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color}`}>
            {tag.text}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverVal(star)}
            onMouseLeave={() => setHoverVal(0)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${label} - ${star} sao`}
          >
            <Star
              size={22}
              className={`transition-colors ${
                star <= activeVal
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-none text-slate-200'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewModal({ isOpen, onClose, appointment, onSuccess }: ReviewModalProps) {
  const [ratingLeTan, setRatingLeTan] = useState(5)
  const [ratingBacSi, setRatingBacSi] = useState(5)
  const [ratingDichVu, setRatingDichVu] = useState(5)

  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overallAvg = Math.round(((ratingLeTan + ratingBacSi + ratingDichVu) / 3) * 10) / 10

  function handleClose() {
    if (submitting) return
    setRatingLeTan(5)
    setRatingBacSi(5)
    setRatingDichVu(5)
    setComment('')
    setError(null)
    onClose()
  }

  function handleAddTag(tagText: string) {
    if (comment.includes(tagText)) return
    setComment((prev) => (prev ? `${prev}, ${tagText}` : tagText))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appointment || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      await patientReviewService.create({
        appointment_id: appointment.appointment_id,
        so_sao: overallAvg,
        danh_gia_le_tan: ratingLeTan,
        danh_gia_bac_si: ratingBacSi,
        danh_gia_dich_vu: ratingDichVu,
        noi_dung: comment.trim() || undefined,
      })
      handleClose()
      onSuccess()
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Không gửi được đánh giá. Vui lòng thử lại.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!appointment) return null

  const ngayKham = new Date(appointment.ngay_kham).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Đánh giá lượt khám" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Appointment Header */}
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700 font-bold text-xs">
                🩺
              </span>
              <span className="text-sm font-bold text-slate-800">
                {appointment.doctor?.ho_ten || 'Bác sĩ chuyên khoa'}
              </span>
            </div>
            <p className="text-xs text-slate-500 ml-9">
              {appointment.specialty?.ten ? `${appointment.specialty.ten} • ` : ''}
              📅 {ngayKham} ({appointment.gio_kham})
            </p>
          </div>
          {appointment.ma_lich_hen && (
            <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-500 whitespace-nowrap">
              Mã: {appointment.ma_lich_hen}
            </span>
          )}
        </div>

        {/* Multi-Criteria Ratings */}
        <div className="space-y-2.5">
          <StarSelector
            icon="🛎️"
            label="Thủ tục Lễ tân & Check-in"
            subLabel="Tốc độ làm thủ tục, thái độ đón tiếp"
            value={ratingLeTan}
            onChange={setRatingLeTan}
          />
          <StarSelector
            icon="🩺"
            label="Bác sĩ khám & Tư vấn y tế"
            subLabel="Thái độ ân cần, giải thích bệnh rõ ràng"
            value={ratingBacSi}
            onChange={setRatingBacSi}
          />
          <StarSelector
            icon="🏥"
            label="Cơ sở vật chất & Dịch vụ"
            subLabel="Vệ sinh phòng khám, thiết bị hiện đại"
            value={ratingDichVu}
            onChange={setRatingDichVu}
          />
        </div>

        {/* Overall Score Badge */}
        <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-teal-600" />
            <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
              Đánh giá tổng quan lượt khám
            </span>
          </div>
          <span className="text-sm font-black text-teal-700 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-teal-200">
            {overallAvg.toFixed(1)} / 5.0 ⭐
          </span>
        </div>

        {/* Quick Suggestion Tags */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Gợi ý ý kiến nhanh (bấm để chọn)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => {
              const isSelected = comment.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  + {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* Detailed Comment Box */}
        <div className="space-y-1.5">
          <label htmlFor="review-comment" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Nhận xét chi tiết <span className="font-normal normal-case text-slate-400">(không bắt buộc)</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={2.5}
            placeholder="Chia sẻ thêm cảm nhận hoặc góp ý cho phòng khám..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
          <p className="text-right text-[10px] text-slate-400">{comment.length}/500 ký tự</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-xs font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Đang gửi...
              </span>
            ) : (
              'Gửi đánh giá'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
