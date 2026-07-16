import { useState, useMemo } from 'react'
import type { AppointmentItem, AppointmentStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, EXAM_TYPE_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import ConfirmDialog from '@/components/common/ConfirmDialog'

const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow',
  confirmed: 'blue',
  checked_in: 'blue',
  in_progress: 'green',
  waiting_record: 'yellow',
  waiting_doctor_confirm: 'yellow',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  skipped: 'gray',
}
const PAYMENT_COLOR: Record<string, 'yellow' | 'green' | 'gray'> = {
  unpaid: 'yellow', paid: 'green', refunded: 'gray',
}

interface DoctorGroup {
  doctor_id: string
  doctor_name: string
  appointments: AppointmentItem[]
}

interface Props {
  groupedAppointments: DoctorGroup[]
  loading: boolean
  onView: (a: AppointmentItem) => void
  onHistory: (a: AppointmentItem) => void
  onCancel: (a: AppointmentItem, reason: string) => void
  onReschedule: (a: AppointmentItem) => void
  onRestore: (a: AppointmentItem) => void
  onHardDelete: (a: AppointmentItem) => void
}

type TabType = 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'overdue'

export default function DoctorAppointmentGroupList({
  groupedAppointments, loading, onView, onHistory, onCancel, onReschedule, onRestore, onHardDelete
}: Props) {
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [confirmCancel, setConfirmCancel] = useState<AppointmentItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AppointmentItem | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<AppointmentItem | null>(null)

  function toggleDoctor(docId: string) {
    if (expandedDoctor === docId) {
      setExpandedDoctor(null)
    } else {
      setExpandedDoctor(docId)
      setActiveTab('upcoming') // Reset tab when switching doctor
    }
  }

  const categorizedAppointments = useMemo(() => {
    if (!expandedDoctor) return null;
    const group = groupedAppointments.find(g => g.doctor_id === expandedDoctor);
    if (!group) return null;

    const now = new Date().getTime();
    const buckets: Record<TabType, AppointmentItem[]> = {
      upcoming: [], ongoing: [], completed: [], cancelled: [], overdue: []
    };

    group.appointments.forEach(a => {
      const appDate = new Date(`${a.ngay_kham}T${a.gio_kham || '00:00'}:00`);
      const appTime = appDate.getTime();
      const isPast = appTime < now;
      const isOngoing = appTime <= now && appTime > now - 3600 * 1000;
      const isFuture = appTime > now;

      if (a.status === 'completed') {
        buckets.completed.push(a);
      } else if (a.status === 'cancelled') {
        buckets.cancelled.push(a);
      } else if (a.status === 'pending' || a.status === 'confirmed') {
        if (isOngoing) buckets.ongoing.push(a);
        else if (isFuture) buckets.upcoming.push(a);
        else if (isPast) buckets.overdue.push(a);
      }
    });

    // Sort each bucket
    Object.keys(buckets).forEach(key => {
      buckets[key as TabType].sort((a, b) => new Date(`${b.ngay_kham}T${b.gio_kham}`).getTime() - new Date(`${a.ngay_kham}T${a.gio_kham}`).getTime());
    });

    return buckets;
  }, [expandedDoctor, groupedAppointments]);

  if (loading) {
    return <div className="card p-10 text-center text-slate-400">Đang tải lịch hẹn...</div>
  }

  if (groupedAppointments.length === 0) {
    return <div className="card p-10 text-center text-slate-400">Không tìm thấy lịch hẹn.</div>
  }

  return (
    <div className="space-y-4">
      {groupedAppointments.map((group) => {
        const isExpanded = expandedDoctor === group.doctor_id

        return (
          <div key={group.doctor_id} className="card overflow-hidden">
            {/* Accordion Header */}
            <button
              onClick={() => toggleDoctor(group.doctor_id)}
              className="flex w-full items-center justify-between bg-slate-50 px-5 py-4 transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <Icon name="doctor" className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-800">Bác sĩ: {group.doctor_name}</h3>
                  <p className="text-sm text-slate-500">Tổng cộng {group.appointments.length} lịch hẹn</p>
                </div>
              </div>
              <Icon name="chevron-down" className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Accordion Body */}
            {isExpanded && (
              <div className="border-t border-slate-100">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
                  {[
                    { id: 'upcoming', label: 'Sắp diễn ra' },
                    { id: 'ongoing', label: 'Đang diễn ra' },
                    { id: 'completed', label: 'Đã hoàn thành' },
                    { id: 'cancelled', label: 'Đã hủy' },
                    { id: 'overdue', label: 'Quá hạn' },
                  ].map((tab) => {
                    const count = categorizedAppointments ? categorizedAppointments[tab.id as TabType].length : 0;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {tab.label}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.id ? 'bg-brand-200 text-brand-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Tab Content */}
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                        <th className="px-4 py-3 font-medium">Ngày — Giờ</th>
                        <th className="px-4 py-3 font-medium">Loại khám</th>
                        <th className="px-4 py-3 font-medium">Giá</th>
                        <th className="px-4 py-3 font-medium">Trạng thái</th>
                        <th className="px-4 py-3 font-medium">Thanh toán</th>
                        <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categorizedAppointments && categorizedAppointments[activeTab].length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">Không có lịch hẹn trong mục này.</td></tr>
                      ) : categorizedAppointments && categorizedAppointments[activeTab].map(a => (
                        <tr key={a._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {a.benh_nhan}
                            {a.sdt_benh_nhan && <div className="text-xs font-normal text-slate-500">{a.sdt_benh_nhan}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <p>{a.ngay_kham}</p>
                            <p className="text-xs text-slate-400">{a.gio_kham}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={a.loai_kham === 'clinic' ? 'blue' : 'yellow'}>
                              {EXAM_TYPE_LABEL[a.loai_kham]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{formatPrice(a.gia_kham)}</td>
                          <td className="px-4 py-3">
                            <Badge color={STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={PAYMENT_COLOR[a.payment_status] || 'gray'}>{PAYMENT_STATUS_LABEL[a.payment_status]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => onView(a)}
                                className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-brand-50 p-2 text-brand-600 transition-colors hover:bg-brand-100"
                                title="Xem chi tiết"
                              >
                                <Icon name="eye" className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onHistory(a)}
                                className="inline-flex items-center justify-center rounded-lg border border-purple-200 bg-purple-50 p-2 text-purple-600 transition-colors hover:bg-purple-100"
                                title="Xem lịch sử"
                              >
                                <Icon name="clock" className="h-4 w-4" />
                              </button>

                              {(activeTab === 'upcoming' || activeTab === 'ongoing' || activeTab === 'overdue') && (
                                <>
                                  <button
                                    onClick={() => onReschedule(a)}
                                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100"
                                    title="Dời lịch"
                                  >
                                    <Icon name="calendar" className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmCancel(a)}
                                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                                    title="Hủy lịch"
                                  >
                                    <Icon name="x" className="h-4 w-4" />
                                  </button>
                                </>
                              )}

                              {activeTab === 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => setConfirmRestore(a)}
                                    className="inline-flex items-center justify-center rounded-lg border border-green-200 bg-green-50 p-2 text-green-600 transition-colors hover:bg-green-100"
                                    title="Khôi phục"
                                  >
                                    <Icon name="refresh-cw" className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(a)}
                                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                                    title="Xóa cứng"
                                  >
                                    <Icon name="trash" className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Hủy lịch hẹn</h3>
            <p className="mt-2 text-sm text-slate-600">
              Xác nhận hủy lịch hẹn của "{confirmCancel.benh_nhan}"?
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Lý do hủy <span className="text-red-500">*</span></label>
              <textarea
                className="input w-full"
                rows={3}
                placeholder="Nhập lý do hủy lịch..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmCancel(null); setCancelReason('') }}
                className="btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (!cancelReason.trim()) {
                    alert('Vui lòng nhập lý do hủy lịch');
                    return;
                  }
                  onCancel(confirmCancel, cancelReason.trim());
                  setConfirmCancel(null);
                  setCancelReason('');
                }}
                className="btn-danger"
              >
                Hủy lịch
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRestore}
        title="Khôi phục lịch hẹn"
        message={`Bạn có chắc muốn khôi phục lịch hẹn của "${confirmRestore?.benh_nhan}"? Lịch hẹn sẽ chuyển về trạng thái Chờ xác nhận.`}
        confirmText="Khôi phục"
        onConfirm={() => {
          if (confirmRestore) onRestore(confirmRestore)
          setConfirmRestore(null)
        }}
        onCancel={() => setConfirmRestore(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Xóa cứng lịch hẹn"
        message={`Bạn có chắc muốn XÓA VĨNH VIỄN lịch hẹn của "${confirmDelete?.benh_nhan}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa vĩnh viễn"
        onConfirm={() => {
          if (confirmDelete) onHardDelete(confirmDelete)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
