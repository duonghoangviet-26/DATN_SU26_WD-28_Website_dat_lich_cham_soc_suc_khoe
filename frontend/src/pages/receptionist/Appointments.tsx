import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { format } from 'date-fns';
import Pagination from '../../components/common/Pagination';
import { receptionistBookingService, ReceptionistBookingSlot } from '../../services/receptionist-booking.service';
import Icon from '../../components/admin/icons';
import QueueTicketTemplate, { QueueTicketData } from '../../components/receptionist/QueueTicketTemplate';

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
  /**
   * Sá»‘ láº§n KHÃCH tá»± xin dá»i â€” tráº§n 1 (rule má»¥c 5). KhÃ¡c `so_lan_thay_doi` (Ä‘áº¿m Má»ŒI thay Ä‘á»•i,
   * ká»ƒ cáº£ láº§n dá»i do lá»—i phÃ²ng khÃ¡m). Cháº·n theo `so_lan_thay_doi` sáº½ tÆ°á»›c oan quyá»n dá»i cá»§a
   * khÃ¡ch khi láº§n trÆ°á»›c lÃ  lá»—i phÃ²ng khÃ¡m.
   */
  so_lan_doi_khach_yeu_cau?: number;
  ly_do_doi?: 'khach_yeu_cau' | 'phong_kham' | null;
  allowed_actions?: Array<'check_in' | 'reschedule' | 'cancel'>;
  lock_reason?: string | null;
  queue_state?: string | null;
}

interface RescheduleHistory {
  _id: string;
  loai_thay_doi: string;
  ly_do_thay_doi: string;
  thoi_diem: string;
}

const isAppointmentOverdue = (ngay_kham: string, gio_kham: string) => {
  // TÃ¡ch ngÃ y tá»« chuá»—i UTC (vd: "2026-07-20T00:00...")
  const dateString = ngay_kham.split('T')[0];
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = gio_kham.split(':').map(Number);

  // Táº¡o Local Date cá»‘ Ä‘á»‹nh theo Ä‘Ãºng cÃ¡c thÃ´ng sá»‘ trÃªn
  const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();

  return appointmentDate < now;
};

const getStatusBadge = (status: string, isOverdue: boolean = false) => {
  switch (status) {
    case 'checked_in':
      return { label: 'ÄÃ£ Ä‘áº¿n', className: 'bg-emerald-100 text-emerald-700' };
    case 'in_progress':
    case 'waiting_record':
    case 'waiting_doctor_confirm':
      return { label: 'Äang khÃ¡m', className: 'bg-indigo-100 text-indigo-700' };
    case 'completed':
      return { label: 'HoÃ n thÃ nh', className: 'bg-blue-100 text-blue-700' };
    case 'cancelled':
      return { label: 'ÄÃ£ há»§y', className: 'bg-red-100 text-red-700' };
    case 'pending':
    case 'confirmed':
    default:
      return {
        label: 'ChÆ°a Ä‘áº¿n',
        className: isOverdue ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'
      };
  }
};

