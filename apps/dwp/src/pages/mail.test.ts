import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Mail page route chunking', () => {
  it('keeps every view surface behind a dynamic import', () => {
    const source = fs.readFileSync(new URL('./mail.tsx', import.meta.url), 'utf8');
    const surfaceModules = [
      'mail-accounts',
      'mail-admin',
      'mail-admin-operations-workspace-surfaces',
      'mail-admin-writing-assets-workspace',
      'mail-address-book',
      'mail-home',
      'mail-inbox',
      'mail-organization',
      'mail-secondary-workspace',
    ];

    for (const moduleName of surfaceModules) {
      expect(source).toContain(`import('../features/mail/${moduleName}')`);
      expect(source).not.toMatch(
        new RegExp(`from ['"]\\.\\./features/mail/${moduleName}['"]`, 'u')
      );
    }
    expect(source).toContain('<Suspense fallback={<RouteFallback />}>');
  });
});
