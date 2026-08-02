import { useState } from 'react'
import { Star } from 'lucide-react'
import Modal from '@/components/common/Modal'
import type { PendingReviewAppointment } from '@/services/patient-review.service'
import { patientReviewService } from '@/services/patient-review.service'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: PendingReviewAppointment | null
  onSuccess: () => void
}

const RATING_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: 'Rất không hài lòng', color: 'text-red-500' },
  2: { text: 'Không hài lòng', color: 'text-orange-500' },
  3: { text: 'Bình thường', color: 'text-yellow-500' },
  4: { text: 'Hài lòng', color: 'text-emerald-500' },
  5: { text: 'Rất hài lòng', color: 'text-teal-600' },
}

export default function ReviewModal({ isOpen, onClose, appointment, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRating = hoverRating || rating
  const label = RATING_LABELS[activeRating]

  function handleClose() {
    if (submitting) return
    setRating(5)
    setHoverRating(0)
    setComment('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appointment || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      await patientReviewService.create({
        appointment_id: appointment.appointment_id,
        so_sao: rating,
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Đánh giá lượt khám" size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Appointment info */}
        <div className="rounded-xl bg-slate-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🩺</span>
            <span className="text-sm font-bold text-slate-800">
              {appointment.doctor?.ho_ten || 'Bác sĩ'}
            </span>
          </div>
          {appointment.specialty && (
            <p className="text-xs text-slate-500 ml-6">{appointment.specialty.ten}</p>
          )}
          <div className="flex items-center gap-4 ml-6 text-xs text-slate-500">
            <span>📅 {ngayKham}</span>
            <span>
              🕐 {appointment.gio_kham}
              {appointment.gio_ket_thuc ? ` – ${appointment.gio_ket_thuc}` : ''}
            </span>
          </div>
          {appointment.ma_lich_hen && (
            <p className="text-[10px] text-slate-400 ml-6 font-mono">
              Mã: {appointment.ma_lich_hen}
            </p>
          )}
        </div>

        {/* Star rating */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Mức độ hài lòng
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                aria-label={`${star} sao`}
                aria-pressed={rating === star}
              >
                <Star
                  size={24}
                  className={`transition-colors duration-150 ${
                    star <= activeRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-none text-slate-300'
                  }`}
                />
              </button>
            ))}
            <span className={`ml-2 text-sm font-semibold ${label?.color || 'text-slate-400'}`}>
              {label?.text || ''}
            </span>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label htmlFor="review-comment" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Nhận xét <span className="font-normal normal-case text-slate-400">(không bắt buộc)</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Chia sẻ trải nghiệm khám của bạn..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
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
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
