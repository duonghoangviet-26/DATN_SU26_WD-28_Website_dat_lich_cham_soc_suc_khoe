import { useState, useEffect } from 'react'
import { clinicService } from '@/services/clinic.service'
import Icon from '@/components/admin/icons'
import { useNavigate } from 'react-router-dom'

interface Props {
  specialtyId: string
  specialtyName: string
  onClose: () => void
}

export default function SpecialtyDoctorsModal({ specialtyId, specialtyName, onClose }: Props) {
  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    clinicService.getDoctorsBySpecialty(specialtyId)
      .then((data) => setDoctors(data))
      .catch((err) => console.error('Lỗi lấy danh sách bác sĩ:', err))
      .finally(() => setLoading(false))
  }, [specialtyId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon name="users" className="w-5 h-5 text-brand-500" />
            Bác sĩ thuộc khoa: <span className="text-brand-600">{specialtyName}</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Đang tải danh sách bác sĩ...</div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Chưa có bác sĩ nào thuộc khoa này.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tên bác sĩ</th>
                    <th className="px-4 py-3">Trình độ</th>
                    <th className="px-4 py-3 text-right">Lịch làm việc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors.map((doctor) => (
                    <tr key={doctor._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{doctor.ho_ten}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-block bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-xs font-medium border border-blue-100">
                          {doctor.bang_cap}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            // Chuyển hướng sang trang quản lý lịch hẹn kèm theo doctor_id và tên để lọc
                            navigate(`/admin/appointments?doctor_id=${doctor._id}&doctor_name=${encodeURIComponent(doctor.ho_ten)}`)
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200"
                        >
                          <Icon name="calendar" className="w-3.5 h-3.5" />
                          Xem lịch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
