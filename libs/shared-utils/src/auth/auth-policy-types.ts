// ----------------------------------------------------------------------

/**
 * Login type
 */
export type LoginType = 'LOCAL' | 'SSO';

/**
 * Auth Policy Response
 * GET /api/auth/policy
 */
export type AuthPolicyResponse = {
  tenantId: string;
  allowedLoginTypes: LoginType[];
  defaultLoginType: LoginType;
  requireMfa?: boolean;
  passwordPolicy?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
  };
};

/**
 * Identity Provider Response
 * GET /api/auth/idp
 */
export type IdentityProviderResponse = {
  tenantId: string;
  providerType: 'OIDC' | 'SAML' | 'LDAP';
  providerName: string;
  authUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};
