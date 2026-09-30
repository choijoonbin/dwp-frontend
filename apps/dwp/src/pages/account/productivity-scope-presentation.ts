type Translate = (key: string) => string;

const PRODUCTIVITY_SCOPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  'Mail.ReadBasic': 'profile.connections.permissions.mailBasicRead',
  'Mail.Read': 'profile.connections.permissions.mailRead',
  'Mail.ReadWrite': 'profile.connections.permissions.mailManage',
  'Calendars.Read': 'profile.connections.permissions.calendarRead',
  'Calendars.ReadWrite': 'profile.connections.permissions.calendarManage',
  offline_access: 'profile.connections.permissions.backgroundAccess',
  openid: 'profile.connections.permissions.signInIdentity',
  profile: 'profile.connections.permissions.basicProfile',
  email: 'profile.connections.permissions.emailAddress',
};

export function hasUnknownProductivityScope(scopes: readonly string[]): boolean {
  return scopes.some((scope) => !PRODUCTIVITY_SCOPE_LABEL_KEYS[scope]);
}

export function productivityScopeLabels(translate: Translate, scopes: readonly string[]): string[] {
  return [
    ...new Set(
      scopes.map((scope) =>
        translate(PRODUCTIVITY_SCOPE_LABEL_KEYS[scope] ?? 'profile.connections.permissions.unknown')
      )
    ),
  ];
}
