import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '@/components/admin/icons';
import { receptionistContactTasksService } from '../../services/receptionist-contact-tasks.service';

interface Props {
  open: boolean;
  onClose: () => void;
}

const receptionistMenu = [
  { path: '/receptionist', label: 'Tổng quan tiếp đón', icon: 'dashboard', end: true },
  { path: '/receptionist/appointments', label: 'Lịch khám phòng khám', icon: 'calendar' },
  { path: '/receptionist/patient-intake', label: 'Tiếp nhận bệnh nhân', icon: 'user-check' },
  { path: '/receptionist/doctor-day-view', label: 'Điều phối bác sĩ', icon: 'stethoscope' },
  { path: '/receptionist/contact-tasks', label: 'Liên hệ bệnh nhân', icon: 'phone-call' },
  { path: '/receptionist/activity-log', label: 'Nhật ký ca trực', icon: 'clipboard-list' },
  { path: '/receptionist/payments', label: 'Viện phí & hóa đơn', icon: 'receipt' },
  { path: '/receptionist/news', label: 'Tin sức khỏe', icon: 'newspaper' },
];

export default function Sidebar({ open, onClose }: Props) {
  const [chuaGoiCount, setChuaGoiCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      receptionistContactTasksService
        .list({ trang_thai: 'chua_goi' })
        .then((tasks) => { if (!cancelled) setChuaGoiCount(tasks.length); })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-white border-r border-slate-200 transform transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">ViteFamily</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Receptionist</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Điều phối</p>
          {receptionistMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.path === '/receptionist/contact-tasks' && chuaGoiCount > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{chuaGoiCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