const hasAction = (appointment: Appointment, action: 'check_in' | 'reschedule' | 'cancel') => {
  if (Array.isArray(appointment.allowed_actions)) {
    return appointment.allowed_actions.includes(action);
  }

  // Fallback cho dá»¯ liá»‡u cÅ©/mock chÆ°a cÃ³ contract tá»« backend.
  if (action === 'check_in') return appointment.status === 'confirmed';
  if (action === 'reschedule') return appointment.status === 'pending' || appointment.status === 'confirmed';
  if (action === 'cancel') return appointment.status === 'pending' || appointment.status === 'confirmed';
  return false;
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

  // States cho Modal Há»§y lá»‹ch
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // States cho Modal Dá»i lá»‹ch
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ReceptionistBookingSlot[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  // PhÃ¢n loáº¡i nghiá»‡p vá»¥ cá»§a láº§n dá»i (rule má»¥c 5, 10.D): khÃ¡ch yÃªu cáº§u thÃ¬ tÃ­nh vÃ o tráº§n 1 láº§n
  // vÃ  pháº£i trÆ°á»›c `T-30'`; lá»—i phÃ²ng khÃ¡m thÃ¬ khÃ´ng tÃ­nh háº¡n má»©c vÃ  khÃ´ng bá»‹ má»‘c Ä‘Ã³ cháº·n.
  const [lyDoDoi, setLyDoDoi] = useState<'khach_yeu_cau' | 'phong_kham'>('khach_yeu_cau');
  const [khachHetLuotDoi, setKhachHetLuotDoi] = useState(false);
  const [aptDangDoi, setAptDangDoi] = useState<Appointment | null>(null);

  // States cho Modal Lá»‹ch sá»­ quÃ¡ háº¡n dá»i lá»‹ch
  const [rescheduleLimitModalOpen, setRescheduleLimitModalOpen] = useState(false);
  const [rescheduleHistory, setRescheduleHistory] = useState<RescheduleHistory[]>([]);

  // States cho Doctor Filter
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // States cho Bulk Action
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedApts, setSelectedApts] = useState<string[]>([]);
  const [bulkCancelModalOpen, setBulkCancelModalOpen] = useState(false);
  const [bulkRescheduleModalOpen, setBulkRescheduleModalOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkStartTime, setBulkStartTime] = useState('');
  const [availableBulkSlots, setAvailableBulkSlots] = useState<string[]>([]);

  // States cho Modal Chi tiáº¿t
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailAppointment, setSelectedDetailAppointment] = useState<Appointment | null>(null);

  // States cho Check-in In Phiáº¿u
  const [confirmCheckInModalOpen, setConfirmCheckInModalOpen] = useState(false);
  const [selectedCheckInApt, setSelectedCheckInApt] = useState<Appointment | null>(null);
  const [printData, setPrintData] = useState<QueueTicketData | null>(null);

  const fetchAppointments = async (page = currentPage) => {
    try {
      setLoading(true);
      setError('');

      let url = `/receptionist/appointments?timeframe=${activeTab}&page=${page}&limit=10`;
      if (filterDate) {
        url += `&date=${filterDate}`;
      }
      if (filterDoctorId) {
        url += `&doctor_id=${filterDoctorId}`;
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
      setError(err.response?.data?.message || 'Lá»—i khi táº£i danh sÃ¡ch lá»‹ch háº¹n');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await axiosInstance.get('/receptionist/booking/doctors');
        if (res.data.success) setDoctorsList(res.data.data);
      } catch (err) {}
    };
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (!bulkStartDate) {
      setAvailableBulkSlots([]);
      setBulkStartTime('');
      return;
    }
    const fetchBulkSlots = async () => {
      try {
        const res = await axiosInstance.get(`/receptionist/booking/doctors/all/slots?date=${bulkStartDate}`);
        if (res.data.success) {
          const slots = res.data.data;
          const times = [...new Set(slots.map((s: any) => s.gio_bat_dau))].sort() as string[];
          setAvailableBulkSlots(times);
          if (!times.includes(bulkStartTime)) {
            setBulkStartTime('');
          }
        }
      } catch (err) {}
    };
    fetchBulkSlots();
  }, [bulkStartDate, bulkStartTime]);

  useEffect(() => {
    fetchAppointments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterDate, filterDoctorId]); // Re-fetch when tab, date, or doctor changes

  // ThÃªm má»™t useEffect Ä‘á»ƒ fetch vá»›i debounce cho search
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchAppointments(1);
    }, 500); // 500ms delay for typing
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedApts(appointments.map(a => a._id));
    } else {
      setSelectedApts([]);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedApts.includes(id)) {
      setSelectedApts(selectedApts.filter(i => i !== id));
    } else {
      setSelectedApts([...selectedApts, id]);
    }
  };

  const handleBulkCancel = async () => {
    try {
      const res = await axiosInstance.post('/receptionist/appointments/bulk-cancel', { ids: selectedApts, reason: bulkReason });
      alert(res.data.message);
      setBulkCancelModalOpen(false);
      setSelectedApts([]);
      setIsBulkMode(false);
      setBulkReason('');
      fetchAppointments(currentPage);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi há»§y hÃ ng loáº¡t');
    }
  };

  const handleBulkReschedule = async () => {
    try {
      const res = await axiosInstance.post('/receptionist/appointments/bulk-reschedule', {
        ids: selectedApts,
        startDate: bulkStartDate,
        startTime: bulkStartTime,
        reason: bulkReason
      });
      alert(res.data.message);
      setBulkRescheduleModalOpen(false);
      setSelectedApts([]);
      setIsBulkMode(false);
      setBulkStartDate('');
      setBulkStartTime('');
      setBulkReason('');
      fetchAppointments(currentPage);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi dá»i hÃ ng loáº¡t');
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchAppointments(newPage);
  };

  // Check-in Ä‘Æ°a bá»‡nh nhÃ¢n vÃ o HÃ€NG Äá»¢I cá»§a bÃ¡c sÄ© (rule má»¥c 6), khÃ´ng chá»‰ Ä‘á»•i tráº¡ng thÃ¡i lá»‹ch.
  // Server tráº£ kÃ¨m cáº£nh bÃ¡o cáº§n xá»­ lÃ½ ngay táº¡i quáº§y: chÆ°a thanh toÃ¡n, Ä‘áº¿n sá»›m/trá»…, ca quÃ¡ táº£i.
  const handleArrived = async (id: string) => {
    try {
      const res = await axiosInstance.patch(`/receptionist/appointments/${id}/arrived`);
      const canhBao: string[] = res.data?.canh_bao ?? [];
      const phong = res.data?.hang_doi?.phong_kham;
      if (canhBao.length > 0) {
        alert(`ÄÃ£ Ä‘Æ°a vÃ o hÃ ng Ä‘á»£i${phong ? ` â€” phÃ²ng ${phong}` : ''}.\n\nLÆ¯U Ã:\nâ€¢ ${canhBao.join('\nâ€¢ ')}`);
      }
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi check-in');
    }
  };

  const confirmCheckIn = async () => {
    if (!selectedCheckInApt) return;
    try {
      const res = await axiosInstance.patch(`/receptionist/appointments/${selectedCheckInApt._id}/arrived`);

      setConfirmCheckInModalOpen(false);
      fetchAppointments();

      const canhBao: string[] = res.data?.canh_bao ?? [];
      const phong = res.data?.hang_doi?.phong_kham;

      let msg = 'ÄÃ£ xÃ¡c nháº­n Check-in vÃ  Ä‘áº©y lá»‡nh in Sá»‘ thá»© tá»± tá»›i mÃ¡y in thÃ nh cÃ´ng!';
      if (canhBao.length > 0) {
        msg += `\n\nLÆ¯U Ã:\nâ€¢ ${canhBao.join('\nâ€¢ ')}`;
      }

      alert(msg);

    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi check-in');
    }
  };

  const handleCancel = (id: string) => {
    setSelectedAppointmentId(id);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!selectedAppointmentId || !cancelReason.trim()) {
      alert('Vui lÃ²ng nháº­p lÃ½ do há»§y!');
      return;
    }
    try {
      await axiosInstance.patch(`/receptionist/appointments/${selectedAppointmentId}/cancel`, { ly_do_huy: cancelReason });
      setCancelModalOpen(false);
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi há»§y lá»‹ch');
    }
  };

  // Má»Ÿ modal dá»i lá»‹ch. Tráº§n 1 láº§n chá»‰ Ã¡p cho láº§n dá»i do KHÃCH yÃªu cáº§u (rule má»¥c 5) â€”
  // Ä‘áº¿m báº±ng `so_lan_doi_khach_yeu_cau`, KHÃ”NG pháº£i `so_lan_thay_doi`. Láº§n dá»i do lá»—i phÃ²ng
  // khÃ¡m khÃ´ng tÃ­nh háº¡n má»©c, nÃªn háº¿t lÆ°á»£t váº«n pháº£i dá»i Ä‘Æ°á»£c, chá»‰ lÃ  buá»™c chá»n "lá»—i phÃ²ng khÃ¡m".
  const moModalDoiLich = (apt: Appointment) => {
    setSelectedDoctorId(apt.doctor_id?._id || '');
    setNewDate(format(new Date(apt.ngay_kham), 'yyyy-MM-dd'));
    setNewTime(''); // Reset giá» vÃ¬ list giá» sáº½ fetch láº¡i
    setRescheduleReason('');
    setRescheduleModalOpen(true);
  };

  const handleReschedule = async (apt: Appointment) => {
    setSelectedAppointmentId(apt._id);

    const hetLuotKhach = (apt.so_lan_doi_khach_yeu_cau || 0) >= 1;
    setKhachHetLuotDoi(hetLuotKhach);
    // Háº¿t lÆ°á»£t cá»§a khÃ¡ch -> chá»‰ cÃ²n Ä‘Æ°á»ng "lá»—i phÃ²ng khÃ¡m", chá»‘t sáºµn Ä‘á»ƒ lá»… tÃ¢n khÃ´ng chá»n sai.
    setLyDoDoi(hetLuotKhach ? 'phong_kham' : 'khach_yeu_cau');

    if (hetLuotKhach) {
      try {
        const res = await axiosInstance.get(`/receptionist/appointments/${apt._id}/reschedule-history`);
        if (res.data.success) {
          setRescheduleHistory(res.data.data);
          setAptDangDoi(apt);
          setRescheduleLimitModalOpen(true);
        }
      } catch {
        alert('Lá»—i khi táº£i lá»‹ch sá»­ dá»i lá»‹ch');
      }
      return;
    }

    moModalDoiLich(apt);
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
      alert('Vui lÃ²ng chá»n ngÃ y, giá» vÃ  nháº­p lÃ½ do dá»i lá»‹ch!');
      return;
    }

    // Validate future date/time
    const selectedDateTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    if (selectedDateTime <= now) {
      alert('KhÃ´ng thá»ƒ dá»i lá»‹ch vá» quÃ¡ khá»©. Vui lÃ²ng chá»n thá»i gian trong tÆ°Æ¡ng lai!');
      return;
    }

    try {
      const res = await axiosInstance.patch(`/receptionist/appointments/${selectedAppointmentId}/reschedule`, {
        ngay_kham: newDate,
        gio_kham: newTime,
        ly_do_doi_lich: rescheduleReason,
        ly_do_doi: lyDoDoi,
      });
      setRescheduleModalOpen(false);
      if (res.data?.message) alert(res.data.message);
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lá»—i khi dá»i lá»‹ch');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Lá»‹ch háº¹n PhÃ²ng khÃ¡m</h2>

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
          HÃ´m nay
        </button>
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'tomorrow'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('tomorrow')}
        >
          NgÃ y mai
        </button>
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('upcoming')}
        >
          Sáº¯p tá»›i
        </button>
        <button
          className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'past'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('past')}
        >
          ÄÃ£ qua
        </button>
      </div>

      {/* Toolbar: TÃ¬m kiáº¿m & Lá»c */}
      <div className="flex flex-col xl:flex-row gap-4 mb-6">
        <button
          onClick={() => {
            setIsBulkMode(!isBulkMode);
            setSelectedApts([]);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isBulkMode ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          {isBulkMode ? 'Há»§y chá»n nhiá»u' : 'Chá»n nhiá»u'}
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="TÃ¬m theo tÃªn, SÄT, mÃ£ lá»‹ch háº¹n..."
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">BÃ¡c sÄ©:</label>
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value)}
            >
              <option value="">Táº¥t cáº£ BÃ¡c sÄ©</option>
              {doctorsList.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.ho_ten || 'BÃ¡c sÄ©'}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">NgÃ y khÃ¡m:</label>
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button
              onClick={() => { setFilterDate(''); setFilterDoctorId(''); }}
              className="px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              XÃ³a lá»c
            </button>
          )}
          </div>
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
                <th className="px-4 py-3 font-semibold flex items-center gap-2">
                  {isBulkMode && (
                    <input type="checkbox" checked={selectedApts.length > 0 && selectedApts.length === appointments.length} onChange={toggleSelectAll} className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                  )}
                  Thá»i gian
                </th>
                <th className="px-4 py-3 font-semibold">Bá»‡nh nhÃ¢n</th>
                <th className="px-4 py-3 font-semibold">BÃ¡c sÄ©</th>
                <th className="px-4 py-3 font-semibold">PhÃ­ Ä‘áº·t lá»‹ch (thu trÆ°á»›c)</th>
                <th className="px-4 py-3 font-semibold">Tráº¡ng thÃ¡i</th>
                <th className="px-4 py-3 font-semibold">Thao tÃ¡c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Äang táº£i dá»¯ liá»‡u...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    ChÆ°a cÃ³ lá»‹ch háº¹n nÃ o táº¡i phÃ²ng khÃ¡m
                  </td>
                </tr>
              ) : (
                appointments.map(apt => {
                  const isOverdue = isAppointmentOverdue(apt.ngay_kham, apt.gio_kham);
                  const isPendingAndOverdue = (apt.status === 'pending' || apt.status === 'confirmed') && isOverdue;

                  return (
                    <tr key={apt._id} className={`transition-colors ${selectedApts.includes(apt._id) ? 'bg-brand-50' : (isPendingAndOverdue ? 'bg-amber-50/50' : 'hover:bg-slate-50')}`}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        {isBulkMode && (
                          <input type="checkbox" checked={selectedApts.includes(apt._id)} onChange={() => toggleSelect(apt._id)} className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                        )}
                        <div>
                          <div className="font-medium text-slate-800">{apt.gio_kham}</div>
                          <div className="text-xs text-slate-500">{format(new Date(apt.ngay_kham), 'dd/MM/yyyy')}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{apt.user_id?.ho_ten || apt.ten_khach || 'KhÃ¡ch vÃ£ng lai'}</div>
                        <div className="text-xs text-slate-500">{apt.user_id?.so_dien_thoai || apt.so_dien_thoai_khach}</div>
                      </td>
                      <td className="px-4 py-3">{apt.doctor_id?.user_id?.ho_ten || 'ChÆ°a gÃ¡n'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          apt.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                          apt.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          apt.payment_status === 'refunded' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {apt.payment_status === 'paid'
                            ? 'ÄÃ£ tráº£ phÃ­ khÃ¡m'
                            : apt.payment_status === 'partial'
                              ? 'ÄÃ£ tráº£ má»™t pháº§n'
                              : apt.payment_status === 'refunded'
                                ? 'ÄÃ£ hoÃ n phÃ­ khÃ¡m'
                                : 'ChÆ°a tráº£ phÃ­ khÃ¡m'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(apt.status, isPendingAndOverdue).className}`}>
                            {getStatusBadge(apt.status, isPendingAndOverdue).label}
                          </span>
                          {isPendingAndOverdue && (
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                              (QuÃ¡ giá»)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {activeTab !== 'past' && (
                            <>
                              {activeTab === 'today' && hasAction(apt, 'check_in') && (
                                <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                  Tra cá»©u táº¡i Tiáº¿p nháº­n
                                </span>
                              )}
                              {hasAction(apt, 'reschedule') && (
                                <button
                                  title="Dá»i lá»‹ch"
                                  onClick={() => handleReschedule(apt)}
                                  className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                                >
                                  <Icon name="calendar" className="w-4 h-4" />
                                </button>
                              )}
                              {hasAction(apt, 'cancel') && (
                                <button
                                  title="Há»§y lá»‹ch"
                                  onClick={() => handleCancel(apt._id)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                >
                                  <Icon name="ban" className="w-4 h-4" />
                                </button>
                              )}
                              {!hasAction(apt, 'check_in') && !hasAction(apt, 'reschedule') && !hasAction(apt, 'cancel') && apt.lock_reason && (
                                <span className="max-w-[160px] truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600" title={apt.lock_reason}>
                                  {apt.lock_reason}
                                </span>
                              )}
                            </>
                          )}
                          <button
                            title="Xem chi tiáº¿t"
                            onClick={() => {
                              setSelectedDetailAppointment(apt);
                              setDetailModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            <Icon name="eye" className="w-4 h-4" />
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

        {/* Component PhÃ¢n trang */}
        <div className="p-4 border-t border-slate-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modal Lá»‹ch sá»­ Dá»i Lá»‹ch (QuÃ¡ giá»›i háº¡n 1 láº§n) */}
      {rescheduleLimitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-red-600 mb-2">KhÃ¡ch Ä‘Ã£ dÃ¹ng háº¿t lÆ°á»£t dá»i lá»‹ch</h3>
            <p className="text-sm text-slate-600 mb-4">
              KhÃ¡ch hÃ ng nÃ y Ä‘Ã£ tá»± xin dá»i <strong className="text-red-500">1 láº§n</strong> â€” háº¿t háº¡n má»©c. KhÃ¡ch váº«n
              Ä‘Æ°á»£c khÃ¡m náº¿u tá»›i trong ca vÃ  <strong>khÃ´ng máº¥t tiá»n</strong>. Náº¿u láº§n nÃ y lÃ  <strong>lá»—i phÃ²ng khÃ¡m</strong>
              {' '}(bÃ¡c sÄ© nghá»‰, báº­n Ä‘á»™t xuáº¥t, sá»± cá»‘ thiáº¿t bá»‹) thÃ¬ váº«n dá»i Ä‘Æ°á»£c vÃ  khÃ´ng tÃ­nh vÃ o háº¡n má»©c cá»§a khÃ¡ch.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 max-h-60 overflow-y-auto space-y-4">
              {rescheduleHistory.length === 0 ? (
                <p className="text-sm text-slate-500 italic">KhÃ´ng cÃ³ dá»¯ liá»‡u lá»‹ch sá»­ cÅ©.</p>
              ) : (
                rescheduleHistory.map((history, idx) => (
                  <div key={history._id} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Láº§n {idx + 1}</span>
                      <span className="text-xs text-slate-500">{new Date(history.thoi_diem).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">LÃ½ do: {history.ly_do_thay_doi}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRescheduleLimitModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                ÄÃ³ng thÃ´ng bÃ¡o
              </button>
              <button
                onClick={() => {
                  if (!aptDangDoi) return;
                  setRescheduleLimitModalOpen(false);
                  moModalDoiLich(aptDangDoi);
                }}
                className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-sm font-medium transition-colors"
              >
                Dá»i do lá»—i phÃ²ng khÃ¡m
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Há»§y Lá»‹ch */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Há»§y lá»‹ch háº¹n</h3>
            <p className="text-sm text-slate-600 mb-4">Vui lÃ²ng nháº­p lÃ½ do há»§y lá»‹ch Ä‘á»ƒ lÆ°u láº¡i vÃ o há»“ sÆ¡.</p>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none mb-6 resize-none"
              rows={4}
              placeholder="Nháº­p lÃ½ do (vÃ­ dá»¥: khÃ¡ch yÃªu cáº§u há»§y, khÃ´ng liÃªn láº¡c Ä‘Æ°á»£c...)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Quay láº¡i
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                XÃ¡c nháº­n há»§y
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dá»i Lá»‹ch */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Dá»i lá»‹ch háº¹n</h3>
            <p className="text-sm text-slate-600 mb-4">Vui lÃ²ng chá»n ngÃ y vÃ  giá» khÃ¡m má»›i cho bá»‡nh nhÃ¢n.</p>

            <div className="space-y-4 mb-6">
              {/* PhÃ¢n loáº¡i lÃ½ do quyáº¿t Ä‘á»‹nh háº¡n má»©c vÃ  má»‘c thá»i gian (rule má»¥c 5, 11) â€”
                  pháº£i lÃ  lá»±a chá»n tÆ°á»ng minh, khÃ´ng suy Ä‘oÃ¡n há»™ lá»… tÃ¢n. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dá»i theo yÃªu cáº§u cá»§a ai?</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  value={lyDoDoi}
                  onChange={(e) => setLyDoDoi(e.target.value as 'khach_yeu_cau' | 'phong_kham')}
                >
                  <option value="khach_yeu_cau" disabled={khachHetLuotDoi}>
                    KhÃ¡ch yÃªu cáº§u â€” tÃ­nh vÃ o háº¡n má»©c 1 láº§n{khachHetLuotDoi ? ' (Ä‘Ã£ háº¿t lÆ°á»£t)' : ''}
                  </option>
                  <option value="phong_kham">Lá»—i phÃ²ng khÃ¡m â€” khÃ´ng tÃ­nh háº¡n má»©c</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {lyDoDoi === 'khach_yeu_cau'
                    ? 'KhÃ¡ch chá»‰ Ä‘Æ°á»£c dá»i 1 láº§n, vÃ  pháº£i trÆ°á»›c giá» khÃ¡m 30 phÃºt.'
                    : 'KhÃ´ng giá»›i háº¡n sá»‘ láº§n, khÃ´ng bá»‹ má»‘c 30 phÃºt cháº·n. Báº¯t buá»™c ghi rÃµ lÃ½ do bÃªn dÆ°á»›i.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NgÃ y khÃ¡m má»›i</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá» khÃ¡m má»›i</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                >
                  <option value="">-- Chá»n giá» khÃ¡m --</option>
                  {availableSlots.length > 0 ? availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.gio_bat_dau}>
                      {slot.gio_bat_dau} - {slot.gio_ket_thuc}
                    </option>
                  )) : (
                    <option value="" disabled>KhÃ´ng cÃ³ khung giá» ráº£nh</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">LÃ½ do dá»i lá»‹ch</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Nháº­p lÃ½ do dá»i lá»‹ch..."
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
                Há»§y bá»
              </button>
              <button
                onClick={confirmReschedule}
                className="px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg text-sm font-medium transition-colors"
              >
                LÆ°u thay Ä‘á»•i
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiáº¿t Lá»‹ch Háº¹n */}
      {detailModalOpen && selectedDetailAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Chi tiáº¿t Lá»‹ch háº¹n</h3>
                <p className="text-sm text-slate-500 mt-1">MÃ£: {selectedDetailAppointment.ma_lich_hen || 'ChÆ°a cÃ³'}</p>
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

            {/* Ná»™i dung Modal */}
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Cá»™t 1: ThÃ´ng tin KhÃ¡ch hÃ ng & BÃ¡c sÄ© */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">ThÃ´ng tin Bá»‡nh nhÃ¢n</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                      {/* Bá»‡nh nhÃ¢n khÃ¡m thá»±c táº¿ */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">NgÆ°á»i Ä‘áº¿n khÃ¡m</p>
                        <p className="font-semibold text-slate-800">
                          {selectedDetailAppointment.ten_khach || selectedDetailAppointment.user_id?.ho_ten || 'KhÃ¡ch vÃ£ng lai'}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {selectedDetailAppointment.so_dien_thoai_khach || selectedDetailAppointment.user_id?.so_dien_thoai || 'KhÃ´ng cÃ³ sá»‘ Ä‘iá»‡n thoáº¡i'}
                        </p>
                      </div>

                      {/* TÃ i khoáº£n Ä‘áº·t lá»‹ch */}
                      {selectedDetailAppointment.user_id && (
                        <div className="pt-3 border-t border-slate-200 border-dashed">
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">TÃ i khoáº£n Ä‘áº·t lá»‹ch</p>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p className="font-medium text-sm text-slate-700">
                              {selectedDetailAppointment.user_id.ho_ten}
                            </p>
                            {selectedDetailAppointment.dat_ho && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                                Äáº·t há»™
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">ThÃ´ng tin Dá»‹ch vá»¥</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">BÃ¡c sÄ© phá»¥ trÃ¡ch</p>
                        <p className="font-medium text-slate-800">{selectedDetailAppointment.doctor_id?.user_id?.ho_ten || 'ChÆ°a gÃ¡n'}</p>
                      </div>
                      {selectedDetailAppointment.ten_dich_vu && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Dá»‹ch vá»¥</p>
                          <p className="font-medium text-slate-800">{selectedDetailAppointment.ten_dich_vu}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Loáº¡i khÃ¡m</p>
                        <span className="px-2 py-1 rounded text-[11px] font-semibold bg-brand-50 text-brand-700">
                          {selectedDetailAppointment.loai_kham === 'home' ? 'Táº¡i nhÃ ' : 'Táº¡i phÃ²ng khÃ¡m'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cá»™t 2: Thá»i gian, Tráº¡ng thÃ¡i & LÃ½ do */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Lá»‹ch háº¹n & Tráº¡ng thÃ¡i</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 border-dashed">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Giá» khÃ¡m</p>
                          <p className="font-bold text-slate-800 text-lg">{selectedDetailAppointment.gio_kham}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">NgÃ y khÃ¡m</p>
                          <p className="font-medium text-slate-800">
                            {format(new Date(selectedDetailAppointment.ngay_kham), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <p className="text-sm text-slate-600">Tráº¡ng thÃ¡i khÃ¡m:</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedDetailAppointment.status, isAppointmentOverdue(selectedDetailAppointment.ngay_kham, selectedDetailAppointment.gio_kham)).className}`}>
                          {getStatusBadge(selectedDetailAppointment.status, isAppointmentOverdue(selectedDetailAppointment.ngay_kham, selectedDetailAppointment.gio_kham)).label}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-600">PhÃ­ Ä‘áº·t lá»‹ch (thu trÆ°á»›c):</p>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{selectedDetailAppointment.gia_kham?.toLocaleString('vi-VN')} Ä‘</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            selectedDetailAppointment.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                            selectedDetailAppointment.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            selectedDetailAppointment.payment_status === 'refunded' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedDetailAppointment.payment_status === 'paid'
                              ? 'ÄÃ£ tráº£ phÃ­ khÃ¡m'
                              : selectedDetailAppointment.payment_status === 'partial'
                                ? 'ÄÃ£ tráº£ má»™t pháº§n'
                                : selectedDetailAppointment.payment_status === 'refunded'
                                  ? 'ÄÃ£ hoÃ n phÃ­ khÃ¡m'
                                  : 'ChÆ°a tráº£ phÃ­ khÃ¡m'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">LÃ½ do khÃ¡m / Triá»‡u chá»©ng</h4>
                    <div className="bg-brand-50/50 p-4 rounded-lg border border-brand-100 text-sm text-slate-700 leading-relaxed min-h-[80px]">
                      {selectedDetailAppointment.ly_do_kham || <span className="text-slate-400 italic">Bá»‡nh nhÃ¢n khÃ´ng ghi chÃº gÃ¬ thÃªm.</span>}
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
                ÄÃ³ng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-in XÃ¡c nháº­n */}
      {confirmCheckInModalOpen && selectedCheckInApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">XÃ¡c nháº­n ÄÃ£ Ä‘áº¿n</h3>
            <div className="mb-6">
              <p className="text-slate-600 mb-2">ThÃ´ng tin in trÃªn phiáº¿u chá» khÃ¡m:</p>
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 space-y-2">
                <div className="flex justify-between border-b border-emerald-200/50 pb-2">
                  <span className="text-sm opacity-80">Bá»‡nh nhÃ¢n:</span>
                  <span className="font-bold">{selectedCheckInApt.user_id?.ho_ten || selectedCheckInApt.ten_khach || 'KhÃ¡ch vÃ£ng lai'}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-200/50 pb-2">
                  <span className="text-sm opacity-80">BÃ¡c sÄ©:</span>
                  <span className="font-semibold">{selectedCheckInApt.doctor_id?.user_id?.ho_ten || 'Äang cáº­p nháº­t'}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-sm opacity-80">PhÃ²ng khÃ¡m:</span>
                  <span className="font-semibold">
                    {`PhÃ²ng ${parseInt((selectedCheckInApt.doctor_id?._id || '0').substring(20) || '0', 16) % 5 + 101}`}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3 italic text-center">Há»‡ thá»‘ng sáº½ Ä‘áº©y lá»‡nh in Sá»‘ thá»© tá»± tá»›i mÃ¡y in sau khi xÃ¡c nháº­n.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmCheckInModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Há»§y bá»
              </button>
              <button
                onClick={confirmCheckIn}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Icon name="check" className="w-4 h-4" />
                XÃ¡c nháº­n & In Phiáº¿u
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {isBulkMode && selectedApts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-full px-6 py-3 flex items-center gap-6 z-40">
          <span className="font-semibold text-brand-700">ÄÃ£ chá»n {selectedApts.length} lá»‹ch háº¹n</span>
          <div className="w-px h-6 bg-slate-200"></div>
          <button onClick={() => setBulkCancelModalOpen(true)} className="text-red-600 hover:text-red-700 font-medium text-sm">Há»§y hÃ ng loáº¡t</button>
          <button onClick={() => setBulkRescheduleModalOpen(true)} className="bg-brand-600 text-white px-4 py-1.5 rounded-full hover:bg-brand-700 font-medium text-sm">Dá»i lá»‹ch hÃ ng loáº¡t</button>
        </div>
      )}

      {/* Bulk Cancel Modal */}
      {bulkCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                Há»§y {selectedApts.length} lá»‹ch háº¹n
              </h3>
              <button onClick={() => setBulkCancelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">LÃ½ do há»§y hÃ ng loáº¡t (Ã¡p dá»¥ng cho táº¥t cáº£)</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  rows={3}
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Vd: BÃ¡c sÄ© nghá»‰ á»‘m Ä‘á»™t xuáº¥t"
                ></textarea>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button onClick={() => setBulkCancelModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">Há»§y bá»</button>
              <button onClick={handleBulkCancel} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium">XÃ¡c nháº­n Há»§y</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reschedule Modal */}
      {bulkRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-brand-50/50">
              <h3 className="text-lg font-bold text-brand-700 flex items-center gap-2">
                Dá»i {selectedApts.length} lá»‹ch háº¹n (Auto-fill)
              </h3>
              <button onClick={() => setBulkRescheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                Há»‡ thá»‘ng sáº½ tá»± Ä‘á»™ng tÃ¬m kiáº¿m chá»— trá»‘ng (ká»ƒ cáº£ cá»§a BÃ¡c sÄ© khÃ¡c cÃ¹ng chuyÃªn khoa) Ä‘á»ƒ dá»“n cÃ¡c bá»‡nh nhÃ¢n vÃ o, báº¯t Ä‘áº§u tá»« <b>NgÃ y báº¯t Ä‘áº§u</b> báº¡n chá»n bÃªn dÆ°á»›i.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">NgÃ y báº¯t Ä‘áº§u tÃ¬m chá»— trá»‘ng <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                />
              </div>
              {availableBulkSlots.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Khung giá» báº¯t Ä‘áº§u <span className="text-red-500">*</span></label>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    value={bulkStartTime}
                    onChange={(e) => setBulkStartTime(e.target.value)}
                  >
                    <option value="">-- Chá»n giá» --</option>
                    {availableBulkSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              )}
              {bulkStartDate && availableBulkSlots.length === 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1 bg-amber-50 p-3 rounded-lg border border-amber-100">
                  <Icon name="alert-triangle" className="w-4 h-4" />
                  KhÃ´ng cÃ³ khung giá» nÃ o trá»‘ng trong ngÃ y nÃ y.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">LÃ½ do dá»i (Ã¡p dá»¥ng cho táº¥t cáº£)</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  rows={2}
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Vd: BÃ¡c sÄ© nghá»‰ phÃ©p, chuyá»ƒn sang ca tiáº¿p theo"
                ></textarea>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button onClick={() => setBulkRescheduleModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">Há»§y bá»</button>
              <button onClick={handleBulkReschedule} disabled={!bulkStartDate || (availableBulkSlots.length > 0 && !bulkStartTime)} className="px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg text-sm font-medium disabled:opacity-50">XÃ¡c nháº­n Dá»i</button>
            </div>
          </div>
        </div>
      )}

      {/* Component In Phiáº¿u áº¨n */}
      <QueueTicketTemplate data={printData} />

    </div>
  );
}
