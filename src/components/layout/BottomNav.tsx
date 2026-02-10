import { NavLink } from 'react-router-dom'
import { Home, TrendingUp, Wallet, ShoppingCart, History, BarChart3, type LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/incomes', label: 'Earn', icon: TrendingUp },
  { to: '/budgets', label: 'Budget', icon: Wallet },
  { to: '/spendings', label: 'Spend', icon: ShoppingCart },
  { to: '/history', label: 'History', icon: History },
  { to: '/statistics', label: 'Stats', icon: BarChart3 },
]

export function BottomNav({ className = '' }: { className?: string }) {
  return (
    <nav
      className={`shrink-0 border-t border-gray-200 bg-white flex items-center justify-around px-1 pt-2 ${className}`}
      style={{ paddingBottom: 'calc(var(--safe-area-bottom) + 3rem)' }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center py-1.5 px-1 transition-colors ${
              isActive ? 'text-emerald-600 font-medium' : 'text-gray-500'
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
