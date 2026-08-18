import type {
  HomePresentation,
  HomeWidgetHeight,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';

// 60 is the smallest grid that represents 1/2, 1/3, 1/4, and 1/5 as whole units.
export const WORKSPACE_WIDGET_GRID_COLUMNS = 60;

export type WorkspaceWidgetResponsiveColumns = Readonly<{
  xs: 60;
  sm: 60;
  lg: 12 | 15 | 20 | 30 | 40 | 60;
}>;

export type WorkspaceWidgetFootprint = Readonly<{
  numerator: 1 | 2;
  denominator: 1 | 2 | 3 | 4 | 5;
}>;

export type WorkspaceWidgetSpacing = Readonly<{
  inlineInset: Readonly<{ xs: 0; sm: number; lg: number }>;
  virtualColumnGapPx: Readonly<{ xs: 0; sm: 2 }>;
  rowGap: Readonly<{ xs: number; sm: number; lg: number }>;
}>;

export type WorkspaceWidgetHeightRule = Readonly<{
  blockSize: number;
  contentRows: 2 | 3 | 4 | 6;
}>;

export const WORKSPACE_WIDGET_SIZE_POLICY: Readonly<
  Record<HomeWidgetSize, WorkspaceWidgetResponsiveColumns>
> = {
  fifth: { xs: 60, sm: 60, lg: 12 },
  quarter: { xs: 60, sm: 60, lg: 15 },
  compact: { xs: 60, sm: 60, lg: 20 },
  medium: { xs: 60, sm: 60, lg: 30 },
  large: { xs: 60, sm: 60, lg: 40 },
  full: { xs: 60, sm: 60, lg: 60 },
};

// Heights follow the 8px baseline grid. On phones the canvas releases the
// fixed block size so every widget can reflow to its full content without clipping.
export const WORKSPACE_WIDGET_HEIGHT_POLICY: Readonly<
  Record<HomeWidgetHeight, WorkspaceWidgetHeightRule>
> = {
  short: { blockSize: 288, contentRows: 2 },
  standard: { blockSize: 368, contentRows: 3 },
  tall: { blockSize: 448, contentRows: 4 },
  expanded: { blockSize: 560, contentRows: 6 },
};

const workspaceWidgetFootprints: Readonly<Record<HomeWidgetSize, WorkspaceWidgetFootprint>> = {
  fifth: { numerator: 1, denominator: 5 },
  quarter: { numerator: 1, denominator: 4 },
  compact: { numerator: 1, denominator: 3 },
  medium: { numerator: 1, denominator: 2 },
  large: { numerator: 2, denominator: 3 },
  full: { numerator: 1, denominator: 1 },
};

// Insets create the visible gutter without multiplying a full-size gap across all 60 grid tracks.
export const WORKSPACE_WIDGET_SPACING_POLICY: Readonly<
  Record<HomePresentation, WorkspaceWidgetSpacing>
> = {
  focused: {
    inlineInset: { xs: 0, sm: 7, lg: 7 },
    virtualColumnGapPx: { xs: 0, sm: 2 },
    rowGap: { xs: 1.5, sm: 2, lg: 2 },
  },
  balanced: {
    inlineInset: { xs: 0, sm: 9, lg: 11 },
    virtualColumnGapPx: { xs: 0, sm: 2 },
    rowGap: { xs: 2, sm: 2.5, lg: 3 },
  },
  expressive: {
    inlineInset: { xs: 0, sm: 11, lg: 15 },
    virtualColumnGapPx: { xs: 0, sm: 2 },
    rowGap: { xs: 2.5, sm: 3, lg: 4 },
  },
};

export function workspaceWidgetGridColumn(size: HomeWidgetSize) {
  const columns = WORKSPACE_WIDGET_SIZE_POLICY[size];
  return {
    xs: '1 / -1',
    sm: columns.sm === WORKSPACE_WIDGET_GRID_COLUMNS ? '1 / -1' : `span ${columns.sm}`,
    lg: columns.lg === WORKSPACE_WIDGET_GRID_COLUMNS ? '1 / -1' : `span ${columns.lg}`,
  } as const;
}

export function workspaceWidgetSizeFraction(size: HomeWidgetSize): string {
  const footprint = workspaceWidgetFootprints[size];
  return `${footprint.numerator}/${footprint.denominator}`;
}

export function workspaceWidgetFootprint(size: HomeWidgetSize): WorkspaceWidgetFootprint {
  return workspaceWidgetFootprints[size];
}

export function workspaceWidgetBlockSize(height: HomeWidgetHeight) {
  const blockSize = WORKSPACE_WIDGET_HEIGHT_POLICY[height].blockSize;
  return { xs: 'auto', sm: blockSize } as const;
}

export function workspaceWidgetContentRows(height: HomeWidgetHeight): 2 | 3 | 4 | 6 {
  return WORKSPACE_WIDGET_HEIGHT_POLICY[height].contentRows;
}

export function workspaceWidgetSpacing(presentation: HomePresentation): WorkspaceWidgetSpacing {
  return WORKSPACE_WIDGET_SPACING_POLICY[presentation];
}
