import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'
import ExamResultModal from '@/components/doctor/ExamResultModal'
import ExamHistoryDetailModal from '@/components/doctor/ExamHistoryDetailModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { subscribeDoctorQueueRealtime } from '@/services/realtime.service'
import type { MucDoThongBaoLeTan } from '@/services/doctor-exam-session.service'
import type { DoctorExamQueueRow, ExamQueueStatus, DoctorAppointmentDetail, RoomStatus, PhongKhamTrangThai, LichChoTiepNhan } from '@/types'
import { formatDate } from '@/utils/format'

const ROOM_STATUS_LABEL: Record<PhongKhamTrangThai, string> = {
  san_sang: 'Sẵn sàng', tam_nghi: 'Tạm nghỉ', dang_don_phong: 'Đang dọn phòng', dang_kham: 'Đang khám',
}
const ROOM_STATUS_COLOR: Record<PhongKhamTrangThai, 'green' | 'yellow' | 'gray' | 'blue'> = {
  san_sang: 'green', tam_nghi: 'gray', dang_don_phong: 'yellow', dang_kham: 'blue',
}

function RoomStatusWidget({ refreshKey = 0 }: { refreshKey?: number }) {
  const [room, setRoom] = useState<RoomStatus | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    doctorAppointmentService.getRoomStatus().then(setRoom).catch(() => {})
  }
  useEffect(load, [refreshKey])

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

function extractApiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || fallback
}

// Tình trạng thời gian của một lượt chờ tiếp nhận, theo mốc rule mục 11.
// Người trễ vẫn được khám và KHÔNG mất tiền — nhãn nói rõ để không ai hiểu thành "từ chối".
function taoLichKhamAoChoLuotOffline(row: DoctorExamQueueRow): DoctorAppointmentDetail {
  return {
    id: row.id,
    ma_lich_hen: null,
    benh_nhan: row.ten_benh_nhan,
    benh_nhan_id: row.ho_so_benh_nhan_id ?? row.id,
    ho_so_benh_nhan_id: row.ho_so_benh_nhan_id ?? null,
    ngay_kham: row.checkin_time,
    gio_kham: '',
    loai_kham: 'clinic',
    chuyen_khoa: null,
    status: 'waiting_record',
    payment_status: 'unpaid',
    gia_kham: 0,
    so_dien_thoai: row.so_dien_thoai ?? '',
    ngay_sinh: row.ngay_sinh ?? null,
    gioi_tinh: row.gioi_tinh === 'nam' ? 'Nam' : row.gioi_tinh === 'nu' ? 'Nữ' : row.gioi_tinh === 'khac' ? 'Khác' : undefined,
    nhom_mau: row.nhom_mau ?? null,
    di_ung: row.di_ung ?? null,
    benh_nen: row.benh_nen ?? null,
    dia_chi: row.dia_chi ?? null,
    ghi_chu: row.ghi_chu ?? null,
    da_co_ket_qua: !!row.ket_qua_id,
    ket_qua_status: row.ket_qua_status as DoctorAppointmentDetail['ket_qua_status'],
  }
}

function nhanThoiDiem(row: LichChoTiepNhan): { text: string; color: 'green' | 'yellow' | 'gray' } {
  if (row.tre_qua_grace) return { text: `Trễ sau ${row.gio_kham} — vẫn khám, xếp sau`, color: 'yellow' }
  if (row.con_trong_grace) return { text: 'Đúng giờ', color: 'green' }
  return { text: 'Đến sớm', color: 'gray' }
}

