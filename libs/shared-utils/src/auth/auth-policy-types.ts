export type AuthPolicyResponse = {
  tenantId: number;
  defaultLoginType: 'LOCAL' | 'SSO';
  allowedLoginTypes: Array<'LOCAL' | 'SSO'>;
  localLoginEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoProviderKey?: string | null;
  requireMfa: boolean;
};

export type IdentityProviderResponse = {
  tenantId: number;
  enabled: boolean;
  providerType: 'OIDC' | 'SAML' | string;
  providerKey: string;
  authUrl?: string | null;
  metadataUrl?: string | null;
  clientId?: string | null;
};
