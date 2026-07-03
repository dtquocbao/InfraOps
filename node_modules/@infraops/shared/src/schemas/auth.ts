import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'engineer',
  'pm',
  'safety',
  'executive',
  'admin',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: UserRoleSchema,
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string(),
  role: UserRoleSchema,
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
