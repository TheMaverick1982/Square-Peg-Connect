import type { UserManagerSettings } from 'oidc-client-ts';

// The callback path is the same registered URL for both flows — popup reuses
// it, so there is no new redirect URI to register at the identity provider.
const callbackUrl = new URL('auth/callback', document.baseURI).href;

export const oidcConfig: UserManagerSettings = {
  authority: 'https://iam-prod.apigateway.co/.well-known/openid-configuration'.replace(/\/\.well-known\/openid-configuration$/, ''),
  client_id: '77c36b5a-d90a-4d6e-841e-8a3e28aa5f70',
  // callbackUrl resolves against document.baseURI, which Vite populates from
  // the --base flag, so the same build works from the iframe preview proxy,
  // the deployed subdomain, or localhost.
  redirect_uri: callbackUrl,
  popup_redirect_uri: callbackUrl,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile business-app user:read',
  response_type: 'code',
  automaticSilentRenew: true,
  loadUserInfo: true,
  // SSO uses this to route the user to the correct login method for their
  // partner. Omitting it causes /oauth2/authorize to fail with
  // error=server_error on the callback. Keep the exact key and value.
  extraQueryParams: { account_id: 'AG-D5HZKZ2TNH' },
};
