import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CalendarScheduleChrome } from './calendar-schedule-chrome';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../components/governed-saved-view-control', () => ({
  GovernedSavedViewControl: () => <div data-testid="saved-view-control" />,
}));

describe('CalendarScheduleChrome', () => {
  it('exposes event search as an accessible dialog action', () => {
    const html = renderToStaticMarkup(
      <CalendarScheduleChrome
        canCreate
        sourcesAvailable
        commandPaletteOpen={false}
        eventSearchOpen={false}
        desktopSources
        sourcesCollapsed={false}
        hasExplicitScheduleState={false}
        view="week"
        savedViewConfiguration={{ view: 'week' }}
        returnTarget={null}
        onOpenCommands={vi.fn()}
        onOpenEventSearch={vi.fn()}
        onCreate={vi.fn()}
        onToggleSources={vi.fn()}
        onOpenSources={vi.fn()}
        onApplySavedView={vi.fn()}
        onReturn={vi.fn()}
      />
    );

    expect(html).toContain('eventSearch.open');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });
});
