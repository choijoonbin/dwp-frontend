import { alpha, createTheme, getContrastRatio } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

import { foundationTokens } from '../foundation';

import type { DensityPreference } from '../appearance';

type BuildDwpThemeInput = {
  mode: 'light' | 'dark';
  density: DensityPreference;
  highContrast: boolean;
  reduceMotion: boolean;
  accentColor: string;
  fontFamily: string;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function safeColor(candidate: string): string {
  return HEX_COLOR.test(candidate) ? candidate : foundationTokens.color.product.primary;
}

function contrastText(background: string): string {
  return getContrastRatio(background, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F151D';
}

function densityMetrics(density: DensityPreference) {
  return foundationTokens.density[density];
}

export function buildDwpTheme({
  mode,
  density,
  highContrast,
  reduceMotion,
  accentColor,
  fontFamily,
}: BuildDwpThemeInput) {
  const tokens = foundationTokens;
  const metrics = densityMetrics(density);
  const dark = mode === 'dark';
  const primary = highContrast
    ? dark
      ? '#B7CBFF'
      : '#0048B5'
    : dark
      ? '#85A9FF'
      : safeColor(accentColor);
  const divider = highContrast
    ? dark
      ? '#FFFFFF'
      : '#0F151D'
    : dark
      ? tokens.color.neutral[500]
      : tokens.color.neutral[200];

  return createTheme({
    cssVariables: { cssVarPrefix: 'dwp' },
    palette: {
      mode,
      primary: { main: primary, contrastText: contrastText(primary) },
      secondary: {
        main: highContrast ? (dark ? '#6FE0D3' : '#00675F') : tokens.color.product.secondary,
      },
      info: { main: dark ? '#58B5E8' : tokens.color.status.info },
      success: { main: dark ? '#4CC38A' : tokens.color.status.success },
      warning: { main: dark ? '#E4A84B' : tokens.color.status.warning },
      error: { main: dark ? '#F0786A' : tokens.color.status.error },
      background: highContrast
        ? { default: dark ? '#000000' : '#FFFFFF', paper: dark ? '#000000' : '#FFFFFF' }
        : {
            default: dark ? tokens.color.neutral[900] : tokens.color.neutral[50],
            paper: dark ? tokens.color.neutral[800] : tokens.color.neutral[0],
          },
      text: highContrast
        ? {
            primary: dark ? '#FFFFFF' : '#000000',
            secondary: dark ? '#FFFFFF' : '#000000',
            disabled: dark ? '#D4D4D4' : '#333333',
          }
        : {
            primary: dark ? tokens.color.neutral[25] : tokens.color.neutral[900],
            secondary: dark ? tokens.color.neutral[200] : tokens.color.neutral[500],
            disabled: tokens.color.neutral[300],
          },
      divider,
      action: {
        hover: alpha(dark ? '#FFFFFF' : '#0F151D', highContrast ? 0.14 : 0.06),
        selected: alpha(primary, highContrast ? 0.22 : 0.12),
        focus: alpha(primary, 0.22),
        disabledOpacity: highContrast ? 0.64 : 0.46,
      },
    },
    shape: { borderRadius: tokens.radius.control },
    spacing: 8,
    typography: {
      fontFamily,
      fontSize: 14,
      h1: { fontSize: '2rem', lineHeight: 1.25, fontWeight: 700, letterSpacing: 0 },
      h2: { fontSize: '1.75rem', lineHeight: 1.3, fontWeight: 700, letterSpacing: 0 },
      h3: { fontSize: '1.5rem', lineHeight: 1.35, fontWeight: 700, letterSpacing: 0 },
      h4: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 700, letterSpacing: 0 },
      h5: { fontSize: '1.125rem', lineHeight: 1.45, fontWeight: 700, letterSpacing: 0 },
      h6: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 700, letterSpacing: 0 },
      subtitle1: { fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 600, letterSpacing: 0 },
      subtitle2: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 600, letterSpacing: 0 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6, letterSpacing: 0 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55, letterSpacing: 0 },
      button: { fontSize: '0.875rem', lineHeight: 1.25, fontWeight: 600, letterSpacing: 0 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: 0 },
      overline: { fontSize: '0.6875rem', lineHeight: 1.5, fontWeight: 700, letterSpacing: 0 },
    },
    transitions: {
      duration: {
        shortest: reduceMotion ? 0 : tokens.duration.fast,
        shorter: reduceMotion ? 0 : tokens.duration.fast,
        short: reduceMotion ? 0 : tokens.duration.standard,
        standard: reduceMotion ? 0 : tokens.duration.standard,
        complex: reduceMotion ? 0 : 260,
        enteringScreen: reduceMotion ? 0 : 180,
        leavingScreen: reduceMotion ? 0 : 140,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box' },
          '::selection': { backgroundColor: alpha(primary, 0.24) },
          ':focus-visible': {
            outline: `3px solid ${alpha(primary, highContrast ? 1 : 0.55)}`,
            outlineOffset: 2,
          },
          body: { margin: 0 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: metrics.controlHeight,
            borderRadius: tokens.radius.control,
            textTransform: 'none',
            transition: reduceMotion
              ? 'none'
              : `background-color ${tokens.duration.fast}ms ease-out, border-color ${tokens.duration.fast}ms ease-out, transform ${tokens.duration.fast}ms ease-out`,
            '&:not(.Mui-disabled):active': { transform: 'translateY(1px)' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { width: metrics.controlHeight, height: metrics.controlHeight },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: tokens.radius.surface },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            border: `1px solid ${divider}`,
            boxShadow: dark
              ? '0 18px 48px rgba(0, 0, 0, 0.36)'
              : '0 18px 48px rgba(15, 21, 29, 0.14)',
          },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { boxShadow: 'none' } },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: metrics.itemHeight, borderRadius: tokens.radius.compact },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { minHeight: metrics.controlHeight },
          input: {
            '&:-webkit-autofill': {
              WebkitBoxShadow: `0 0 0 100px ${dark ? tokens.color.neutral[800] : tokens.color.neutral[0]} inset`,
              WebkitTextFillColor: dark ? tokens.color.neutral[25] : tokens.color.neutral[900],
              caretColor: dark ? tokens.color.neutral[25] : tokens.color.neutral[900],
              borderRadius: 'inherit',
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            color: highContrast
              ? dark
                ? '#FFFFFF'
                : '#000000'
              : dark
                ? tokens.color.neutral[25]
                : tokens.color.neutral[700],
            '&.Mui-selected': {
              color: highContrast ? contrastText(primary) : primary,
              backgroundColor: highContrast ? primary : alpha(primary, 0.12),
            },
            '&.Mui-selected:hover': {
              backgroundColor: highContrast ? primary : alpha(primary, 0.18),
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            paddingTop: metrics.cellPadding,
            paddingBottom: metrics.cellPadding,
            borderColor: divider,
          },
          head: { fontWeight: 700, backgroundColor: dark ? tokens.color.neutral[800] : '#F7F8FA' },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: { tooltip: { borderRadius: tokens.radius.compact, fontSize: 12 } },
      },
      MuiDialog: {
        defaultProps: { fullWidth: true },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.125rem', fontWeight: 700 } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: tokens.radius.control } },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: tokens.radius.compact, fontWeight: 600 },
          icon: { marginLeft: 7 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: alpha(primary, 0.12) },
          bar: { borderRadius: tokens.radius.compact },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            borderColor: divider,
            borderRadius: tokens.radius.surface,
            backgroundColor: dark ? tokens.color.neutral[800] : tokens.color.neutral[0],
          },
          columnHeaders: {
            borderColor: divider,
            backgroundColor: dark ? tokens.color.neutral[800] : tokens.color.neutral[50],
          },
          columnHeaderTitle: { fontWeight: 700 },
          cell: {
            borderColor: divider,
            display: 'flex',
            alignItems: 'center',
            lineHeight: 'normal',
            '& .MuiChip-root': { height: 24 },
            '& .MuiIconButton-root': { width: 32, height: 32 },
          },
          row: {
            '&.Mui-selected': { backgroundColor: alpha(primary, highContrast ? 0.28 : 0.1) },
            '&:hover': { backgroundColor: alpha(primary, highContrast ? 0.16 : 0.045) },
          },
          footerContainer: { minHeight: 52, borderColor: divider },
        },
      },
    },
  });
}
