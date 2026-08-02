import { useState, useEffect } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { receptionistNotificationService, VirtualNotification } from '../../services/receptionist-notification.service';
import Icon from '../../components/admin/icons';
import { format } from 'date-fns';
import { receptionistPaymentService } from '../../services/receptionist-payment.service';

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

interface DoctorOperationalStatus {
  doctor_id: string;
  ten_bac_si: string;
  phong_kham?: string | null;
  trang_thai_van_hanh: string;
  so_dang_cho: number;
  thoi_gian_kham_hien_tai_phut?: number | null;
  canh_bao_qua_tai: boolean;
  benh_nhan_hien_tai?: {
    ten_benh_nhan: string;
    ma_so_thu_tu?: string | null;
  } | null;
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

  useEffect(() => {
    fetchStats();
    fetchPendingCheckins();
    fetchDoctorStatuses();
    fetchNotifications();

    const intervalId = window.setInterval(() => {
      fetchStats();
      fetchPendingCheckins();
      fetchDoctorStatuses();
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
    if (status === 'dang_kham') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (status === 'san_sang') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'dang_don_phong') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Tổng quan Lễ tân</h2>
      
      {/* Khung Thống Kê */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium">Ca khám hôm nay</p>
          <p className="text-3xl font-bold text-brand-600 mt-2">{totalToday}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium">Đang chờ khám</p>
          <p className="text-3xl font-bold text-brand-600 mt-2">{waiting}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium">Doanh thu tại quầy</p>
          <p className="text-3xl font-bold text-brand-600 mt-2">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(todayRevenue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Hôm nay</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="users" className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold text-slate-800">Trạng thái vận hành bác sĩ</h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">Cập nhật mỗi 30 giây</span>
        </div>
        <div className="p-4">
          {doctorStatuses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Chưa có dữ liệu trạng thái bác sĩ hôm nay.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {doctorStatuses.map((doctor) => (
                <div key={doctor.doctor_id} className={`rounded-xl border p-3 ${doctorStatusClass(doctor.trang_thai_van_hanh, doctor.canh_bao_qua_tai)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{doctor.ten_bac_si}</p>
                      <p className="mt-1 text-xs font-medium opacity-80">{doctor.phong_kham || 'Chưa có phòng'} · {doctor.so_dang_cho} đang chờ</p>
                    </div>
                    <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-bold">
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
                  {doctor.canh_bao_qua_tai && (
                    <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold">Ca khám đã kéo dài từ 60 phút, cần theo dõi điều phối.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid 3 Khung Mới */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Khung 1: Thông báo */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Icon name="bell" className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold text-slate-800">Thông báo mới</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Không có thông báo mới.</p>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">{notif.tieu_de}</p>
                  <p className="text-xs text-slate-500 mt-1">{notif.noi_dung}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{format(new Date(notif.ngay_tao), 'HH:mm dd/MM')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Khung 2: Lịch đã đặt, chờ tiếp nhận */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Icon name="users" className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800">Chờ tiếp nhận</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {pendingCheckins.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Không có lịch đang chờ tiếp nhận.</p>
            ) : (
              pendingCheckins.map((apt) => (
                <div key={apt.appointment_id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{apt.ten_benh_nhan}</p>
                    <p className="text-xs text-slate-500 font-medium">{apt.gio_kham}{apt.phong_kham ? ` · ${apt.phong_kham}` : ''}</p>
                    {apt.tre_qua_grace && <p className="text-[10px] font-semibold text-amber-600">Trễ hơn 15 phút · vẫn được tiếp nhận</p>}
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Tra cứu tại Tiếp nhận
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Khung 3: Lịch sắp tới (4h) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Icon name="clock" className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-800">Sắp tới (4h)</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Không có lịch trong 4h tới.</p>
            ) : (
              upcomingAppointments.map(apt => (
                <div key={apt._id} className="p-3 border border-slate-200 rounded-lg flex flex-col gap-2 hover:bg-slate-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-700">
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
                        className="flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded border border-brand-100 hover:bg-brand-100 transition-colors"
                      >
                        📞 Liên hệ
                      </button>
                      
                      {/* Tooltip */}
                      {activeTooltip === apt._id && (
                        <div className="absolute right-0 top-8 w-56 bg-slate-800 text-white text-xs rounded shadow-lg p-3 z-10">
                          <p className="mb-1"><span className="text-slate-400">Khám:</span> {apt.user_id?.ho_ten || apt.ten_khach}</p>
                          <p className="mb-1"><span className="text-slate-400">Đặt hộ:</span> {apt.nguoi_dat_ho_ten || 'Không'}</p>
                          <p className="mt-2 font-bold text-brand-400 flex items-center gap-1">
                            📞 {apt.user_id?.so_dien_thoai || apt.so_dien_thoai_khach || apt.nguoi_dat_sdt || 'Chưa cập nhật'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
