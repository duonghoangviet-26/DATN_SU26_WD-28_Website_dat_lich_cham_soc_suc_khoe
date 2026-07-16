import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/receptionist/Sidebar';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { receptionistNotificationService, VirtualNotification } from '@/services/receptionist-notification.service';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header tạm thời */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 z-10 shadow-sm relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800">Cổng Lễ Tân</h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={handleToggleDropdown}
                className="relative p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-full transition-colors focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 lg:w-96 rounded-xl bg-white shadow-xl border border-slate-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Thông báo Lễ tân</h3>
                    <span className="text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded-full font-semibold">Mới nhất</span>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">Chưa có thông báo nào</div>
                    ) : (
                      notifications.map(notif => {
                        const isUnread = new Date(notif.ngay_tao).getTime() > (localStorage.getItem('receptionist_last_viewed_notification') ? new Date(localStorage.getItem('receptionist_last_viewed_notification')!).getTime() : 0);
                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/receptionist/appointments');
                            }}
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${isUnread ? 'bg-brand-50/30' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${isUnread ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                                  {notif.tieu_de}
                                </p>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                  {notif.noi_dung}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-wide">
                                  {formatDistanceToNow(new Date(notif.ngay_tao), { addSuffix: true, locale: vi })}
                                </p>
                              </div>
                              {isUnread && <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
              <span className="text-sm font-bold text-slate-700">{user?.ho_ten || 'Lễ Tân'}</span>
              <button 
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>
        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
