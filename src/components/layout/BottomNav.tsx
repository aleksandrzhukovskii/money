import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/statistics', label: 'Stats' },
]

export function BottomNav({ className = '' }: { className?: string }) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white flex items-center justify-around px-2 ${className}`}
      style={{ paddingBottom: 'var(--safe-area-bottom)' }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
              isActive ? 'text-emerald-600 font-medium' : 'text-gray-500'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
