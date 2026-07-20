import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { format } from 'date-fns';
import Pagination from '../../components/common/Pagination';
import { receptionistBookingService, ReceptionistBookingSlot } from '../../services/receptionist-booking.service';

interface Appointment {
  _id: string;
  ngay_kham: string;
  gio_kham: string;
  status: string;
  loai_kham: string;
  payment_status: string;
  user_id: { ho_ten: string; so_dien_thoai: string } | null;
  doctor_id: { _id?: string; user_id?: { ho_ten: string } } | null;
  ten_khach?: string;
  so_dien_thoai_khach?: string;
  ma_lich_hen?: string;
  ly_do_kham?: string;
  gia_kham?: number;
  ten_dich_vu?: string;
  nguoi_dat_ho_ten?: string;
  dat_ho?: boolean;
  so_lan_thay_doi?: number;
}

const isAppointmentOverdue = (ngay_kham: string, gio_kham: string) => {
  // Tách ngày từ chuỗi UTC (vd: "2026-07-20T00:00...")
  const dateString = ngay_kham.split('T')[0];
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = gio_kham.split(':').map(Number);
  
  // Tạo Local Date cố định theo đúng các thông số trên
  const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  
  return appointmentDate < now;
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'upcoming' | 'past'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const isFirstSearchRender = useRef(true);
  
  // States cho Modal Hủy lịch
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // States cho Modal Dời lịch
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ReceptionistBookingSlot[]>([]);

  // States cho Modal Chi tiết
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailAppointment, setSelectedDetailAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = async (page = currentPage) => {
    try {
      setLoading(true);
      setError('');
      
      let url = `/receptionist/appointments?timeframe=${activeTab}&page=${page}&limit=10`;
      if (filterDate) {
        url += `&date=${filterDate}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await axiosInstance.get(url);
      if (res.data.success) {
        setAppointments(res.data.data);
        if (res.data.pagination) {
          setCurrentPage(res.data.pagination.page);
          setTotalPages(res.data.pagination.totalPages);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách lịch hẹn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(1);
  }, [activeTab, filterDate]); // Re-fetch when tab or date changes

  // Thêm một useEffect để fetch với debounce cho search
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchAppointments(1);
    }, 500); // 500ms delay for typing
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePageChange = (newPage: number) => {
    fetchAppointments(newPage);
  };

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

  const handleReschedule = (apt: Appointment) => {
    setSelectedAppointmentId(apt._id);
    const docId = apt.doctor_id?._id || '';
    setSelectedDoctorId(docId);
    // Format date from DB string to YYYY-MM-DD for input type="date"
    const dateObj = new Date(apt.ngay_kham);
    setNewDate(format(dateObj, 'yyyy-MM-dd'));
    setNewTime(''); // Reset giờ vì list giờ sẽ fetch lại
    setRescheduleReason('');
    setRescheduleModalOpen(true);
  };

  useEffect(() => {
    if (selectedDoctorId && newDate && rescheduleModalOpen) {
      receptionistBookingService.getSlots(selectedDoctorId, newDate).then(slots => {
        setAvailableSlots(slots);
      }).catch(() => {
        setAvailableSlots([]);
      });
    }
  }, [selectedDoctorId, newDate, rescheduleModalOpen]);

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
            activeTab === 'tomorrow'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('tomorrow')}
        >
          Ngày mai
        </button>
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('upcoming')}
        >
          Sắp tới
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

      {/* Toolbar: Tìm kiếm & Lọc */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT, mã lịch hẹn..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-3 top-2.5 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Ngày khám:</label>
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Xóa lọc
            </button>
          )}
        </div>
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
                appointments.map(apt => {
                  const isOverdue = isAppointmentOverdue(apt.ngay_kham, apt.gio_kham);
                  const isPendingAndOverdue = (apt.status === 'pending' || apt.status === 'confirmed') && isOverdue;

                  return (
                    <tr key={apt._id} className={`hover:bg-slate-50 transition-colors ${isPendingAndOverdue ? 'opacity-60 bg-slate-50/50' : ''}`}>
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
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            apt.status === 'checked_in' ? 'bg-blue-100 text-blue-700' : 
                            apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                            isPendingAndOverdue ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {apt.status === 'checked_in' ? 'Đã đến' : apt.status === 'cancelled' ? 'Đã hủy' : 'Chờ khám'}
                          </span>
                          {isPendingAndOverdue && (
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                              (Quá giờ)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {activeTab !== 'past' && (
                          <>
                            {activeTab === 'today' && apt.status !== 'checked_in' && apt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleArrived(apt._id)}
                                className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                              >
                                Đã đến
                              </button>
                            )}
                            {apt.status !== 'checked_in' && apt.status !== 'cancelled' && (apt.so_lan_thay_doi || 0) < 3 && (
                              <button
                                onClick={() => handleReschedule(apt)}
                                className="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                              >
                                Dời lịch
                              </button>
                            )}
                            {apt.status !== 'cancelled' && apt.status !== 'checked_in' && (
                              <button
                                onClick={() => handleCancel(apt._id)}
                                className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium"
                              >
                                Hủy
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDetailAppointment(apt);
                            setDetailModalOpen(true);
                          }}
                          className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-medium flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Xem chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Component Phân trang */}
        <div className="p-4 border-t border-slate-200">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
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
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                >
                  <option value="">-- Chọn giờ khám --</option>
                  {availableSlots.length > 0 ? availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.gio_bat_dau}>
                      {slot.gio_bat_dau} - {slot.gio_ket_thuc}
                    </option>
                  )) : (
                    <option value="" disabled>Không có khung giờ rảnh</option>
                  )}
                </select>
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

      {/* Modal Xem Chi Tiết Lịch Hẹn */}
      {detailModalOpen && selectedDetailAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Chi tiết Lịch hẹn</h3>
                <p className="text-sm text-slate-500 mt-1">Mã: {selectedDetailAppointment.ma_lich_hen || 'Chưa có'}</p>
              </div>
              <button 
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nội dung Modal */}
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Cột 1: Thông tin Khách hàng & Bác sĩ */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Thông tin Bệnh nhân</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                      {/* Bệnh nhân khám thực tế */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Người đến khám</p>
                        <p className="font-semibold text-slate-800">
                          {selectedDetailAppointment.ten_khach || selectedDetailAppointment.user_id?.ho_ten || 'Khách vãng lai'}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {selectedDetailAppointment.so_dien_thoai_khach || selectedDetailAppointment.user_id?.so_dien_thoai || 'Không có số điện thoại'}
                        </p>
                      </div>

                      {/* Tài khoản đặt lịch */}
                      {selectedDetailAppointment.user_id && (
                        <div className="pt-3 border-t border-slate-200 border-dashed">
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Tài khoản đặt lịch</p>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p className="font-medium text-sm text-slate-700">
                              {selectedDetailAppointment.user_id.ho_ten}
                            </p>
                            {selectedDetailAppointment.dat_ho && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                                Đặt hộ
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Thông tin Dịch vụ</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Bác sĩ phụ trách</p>
                        <p className="font-medium text-slate-800">{selectedDetailAppointment.doctor_id?.user_id?.ho_ten || 'Chưa gán'}</p>
                      </div>
                      {selectedDetailAppointment.ten_dich_vu && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Dịch vụ</p>
                          <p className="font-medium text-slate-800">{selectedDetailAppointment.ten_dich_vu}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Loại khám</p>
                        <span className="px-2 py-1 rounded text-[11px] font-semibold bg-brand-50 text-brand-700">
                          {selectedDetailAppointment.loai_kham === 'home' ? 'Tại nhà' : 'Tại phòng khám'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cột 2: Thời gian, Trạng thái & Lý do */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Lịch hẹn & Trạng thái</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 border-dashed">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Giờ khám</p>
                          <p className="font-bold text-slate-800 text-lg">{selectedDetailAppointment.gio_kham}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Ngày khám</p>
                          <p className="font-medium text-slate-800">
                            {format(new Date(selectedDetailAppointment.ngay_kham), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-1">
                        <p className="text-sm text-slate-600">Trạng thái khám:</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedDetailAppointment.status === 'checked_in' ? 'bg-blue-100 text-blue-700' : 
                          selectedDetailAppointment.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {selectedDetailAppointment.status === 'checked_in' ? 'Đã đến' : selectedDetailAppointment.status === 'cancelled' ? 'Đã hủy' : 'Chờ khám'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-600">Thanh toán:</p>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{selectedDetailAppointment.gia_kham?.toLocaleString('vi-VN')} đ</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            selectedDetailAppointment.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                            selectedDetailAppointment.payment_status === 'refunded' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedDetailAppointment.payment_status === 'paid' ? 'Đã thu' : selectedDetailAppointment.payment_status === 'refunded' ? 'Đã hoàn' : 'Chưa thu'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Lý do khám / Triệu chứng</h4>
                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-sm text-slate-700 leading-relaxed min-h-[80px]">
                      {selectedDetailAppointment.ly_do_kham || <span className="text-slate-400 italic">Bệnh nhân không ghi chú gì thêm.</span>}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-sm font-bold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
