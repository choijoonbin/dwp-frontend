import type { Theme, SxProps, CSSObject } from '@mui/material/styles';

import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';

import { layoutClasses } from './classes';
import { layoutSectionVars } from './css-vars';

// ----------------------------------------------------------------------

export type LayoutSectionProps = React.ComponentProps<'div'> & {
  sx?: SxProps<Theme>;
  cssVars?: CSSObject;
  children?: React.ReactNode;
  footerSection?: React.ReactNode;
  headerSection?: React.ReactNode;
  sidebarSection?: React.ReactNode;
  layoutMode?: 'fixed' | 'scrollable';
};

export function LayoutSection({
  sx,
  cssVars,
  children,
  footerSection,
  headerSection,
  sidebarSection,
  className,
  layoutMode = 'scrollable',
  ...other
}: LayoutSectionProps) {
  const inputGlobalStyles = (
    <GlobalStyles styles={(theme) => ({ body: { ...layoutSectionVars(theme), ...cssVars } })} />
  );

  return (
    <>
      {inputGlobalStyles}

      <LayoutRoot
        id="root__layout"
        className={mergeClasses([layoutClasses.root, className])}
        layoutMode={layoutMode}
        sx={sx}
        {...other}
      >
        {sidebarSection ? (
          <>
            {sidebarSection}
            <LayoutSidebarContainer className={layoutClasses.sidebarContainer} layoutMode={layoutMode}>
              {headerSection}
              {children}
              {footerSection}
            </LayoutSidebarContainer>
          </>
        ) : (
          <>
            {headerSection}
            {children}
            {footerSection}
          </>
        )}
      </LayoutRoot>
    </>
  );
}

// ----------------------------------------------------------------------

const LayoutRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== 'layoutMode',
})<{ layoutMode?: 'fixed' | 'scrollable' }>(({ layoutMode }) => ({
  display: 'flex',
  flexDirection: 'row',
  width: '100vw',
  ...(layoutMode === 'fixed'
    ? {
        height: '100vh',
        overflow: 'hidden',
      }
    : {
        minHeight: '100vh',
      }),
}));

const LayoutSidebarContainer = styled('div', {
  shouldForwardProp: (prop) => prop !== 'layoutMode',
})<{ layoutMode?: 'fixed' | 'scrollable' }>(({ layoutMode }) => ({
  display: 'flex',
  flex: '1 1 auto',
  minWidth: 0,
  flexDirection: 'column',
  ...(layoutMode === 'fixed'
    ? {
        height: '100%',
        overflow: 'hidden',
      }
    : {
        minHeight: '100%',
      }),
}));
