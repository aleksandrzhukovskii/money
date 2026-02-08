import { NavLink } from 'react-router-dom'
import { Home, TrendingUp, Wallet, ShoppingCart, BarChart3, type LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/incomes', label: 'Incomes', icon: TrendingUp },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/spendings', label: 'Spendings', icon: ShoppingCart },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
]

export function Sidebar({ className = '' }: { className?: string }) {
  return (
    <nav className={`w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex-col p-4 gap-1 ${className}`}>
      <h1 className="text-lg font-semibold px-3 py-2 mb-2">Money</h1>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-emerald-100 text-emerald-900 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
