import { NavLink } from 'react-router-dom'
import { adminMenu } from '@/routes/adminMenu'
import Icon from './icons'

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
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
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">VitaFamily</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Khu vực quản trị</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {adminMenu.map((item, idx) => {
            if (item.type === 'section') {
              return (
                <p
                  key={idx}
                  className="mb-1 mt-5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 first:mt-0"
                >
                  {item.label}
                </p>
              )
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`
                }
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <p className="text-[10px] text-slate-400">VitaFamily v1.0 · DATN SU26 WD-28</p>
        </div>
      </aside>
    </>
  )
}
