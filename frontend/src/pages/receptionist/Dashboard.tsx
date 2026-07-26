import { useState, useEffect } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { receptionistNotificationService, VirtualNotification } from '../../services/receptionist-notification.service';
import Icon from '../../components/admin/icons';
import { format } from 'date-fns';

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

const isAppointmentOverdue = (ngay_kham: string, gio_kham: string) => {
  const appointmentDate = new Date(ngay_kham);
  const [hours, minutes] = gio_kham.split(':').map(Number);
  appointmentDate.setHours(hours, minutes, 0, 0);
  const now = new Date();
  return appointmentDate < now;
};

export default function Dashboard() {
  const [totalToday, setTotalToday] = useState(0);
  const [waiting, setWaiting] = useState(0);
  
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<VirtualNotification[]>([]);
  
  // Trạng thái cho Tooltip
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await axiosInstance.get('/receptionist/appointments?timeframe=today&limit=1000');
      if (res.data.success) {
        const appointments: Appointment[] = res.data.data;
        setAllAppointments(appointments);
        setTotalToday(appointments.length);
        setWaiting(
          appointments.filter((a) => a.status === 'checked_in').length
        );
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu tổng quan:', err);
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
    fetchNotifications();
  }, []);

  const handleArrived = async (id: string) => {
    try {
      await axiosInstance.patch(`/receptionist/appointments/${id}/arrived`);
      fetchStats(); // Cập nhật lại danh sách và số lượng
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi check-in');
    }
  };

  // --- Logic Lọc Dữ liệu cho Khung 2 & 3 ---
  
  // Khung 2: Lịch đặt trực tiếp (walk-in) - Tạm tính bằng cách user_id === null hoặc hinh_thuc_dat_lich === 'receptionist'
  const walkinAppointments = allAppointments.filter(
    (a) => (!a.user_id || a.hinh_thuc_dat_lich === 'receptionist') && (a.status === 'pending' || a.status === 'confirmed')
  );

  // Khung 3: Lịch hẹn 4h tới
  const upcomingAppointments = allAppointments.filter((a) => {
    if (a.status !== 'pending' && a.status !== 'confirmed') return false;
    const aptDate = new Date(a.ngay_kham);
    const [h, m] = a.gio_kham.split(':').map(Number);
    aptDate.setHours(h, m, 0, 0);
    
    const diffHours = (aptDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 4;
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Tổng quan Lễ tân</h2>
      
      {/* Khung Thống Kê */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium">Ca khám hôm nay</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{totalToday}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium">Đang chờ khám</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{waiting}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow opacity-60">
          <p className="text-slate-500 text-sm font-medium">Doanh thu tại quầy</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">0 đ</p>
          <p className="text-xs text-slate-400 mt-1">(Sắp ra mắt)</p>
        </div>
      </div>

      {/* Grid 3 Khung Mới */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Khung 1: Thông báo */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Icon name="bell" className="w-5 h-5 text-amber-500" />
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

        {/* Khung 2: Lịch đặt trực tiếp (Walk-in) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Icon name="users" className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800">Khách đặt trực tiếp</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {walkinAppointments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Không có lịch chờ.</p>
            ) : (
              walkinAppointments.map(apt => (
                <div key={apt._id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{apt.ten_khach || 'Khách vãng lai'}</p>
                    <p className="text-xs text-slate-500 font-medium">{apt.gio_kham}</p>
                  </div>
                  <button 
                    onClick={() => handleArrived(apt._id)}
                    className="flex items-center gap-1 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  >
                    <Icon name="check" className="w-3.5 h-3.5" />
                    Đã đến
                  </button>
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
