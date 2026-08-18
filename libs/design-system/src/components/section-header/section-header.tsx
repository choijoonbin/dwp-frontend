import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TypographyProps } from '@mui/material/Typography';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { GlyphSurface } from '../glyph-surface';

export const SECTION_HEADER_METRICS = Object.freeze({
  iconPlate: 30,
  icon: 17,
  iconStroke: 1.8,
  title: 18,
  titleLineHeight: 24,
});

export const SECTION_HEADER_META_METRICS = Object.freeze({
  fontSize: 12,
  lineHeight: 18,
  fontWeight: 500,
});

export function SectionHeaderMetaText({ children, sx, ...props }: TypographyProps) {
  return (
    <Typography
      component="span"
      color="text.secondary"
      data-dwp-section-header-meta-text
      {...props}
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        {
          color: 'text.secondary',
          fontSize: SECTION_HEADER_META_METRICS.fontSize,
          fontWeight: SECTION_HEADER_META_METRICS.fontWeight,
          lineHeight: `${SECTION_HEADER_META_METRICS.lineHeight}px`,
          letterSpacing: 0,
        },
      ]}
    >
      {children}
    </Typography>
  );
}

export type SectionHeaderProps = {
  id?: string;
  icon: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  headingComponent?: 'h2' | 'h3';
  divider?: boolean;
};

/**
 * Standard heading anatomy for first-level workspace sections.
 * Status and category color belong in `meta` or section content, not in the heading glyph.
 */
export function SectionHeader({
  id,
  icon: Icon,
  title,
  meta,
  headingComponent = 'h2',
  divider = false,
}: SectionHeaderProps) {
  const resolvedMeta =
    typeof meta === 'string' || typeof meta === 'number' ? (
      <SectionHeaderMetaText>{meta}</SectionHeaderMetaText>
    ) : (
      meta
    );

  return (
    <Box
      data-dwp-section-header
      sx={{
        minWidth: 0,
        minHeight: 30,
        pb: divider ? 1.5 : 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 2,
        rowGap: 1,
        borderBottom: divider ? 1 : 0,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          flex: resolvedMeta ? '1 1 220px' : '1 1 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <GlyphSurface
          data-dwp-section-header-icon
          size={SECTION_HEADER_METRICS.iconPlate}
          variant="soft"
          sx={{
            border: 0,
            backgroundImage: 'none',
            boxShadow: 'none',
            '&::after': { display: 'none' },
          }}
        >
          <Icon
            size={SECTION_HEADER_METRICS.icon}
            strokeWidth={SECTION_HEADER_METRICS.iconStroke}
            aria-hidden="true"
          />
        </GlyphSurface>
        <Typography
          id={id}
          component={headingComponent}
          sx={{
            minWidth: 0,
            fontSize: SECTION_HEADER_METRICS.title,
            fontWeight: 600,
            lineHeight: `${SECTION_HEADER_METRICS.titleLineHeight}px`,
            letterSpacing: 0,
          }}
        >
          {title}
        </Typography>
      </Box>
      {resolvedMeta ? (
        <Box
          data-dwp-section-header-meta
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            '& > *': { maxWidth: '100%' },
          }}
        >
          {resolvedMeta}
        </Box>
      ) : null}
    </Box>
  );
}
