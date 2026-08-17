import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../services/axiosInstance';
import { receptionistNotificationService, VirtualNotification } from '../../services/receptionist-notification.service';
import Icon from '../../components/admin/icons';
import { format } from 'date-fns';
import { receptionistPaymentService } from '../../services/receptionist-payment.service';
import QueueTransferModal, { QueueTransferCandidate } from '../../components/receptionist/QueueTransferModal';
import QueueCancelModal from '../../components/receptionist/QueueCancelModal';
import { receptionistContactTasksService } from '../../services/receptionist-contact-tasks.service';
import { EmptyBlock, MetricCard, PageShell, Panel, ReceptionistHeader, StatusBadge } from '@/components/receptionist/ReceptionistUI';

interface Appointment {
  _id: string;
  status: string;
  ngay_kham: string;
  gio_kham: string;
  ten_khach?: string;
  so_dien_thoai_khach?: string;
  user_id?: { _id: string; ho_ten: string; so_dien_thoai: string } | null;
  nguoi_dat_ho_ten?: string;
  nguoi_dat_sdt?: string;
  hinh_thuc_dat_lich?: string;
}

interface PendingCheckin {
  appointment_id: string;
  ma_lich_hen?: string | null;
  ten_benh_nhan: string;
  gio_kham: string;
  phong_kham?: string | null;
  payment_status?: string | null;
  tre_qua_grace?: boolean;
}

