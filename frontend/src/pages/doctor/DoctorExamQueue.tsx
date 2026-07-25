import { useEffect, useMemo, useState, type FormEvent } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import ExamResultModal from '@/components/doctor/ExamResultModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import type { DoctorExamQueueRow, ExamQueueStatus, DoctorAppointmentDetail, RoomStatus, PhongKhamTrangThai } from '@/types'
import { formatDate } from '@/utils/format'

const ROOM_STATUS_LABEL: Record<PhongKhamTrangThai, string> = {
  san_sang: 'Sẵn sàng', tam_nghi: 'Tạm nghỉ', dang_don_phong: 'Đang dọn phòng', dang_kham: 'Đang khám',
}
const ROOM_STATUS_COLOR: Record<PhongKhamTrangThai, 'green' | 'yellow' | 'gray' | 'blue'> = {
  san_sang: 'green', tam_nghi: 'gray', dang_don_phong: 'yellow', dang_kham: 'blue',
}

function RoomStatusWidget() {
  const [room, setRoom] = useState<RoomStatus | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    doctorAppointmentService.getRoomStatus().then(setRoom).catch(() => {})
  }
  useEffect(load, [])

  async function change(trang_thai: Exclude<PhongKhamTrangThai, 'dang_kham'>) {
    setSaving(true)
    try {
      await doctorAppointmentService.updateRoomStatus(trang_thai)
      load()
    } catch {
      // im lặng — ràng buộc chuyển trạng thái do backend chốt (vd không thể tạm nghỉ khi còn bệnh nhân)
    } finally {
      setSaving(false)
    }
  }

  if (!room) return null
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
      <span className="text-xs font-semibold text-slate-500">Trạng thái phòng khám</span>
      <Badge color={ROOM_STATUS_COLOR[room.trang_thai]}>{ROOM_STATUS_LABEL[room.trang_thai]}</Badge>
      {room.phong_kham && <span className="text-xs text-slate-400">Phòng {room.phong_kham}</span>}
      <div className="ml-auto flex gap-2">
        <Button variant="secondary" size="sm" disabled={saving || room.trang_thai === 'san_sang'} onClick={() => change('san_sang')}>Sẵn sàng</Button>
        <Button variant="secondary" size="sm" disabled={saving || room.trang_thai === 'tam_nghi'} onClick={() => change('tam_nghi')}>Tạm nghỉ</Button>
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<ExamQueueStatus, string> = {
  dang_cho: 'Đang chờ', da_goi: 'Đã gọi', trong_phong: 'Trong phòng',
  cho_nhap_ho_so: 'Chờ nhập hồ sơ', cho_xac_nhan: 'Chờ bạn xác nhận',
  da_xong: 'Đã xong', bo_luot: 'Bỏ lượt', da_huy: 'Đã hủy',
}
// Badge chỉ nhận màu thuộc union cố định của component — không phải string tuỳ ý.
const STATUS_COLOR: Record<ExamQueueStatus, 'green' | 'red' | 'blue' | 'yellow' | 'gray'> = {
  dang_cho: 'gray', da_goi: 'blue', trong_phong: 'blue',
  cho_nhap_ho_so: 'yellow', cho_xac_nhan: 'green', da_xong: 'green', bo_luot: 'gray', da_huy: 'red',
}
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

