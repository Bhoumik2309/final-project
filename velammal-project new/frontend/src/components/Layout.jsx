import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  ScanLine,
  FileText,
  ClipboardList,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scan', icon: ScanLine, label: 'Scan Exam' },
  { to: '/result-sheets', icon: ClipboardList, label: 'Result Sheets' },
  { to: '/results', icon: FileText, label: 'All Results' },
]

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: '#FFF8F0' }}>
      {/* Sidebar */}
      <aside className="w-64 flex flex-col shadow-xl" style={{ background: 'linear-gradient(180deg, #8B1A1A 0%, #6B1414 100%)' }}>
        {/* Logo Header */}
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="flex items-center gap-3">
            <img
              src="/app-logo.png"
              alt="Velammal Logo"
              className="w-12 h-12 object-contain"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Velammal</h1>
              <p className="text-xs font-semibold" style={{ color: '#F5C518' }}>Engineering College</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>ExamScan AI</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'hover:text-white'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(232,119,34,0.85)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="flex items-center justify-center gap-2">
            <img src="/app-logo.png" alt="" className="w-5 h-5 object-contain opacity-60" />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
