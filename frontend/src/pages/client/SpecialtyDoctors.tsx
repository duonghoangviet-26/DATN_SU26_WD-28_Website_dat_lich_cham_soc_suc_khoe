import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { specialtyService, type SpecialtyBrowseItem } from '@/services/specialty.service'
import { doctorService } from '@/services/doctor.service'
import type { DoctorProfile } from '@/types'
import DoctorCard from '@/components/client/DoctorCard'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

export default function SpecialtyDoctors() {
  const { slug } = useParams<{ slug: string }>()
  const [specialty, setSpecialty] = useState<SpecialtyBrowseItem | null>(null)
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let ignore = false
    setLoading(true)
    Promise.all([specialtyService.getBySlug(slug), doctorService.getBySpecialtySlug(slug)])
      .then(([sp, docs]) => {
        if (ignore) return
        setSpecialty(sp)
        setDoctors(docs)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [slug])

  if (loading) return <p className="text-sm text-slate-500">Đang tải...</p>

  if (!specialty) {
    return (
      <div className="text-center">
        <p className="text-slate-600">Không tìm thấy chuyên khoa.</p>
        <Link to="/dich-vu/chuyen-khoa" className="btn-secondary mt-4 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={`Bác sĩ ${specialty.ten}`} description={specialty.mo_ta} />

      {doctors.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có bác sĩ nào cho chuyên khoa này.</p>
      ) : (
        <div className="grid gap-4">
          {doctors.map((d) => (
            <DoctorCard
              key={d.id}
              doctor={d}
              onBook={() => setToast('Chức năng đặt lịch đang được hoàn thiện, vui lòng quay lại sau.')}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
