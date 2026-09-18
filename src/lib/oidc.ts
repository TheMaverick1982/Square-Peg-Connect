import type { UserManagerSettings } from 'oidc-client-ts';
import { vibeConfig } from '@/vibe.config';

// Call this only where a browser exists: after client mount, or in an
// event handler. NEVER at module scope, and never during a server render.
export function buildOidcConfig(): UserManagerSettings {
  const callbackUrl = new URL('auth/callback', document.baseURI).href;
  return {
    authority: vibeConfig.sso.authority,
    client_id: vibeConfig.sso.clientId,
    redirect_uri: callbackUrl,
    popup_redirect_uri: callbackUrl,
    post_logout_redirect_uri: window.location.origin,
    scope: vibeConfig.sso.scopes,
    response_type: 'code',
    automaticSilentRenew: true,
    loadUserInfo: true,
    extraQueryParams: { [vibeConfig.sso.loginParamKey]: vibeConfig.sso.loginParamValue },
  };
}
