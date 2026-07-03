import type { UserRole } from './schemas/auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ApiHealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
  };
}
