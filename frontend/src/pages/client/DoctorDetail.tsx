import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'
import { patientBookingService, type PatientBookingDoctor } from '@/services/patient-booking.service'
import { resolveMediaUrl } from '@/utils/media'

export default function DoctorDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [doctor, setDoctor] = useState<PatientBookingDoctor | null>(null)
  const [reviews, setReviews] = useState<any[]>([])

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
        <div className="aspect-[3/4] w-full md:w-56 shrink-0 bg-slate-100 rounded-xl overflow-hidden shadow-inner">
          {resolveMediaUrl(doctor.anh_dai_dien) ? (
            <img src={resolveMediaUrl(doctor.anh_dai_dien) || undefined} alt={doctor.ho_ten} className="h-full w-full object-cover object-top" />
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
              🩺 {doctor.specialties?.length > 0 ? doctor.specialties.map(s => s.ten).join(', ') : 'Chuyên khoa'}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-800">
              {doctor.ho_so_chi_tiet?.chuc_danh ? `${doctor.ho_so_chi_tiet.chuc_danh} ` : ''}{doctor.ho_ten}
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">
              {doctor.ho_so_chi_tiet?.chuc_vu_hien_tai || doctor.bang_cap || 'Bác sĩ Chuyên khoa'}
            </p>

            {doctor.ho_so_chi_tiet?.gioi_thieu_ngan && (
              <p className="text-sm italic text-slate-600 border-l-2 border-brand-300 pl-3 mt-2 mb-2">
                "{doctor.ho_so_chi_tiet.gioi_thieu_ngan}"
              </p>
            )}

            {/* Tags Bằng cấp & Học vị */}
            {doctor.ho_so_chi_tiet?.bang_cap_hoc_vi_tags && doctor.ho_so_chi_tiet.bang_cap_hoc_vi_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {doctor.ho_so_chi_tiet.bang_cap_hoc_vi_tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold border border-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Kinh nghiệm</p>
              <p className="text-sm font-extrabold text-slate-800">{doctor.so_nam_kinh_nghiem} năm làm việc</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Giá khám</p>
              <p className="text-sm font-extrabold text-brand-600">{doctor.gia_kham?.toLocaleString('vi-VN')} đ</p>
            </div>
            {doctor.phong_kham_mac_dinh && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Địa điểm khám</p>
                <p className="text-sm font-extrabold text-slate-800">{doctor.phong_kham_mac_dinh}</p>
              </div>
            )}
          </div>

          {/* CCHN */}
          {doctor.ho_so_chi_tiet?.ma_cchn && (
            <div className="mt-1 text-xs text-slate-500">
              <p><strong>Mã CCHN:</strong> <span className="font-mono text-slate-700">{doctor.ho_so_chi_tiet.ma_cchn}</span></p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link to="/booking" className="btn-primary px-6 py-2.5 text-sm font-bold shadow-md shadow-brand-100">
              Đặt lịch khám ngay
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: EDUCATION & EXPERIENCE */}
        <div className="lg:col-span-2 space-y-6 text-left">

          {/* Tiểu sử */}
          {doctor.tieu_su && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Tiểu sử & Giới thiệu</h2>
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{doctor.tieu_su}</p>
            </div>
          )}

          {/* Chuyên môn */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase">Chuyên môn</h2>
            <dl className="space-y-4 text-sm">
              {doctor.ho_so_chi_tiet?.chuc_vu_hien_tai && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Chức vụ hiện tại</dt>
                  <dd className="font-medium text-slate-800">{doctor.ho_so_chi_tiet.chuc_vu_hien_tai}</dd>
                </div>
              )}
              {doctor.bang_cap && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Bằng cấp</dt>
                  <dd className="font-medium text-slate-800">{doctor.bang_cap}</dd>
                </div>
              )}
              {doctor.ho_so_chi_tiet?.bang_cap_hoc_vi_tags && doctor.ho_so_chi_tiet.bang_cap_hoc_vi_tags.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Học vị (Tags)</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {doctor.ho_so_chi_tiet.bang_cap_hoc_vi_tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200">{tag}</span>
                    ))}
                  </dd>
                </div>
              )}
              {doctor.ho_so_chi_tiet?.ngon_ngu && doctor.ho_so_chi_tiet.ngon_ngu.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Ngôn ngữ</dt>
                  <dd className="font-medium text-slate-800">{doctor.ho_so_chi_tiet.ngon_ngu.join(', ')}</dd>
                </div>
              )}
              {doctor.ho_so_chi_tiet?.the_manh_chuyen_mon && doctor.ho_so_chi_tiet.the_manh_chuyen_mon.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Thế mạnh</dt>
                  <dd className="font-medium text-slate-800">{doctor.ho_so_chi_tiet.the_manh_chuyen_mon.join(', ')}</dd>
                </div>
              )}
              {doctor.ho_so_chi_tiet?.benh_ly_dieu_tri && doctor.ho_so_chi_tiet.benh_ly_dieu_tri.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <dt className="w-40 shrink-0 text-slate-500">Bệnh lý điều trị</dt>
                  <dd className="font-medium text-slate-800">{doctor.ho_so_chi_tiet.benh_ly_dieu_tri.join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Học vấn & Quá trình đào tạo */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Học vấn & Quá trình đào tạo</h2>
            {doctor.ho_so_chi_tiet?.qua_trinh_dao_tao && doctor.ho_so_chi_tiet.qua_trinh_dao_tao.length > 0 ? (
              <div className="space-y-3">
                {doctor.ho_so_chi_tiet.qua_trinh_dao_tao.map((dt, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start gap-4">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{dt.ten_bang}</p>
                      {dt.truong && <p className="text-xs text-slate-600 font-medium mt-0.5">{dt.truong}</p>}
                    </div>
                    {(dt.tu_nam || dt.den_nam) && (
                      <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-md text-slate-600 border border-slate-200 shrink-0 font-mono">
                        {dt.tu_nam || ''} {dt.den_nam ? `- ${dt.den_nam}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">{doctor.bang_cap || 'Chưa cập nhật chi tiết học vấn.'}</p>
            )}
          </div>

          {/* Quá trình công tác */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Quá trình công tác & Kinh nghiệm</h2>
            {doctor.ho_so_chi_tiet?.qua_trinh_cong_tac && doctor.ho_so_chi_tiet.qua_trinh_cong_tac.length > 0 ? (
              <div className="space-y-3">
                {doctor.ho_so_chi_tiet.qua_trinh_cong_tac.map((ct, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start gap-4">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{ct.chuc_vu || 'Bác sĩ chuyên khoa'}</p>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{ct.noi_cong_tac}</p>
                    </div>
                    {(ct.tu_nam || ct.den_nam) && (
                      <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-md text-slate-600 border border-slate-200 shrink-0 font-mono">
                        {ct.tu_nam || ''} {ct.den_nam ? `- ${ct.den_nam}` : 'Đến nay'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">{doctor.kinh_nghiem || 'Chưa cập nhật chi tiết công tác.'}</p>
            )}
          </div>

          {/* Giải thưởng & Ghi nhận */}
          {doctor.ho_so_chi_tiet?.giai_thuong && doctor.ho_so_chi_tiet.giai_thuong.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Giải thưởng & Danh hiệu ghi nhận</h2>
              <div className="space-y-2.5">
                {doctor.ho_so_chi_tiet.giai_thuong.map((gt, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800">
                      🏆 {gt.ten}
                    </span>
                    {gt.nam && (
                      <span className="text-xs font-medium px-2.5 py-0.5 bg-white text-slate-600 rounded-md border border-slate-200 font-mono">
                        Năm {gt.nam}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PATIENT REVIEWS SUMMARY & LIST */}
        <div className="space-y-6 text-left">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Đánh giá & Nhận xét</h2>
              <span className="text-xs font-semibold text-slate-400">({reviews.length} lượt)</span>
            </div>

            {/* Thống kê điểm số sao tiêu chí Bác sĩ */}
            <div className="rounded-xl bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-4 border border-amber-100/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-amber-600">
                  {doctor.diem_danh_gia ? Number(doctor.diem_danh_gia).toFixed(1) : '5.0'}
                </span>
                <span className="text-amber-500 text-xl font-bold">⭐</span>
              </div>
              <p className="text-xs font-bold text-slate-700">Điểm đánh giá chuyên môn Bác sĩ</p>
              <p className="text-[11px] text-slate-400">
                Dựa trên {doctor.tong_danh_gia || reviews.length} nhận xét của bệnh nhân sau khi hoàn thành khám bệnh.
              </p>
            </div>

            {/* Danh sách nhận xét */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">Nhận xét thực tế từ bệnh nhân</h3>
              
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có lượt đánh giá nào cho bác sĩ này.</p>
              ) : (
                <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                  {reviews.map((r) => {
                    const ratingDoc = r.so_sao || 5
                    return (
                      <div key={r.id || r._id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{r.benh_nhan || 'Bệnh nhân'}</span>
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-[10px] ${i < ratingDoc ? 'text-amber-400' : 'text-slate-200'}`}>⭐</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600 italic">
                          "{r.noi_dung || 'Đã khám thành công và để lại đánh giá.'}"
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
