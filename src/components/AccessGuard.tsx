import { useEffect, useState, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import type { User } from 'oidc-client-ts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'unauthorized' | 'forbidden'>('loading');
  const checkedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.id_token) return;

    const checkAccess = async (idToken: string) => {
      // Don't check the same token multiple times
      if (checkedTokenRef.current === idToken && status !== 'loading') return;
      
      setStatus('loading');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch('https://vibe-prod.apigateway.co/api/projects/AG-D5HZKZ2TNH/6c9fc416-c440-4bad-a4ac-274e11e95763/access', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 200) {
          checkedTokenRef.current = idToken;
          setStatus('allowed');
        } else if (res.status === 401) {
          setStatus('unauthorized');
        } else if (res.status === 403) {
          setStatus('forbidden');
        } else {
          // Any other status (500, etc) stays loading as per instructions
          // and will retry naturally on next mount or silent renew
        }
      } catch (err) {
        clearTimeout(timeoutId);
        // Network error, timeout, etc., stay in loading state
      }
    };

    checkAccess(auth.user.id_token);

    // Re-check on silent renew
    const handleUserLoaded = (user: User) => {
      if (user?.id_token) {
        checkAccess(user.id_token);
      }
    };

    auth.events.addUserLoaded(handleUserLoaded);
    return () => {
      auth.events.removeUserLoaded(handleUserLoaded);
    };
  }, [auth.isAuthenticated, auth.user?.id_token, auth.events, status]);

  if (!auth.isAuthenticated) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div aria-busy="true" className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <span className="sr-only">Verifying access</span>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
        <Card role="alert" className="max-w-md w-full p-6 text-center shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Session Expired</h2>
          <p className="text-muted-foreground mb-6">Your session is invalid. Please sign in again.</p>
          <Button 
            className="w-full" 
            autoFocus 
            onClick={() => {
              auth.removeUser().then(() => {
                auth.signinRedirect({ prompt: 'login' });
              });
            }}
          >
            Sign In Again
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
        <Card role="alert" className="max-w-md w-full p-6 text-center shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You don't have access to this app.</p>
          <div className="space-y-3">
            <Button 
              className="w-full" 
              autoFocus 
              onClick={() => {
                auth.signinRedirect({ prompt: 'login' });
              }}
            >
              Switch Account
            </Button>
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => {
                auth.signoutRedirect({ extraQueryParams: { logoutAllNamespaces: 'true' } });
              }}
            >
              Sign out everywhere
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
