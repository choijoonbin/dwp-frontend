import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { StatusPage } from './status-page';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('status page landmark contract', () => {
  it('keeps denied and not-found routes inside the shell skip-link target', () => {
    for (const [code, titleKey] of [
      ['403', 'accessDenied'],
      ['404', 'notFound'],
    ] as const) {
      const markup = renderToStaticMarkup(
        <MemoryRouter>
          <StatusPage code={code} titleKey={titleKey} />
        </MemoryRouter>
      );

      expect(markup).toMatch(/<main[^>]*id="dwp-main-content"[^>]*tabindex="-1"/u);
      expect(markup).toContain(`>${code}</h2>`);
      expect(markup).toContain(`statusPages.${titleKey}`);
    }
  });
});
