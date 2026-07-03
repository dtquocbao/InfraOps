import type { UserRole } from './schemas/auth';

/** Maximum security clearance per role for document retrieval */
export const ROLE_CLEARANCE: Record<UserRole, string[]> = {
  engineer: ['public', 'internal'],
  pm: ['public', 'internal'],
  safety: ['public', 'internal', 'confidential'],
  executive: ['public', 'internal', 'confidential'],
  admin: ['public', 'internal', 'confidential', 'restricted'],
};

export function clearanceForRole(role: UserRole): string[] {
  return ROLE_CLEARANCE[role] ?? ['public'];
}
