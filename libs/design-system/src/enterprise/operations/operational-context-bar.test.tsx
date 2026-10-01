import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { OperationalContextBar } from './operational-context-bar';
import {
  operationalContextItemSx,
  operationalContextValueSx,
} from './operational-context-bar.styles';

describe('OperationalContextBar responsive context values', () => {
  it('allows a long operational value to wrap inside a narrow context item', () => {
    const value = '24시간 · 2026. 10. 1. 오후 7:31:00 ~ 2026. 10. 1. 오후 8:31:00';
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={createTheme()}>
        <OperationalContextBar
          label="API monitoring context"
          items={[{ label: '조회 구간', value }]}
        />
      </ThemeProvider>
    );

    expect(markup).toContain('aria-label="API monitoring context"');
    expect(markup).toContain(value);
    expect(operationalContextItemSx).toEqual({ minWidth: 0, maxWidth: '100%' });
    expect(operationalContextValueSx).toEqual({
      whiteSpace: { xs: 'normal', sm: 'nowrap' },
      overflowWrap: 'anywhere',
    });
  });
});
