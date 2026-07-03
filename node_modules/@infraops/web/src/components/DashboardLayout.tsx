import { NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { APP_NAME, COMPANY_NAME } from '@infraops/shared';
import { useAuth } from '../lib/auth';
import { getNavForRole } from '../lib/navigation';
import { cn } from '../lib/utils';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navItems = user ? getNavForRole(user.role) : [];

  return (
    <div className="flex min-h-screen bg-charcoal-950">
      <aside className="flex w-64 flex-col border-r border-charcoal-700 bg-charcoal-900">
        <div className="border-b border-charcoal-700 p-5">
          <p className="text-xs uppercase tracking-wider text-accent">{APP_NAME}</p>
          <h1 className="mt-1 text-lg font-semibold text-white">{COMPANY_NAME}</h1>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-gray-400 hover:bg-charcoal-800 hover:text-gray-200',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-charcoal-700 p-4">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-xs capitalize text-gray-500">{user?.role}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-charcoal-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