// Bảng "Chờ tiếp nhận": khách đã đặt lịch hôm nay nhưng chưa có ai bấm tiếp nhận.
// Không có bảng này thì lượt đã thanh toán không có đường nào vào hàng đợi của bác sĩ.
function BangChoTiepNhan({
  rows, loading,
}: {
  rows: LichChoTiepNhan[]
  loading: boolean
}) {
  if (loading) return null
  if (rows.length === 0) return null

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-3">
        <Icon name="clock" className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-slate-800">Chờ tiếp nhận</span>
        <span className="text-xs text-slate-500">
          Khách đã đặt lịch hôm nay, chưa vào hàng đợi. Lễ tân tiếp nhận tại quầy trước khi bác sĩ thao tác.
        </span>
        <span className="ml-auto text-xs font-semibold text-amber-700">{rows.length} lượt</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className={TH}>Khung giờ</th>
              <th className={TH}>Bệnh nhân</th>
              <th className={TH}>Phòng</th>
              <th className={TH}>Thanh toán</th>
              <th className={TH}>Tình trạng</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const thoiDiem = nhanThoiDiem(r)
              return (
                <tr key={r.appointment_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{r.gio_kham}</p>
                    {r.ma_lich_hen && <p className="text-xs text-slate-400">{r.ma_lich_hen}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.ten_benh_nhan}</p>
                    <p className="text-xs text-slate-400">
                      {[r.so_dien_thoai, r.chuyen_khoa].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.phong_kham ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge color={r.payment_status === 'paid' ? 'green' : 'red'}>
                      {r.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={thoiDiem.color}>{thoiDiem.text}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-amber-700">Chờ lễ tân tiếp nhận</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DoctorExamQueue() {
  const navigate = useNavigate()
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
  const [viewHistoryQueueId, setViewHistoryQueueId] = useState<string | null>(null)
  const [choTiepNhan, setChoTiepNhan] = useState<LichChoTiepNhan[]>([])
  const [choTiepNhanLoading, setChoTiepNhanLoading] = useState(true)
  const [roomRefreshKey, setRoomRefreshKey] = useState(0)
  // Báo lễ tân KHÔNG gắn bệnh nhân cụ thể — cần gửi được bất cứ lúc nào (ca khám quá lâu, khám
  // nhanh có thể đưa bệnh nhân tiếp theo vào...), không chỉ khi đang đứng trong phòng khám.
  const [showNotifyReception, setShowNotifyReception] = useState(false)
  const [notifyPriority, setNotifyPriority] = useState<MucDoThongBaoLeTan>('warning')
  const [notifyContent, setNotifyContent] = useState('')
  const [notifySaving, setNotifySaving] = useState(false)
  const [notifyError, setNotifyError] = useState<string | null>(null)
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    // Cảnh báo (chưa thanh toán, ca quá tải) dài hơn một dòng — để lâu hơn cho đọc kịp.
    setTimeout(() => setToast(null), message.length > 60 ? 7000 : 3000)
  }

  function load() {
    setLoading(true); setError(false)
    doctorAppointmentService.getExamQueue()
      .then(setRows).catch(() => setError(true)).finally(() => setLoading(false))
    setChoTiepNhanLoading(true)
    doctorAppointmentService.getPendingCheckin()
      .then(setChoTiepNhan).catch(() => setChoTiepNhan([])).finally(() => setChoTiepNhanLoading(false))
  }
  useEffect(() => {
    load()
    const unsubscribe = subscribeDoctorQueueRealtime(() => {
      load()
    })
    const fallbackRefresh = window.setInterval(load, 15000)

    return () => {
      unsubscribe()
      window.clearInterval(fallbackRefresh)
    }
  }, [])

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
    if (!r.appointment_id) {
      setModalMode('edit')
      setActive(r)
      setActiveAppt(taoLichKhamAoChoLuotOffline(r))
      return
    }
    setModalMode('edit')
    setActive(r); setActiveAppt(null)
    try {
      const appt = await doctorAppointmentService.getById(r.appointment_id)
      setActiveAppt(appt)
    } catch { setActive(null) }
  }

  function closeModal() { setActive(null); setActiveAppt(null) }

  async function sendReceptionNotice() {
    if (!notifyContent.trim()) return
    setNotifySaving(true)
    setNotifyError(null)
    setNotifySuccess(null)
    try {
      await doctorAppointmentService.notifyReceptionGeneral({ muc_do: notifyPriority, noi_dung: notifyContent.trim() })
      setNotifyContent('')
      setNotifySuccess('Đã gửi thông báo cho lễ tân')
      window.setTimeout(() => {
        setShowNotifyReception(false)
        setNotifySuccess(null)
      }, 800)
    } catch (e) {
      setNotifyError(extractApiMessage(e, 'Không gửi được thông báo cho lễ tân'))
    } finally {
      setNotifySaving(false)
    }
  }

  // Hủy ca gồm rất nhiều tình huống khác nhau (khách bỏ về, không đủ điều kiện khám...) —
  // bắt buộc nhập lý do để lưu lại đối chiếu sau này (rule mục 8, LichSuLichHen.ly_do_thay_doi).
  async function handleHuyCa(r: DoctorExamQueueRow) {
    const reason = window.prompt(`Lý do hủy ca của ${r.ten_benh_nhan}`)
    if (!reason?.trim()) return
    await runQueueAction(r.id, (id) => doctorAppointmentService.cancelQueue(id, reason.trim()), 'Đã hủy ca')
  }

  async function runQueueAction(id: string, action: (id: string) => Promise<unknown>, successMsg: string) {
    setActionLoadingId(id)
    try {
      await action(id)
      showToast(successMsg)
      if (action === doctorAppointmentService.intoRoomQueue) {
        navigate(`/doctor/exam/${id}`)
        return
      }
      load()
    } catch (e) {
      showToast(extractApiMessage(e, 'Thao tác thất bại, vui lòng thử lại'), 'error')
    } finally {
      setRoomRefreshKey((value) => value + 1)
      setActionLoadingId(null)
    }
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter) {
        if (r.trang_thai_tong_hop !== statusFilter) return false
      } else if (r.trang_thai_tong_hop === 'da_xong') {
        // C4 — bệnh nhân đã hoàn tất KHÔNG hiện mặc định ở bảng chờ khám nữa (tránh chiếm chỗ,
        // đẩy người đang chờ xuống dưới) — xem lại ở trang "Bệnh nhân đã khám", hoặc lọc rõ
        // "Đã xong" ở đây nếu chỉ cần kiểm tra nhanh trong ca hôm nay.
        return false
      }
      if (kw && !r.ten_benh_nhan.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, search, statusFilter])
  const soDaXongHomNay = useMemo(() => rows.filter((r) => r.trang_thai_tong_hop === 'da_xong').length, [rows])

  return (
    <div>
      <PageHeader title="Hồ sơ chờ khám"
        description="Toàn bộ bệnh nhân (đặt online + vãng lai) đã check-in được gán cho bạn — check-in, gọi, vào phòng, kết thúc khám và nhập hồ sơ.">
        <Button variant="secondary" size="sm" onClick={() => setShowNotifyReception(true)}
          icon={<Icon name="bell" className="h-3.5 w-3.5" />}>
          Báo lễ tân
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/doctor/exam-history')}
          icon={<Icon name="eye" className="h-3.5 w-3.5" />}>
          Bệnh nhân đã khám{soDaXongHomNay > 0 ? ` (${soDaXongHomNay} hôm nay)` : ''}
        </Button>
      </PageHeader>

      <RoomStatusWidget refreshKey={roomRefreshKey} />

      <BangChoTiepNhan rows={choTiepNhan} loading={choTiepNhanLoading} />

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
        {!loading && !error && <span className="ml-auto text-xs text-slate-400">{filtered.length} lượt</span>}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-600">Không tải được hàng đợi.</p>
          <Button variant="secondary" size="sm" onClick={load}>Thử lại</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          <p>Chưa có bệnh nhân nào trong hàng đợi.</p>
          {choTiepNhan.length > 0 && (
            <p className="text-xs text-amber-700">
              {choTiepNhan.length} khách đã đặt lịch hôm nay — bấm “Tiếp nhận” ở bảng trên khi họ có mặt.
            </p>
          )}
          {!statusFilter && soDaXongHomNay > 0 && (
            <p className="text-xs text-slate-400">
              {soDaXongHomNay} bệnh nhân đã khám xong hôm nay — xem ở “Bệnh nhân đã khám”.
            </p>
          )}
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
                      <div className="flex flex-col gap-1 items-start">
                        <Badge color={r.nguon === 'offline' ? 'yellow' : 'blue'}>{r.nguon === 'offline' ? 'Vãng lai' : 'Đặt online'}</Badge>
                        {r.loai_lich_hen === 'tai_kham' ? (
                          <Badge color="purple">🔁 Tái khám</Badge>
                        ) : (
                          <Badge color="blue">📋 Khám bình thường</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.phong_kham ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[r.trang_thai_tong_hop]}>{STATUS_LABEL[r.trang_thai_tong_hop]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.trang_thai_tong_hop === 'dang_cho' && (
                          <>
                            <Button size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => runQueueAction(r.id, doctorAppointmentService.intoRoomQueue, 'Bệnh nhân đã vào phòng')}
                              icon={<Icon name="send" className="h-3.5 w-3.5" />}>Bắt đầu khám</Button>
                            <Button variant="secondary" size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => runQueueAction(r.id, doctorAppointmentService.callQueuePatient, 'Đã gọi bệnh nhân')}
                              icon={<Icon name="bell" className="h-3.5 w-3.5" />}>Gọi bệnh nhân</Button>
                            <Button variant="secondary" size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => handleHuyCa(r)}>Hủy ca</Button>
                          </>
                        )}
                        {r.trang_thai_tong_hop === 'da_goi' && (
                          <>
                            <Button size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => runQueueAction(r.id, doctorAppointmentService.intoRoomQueue, 'Bệnh nhân đã vào phòng')}
                              icon={<Icon name="send" className="h-3.5 w-3.5" />}>Bắt đầu khám</Button>
                            <Button variant="secondary" size="sm" disabled={actionLoadingId === r.id}
                              onClick={() => handleHuyCa(r)}>Hủy ca</Button>
                          </>
                        )}
                        {r.trang_thai_tong_hop === 'trong_phong' && (
                          // Bệnh nhân đã trong phòng — mở trang khám 4 bước (Task 8/9), KHÔNG còn
                          // chuyển thẳng "Kết thúc khám" như luồng cũ: kết thúc ca khám giờ đi qua
                          // màn Xác nhận (StepXacNhan → complete()), tự transaction 3 bản ghi + trả
                          // bệnh nhân kế tiếp — xem docs task-9-brief.md.
                          <Button size="sm"
                            onClick={() => navigate(`/doctor/exam/${r.id}`)}
                            icon={<Icon name="file-text" className="h-3.5 w-3.5" />}>Vào phòng khám</Button>
                        )}
                        {r.trang_thai_tong_hop === 'cho_nhap_ho_so' && (
                          r.appointment_id
                            ? <Button size="sm" onClick={() => openEnterRecord(r)}
                                icon={<Icon name="file-text" className="h-3.5 w-3.5" />}>Nhập hồ sơ</Button>
                            : <Button size="sm" onClick={() => openEnterRecord(r)}
                                icon={<Icon name="file-text" className="h-3.5 w-3.5" />}>Nhập hồ sơ</Button>
                        )}
                        {r.trang_thai_tong_hop === 'cho_xac_nhan' && (
                          <Button variant="success" size="sm" onClick={() => openConfirm(r)}
                            icon={<Icon name="check" className="h-3.5 w-3.5" />}>Xem & xác nhận</Button>
                        )}
                        {r.trang_thai_tong_hop === 'da_xong' && (
                          <Button variant="secondary" size="sm" onClick={() => setViewHistoryQueueId(r.id)}
                            icon={<Icon name="eye" className="h-3.5 w-3.5" />}>Xem hồ sơ</Button>
                        )}
                        {['bo_luot', 'da_huy'].includes(r.trang_thai_tong_hop) && (
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
          queueId={active.appointment_id ? undefined : active.id}
          onConfirmed={() => { closeModal(); load() }} onSaved={() => { closeModal(); load() }}
          onRevisionRequested={() => { closeModal(); load() }} />
      )}

      {viewHistoryQueueId && (
        <ExamHistoryDetailModal queueId={viewHistoryQueueId} onClose={() => setViewHistoryQueueId(null)}
          onAmended={() => { setViewHistoryQueueId(null); load() }} />
      )}

      {/* Báo lễ tân — KHÔNG gắn bệnh nhân cụ thể, gửi được bất cứ lúc nào (VD: ca khám quá lâu,
          khám nhanh hơn dự kiến có thể đưa bệnh nhân tiếp theo vào). */}
      <Modal isOpen={showNotifyReception} onClose={() => setShowNotifyReception(false)} title="Báo lễ tân" size="sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Mức độ ưu tiên</label>
            <select
              value={notifyPriority}
              onChange={(event) => setNotifyPriority(event.target.value as MucDoThongBaoLeTan)}
              className="input w-full"
            >
              <option value="urgent">Khẩn — cần lễ tân xử lý ngay</option>
              <option value="warning">Cần chú ý / điều phối</option>
              <option value="info">Thông tin, không gấp</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nội dung gửi lễ tân</label>
            <textarea
              value={notifyContent}
              onChange={(event) => setNotifyContent(event.target.value)}
              rows={5}
              placeholder="VD: Ca này khám lâu hơn dự kiến, nhờ báo trước cho người đang chờ. Hoặc: Khám nhanh hơn dự kiến, có thể đưa bệnh nhân tiếp theo vào."
              className="input w-full"
            />
          </div>
          {notifyError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{notifyError}</p>}
          {notifySuccess && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notifySuccess}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNotifyReception(false)} className="btn-secondary">
              Hủy
            </button>
            <button
              type="button"
              disabled={notifySaving || !notifyContent.trim()}
              onClick={sendReceptionNotice}
              className="btn-primary disabled:opacity-40"
            >
              {notifySaving ? 'Đang gửi...' : 'Gửi lễ tân'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast — góc trên phải, tự mất sau 3 giây */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}
    </div>
  )
}
