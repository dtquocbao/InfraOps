import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  FileText,
  LayoutDashboard,
  Shield,
  FolderKanban,
  Settings,
} from 'lucide-react';
import type { UserRole } from '@infraops/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  roles?: UserRole[];
}

const ALL_ROLES: UserRole[] = ['engineer', 'pm', 'safety', 'executive', 'admin'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Executive', icon: LayoutDashboard, end: true, roles: ['pm', 'executive', 'admin'] },
  { to: '/projects', label: 'Projects', icon: FolderKanban, roles: ['pm', 'executive', 'admin'] },
  { to: '/assistant', label: 'AI Assistant', icon: Bot, roles: ALL_ROLES },
  { to: '/documents', label: 'Documents', icon: FileText, roles: ['pm', 'safety', 'executive', 'admin'] },
  { to: '/reviews', label: 'Human Review', icon: Shield, roles: ['pm', 'safety', 'executive', 'admin'] },
  { to: '/iot', label: 'IoT Monitor', icon: Activity, roles: ['pm', 'executive', 'admin'] },
  { to: '/admin', label: 'Admin', icon: Settings, roles: ['admin', 'executive'] },
];

const ROUTE_ACCESS: Record<string, UserRole[] | 'all'> = {
  '/': ['pm', 'executive', 'admin'],
  '/projects': ['pm', 'executive', 'admin'],
  '/assistant': ALL_ROLES,
  '/documents': ['pm', 'safety', 'executive', 'admin'],
  '/reviews': ['pm', 'safety', 'executive', 'admin'],
  '/iot': ['pm', 'executive', 'admin'],
  '/admin': ['admin', 'executive'],
};

export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export function getDefaultRoute(role: UserRole): string {
  if (role === 'engineer') return '/assistant';
  if (role === 'safety') return '/reviews';
  return '/';
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const path = pathname === '' ? '/' : pathname.replace(/\/$/, '') || '/';
  const allowed = ROUTE_ACCESS[path];
  if (!allowed) return true;
  if (allowed === 'all') return true;
  return allowed.includes(role);
}
