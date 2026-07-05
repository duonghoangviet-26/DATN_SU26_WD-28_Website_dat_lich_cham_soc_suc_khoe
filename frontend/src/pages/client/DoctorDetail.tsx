import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mockDoctors } from '@/mock/doctors'
import { mockReviews } from '@/mock/reviews'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'
import type { DoctorProfile, ReviewItem } from '@/types'

export default function DoctorDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      const docId = Number(id)
      const foundDoctor = mockDoctors.find((d) => d.id === docId && d.loai === 'specialist')
      if (foundDoctor) {
        setDoctor(foundDoctor)
        // Find reviews for this doctor
        const docReviews = mockReviews.filter((r) => r.bac_si === foundDoctor.ho_ten && r.status === 'visible')
        setReviews(docReviews)
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [id])

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

          <div className="grid gap-4 border-y border-slate-50 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Kinh nghiệm</p>
              <p className="text-sm font-extrabold text-slate-800">{doctor.so_nam_kinh_nghiem} năm làm việc</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Phí tư vấn ban đầu</p>
              <p className="text-sm font-extrabold text-brand-600">{doctor.gia_kham.toLocaleString('vi-VN')} đ</p>
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
            <span className="text-xs text-slate-400">
              * Hỗ trợ BHYT Nhà nước & Bảo lãnh bảo hiểm tư nhân
            </span>
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
              <h2 className="text-lg font-bold text-slate-800">Ý kiến bệnh nhân</h2>
              <span className="text-xs font-semibold text-slate-400">({reviews.length} lượt)</span>
            </div>

            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có lượt đánh giá nào cho bác sĩ này.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="space-y-2 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{r.benh_nhan}</span>
                      <span className="text-xs font-bold text-amber-500">{'⭐'.repeat(r.so_sao)}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      "{r.noi_dung}"
                    </p>
                    <p className="text-[10px] text-slate-400">
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
