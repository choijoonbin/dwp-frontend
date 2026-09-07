import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { OperationalKpiStrip } from './operational-kpi-strip';

describe('OperationalKpiStrip publishing', () => {
  it.each(['light', 'dark'] as const)(
    'keeps metric labels, zero counts and optional drill-downs in %s mode',
    (mode) => {
      const markup = renderToStaticMarkup(
        <ThemeProvider theme={createTheme({ palette: { mode, divider: '#abcdef' } })}>
          <OperationalKpiStrip
            ariaLabel="Approval metrics"
            items={[
              { key: 'pending', label: 'Pending', value: 1, onSelect: () => undefined },
              { key: 'due', label: 'Due today', value: 0 },
              { key: 'progress', label: 'In progress', value: 2 },
            ]}
          />
        </ThemeProvider>
      );
      expect(markup).toContain('>0</p>');
      expect(markup).toContain('Due today');
      expect(markup).toContain('In progress');
      expect(markup).toContain('aria-label="Approval metrics"');
      expect(markup.match(/<button /gu)).toHaveLength(1);
    }
  );

  it('allows an embedded strip to avoid a duplicate outer edge', () => {
    const embeddedStyle = vi.fn(() => ({ borderBottom: 0 }));
    const markup = renderToStaticMarkup(
      <OperationalKpiStrip
        ariaLabel="Metrics"
        items={[{ key: 'pending', label: 'Pending', value: 1 }]}
        sx={embeddedStyle}
      />
    );
    expect(markup).toContain('Pending');
    expect(embeddedStyle).toHaveBeenCalled();
  });
});
