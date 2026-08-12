import tokenFile from '../../tokens/dwp.tokens.json';

const hex = (token: { $value: { hex: string } }) => token.$value.hex;
const pixels = (token: { $value: { value: number; unit: string } }) => token.$value.value;
const milliseconds = (token: { $value: { value: number; unit: string } }) => token.$value.value;
const fontStack = (families: readonly string[]) =>
  families.map((family) => (family.includes(' ') ? `"${family}"` : family)).join(', ');

export const foundationTokens = {
  color: {
    neutral: {
      0: hex(tokenFile.color.neutral['0']),
      25: hex(tokenFile.color.neutral['25']),
      50: hex(tokenFile.color.neutral['50']),
      100: hex(tokenFile.color.neutral['100']),
      200: hex(tokenFile.color.neutral['200']),
      300: hex(tokenFile.color.neutral['300']),
      400: hex(tokenFile.color.neutral['400']),
      500: hex(tokenFile.color.neutral['500']),
      700: hex(tokenFile.color.neutral['700']),
      800: hex(tokenFile.color.neutral['800']),
      900: hex(tokenFile.color.neutral['900']),
    },
    product: {
      primary: hex(tokenFile.color.product.primary),
      secondary: hex(tokenFile.color.product.secondary),
    },
    status: {
      info: hex(tokenFile.color.status.info),
      success: hex(tokenFile.color.status.success),
      warning: hex(tokenFile.color.status.warning),
      error: hex(tokenFile.color.status.error),
    },
    data: {
      cobalt: hex(tokenFile.color.data.cobalt),
      teal: hex(tokenFile.color.data.teal),
      saffron: hex(tokenFile.color.data.saffron),
      coral: hex(tokenFile.color.data.coral),
      cyan: hex(tokenFile.color.data.cyan),
      violet: hex(tokenFile.color.data.violet),
    },
  },
  radius: {
    compact: pixels(tokenFile.dimension.radius.compact),
    control: pixels(tokenFile.dimension.radius.control),
    surface: pixels(tokenFile.dimension.radius.surface),
  },
  space: {
    1: pixels(tokenFile.dimension.space['1']),
    2: pixels(tokenFile.dimension.space['2']),
    3: pixels(tokenFile.dimension.space['3']),
    4: pixels(tokenFile.dimension.space['4']),
    6: pixels(tokenFile.dimension.space['6']),
    8: pixels(tokenFile.dimension.space['8']),
  },
  layout: {
    navigationExpanded: pixels(tokenFile.dimension.layout.navigationExpanded),
    adminNavigationExpanded: pixels(tokenFile.dimension.layout.adminNavigationExpanded),
    navigationCompact: pixels(tokenFile.dimension.layout.navigationCompact),
    headerHeight: pixels(tokenFile.dimension.layout.headerHeight),
    focusCanvasMaxWidth: pixels(tokenFile.dimension.layout.focusCanvasMaxWidth),
  },
  density: {
    compact: {
      controlHeight: pixels(tokenFile.dimension.density.compact.control),
      itemHeight: pixels(tokenFile.dimension.density.compact.item),
      cellPadding: pixels(tokenFile.dimension.density.compact.cellPadding),
    },
    standard: {
      controlHeight: pixels(tokenFile.dimension.density.standard.control),
      itemHeight: pixels(tokenFile.dimension.density.standard.item),
      cellPadding: pixels(tokenFile.dimension.density.standard.cellPadding),
    },
    comfortable: {
      controlHeight: pixels(tokenFile.dimension.density.comfortable.control),
      itemHeight: pixels(tokenFile.dimension.density.comfortable.item),
      cellPadding: pixels(tokenFile.dimension.density.comfortable.cellPadding),
    },
  },
  duration: {
    instant: milliseconds(tokenFile.duration.instant),
    fast: milliseconds(tokenFile.duration.fast),
    standard: milliseconds(tokenFile.duration.standard),
  },
  font: {
    ui: fontStack(tokenFile.font.ui.$value),
    mono: fontStack(tokenFile.font.mono.$value),
  },
} as const;

export type FoundationTokens = typeof foundationTokens;
