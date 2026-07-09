import { useState, useEffect } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { format } from 'date-fns';

interface Appointment {
  _id: string;
  ngay_kham: string;
  gio_kham: string;
  status: string;
  loai_kham: string;
  payment_status: string;
  user_id: { ho_ten: string; so_dien_thoai: string } | null;
  doctor_id: { user_id?: { ho_ten: string } } | null;
  ten_khach?: string;
  so_dien_thoai_khach?: string;
  ma_lich_hen?: string;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'past'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States cho Modal Hủy lịch
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // States cho Modal Dời lịch
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axiosInstance.get(`/receptionist/appointments?timeframe=${activeTab}`);
      if (res.data.success) {
        setAppointments(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách lịch hẹn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [activeTab]);

  const handleArrived = async (id: string) => {
    try {
      await axiosInstance.patch(`/receptionist/appointments/${id}/arrived`);
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi check-in');
    }
  };

  const handleCancel = (id: string) => {
    setSelectedAppointmentId(id);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!selectedAppointmentId || !cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy!');
      return;
    }
    try {
      await axiosInstance.patch(`/receptionist/appointments/${selectedAppointmentId}/cancel`, { ly_do_huy: cancelReason });
      setCancelModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy lịch');
    }
  };

  const handleReschedule = (id: string, oldDate: string, oldTime: string) => {
    setSelectedAppointmentId(id);
    // Format date from DB string to YYYY-MM-DD for input type="date"
    const dateObj = new Date(oldDate);
    setNewDate(format(dateObj, 'yyyy-MM-dd'));
    setNewTime(oldTime);
    setRescheduleReason('');
    setRescheduleModalOpen(true);
  };

  const confirmReschedule = async () => {
    if (!selectedAppointmentId || !newDate || !newTime || !rescheduleReason.trim()) {
      alert('Vui lòng chọn ngày, giờ và nhập lý do dời lịch!');
      return;
    }

    // Validate future date/time
    const selectedDateTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    if (selectedDateTime <= now) {
      alert('Không thể dời lịch về quá khứ. Vui lòng chọn thời gian trong tương lai!');
      return;
    }

    try {
      await axiosInstance.patch(`/receptionist/appointments/${selectedAppointmentId}/reschedule`, { 
        ngay_kham: newDate, 
        gio_kham: newTime,
        ly_do_doi_lich: rescheduleReason
      });
      setRescheduleModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi dời lịch');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Lịch hẹn Phòng khám</h2>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'today'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('today')}
        >
          Hôm nay
        </button>
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'past'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('past')}
        >
          Đã qua
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-800 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Bệnh nhân</th>
                <th className="px-4 py-3 font-semibold">Bác sĩ</th>
                <th className="px-4 py-3 font-semibold">Thanh toán</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Chưa có lịch hẹn nào tại phòng khám
                  </td>
                </tr>
              ) : (
                appointments.map(apt => (
                  <tr key={apt._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{apt.gio_kham}</div>
                      <div className="text-xs text-slate-500">{format(new Date(apt.ngay_kham), 'dd/MM/yyyy')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{apt.user_id?.ho_ten || apt.ten_khach || 'Khách vãng lai'}</div>
                      <div className="text-xs text-slate-500">{apt.user_id?.so_dien_thoai || apt.so_dien_thoai_khach}</div>
                    </td>
                    <td className="px-4 py-3">{apt.doctor_id?.user_id?.ho_ten || 'Chưa gán'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        apt.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                        apt.payment_status === 'refunded' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {apt.payment_status === 'paid' ? 'Đã thu' : apt.payment_status === 'refunded' ? 'Đã hoàn' : 'Chưa thu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        apt.status === 'checked_in' ? 'bg-blue-100 text-blue-700' : 
                        apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {apt.status === 'checked_in' ? 'Đã đến' : apt.status === 'cancelled' ? 'Đã hủy' : 'Chờ khám'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {activeTab === 'today' ? (
                          <>
                            {apt.status !== 'checked_in' && apt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleArrived(apt._id)}
                                className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                              >
                                Đã đến
                              </button>
                            )}
                            {apt.status !== 'checked_in' && apt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleReschedule(apt._id, apt.ngay_kham, apt.gio_kham)}
                                className="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                              >
                                Dời lịch
                              </button>
                            )}
                            {apt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancel(apt._id)}
                                className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium"
                              >
                                Hủy
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => alert('Chi tiết lịch hẹn: ' + apt.ma_lich_hen)}
                            className="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium"
                          >
                            Xem chi tiết
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Hủy Lịch */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Hủy lịch hẹn</h3>
            <p className="text-sm text-slate-600 mb-4">Vui lòng nhập lý do hủy lịch để lưu lại vào hồ sơ.</p>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none mb-6 resize-none"
              rows={4}
              placeholder="Nhập lý do (ví dụ: khách yêu cầu hủy, không liên lạc được...)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dời Lịch */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Dời lịch hẹn</h3>
            <p className="text-sm text-slate-600 mb-4">Vui lòng chọn ngày và giờ khám mới cho bệnh nhân.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày khám mới</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giờ khám mới</label>
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lý do dời lịch</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Nhập lý do dời lịch..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRescheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmReschedule}
                className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-sm font-medium transition-colors"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
