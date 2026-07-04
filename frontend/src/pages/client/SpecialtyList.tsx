import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { specialtyService, type SpecialtyBrowseItem } from '@/services/specialty.service'
import PageHeader from '@/components/common/PageHeader'

export default function SpecialtyList() {
  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    specialtyService
      .getAllActive()
      .then((data) => {
        if (!ignore) setSpecialties(data)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div>
      <PageHeader title="Khám Chuyên khoa" description="Chọn chuyên khoa để xem danh sách bác sĩ." />

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specialties.map((s) => (
            <Link key={s.id} to={`/dich-vu/chuyen-khoa/${s.slug}`} className="card-hover p-5 text-center">
              <span className="text-3xl">{s.icon_url}</span>
              <h3 className="mt-2 font-semibold text-slate-800">{s.ten}</h3>
              <p className="mt-1 text-xs text-slate-500">{s.so_bac_si} bác sĩ</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