export default function DoctorExamQueue() {
  const [rows, setRows] = useState<DoctorExamQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | ExamQueueStatus>('')
  const [active, setActive] = useState<DoctorExamQueueRow | null>(null)
  const [activeAppt, setActiveAppt] = useState<DoctorAppointmentDetail | null>(null)
  const [modalMode, setModalMode] = useState<'edit' | 'confirm'>('confirm')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinName, setCheckinName] = useState('')
  const [checkinPhone, setCheckinPhone] = useState('')
  const [checkinSaving, setCheckinSaving] = useState(false)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function load() {
    setLoading(true); setError(false)
    doctorAppointmentService.getExamQueue()
      .then(setRows).catch(() => setError(true)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  // Chỉ mở modal xác nhận khi tới bước của bác sĩ (đã có ket_qua_id + đang chờ xác nhận).
  async function openConfirm(r: DoctorExamQueueRow) {
    if (!r.appointment_id) {
      // Offline: xác nhận trực tiếp theo ket_qua_id (chưa dựng modal chi tiết offline ở đợt này).
      if (!r.ket_qua_id) return
      await doctorAppointmentService.confirmResultByRecord(r.ket_qua_id)
      load(); return
    }
    setModalMode('confirm')
    setActive(r); setActiveAppt(null)
    try {
      const appt = await doctorAppointmentService.getById(r.appointment_id)
      setActiveAppt(appt)
    } catch { setActive(null) }
  }

  // Mở modal nhập hồ sơ (mode="edit") cho lượt đang chờ nhập hồ sơ — chỉ hỗ trợ lượt online
  // (có appointment_id); lượt vãng lai (offline) chưa có luồng nhập hồ sơ đầy đủ ở đợt này.
  async function openEnterRecord(r: DoctorExamQueueRow) {
    if (!r.appointment_id) return
    setModalMode('edit')
    setActive(r); setActiveAppt(null)
    try {
      const appt = await doctorAppointmentService.getById(r.appointment_id)
      setActiveAppt(appt)
    } catch { setActive(null) }
  }

  function closeModal() { setActive(null); setActiveAppt(null) }

  async function runQueueAction(id: string, action: (id: string) => Promise<unknown>, successMsg: string) {
    setActionLoadingId(id)
    try {
      await action(id)
      showToast(successMsg)
      load()
    } catch {
      showToast('Thao tác thất bại, vui lòng thử lại', 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleCheckin(e: FormEvent) {
    e.preventDefault()
    if (!checkinName.trim() || !checkinPhone.trim()) return
    setCheckinSaving(true)
    try {
      await doctorAppointmentService.checkinQueue({ ten_benh_nhan: checkinName.trim(), so_dien_thoai: checkinPhone.trim() })
      showToast('Đã check-in bệnh nhân')
      setShowCheckin(false); setCheckinName(''); setCheckinPhone('')
      load()
    } catch {
      showToast('Không check-in được, vui lòng thử lại', 'error')
    } finally {
      setCheckinSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && r.trang_thai_tong_hop !== statusFilter) return false
      if (kw && !r.ten_benh_nhan.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, search, statusFilter])

  return (
    <div>
      <PageHeader title="Hồ sơ chờ khám"
        description="Toàn bộ bệnh nhân (đặt online + vãng lai) đã check-in được gán cho bạn — check-in, gọi, vào phòng, kết thúc khám và nhập hồ sơ." />

      <RoomStatusWidget />

      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên bệnh nhân..." className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Trạng thái</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | ExamQueueStatus)} className="input w-auto min-w-[170px]">
            <option value="">Tất cả</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowCheckin((v) => !v)}
          icon={<Icon name="plus" className="h-3.5 w-3.5" />}>Check-in vãng lai</Button>
        {!loading && !error && <span className="ml-auto text-xs text-slate-400">{filtered.length} lượt</span>}
      </div>

      {showCheckin && (
        <form onSubmit={handleCheckin} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tên bệnh nhân</label>
            <input value={checkinName} onChange={(e) => setCheckinName(e.target.value)} required className="input w-full" />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Số điện thoại</label>
            <input value={checkinPhone} onChange={(e) => setCheckinPhone(e.target.value)} required className="input w-full" />
          </div>
          <Button type="submit" size="sm" disabled={checkinSaving}>{checkinSaving ? 'Đang check-in...' : 'Check-in'}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowCheckin(false)}>Hủy</Button>
        </form>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-600">Không tải được hàng đợi.</p>
          <Button variant="secondary" size="sm" onClick={load}>Thử lại</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          Chưa có bệnh nhân nào trong hàng đợi.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className={TH}>Bệnh nhân</th>
                  <th className={TH}>Nguồn</th>
                  <th className={TH}>Phòng</th>
                  <th className={TH}>Trạng thái</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.ten_benh_nhan}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.checkin_time)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={r.nguon === 'offline' ? 'yellow' : 'blue'}>{r.nguon === 'offline' ? 'Vãng lai' : 'Đặt online'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.phong_kham ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[r.trang_thai_tong_hop]}>{STATUS_LABEL[r.trang_thai_tong_hop]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.trang_thai_tong_hop === 'dang_cho' && (
                          <Button size="sm" disabled={actionLoadingId === r.id}
                            onClick={() => runQueueAction(r.id, doctorAppointmentService.callQueuePatient, 'Đã gọi bệnh nhân')}
                            icon={<Icon name="bell" className="h-3.5 w-3.5" />}>Gọi bệnh nhân</Button>
                        )}
                        {r.trang_thai_tong_hop === 'da_goi' && (
                          <>
                            <Button size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => runQueueAction(r.id, doctorAppointmentService.intoRoomQueue, 'Bệnh nhân đã vào phòng')}
                              icon={<Icon name="send" className="h-3.5 w-3.5" />}>Vào phòng</Button>
                            <Button variant="secondary" size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => runQueueAction(r.id, doctorAppointmentService.skipQueue, 'Đã bỏ lượt')}>Bỏ lượt</Button>
                          </>
                        )}
                        {r.trang_thai_tong_hop === 'trong_phong' && (
                          <Button size="sm" disabled={actionLoadingId === r.id}
                            onClick={() => runQueueAction(r.id, doctorAppointmentService.finishQueue, 'Đã kết thúc khám')}
                            icon={<Icon name="check" className="h-3.5 w-3.5" />}>Kết thúc khám</Button>
                        )}
                        {r.trang_thai_tong_hop === 'cho_nhap_ho_so' && (
                          r.appointment_id
                            ? <Button size="sm" onClick={() => openEnterRecord(r)}
                                icon={<Icon name="file-text" className="h-3.5 w-3.5" />}>Nhập hồ sơ</Button>
                            : <span className="text-xs text-slate-400">Chưa hỗ trợ nhập hồ sơ vãng lai</span>
                        )}
                        {r.trang_thai_tong_hop === 'cho_xac_nhan' && (
                          <Button variant="success" size="sm" onClick={() => openConfirm(r)}
                            icon={<Icon name="check" className="h-3.5 w-3.5" />}>Xem & xác nhận</Button>
                        )}
                        {['da_xong', 'bo_luot', 'da_huy'].includes(r.trang_thai_tong_hop) && (
                          <span className="text-xs text-slate-400">—</span>
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

      {active && activeAppt && (
        <ExamResultModal appt={activeAppt} mode={modalMode} onClose={closeModal}
          onConfirmed={() => { closeModal(); load() }} onSaved={() => { closeModal(); load() }}
          onRevisionRequested={() => { closeModal(); load() }} />
      )}

      {/* Toast — góc trên phải, tự mất sau 3 giây */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}
    </div>
  )
}
