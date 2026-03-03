/** User roles for RBAC */
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

/** Device connection status (computed at runtime, not stored in DB) */
export enum DeviceStatus {
  PENDING = 'PENDING',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/** Tenant operation mode */
export enum TenantMode {
  INTERNAL = 'INTERNAL',
  MARKETPLACE = 'MARKETPLACE',
}
