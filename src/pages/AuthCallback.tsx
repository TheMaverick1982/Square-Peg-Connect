import { useEffect, useRef } from 'react';
import { UserManager } from 'oidc-client-ts';
import { useAuth } from 'react-oidc-context';
import { Navigate } from 'react-router-dom';
import { oidcConfig } from '../lib/oidc';

export function AuthCallback() {
  const auth = useAuth();
  const ran = useRef(false);

  // This route lives at /auth/callback, so an opener here means we are the
  // sign-in popup the app opened. Discriminate on the opener AND being a popup
  // landing on the callback — not opener alone, which is non-null for any
  // window opened via window.open()/target="_blank".
  const isAuthPopup =
    !!window.opener &&
    window.location.pathname.endsWith('/auth/callback');

  // Popup window: relay the result to the opener, then close. signinPopupCallback()
  // does not read the state store, so partitioning is not a problem here. The ran
  // ref makes this fire exactly once under React 18 StrictMode double-mount, so a
  // genuine failure is logged rather than masked by a duplicate "state consumed" error.
  useEffect(() => {
    if (!isAuthPopup || ran.current) return;
    ran.current = true;
    new UserManager(oidcConfig)
      .signinPopupCallback()
      .catch((e) => console.error('popup sign-in callback failed', e))
      .finally(() => window.close());
  }, [isAuthPopup]);
  if (isAuthPopup) return <div aria-busy="true" className="h-screen w-screen flex items-center justify-center">Signing you in…</div>;

  // Redirect flow (default), processed automatically by react-oidc-context.
  // auth.error is set when the callback carries ?error= (e.g. server_error).
  if (auth.error) return <div role="alert" className="h-screen w-screen flex items-center justify-center">Sign in failed: {auth.error.message}</div>;
  if (auth.isAuthenticated) return <Navigate to="/" replace />;
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-muted-foreground">Signing you in…</div>
    </div>
  );
}
