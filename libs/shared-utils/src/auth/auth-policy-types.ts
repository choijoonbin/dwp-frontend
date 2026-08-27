export type AuthPolicyResponse = {
  tenantId: number;
  defaultLoginType: 'LOCAL' | 'SSO';
  allowedLoginTypes: Array<'LOCAL' | 'SSO'>;
  localLoginEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoProviderKey?: string | null;
  requireMfa: boolean;
};

export type LoginOptionsResponse = {
  localLoginAvailable: boolean;
  ssoLoginAvailable: boolean;
  preferredLoginType: 'LOCAL' | 'SSO' | 'NONE';
};

export type IdentityProviderResponse = {
  enabled: boolean;
  providerType: 'OIDC' | 'SAML' | string;
  providerKey: string;
};
