import { useState, useEffect } from 'react';
import axiosInstance from '../../services/axiosInstance';

interface Appointment {
  status: string;
  ngay_kham: string;
  gio_kham: string;
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axiosInstance.get('/receptionist/appointments?timeframe=today&limit=1000');
        if (res.data.success) {
          const appointments: Appointment[] = res.data.data;
          setTotalToday(appointments.length);
          setWaiting(
            appointments.filter((a) => a.status === 'checked_in').length
          );
        }
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu tổng quan:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Tổng quan Lễ tân</h2>
      <div className="grid grid-cols-3 gap-6">
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
    </div>
  );
}
