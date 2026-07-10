import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import PageHeader from '@/components/common/PageHeader'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import { clinicService } from '@/services/clinic.service'
import { serviceService } from '@/services/service.service'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import type { ServiceFormData, ServiceItem } from '@/types'
import { formatPrice } from '@/utils/format'

interface SpecialtyDoctorItem {
  _id: string
  ho_ten: string
  bang_cap: string
  user_id: string | null
}

type ServiceTab = 'all' | 'packages' | 'regular'

const DOI_TUONG_LABEL: Record<string, string> = {
  tre_em: 'Trẻ em',
  nguoi_lon: 'Người lớn',
  gia_dinh: 'Gia đình',
  khong_gioi_han: 'Không giới hạn',
}

export default function ManageServiceSpecialtyDetail() {
  const doctorItemsPerPage = 5
  const serviceItemsPerPage = 8
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [specialty, setSpecialty] = useState<SpecialtyBrowseItem | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [doctors, setDoctors] = useState<SpecialtyDoctorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [doctorPage, setDoctorPage] = useState(1)
  const [servicePage, setServicePage] = useState(1)

  const [formTarget, setFormTarget] = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget] = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const activeTab = (searchParams.get('tab') as ServiceTab) || 'all'

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function triggerReload() {
    setReloadKey((value) => value + 1)
  }

  useEffect(() => {
    if (!slug) return

    let ignore = false
    setLoading(true)

    Promise.all([
      specialtyService.getAdminBySlug(slug),
      serviceService.getAll('related', '', '', 1, 9999),
    ])
      .then(async ([foundSpecialty, serviceResult]) => {
        if (ignore) return

        setLoadError(false)
        if (!foundSpecialty) {
          setNotFound(true)
          return
        }

        const specialtyDoctors = await clinicService.getDoctorsBySpecialty(String(foundSpecialty.id))
        if (ignore) return

        setNotFound(false)
        setSpecialty(foundSpecialty)
        setServices(
          serviceResult.items.filter((service) => service.specialty_id === String(foundSpecialty.id))
        )
        setDoctors(Array.isArray(specialtyDoctors) ? specialtyDoctors : [])
      })
      .catch(() => {
        if (!ignore) {
          setLoadError(true)
          showToast('Không thể tải dữ liệu chuyên khoa', 'error')
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [slug, reloadKey])

  async function handleSave(data: ServiceFormData, moTaThayDoi?: string) {
    try {
      if (formTarget === 'new') {
        await serviceService.create(data)
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        await serviceService.update(formTarget.id, data, moTaThayDoi)
        showToast('Cập nhật dịch vụ thành công')
      }

      setFormTarget(null)
      triggerReload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return

    const wasActive = toggleTarget.status === 'active'
    const serviceId = toggleTarget.id
    setToggleTarget(null)

    try {
      await serviceService.toggle(serviceId)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerReload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  async function handleView(service: ServiceItem) {
    setViewTarget(service)
    setViewLoading(true)

    try {
      const fullService = await serviceService.getById(service.id)
      setViewTarget(fullService)
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  const filteredServices = services.filter((service) => {
    if (activeTab === 'packages') return service.la_goi === true
    if (activeTab === 'regular') return service.la_goi !== true
    return true
  })

  const packageCount = services.filter((service) => service.la_goi === true).length
  const regularCount = services.filter((service) => service.la_goi !== true).length
  const doctorTotalPages = Math.max(1, Math.ceil(doctors.length / doctorItemsPerPage))
  const serviceTotalPages = Math.max(1, Math.ceil(filteredServices.length / serviceItemsPerPage))
  const visibleDoctors = doctors.slice((doctorPage - 1) * doctorItemsPerPage, doctorPage * doctorItemsPerPage)
  const visibleServices = filteredServices.slice((servicePage - 1) * serviceItemsPerPage, servicePage * serviceItemsPerPage)

  useEffect(() => {
    setDoctorPage(1)
  }, [specialty?.id, doctors.length])

  useEffect(() => {
    setServicePage(1)
  }, [activeTab, specialty?.id, filteredServices.length])

  useEffect(() => {
    if (doctorPage > doctorTotalPages) {
      setDoctorPage(doctorTotalPages)
    }
  }, [doctorPage, doctorTotalPages])

  useEffect(() => {
    if (servicePage > serviceTotalPages) {
      setServicePage(serviceTotalPages)
    }
  }, [servicePage, serviceTotalPages])

  if (loading && !specialty) {
    return <div className="py-16 text-center text-slate-400">Đang tải...</div>
  }

  if (loadError && !specialty) {
    return (
      <div className="py-16 text-center">
        <p className="text-base font-medium text-slate-600">Không thể tải dữ liệu chuyên khoa</p>
        <Link to="/admin/services" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          ← Quay lại Quản lý dịch vụ
        </Link>
      </div>
    )
  }

  if (notFound || !specialty) {
    return (
      <div className="py-16 text-center">
        <p className="text-base font-medium text-slate-600">Không tìm thấy chuyên khoa</p>
        <Link to="/admin/services" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          ← Quay lại Quản lý dịch vụ
        </Link>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <div>
        <button
          onClick={() => navigate('/admin/services')}
          className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          ← Quay lại Quản lý dịch vụ
        </button>

        <PageHeader title={`${specialty.icon_url} ${specialty.ten}`} description={specialty.mo_ta}>
          <button onClick={() => setFormTarget('new')} className="btn-primary flex items-center gap-1.5">
            <Icon name="plus" className="h-4 w-4" />
            {activeTab === 'packages' ? 'Thêm gói dịch vụ' : 'Thêm dịch vụ'}
          </button>
        </PageHeader>

        <div className="card mb-6 overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Bác sĩ chuyên khoa này ({doctors.length})</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Danh sách này lấy trực tiếp từ API chuyên khoa. Cập nhật hồ sơ bác sĩ được thực hiện ở trang Quản lý bác sĩ.
            </p>
          </div>

          {doctors.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Chưa có bác sĩ nào thuộc chuyên khoa này
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Bác sĩ
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Trình độ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Lịch
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDoctors.map((doctor) => (
                    <tr key={doctor._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                            <Icon name="doctor" className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{doctor.ho_ten}</div>
                            <div className="text-xs text-slate-400">Dữ liệu thật từ chuyên khoa</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {doctor.bang_cap || 'Chưa cập nhật'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              navigate(
                                `/admin/appointments?doctor_id=${doctor._id}&doctor_name=${encodeURIComponent(doctor.ho_ten)}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-100"
                          >
                            <Icon name="calendar" className="h-3.5 w-3.5" />
                            Lịch hẹn
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/admin/doctor-schedules?doctor_id=${doctor._id}&doctor_name=${encodeURIComponent(doctor.ho_ten)}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            <Icon name="clock" className="h-3.5 w-3.5" />
                            Lịch làm việc
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && doctors.length > doctorItemsPerPage && (
            <TablePaginationFooter
              currentPage={doctorPage}
              totalPages={doctorTotalPages}
              totalItems={doctors.length}
              currentItemCount={visibleDoctors.length}
              itemLabel="bác sĩ"
              pageSize={doctorItemsPerPage}
              onPageChange={setDoctorPage}
            />
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['all', `Tất cả (${services.length})`],
            ['packages', `Gói (${packageCount})`],
            ['regular', `Dịch vụ lẻ (${regularCount})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('tab', value)
                setSearchParams(next)
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === value
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {activeTab === 'packages'
                ? `Gói dịch vụ (${filteredServices.length})`
                : activeTab === 'regular'
                  ? `Dịch vụ lẻ (${filteredServices.length})`
                  : `Dịch vụ liên quan (${filteredServices.length})`}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Mã DV
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tên dịch vụ
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Giá
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {activeTab === 'packages'
                        ? 'Chưa có gói dịch vụ nào cho chuyên khoa này'
                        : activeTab === 'regular'
                          ? 'Chưa có dịch vụ lẻ nào cho chuyên khoa này'
                          : 'Chưa có dịch vụ liên quan nào cho chuyên khoa này'}
                    </td>
                  </tr>
                )}
                {visibleServices.map((service) => {
                  const dim = service.status === 'inactive' ? 'opacity-40' : ''
                  return (
                    <tr key={service.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>
                        {service.ma_dich_vu}
                      </td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-800">{service.ten}</div>
                          {service.la_goi && <Badge color="blue">Gói</Badge>}
                          {service.la_goi && service.doi_tuong_ap_dung && (
                            <Badge color="yellow">
                              {DOI_TUONG_LABEL[service.doi_tuong_ap_dung] ?? service.doi_tuong_ap_dung}
                            </Badge>
                          )}
                        </div>
                        {service.mo_ta_ngan && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                            {service.mo_ta_ngan}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>
                        {formatPrice(service.gia)}
                      </td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={service.status === 'active' ? 'green' : 'gray'}>
                          {service.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleView(service)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                          >
                            Xem
                          </button>
                          <button
                            onClick={() => setFormTarget(service)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => setToggleTarget(service)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              service.status === 'active'
                                ? 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {service.status === 'active' ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredServices.length > serviceItemsPerPage && (
            <TablePaginationFooter
              currentPage={servicePage}
              totalPages={serviceTotalPages}
              totalItems={filteredServices.length}
              currentItemCount={visibleServices.length}
              itemLabel={activeTab === 'packages' ? 'gói dịch vụ' : 'dịch vụ'}
              pageSize={serviceItemsPerPage}
              onPageChange={setServicePage}
            />
          )}
        </div>

        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          initialSpecialtyId={String(specialty.id)}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
        />

        <ServiceViewModal
          open={viewTarget !== null}
          service={viewTarget}
          loadingLog={viewLoading}
          onClose={() => setViewTarget(null)}
          onEdit={handleEditFromView}
        />

        <ConfirmDialog
          open={toggleTarget !== null}
          title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
          message={
            toggleTarget?.status === 'active'
              ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch.`
              : `Dịch vụ "${toggleTarget?.ten}" sẽ hiển thị trở lại.`
          }
          confirmText={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
          danger={toggleTarget?.status === 'active'}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </>
  )
}
