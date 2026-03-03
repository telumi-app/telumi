// @telumi/db — Prisma client + types re-export
export { prisma, PrismaClient } from './client';
export type {
  Workspace,
  User,
  Device,
  DeviceHeartbeat,
} from '@prisma/client';
export {
  UserRole,
  DeviceStatus,
} from '@prisma/client';
