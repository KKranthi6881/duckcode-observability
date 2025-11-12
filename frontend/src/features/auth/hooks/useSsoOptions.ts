import { useEffect, useState } from 'react';

export interface SsoConnectionInfo {
  organizationId: string;
  providerType: string;
  providerLabel?: string | null;
  enforce: boolean;
  allowPasswordFallback: boolean;
}

interface SsoOptionsState {
  domain: string | null;
  connection: SsoConnectionInfo | null;
}

export const useSsoOptions = (email: string) => {
  const [state, setState] = useState<SsoOptionsState>({ domain: null, connection: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !email.includes('@')) {
      setState({ domain: null, connection: null });
      setError(null);
      return;
    }

    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/auth/sso/options?email=${encodeURIComponent(email)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch SSO options');
        }

        const data = await response.json();
        setState({
          domain: data.domain ?? null,
          connection: data.connection ?? null,
        });
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          return;
        }
        console.error('SSO lookup error:', err);
        setError((err as Error).message);
        setState({ domain: null, connection: null });
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [email]);

  return {
    domain: state.domain,
    connection: state.connection,
    isLoading,
    error,
  };
};
