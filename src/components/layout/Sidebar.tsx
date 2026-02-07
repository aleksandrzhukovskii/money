import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/statistics', label: 'Statistics' },
]

export function Sidebar({ className = '' }: { className?: string }) {
  return (
    <nav className={`w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex-col p-4 gap-1 ${className}`}>
      <h1 className="text-lg font-semibold px-3 py-2 mb-2">Money</h1>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `block rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-emerald-100 text-emerald-900 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
