export type AuthUser = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  workspaceId: string;
  iat?: number;
  exp?: number;
};
