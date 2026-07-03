import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import { serviceService } from '@/services/service.service'
import { doctorService } from '@/services/doctor.service'
import type { ServiceItem, ServiceFormData, DoctorProfile } from '@/types'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'
import DoctorServiceFieldsModal, { type DoctorServiceFieldsData } from '@/components/admin/services/DoctorServiceFieldsModal'

// Tầng 3 — trang chi tiết 1 chuyên khoa trong Quản lý dịch vụ:
// (A) danh sách bác sĩ khoa (nội dung chính — sửa field liên quan dịch vụ + ẩn/hiện tại đây)
// (B) menu dịch vụ liên quan của khoa (CRUD thật, phần phụ)
// Xem docs/superpowers/specs/2026-07-03-admin-service-hierarchy-design.md
export default function ManageServiceSpecialtyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [specialty, setSpecialty] = useState<SpecialtyBrowseItem | null>(null)
  const [notFound, setNotFound]   = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [services, setServices]   = useState<ServiceItem[]>([])
  const [doctors, setDoctors]     = useState<DoctorProfile[]>([])
  const [loading, setLoading]     = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  const [doctorFormTarget, setDoctorFormTarget]     = useState<DoctorProfile | null>(null)
  const [doctorToggleTarget, setDoctorToggleTarget] = useState<DoctorProfile | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function triggerReload() { setReloadKey(k => k + 1) }

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      specialtyService.getBySlug(slug),
      serviceService.getAll('related', '', '', 1, 9999),
      // Lấy toàn bộ (không chỉ approved) vì trang admin cần thấy cả bác sĩ đã ẩn (suspended) để có thể "Hiện" lại.
      // Trang bệnh nhân dùng doctorService.getBySpecialtySlug (chỉ approved) — không đụng tới ở đây.
      doctorService.getAll(),
    ])
      .then(([sp, svcResult, allDocs]) => {
        setLoadError(false)
        if (!sp) { setNotFound(true); return }
        setSpecialty(sp)
        setServices(svcResult.items.filter(s => s.specialty_id === String(sp.id)))
        setDoctors(allDocs.filter(d =>
          d.loai !== 'home_staff' &&
          d.chuyen_khoa === sp.ten &&
          (d.trang_thai_duyet === 'approved' || d.trang_thai_duyet === 'suspended'),
        ))
      })
      .catch(() => { setLoadError(true); showToast('Không thể tải dữ liệu chuyên khoa', 'error') })
      .finally(() => setLoading(false))
  }, [slug, reloadKey])

  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        await serviceService.create(data)
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        await serviceService.update(formTarget.id, data, mo_ta)
        showToast('Cập nhật dịch vụ thành công')
      }
      setFormTarget(null)
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const wasActive = toggleTarget.status === 'active'
    const id = toggleTarget.id
    setToggleTarget(null)
    try {
      await serviceService.toggle(id)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  async function handleDoctorSave(data: DoctorServiceFieldsData) {
    if (!doctorFormTarget) return
    try {
      await doctorService.updateServiceFields(String(doctorFormTarget.id), data)
      showToast('Cập nhật thông tin bác sĩ thành công')
      setDoctorFormTarget(null)
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleDoctorToggleConfirm() {
    if (!doctorToggleTarget) return
    const wasApproved = doctorToggleTarget.trang_thai_duyet === 'approved'
    const id = String(doctorToggleTarget.id)
    setDoctorToggleTarget(null)
    try {
      if (wasApproved) await doctorService.suspend(id)
      else await doctorService.restore(id)
      showToast(wasApproved ? 'Đã ẩn bác sĩ' : 'Đã hiện bác sĩ')
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  async function handleView(service: ServiceItem) {
    setViewTarget(service)
    setViewLoading(true)
    try {
      const full = await serviceService.getById(service.id)
      setViewTarget(full)
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
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
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
            Thêm dịch vụ liên quan
          </button>
        </PageHeader>

        {/* (A) Bác sĩ thuộc khoa — nội dung chính, chỉ xem tham khảo, sửa ở trang Quản lý bác sĩ */}
        <div className="card mb-6 overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Bác sĩ chuyên khoa này ({doctors.length})</h2>
            <p className="mt-0.5 text-xs text-slate-400">Sửa giá khám, bảo hiểm và dịch vụ liên quan tại đây. Sửa hồ sơ bác sĩ (bằng cấp, kinh nghiệm...) ở trang Quản lý bác sĩ.</p>
          </div>
          {doctors.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Chưa có bác sĩ được duyệt thuộc chuyên khoa này</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {doctors.map((d) => {
                const suspended = d.trang_thai_duyet === 'suspended'
                const dim = suspended ? 'opacity-40' : ''
                return (
                <div key={d.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ${dim}`}>
                      <Icon name="doctor" className="h-5 w-5" />
                    </div>
                    <div className={`min-w-[200px] flex-1 ${dim}`}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-800">{d.ho_ten}</div>
                        {suspended && <Badge color="gray">Đã ẩn</Badge>}
                      </div>
                      <div className="text-xs text-slate-400">{d.bang_cap} · {d.so_nam_kinh_nghiem} năm kinh nghiệm</div>
                      {d.kinh_nghiem && <div className="mt-1 text-xs text-slate-500">{d.kinh_nghiem}</div>}
                      {!!d.tuoi_nhan_kham_tu && (
                        <div className="mt-1 text-xs text-slate-400">Bác sĩ nhận khám từ {d.tuoi_nhan_kham_tu} tuổi trở lên</div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        onClick={() => setDoctorFormTarget(d)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => setDoctorToggleTarget(d)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          suspended
                            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        {suspended ? 'Hiện' : 'Ẩn'}
                      </button>
                    </div>
                  </div>

                  <div className={`mt-3 grid gap-4 sm:grid-cols-3 ${dim}`}>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Giá khám</div>
                      <div className="font-semibold text-slate-800">{formatPrice(d.gia_kham)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">Giá khám chưa bao gồm chi phí chụp chiếu, xét nghiệm</div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Dịch vụ liên quan đã áp dụng</div>
                      {d.related_services && d.related_services.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                          {d.related_services.map((rs) => (
                            <li key={rs.id} className="flex justify-between gap-2">
                              <span>{rs.ten}</span>
                              <span className="font-medium">{formatPrice(rs.gia)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1 text-xs text-slate-400">Chưa áp dụng dịch vụ nào</div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Loại bảo hiểm áp dụng</div>
                      <div className="mt-1 space-y-1.5">
                        <div>
                          <Badge color={d.bao_hiem?.nha_nuoc ? 'blue' : 'gray'}>Bảo hiểm y tế nhà nước</Badge>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {d.bao_hiem?.nha_nuoc ? 'Phòng khám có áp dụng bảo hiểm y tế nhà nước' : 'Phòng khám chưa áp dụng bảo hiểm y tế nhà nước'}
                          </div>
                        </div>
                        <div>
                          <Badge color={d.bao_hiem?.bao_lanh ? 'blue' : 'gray'}>Bảo hiểm bảo lãnh</Badge>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {d.bao_hiem?.bao_lanh ? 'Phòng khám có áp dụng bảo hiểm bảo lãnh' : 'Phòng khám chưa áp dụng bảo hiểm bảo lãnh'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* (B) Menu dịch vụ liên quan của khoa — phần phụ, CRUD thật */}
        <div className="card overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Dịch vụ liên quan ({services.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Mã DV</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Tên dịch vụ</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Chưa có dịch vụ liên quan nào cho chuyên khoa này
                    </td>
                  </tr>
                )}
                {services.map((s) => {
                  const dim = s.status === 'inactive' ? 'opacity-40' : ''
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <div className="font-medium text-slate-800">{s.ten}</div>
                        {s.mo_ta_ngan && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                          {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleView(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600">Xem</button>
                          <button onClick={() => setFormTarget(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">Sửa</button>
                          <button
                            onClick={() => setToggleTarget(s)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              s.status === 'active'
                                ? 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {s.status === 'active' ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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

        <DoctorServiceFieldsModal
          open={doctorFormTarget !== null}
          doctor={doctorFormTarget}
          availableServices={services}
          onClose={() => setDoctorFormTarget(null)}
          onSave={handleDoctorSave}
        />

        <ConfirmDialog
          open={doctorToggleTarget !== null}
          title={doctorToggleTarget?.trang_thai_duyet === 'approved' ? 'Ẩn bác sĩ?' : 'Hiện bác sĩ?'}
          message={
            doctorToggleTarget?.trang_thai_duyet === 'approved'
              ? `BS. "${doctorToggleTarget?.ho_ten}" sẽ bị ẩn khỏi danh sách bác sĩ chuyên khoa. Bệnh nhân không thể đặt lịch khám mới.`
              : `BS. "${doctorToggleTarget?.ho_ten}" sẽ hiển thị và nhận đặt lịch trở lại.`
          }
          confirmText={doctorToggleTarget?.trang_thai_duyet === 'approved' ? 'Ẩn bác sĩ' : 'Hiện bác sĩ'}
          danger={doctorToggleTarget?.trang_thai_duyet === 'approved'}
          onConfirm={handleDoctorToggleConfirm}
          onCancel={() => setDoctorToggleTarget(null)}
        />
      </div>
    </>
  )
}