function notificationTone(notification: VirtualNotification) {
  const priority = notification.du_lieu_dinh_kem?.priority
  if (priority === 'urgent') return 'border-red-200 bg-red-50 text-red-900'
  if (priority === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-100 bg-slate-50 text-slate-800'
}

function notificationLabel(notification: VirtualNotification) {
  const priority = notification.du_lieu_dinh_kem?.priority
  if (priority === 'urgent') return 'Khẩn'
  if (priority === 'warning') return 'Cần xử lý'
  return 'Thông tin'
}

interface DoctorOperationalStatus {
  doctor_id: string;
  ten_bac_si: string;
  phong_kham?: string | null;
  specialties?: Array<{ id: string; ten: string | null }>;
  trang_thai_van_hanh: string;
  so_dang_cho: number;
  thoi_gian_kham_hien_tai_phut?: number | null;
  do_tre_ca_phut?: number;
  nguyen_nhan_do_tre?: string;
  ngung_nhan_walkin?: boolean;
  chan_dat_online?: boolean;
  canh_bao_dieu_phoi?: string | null;
  canh_bao_qua_tai: boolean;
  benh_nhan_hien_tai?: {
    ten_benh_nhan: string;
    ma_so_thu_tu?: string | null;
  } | null;
  luot_cho_bi_anh_huong?: Array<{
    hang_doi_id: string;
    appointment_id?: string | null;
    specialty_id?: string | null;
    ten_benh_nhan: string;
    ma_so_thu_tu?: string | null;
    trang_thai: string;
    nguon: string;
    gio_hen_goc?: string | null;
    thoi_gian_cho_uoc_tinh_phut?: number | null;
    can_dieu_phoi?: boolean;
  }>;
  lich_chua_checkin_bi_anh_huong?: Array<{
    appointment_id: string;
    ma_lich_hen?: string | null;
    ten_benh_nhan: string;
    so_dien_thoai?: string | null;
    gio_kham: string;
    status: string;
    thoi_gian_tre_uoc_tinh_phut?: number;
    can_goi_bao?: boolean;
  }>;
}

export default function Dashboard() {
  const [totalToday, setTotalToday] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [pendingCheckins, setPendingCheckins] = useState<PendingCheckin[]>([]);
  const [doctorStatuses, setDoctorStatuses] = useState<DoctorOperationalStatus[]>([]);
  const [notifications, setNotifications] = useState<VirtualNotification[]>([]);
  
  // Trạng thái cho Tooltip
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Trạng thái cho modal chuyển bác sĩ (E-4)
  const [transferTarget, setTransferTarget] = useState<{
    hangDoiId: string;
    tenBenhNhan: string;
    maSoThuTu?: string | null;
    specialtyId: string | null;
    currentDoctorId: string;
  } | null>(null);
  const [transferMessage, setTransferMessage] = useState('');

  // Trạng thái cho modal đóng lượt khi khách bỏ về (E-11)
  const [cancelTarget, setCancelTarget] = useState<{
    hangDoiId: string;
    tenBenhNhan: string;
    maSoThuTu?: string | null;
  } | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');

  // So viec "can goi khach" chua xu ly (E-3)
  const [chuaGoiCount, setChuaGoiCount] = useState(0);

  const fetchStats = async () => {
    try {
      const res = await axiosInstance.get('/receptionist/appointments?timeframe=today&limit=1000');
      if (res.data.success) {
        const appointments: Appointment[] = res.data.data;
        setAllAppointments(appointments);
        setTotalToday(
          appointments.filter((appointment) => !['cancelled', 'no_show', 'skipped'].includes(appointment.status)).length,
        );
        setWaiting(
          appointments.filter((a) => a.status === 'checked_in').length
        );
      }
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const paymentRes = await receptionistPaymentService.getAll({ from: today, to: today, limit: 1000 });
      setTodayRevenue(paymentRes.summary.paidAmount || 0);
      
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu tổng quan:', err);
    }
  };

  const fetchPendingCheckins = async () => {
    try {
      const res = await axiosInstance.get('/receptionist/appointments/pending-checkin');
      if (res.data.success) setPendingCheckins(res.data.data ?? []);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách chờ tiếp nhận:', err);
    }
  };

  const fetchDoctorStatuses = async () => {
    try {
      const res = await axiosInstance.get('/receptionist/appointments/doctor-statuses');
      if (res.data.success) setDoctorStatuses(res.data.data ?? []);
    } catch (err) {
      console.error('Loi khi lay trang thai bac si:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const notifs = await receptionistNotificationService.getRecentNotifications();
      setNotifications(notifs.slice(0, 5)); // Chỉ lấy 5 cái mới nhất
    } catch (err) {
      console.error('Lỗi khi lấy thông báo:', err);
    }
  };

  const fetchContactTaskCount = async () => {
    try {
      const tasks = await receptionistContactTasksService.list({ trang_thai: 'chua_goi' });
      setChuaGoiCount(tasks.length);
    } catch (err) {
      console.error('Loi khi lay so viec can goi:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPendingCheckins();
    fetchDoctorStatuses();
    fetchNotifications();
    fetchContactTaskCount();

    const intervalId = window.setInterval(() => {
      fetchStats();
      fetchPendingCheckins();
      fetchDoctorStatuses();
      fetchContactTaskCount();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Check-in đưa bệnh nhân vào hàng đợi bác sĩ (rule mục 6) — xem chú thích ở Appointments.tsx.
  // --- Logic Lọc Dữ liệu cho Khung 2 & 3 ---
  

  // Khung 3: Lịch hẹn 4h tới
  const upcomingAppointments = allAppointments.filter((a) => {
    if (a.status !== 'pending' && a.status !== 'confirmed') return false;
    const aptDate = new Date(a.ngay_kham);
    const [h, m] = a.gio_kham.split(':').map(Number);
    aptDate.setHours(h, m, 0, 0);
    
    const diffHours = (aptDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 4;
  });

  const doctorStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      qua_tai_tam_thoi: 'Quá tải',
      san_sang: 'Sẵn sàng',
      dang_kham: 'Đang khám',
      dang_don_phong: 'Đang dọn phòng',
      tam_nghi: 'Tạm nghỉ',
      khong_co_lich: 'Không có lịch',
      nghi_phep: 'Nghỉ phép',
      nghi_viec: 'Nghỉ việc',
    };
    return labels[status] || status;
  };

  const doctorStatusClass = (status: string, overloaded?: boolean) => {
    if (overloaded) return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'qua_tai_tam_thoi') return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'dang_kham') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (status === 'san_sang') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'dang_don_phong') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const formatQueueTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, 'HH:mm');
  };

  // Bác sĩ không thể nhận thêm lượt chuyển đến (khớp nhãn ở doctorStatusLabel).
  const KHONG_THE_NHAN_CHUYEN = ['khong_co_lich', 'tam_nghi', 'nghi_phep', 'nghi_viec'];

  const getTransferCandidates = (specialtyId: string | null, currentDoctorId: string): QueueTransferCandidate[] => {
    return doctorStatuses
      .filter((doctor) => doctor.doctor_id !== currentDoctorId)
      .filter((doctor) => !KHONG_THE_NHAN_CHUYEN.includes(doctor.trang_thai_van_hanh))
      .filter((doctor) => !specialtyId || (doctor.specialties ?? []).some((specialty) => specialty.id === specialtyId))
      .map((doctor) => ({
        doctor_id: doctor.doctor_id,
        ten_bac_si: doctor.ten_bac_si,
        so_dang_cho: doctor.so_dang_cho,
        phong_kham: doctor.phong_kham,
      }));
  };

  const handleTransferred = () => {
    setTransferTarget(null);
    setTransferMessage('Đã chuyển lượt sang bác sĩ khác.');
    fetchDoctorStatuses();
    window.setTimeout(() => setTransferMessage(''), 4000);
  };

  const handleCancelled = () => {
    setCancelTarget(null);
    setCancelMessage('Đã đóng lượt chờ.');
    fetchDoctorStatuses();
    window.setTimeout(() => setCancelMessage(''), 4000);
  };

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Bàn điều phối"
        title="Tổng quan lễ tân"
        description="Theo dõi lịch trong ngày, trạng thái bác sĩ, khách chờ tiếp nhận và các thông báo cần xử lý."
        metrics={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Ca khám hôm nay" value={totalToday} tone="brand" />
            <MetricCard label="Đang chờ khám" value={waiting} tone="warning" />
            <MetricCard
              label="Doanh thu tại quầy"
              value={new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(todayRevenue)}
              detail="Hôm nay"
              tone="success"
            />
          </div>
        }
      />

      {(transferMessage || cancelMessage) && (
        <div className="grid gap-3">
          {transferMessage && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">{transferMessage}</p>}
          {cancelMessage && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">{cancelMessage}</p>}
        </div>
      )}
      {chuaGoiCount > 0 && (
        <Link
          to="/receptionist/contact-tasks"
          className="flex flex-col justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 sm:flex-row sm:items-center"
        >
          <span>Còn {chuaGoiCount} khách cần liên hệ hoặc xác nhận đến khám.</span>
          <span className="shrink-0 underline">Mở liên hệ khách hàng</span>
        </Link>
      )}

      <Panel
        title="Trạng thái vận hành bác sĩ"
        description="Các ca quá tải, lượt đang chờ và lịch chưa check-in cần điều phối."
        action={<span className="text-xs font-semibold text-slate-500">Cập nhật mỗi 30 giây</span>}
        bodyClassName="p-4"
      >
          {doctorStatuses.length === 0 ? (
            <EmptyBlock>Chưa có dữ liệu trạng thái bác sĩ hôm nay.</EmptyBlock>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {doctorStatuses.map((doctor) => (
                <article key={doctor.doctor_id} className={`min-w-0 rounded-lg border p-3 ${doctorStatusClass(doctor.trang_thai_van_hanh, doctor.canh_bao_qua_tai)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{doctor.ten_bac_si}</p>
                      <p className="mt-1 text-xs font-medium opacity-80">{doctor.phong_kham || 'Chưa có phòng'} · {doctor.so_dang_cho} đang chờ</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white/75 px-2 py-1 text-[11px] font-bold">
                      {doctorStatusLabel(doctor.trang_thai_van_hanh)}
                    </span>
                  </div>
                  {doctor.benh_nhan_hien_tai && (
                    <p className="mt-3 text-xs">
                      Đang khám: <span className="font-semibold">{doctor.benh_nhan_hien_tai.ma_so_thu_tu ? `${doctor.benh_nhan_hien_tai.ma_so_thu_tu} · ` : ''}{doctor.benh_nhan_hien_tai.ten_benh_nhan}</span>
                    </p>
                  )}
                  {doctor.thoi_gian_kham_hien_tai_phut !== null && doctor.thoi_gian_kham_hien_tai_phut !== undefined && (
                    <p className="mt-1 text-xs">Thời gian hiện tại: {doctor.thoi_gian_kham_hien_tai_phut} phút</p>
                  )}
                  {(doctor.do_tre_ca_phut ?? 0) > 0 && (
                    <p className="mt-1 text-xs">
                      Ca đang trễ: <span className="font-semibold">{doctor.do_tre_ca_phut} phút</span>
                      {doctor.nguyen_nhan_do_tre === 'trong_phong' ? ' do lượt trong phòng' : ' do hàng đợi'}
                    </p>
                  )}
                  {doctor.canh_bao_qua_tai && (
                    <div className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold">
                      <p>{doctor.canh_bao_dieu_phoi || 'Ca khám đã kéo dài từ 60 phút, cần theo dõi điều phối.'}</p>
                      {(doctor.ngung_nhan_walkin || doctor.chan_dat_online) && (
                        <p className="mt-1 text-[11px]">
                          {doctor.chan_dat_online ? 'Tạm chặn đặt online khung còn lại.' : 'Tạm ngưng nhận walk-in khung còn lại.'}
                        </p>
                      )}
                      <Link
                        to={`/receptionist/appointments?overload_doctor=${doctor.doctor_id}`}
                        className="mt-2 inline-block rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                      >
                        Điều phối ca quá tải
                      </Link>
                    </div>
                  )}
                  {(doctor.luot_cho_bi_anh_huong?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">Slot chờ cần theo dõi</p>
                      {doctor.luot_cho_bi_anh_huong?.slice(0, 3).map((queue) => (
                        <div key={queue.hang_doi_id} className="rounded-lg bg-white/75 px-2 py-1.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-semibold text-slate-800">
                              {queue.ma_so_thu_tu ? `${queue.ma_so_thu_tu} · ` : ''}{queue.ten_benh_nhan}
                            </span>
                            <span className="whitespace-nowrap text-[11px] font-bold">
                              ~{queue.thoi_gian_cho_uoc_tinh_phut ?? 0}p
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] opacity-80">
                            {queue.nguon === 'online' ? 'Online' : 'Tại quầy'}
                            {formatQueueTime(queue.gio_hen_goc) ? ` · hẹn ${formatQueueTime(queue.gio_hen_goc)}` : ''}
                          </p>
                          {(queue.trang_thai === 'dang_cho' || queue.trang_thai === 'da_goi') && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {queue.trang_thai === 'dang_cho' && (
                                <button
                                  type="button"
                                  onClick={() => setTransferTarget({
                                    hangDoiId: queue.hang_doi_id,
                                    tenBenhNhan: queue.ten_benh_nhan,
                                    maSoThuTu: queue.ma_so_thu_tu,
                                    specialtyId: queue.specialty_id ?? null,
                                    currentDoctorId: doctor.doctor_id,
                                  })}
                                  className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                                >
                                  Chuyển bác sĩ
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setCancelTarget({
                                  hangDoiId: queue.hang_doi_id,
                                  tenBenhNhan: queue.ten_benh_nhan,
                                  maSoThuTu: queue.ma_so_thu_tu,
                                })}
                                className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Đóng lượt
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(doctor.lich_chua_checkin_bi_anh_huong?.length ?? 0) > 0 && doctor.canh_bao_qua_tai && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">Lịch chưa check-in cần báo</p>
                      {doctor.lich_chua_checkin_bi_anh_huong?.slice(0, 3).map((appointment) => (
                        <div key={appointment.appointment_id} className="rounded-lg bg-white/75 px-2 py-1.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-semibold text-slate-800">{appointment.ten_benh_nhan}</span>
                            <span className="whitespace-nowrap text-[11px] font-bold">{appointment.gio_kham}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] opacity-80">
                            {appointment.so_dien_thoai || 'Chưa có SĐT'}
                            {(appointment.thoi_gian_tre_uoc_tinh_phut ?? 0) > 0 ? ` · trễ ~${appointment.thoi_gian_tre_uoc_tinh_phut}p` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        
        {/* Khung 1: Thông báo */}
        <Panel title="Thông báo mới" bodyClassName="max-h-[28rem] space-y-3 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyBlock>Không có thông báo mới.</EmptyBlock>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className={`rounded-lg border p-3 ${notificationTone(notif)}`}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold">{notif.tieu_de}</p>
                    <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">{notificationLabel(notif)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{notif.noi_dung}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{format(new Date(notif.ngay_tao), 'HH:mm dd/MM')}</p>
                </div>
              ))
            )}
        </Panel>

        {/* Khung 2: Lịch đã đặt, chờ tiếp nhận */}
        <Panel title="Chờ tiếp nhận" bodyClassName="max-h-[28rem] space-y-3 overflow-y-auto">
            {pendingCheckins.length === 0 ? (
              <EmptyBlock>Không có lịch đang chờ tiếp nhận.</EmptyBlock>
            ) : (
              pendingCheckins.map((apt) => (
                <div key={apt.appointment_id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-slate-800">{apt.ten_benh_nhan}</p>
                    <p className="text-xs text-slate-500 font-medium">{apt.gio_kham}{apt.phong_kham ? ` · ${apt.phong_kham}` : ''}</p>
                    {apt.tre_qua_grace && <p className="text-[10px] font-semibold text-amber-600">Trễ hơn 15 phút · vẫn được tiếp nhận</p>}
                  </div>
                  <StatusBadge tone="warning" className="shrink-0">Tra cứu tại tiếp nhận</StatusBadge>
                </div>
              ))
            )}
        </Panel>

        {/* Khung 3: Lịch sắp tới (4h) */}
        <Panel title="Sắp tới (4h)" bodyClassName="max-h-[28rem] space-y-3 overflow-y-auto">
            {upcomingAppointments.length === 0 ? (
              <EmptyBlock>Không có lịch trong 4h tới.</EmptyBlock>
            ) : (
              upcomingAppointments.map(apt => (
                <div key={apt._id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-slate-800">
                        {apt.user_id?.ho_ten || apt.ten_khach || 'Khách vãng lai'}
                      </p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Icon name="calendar" className="w-3 h-3" />
                        {apt.gio_kham}
                      </p>
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setActiveTooltip(activeTooltip === apt._id ? null : apt._id)}
                        className="flex items-center gap-1 rounded-md border border-brand-100 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        Liên hệ
                      </button>
                      
                      {/* Tooltip */}
                      {activeTooltip === apt._id && (
                        <div className="absolute right-0 top-8 z-10 w-56 rounded-lg bg-slate-900 p-3 text-xs text-white shadow-lg">
                          <p className="mb-1"><span className="text-slate-400">Khám:</span> {apt.user_id?.ho_ten || apt.ten_khach}</p>
                          <p className="mb-1"><span className="text-slate-400">Đặt hộ:</span> {apt.nguoi_dat_ho_ten || 'Không'}</p>
                          <p className="mt-2 flex items-center gap-1 font-bold text-brand-200">
                            {apt.user_id?.so_dien_thoai || apt.so_dien_thoai_khach || apt.nguoi_dat_sdt || 'Chưa cập nhật'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
        </Panel>

      </div>

      {transferTarget && (
        <QueueTransferModal
          hangDoiId={transferTarget.hangDoiId}
          tenBenhNhan={transferTarget.tenBenhNhan}
          maSoThuTu={transferTarget.maSoThuTu}
          candidates={getTransferCandidates(transferTarget.specialtyId, transferTarget.currentDoctorId)}
          onClose={() => setTransferTarget(null)}
          onTransferred={handleTransferred}
        />
      )}

      {cancelTarget && (
        <QueueCancelModal
          hangDoiId={cancelTarget.hangDoiId}
          tenBenhNhan={cancelTarget.tenBenhNhan}
          maSoThuTu={cancelTarget.maSoThuTu}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}
    </PageShell>
  );
}
