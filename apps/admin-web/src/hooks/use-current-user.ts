import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type MeResponseData } from '@/lib/api/auth';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';

export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponseData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.me(token);
      if (response.data) {
        setUser(response.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (
        message.includes('Sessão inválida') ||
        message.includes('autenticado') ||
        message.includes('Unauthorized')
      ) {
        clearSessionToken();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      await refreshUser();
    };

    void load();

    const onUserUpdated = () => {
      if (mounted) {
        void refreshUser();
      }
    };

    window.addEventListener('telumi:user-updated', onUserUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('telumi:user-updated', onUserUpdated);
    };
  }, [refreshUser]);

  const logout = useCallback(() => {
    clearSessionToken();
    setUser(null);
    router.replace('/login');
  }, [router]);

  return { user, loading, logout, refreshUser };
}
