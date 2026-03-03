import type { ReactNode } from 'react';

type AuthCardShellProps = {
  children: ReactNode;
};

export function AuthCardShell({ children }: AuthCardShellProps) {
  return (
    <div className="w-full flex justify-center">
      {children}
    </div>
  );
}
