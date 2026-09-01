import { expect, type Locator } from '@playwright/test';

export async function expectRoleMetricAlignment(insight: Locator) {
  await insight.evaluate(async () => {
    // Compact comparisons can wrap differently under fallback glyph metrics.
    // Measure only after the product font and the resulting container layout settle.
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  const geometry = await insight.locator('[data-home-role-lens]').evaluateAll((lenses) =>
    lenses.map((lens) => {
      const bounds = lens.getBoundingClientRect();
      const value = lens.querySelector<HTMLElement>('[data-home-role-value]')!;
      const unit = lens.querySelector<HTMLElement>('[data-home-role-unit]')!;
      const label = lens.querySelector<HTMLElement>('[data-home-role-label]')!;
      const comparison = lens.querySelector<HTMLElement>('[data-home-role-comparison]')!;
      const rail = lens.querySelector<HTMLElement>('[data-home-role-metric-rail]')!;
      const valueBounds = value.getBoundingClientRect();
      const unitBounds = unit.getBoundingClientRect();
      const labelBounds = label.getBoundingClientRect();
      const comparisonBounds = comparison.getBoundingClientRect();
      const railBounds = rail.getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        valueTop: valueBounds.top,
        unitEndInset: bounds.right - unitBounds.right,
        labelTop: labelBounds.top,
        comparisonCenter: comparisonBounds.top + comparisonBounds.height / 2,
        railCenter: railBounds.top + railBounds.height / 2,
        railWidth: railBounds.width,
        railHeight: railBounds.height,
        overflow: Math.max(0, lens.scrollWidth - lens.clientWidth),
      };
    })
  );

  expect(geometry).toHaveLength(4);
  for (const key of ['width', 'height', 'unitEndInset', 'railWidth', 'railHeight'] as const) {
    const values = geometry.map((item) => item[key]);
    expect(Math.max(...values) - Math.min(...values), `${key} alignment`).toBeLessThanOrEqual(1);
  }
  for (const [first, second] of [
    [geometry[0], geometry[1]],
    [geometry[2], geometry[3]],
  ]) {
    for (const key of ['valueTop', 'labelTop', 'comparisonCenter', 'railCenter'] as const) {
      expect(Math.abs(first[key] - second[key]), `${key} row alignment`).toBeLessThanOrEqual(1);
    }
  }
  expect(geometry.every((item) => Math.abs(item.comparisonCenter - item.railCenter) <= 1)).toBe(
    true
  );
  expect(geometry.every((item) => item.overflow <= 1)).toBe(true);
}
