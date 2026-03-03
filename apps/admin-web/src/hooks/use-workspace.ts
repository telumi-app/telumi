import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type MeResponseData } from '@/lib/api/auth';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';

export function useWorkspace() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<MeResponseData['workspace'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const token = getSessionToken();

      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const response = await authApi.me(token);
        if (mounted && response.data) {
          setWorkspace(response.data.workspace);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Sessão inválida')) {
          clearSessionToken();
          router.replace('/login');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  return { workspace, loading };
}
