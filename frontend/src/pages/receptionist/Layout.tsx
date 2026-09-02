import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/receptionist/Sidebar';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { receptionistNotificationService, VirtualNotification } from '@/services/receptionist-notification.service';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Bell, LogOut, Menu } from 'lucide-react';

function notificationTone(notification: VirtualNotification) {
  const priority = notification.du_lieu_dinh_kem?.priority
  if (priority === 'urgent') {
    return {
      label: 'Khẩn',
      item: 'border-red-200 bg-red-50 hover:bg-red-100',
      dot: 'bg-red-600',
      pill: 'bg-red-600 text-white',
    }
  }
  if (priority === 'warning') {
    return {
      label: 'Cần xử lý',
      item: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
      dot: 'bg-amber-500',
      pill: 'bg-amber-100 text-amber-800',
    }
  }
  return {
    label: 'Thông tin',
    item: 'border-slate-100 bg-white hover:bg-slate-50',
    dot: 'bg-brand-500',
    pill: 'bg-slate-100 text-slate-600',
  }
}

export default function ReceptionistLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Notification States
  const [notifications, setNotifications] = useState<VirtualNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Đọc thời điểm xem gần nhất từ localStorage
    const savedTime = localStorage.getItem('receptionist_last_viewed_notification');
    const lastViewed = savedTime ? new Date(savedTime).getTime() : 0;

    const fetchNotifications = async () => {
      try {
        const data = await receptionistNotificationService.getRecentNotifications();
        setNotifications(data);
        // Đếm số lượng thông báo được tạo SAU mốc lastViewed
        const unread = data.filter(n => new Date(n.ngay_tao).getTime() > lastViewed).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Lỗi khi fetch thông báo ảo:', error);
      }
    };

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 15000); // Polling mỗi 15 giây

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Đóng dropdown khi click ra ngoài
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown && unreadCount > 0) {
      // Khi mở ra xem, cập nhật mốc thời gian xem thành hiện tại
      localStorage.setItem('receptionist_last_viewed_notification', new Date().toISOString());
      setUnreadCount(0); // Reset số lượng chưa đọc ngay lập tức trên UI
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700 lg:hidden"
              aria-label="Mở menu lễ tân"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-950">Cổng lễ tân</p>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">Điều phối lịch hẹn, tiếp nhận và thanh toán</p>
            </div>
          </div>
          
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* Notification Bell */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={handleToggleDropdown}
                className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700"
                aria-label="Mở thông báo lễ tân"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showDropdown && (
                <div className="absolute right-0 z-50 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-bold text-slate-950">Thông báo lễ tân</h3>
                    <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">Mới nhất</span>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">Chưa có thông báo nào</div>
                    ) : (
                      notifications.map(notif => {
                        const isUnread = new Date(notif.ngay_tao).getTime() > (localStorage.getItem('receptionist_last_viewed_notification') ? new Date(localStorage.getItem('receptionist_last_viewed_notification')!).getTime() : 0);
                        const tone = notificationTone(notif);
                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              setShowDropdown(false);
                              const targetUrl = notif.du_lieu_dinh_kem?.url;
                              const isDoctorMsg = notif.related_type === 'doctor_reception_message' || notif.du_lieu_dinh_kem?.source === 'doctor_reception_message';
                              if (isDoctorMsg) {
                                navigate('/receptionist/quan-ly-dieu-phoi');
                              } else if (typeof targetUrl === 'string' && targetUrl && targetUrl !== '/receptionist/dashboard') {
                                navigate(targetUrl);
                              } else {
                                navigate('/receptionist/quan-ly-dieu-phoi');
                              }
                            }}
                            className={`cursor-pointer border-b p-4 transition-colors ${tone.item} ${isUnread ? 'ring-1 ring-inset ring-brand-100' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <p className={`line-clamp-2 text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                    {notif.tieu_de}
                                  </p>
                                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tone.pill}`}>{tone.label}</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                  {notif.noi_dung}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-wide">
                                  {formatDistanceToNow(new Date(notif.ngay_tao), { addSuffix: true, locale: vi })}
                                </p>
                              </div>
                              {isUnread && <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-3 sm:gap-3 sm:pl-4">
              <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-700 sm:inline">{user?.ho_ten || 'Lễ tân'}</span>
              <button 
                onClick={handleLogout}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </div>
        </header>
        {/* Main Content Area */}
        <main className="relative flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
