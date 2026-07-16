import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'
import { patientBookingService, type PatientBookingDoctor } from '@/services/patient-booking.service'
import { useAuth } from '@/context/AuthContext'

export default function DoctorDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [doctor, setDoctor] = useState<PatientBookingDoctor | null>(null)
  const [reviews, setReviews] = useState<any[]>([])

  // Rating form states
  const [submittingReview, setSubmittingReview] = useState(false)
  const [newReviewRating, setNewReviewRating] = useState(5)
  const [newReviewComment, setNewReviewComment] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false
    setLoading(true)

    Promise.all([
      patientBookingService.getDoctorById(id),
      patientBookingService.getDoctorReviews(id)
    ])
      .then(([docData, reviewsList]) => {
        if (!ignore) {
          setDoctor(docData)
          setReviews(reviewsList)
        }
      })
      .catch((err) => {
        console.error('Không tải được thông tin bác sĩ hoặc đánh giá:', err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id])

  async function handleSubmitReview(event: React.FormEvent) {
    event.preventDefault()
    if (!id || !user) return

    setSubmittingReview(true)
    setReviewError(null)
    setReviewSuccess(null)

    try {
      await patientBookingService.createDoctorReview(id, {
        so_sao: newReviewRating,
        noi_dung: newReviewComment.trim()
      })
      setReviewSuccess('Đã gửi đánh giá thành công!')
      setNewReviewComment('')
      setNewReviewRating(5)

      // Reload reviews and doctor info
      const [updatedDoctor, updatedReviews] = await Promise.all([
        patientBookingService.getDoctorById(id),
        patientBookingService.getDoctorReviews(id)
      ])
      setDoctor(updatedDoctor)
      setReviews(updatedReviews)
    } catch (error: any) {
      setReviewError(error.response?.data?.message || error.message || 'Không gửi được đánh giá. Vui lòng kiểm tra lại lịch sử khám.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return <Loading message="Đang tải thông tin bác sĩ chuyên khoa..." />
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 px-4">
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy bác sĩ</h2>
        <p className="text-sm text-slate-400 mt-2">Bác sĩ không tồn tại hoặc đã ngừng công tác tại phòng khám.</p>
        <Link to="/bac-si" className="btn-primary mt-6 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-8">
      <Breadcrumb items={[{ label: 'Bác sĩ', to: '/bac-si' }, { label: doctor.ho_ten }]} />

      {/* DOCTOR GENERAL CARD */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-8 items-start">
        {/* Avatar */}
        <div className="aspect-square w-full md:w-56 shrink-0 bg-slate-100 rounded-xl overflow-hidden shadow-inner">
          {doctor.anh_dai_dien ? (
            <img src={doctor.anh_dai_dien} alt={doctor.ho_ten} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-brand-50 text-brand-600 font-extrabold text-5xl">
              {doctor.ho_ten.split(' ').pop()?.charAt(0)}
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="flex-1 text-left space-y-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
              🩺 Chuyên khoa Tai Mũi Họng
            </span>
            <h1 className="text-2xl font-extrabold text-slate-800">{doctor.ho_ten}</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{doctor.bang_cap}</p>
          </div>

          <div className="grid gap-4 border-y border-slate-50 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Kinh nghiệm</p>
              <p className="text-sm font-extrabold text-slate-800">{doctor.so_nam_kinh_nghiem} năm làm việc</p>
            </div>
            {doctor.phong_kham_mac_dinh && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Địa điểm khám</p>
                <p className="text-sm font-extrabold text-slate-800">{doctor.phong_kham_mac_dinh}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link to={`/booking?doctor_id=${doctor.id}`} className="btn-primary px-6 py-2.5 text-sm font-bold shadow-md shadow-brand-100">
              Đặt lịch khám ngay
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: BIO & EDUCATION */}
        <div className="lg:col-span-2 space-y-6 text-left">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-50 pb-3">Tiểu sử & Kinh nghiệm chuyên môn</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{doctor.kinh_nghiem}</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Bác sĩ thường xuyên tham gia các hội nghị tai mũi họng quốc tế, nghiên cứu các phác đồ mới nhất nhằm hạn chế lạm dụng kháng sinh cho trẻ em trong các bệnh viêm xoang, viêm tai giữa.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-50 pb-3">Bằng cấp & Chứng chỉ hành nghề</h2>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-2">
              <li>Tốt nghiệp hệ chính quy trường Đại học Y Dược lớn.</li>
              <li>Chứng chỉ đào tạo chuyên sâu nội soi Tai Mũi Họng ống mềm thế hệ mới.</li>
              <li>Thành viên thường trực Hội Tai Mũi Họng Việt Nam.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: PATIENT REVIEWS */}
        <div className="space-y-6 text-left">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Đánh giá & Nhận xét</h2>
              <span className="text-xs font-semibold text-slate-400">({reviews.length} lượt)</span>
            </div>

            {/* Form viết đánh giá */}
            <div className="border-b border-slate-50 pb-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gửi đánh giá của bạn</h3>
              
              {!user ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-xs text-slate-500">Đăng nhập để nhận xét cho bác sĩ chuyên khoa.</p>
                  <Link to={`/login?redirect=/bac-si/${doctor.id}`} className="text-xs font-bold text-brand-600 hover:underline mt-1 inline-block">
                    Đăng nhập ngay
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  {/* Chọn số sao */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Số sao:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReviewRating(star)}
                          className="text-lg transition-transform hover:scale-110 focus:outline-none"
                        >
                          {star <= newReviewRating ? '⭐' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nhập nội dung */}
                  <div className="space-y-1">
                    <textarea
                      placeholder="Nhập nhận xét của bạn về bác sĩ sau khi khám..."
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                      maxLength={500}
                      className="w-full text-xs rounded-lg border border-slate-200 p-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition min-h-[70px] resize-none"
                      required
                    />
                  </div>

                  {reviewError && (
                    <p className="text-[11px] font-semibold text-red-650">{reviewError}</p>
                  )}
                  {reviewSuccess && (
                    <p className="text-[11px] font-semibold text-emerald-650">{reviewSuccess}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full btn-primary py-2 text-xs font-bold shadow-sm shadow-brand-100"
                  >
                    {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </form>
              )}
            </div>

            {/* Danh sách nhận xét */}
            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có lượt đánh giá nào cho bác sĩ này.</p>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <div key={r.id || r._id} className="space-y-1.5 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{r.benh_nhan}</span>
                      <span className="text-xs font-bold text-amber-500">{'⭐'.repeat(r.so_sao)}</span>
                    </div>
                    <p className="text-xs text-slate-550 leading-relaxed italic">
                      "{r.noi_dung || 'Không có bình luận.'}"
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {new Date(r.ngay_tao).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
