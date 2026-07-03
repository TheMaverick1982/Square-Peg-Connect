import type { UserManagerSettings } from 'oidc-client-ts';
import { vibeConfig } from '@/vibe.config';

// The callback path is the same registered URL for both flows — popup reuses
// it, so there is no new redirect URI to register at the identity provider.
const callbackUrl = new URL('auth/callback', document.baseURI).href;

// Extract exact scopes from config and ensure 'email' is requested
// so we get the email claim needed for Admin mapping
const scopes = vibeConfig.sso.scopes.includes('email') 
  ? vibeConfig.sso.scopes 
  : `${vibeConfig.sso.scopes} email`;

export const oidcConfig: UserManagerSettings = {
  authority: vibeConfig.sso.authority,
  client_id: vibeConfig.sso.clientId,
  redirect_uri: callbackUrl,
  popup_redirect_uri: callbackUrl,
  post_logout_redirect_uri: window.location.origin,
  scope: scopes,
  response_type: 'code',
  automaticSilentRenew: true,
  loadUserInfo: true,
  extraQueryParams: { [vibeConfig.sso.loginParamKey]: vibeConfig.sso.loginParamValue },
};
