import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

import { layoutClasses } from './classes';

// ----------------------------------------------------------------------

export type MainSectionProps = React.ComponentProps<typeof MainRoot> & {
  layoutMode?: 'fixed' | 'scrollable';
};

export function MainSection({ children, className, sx, layoutMode = 'scrollable', ...other }: MainSectionProps) {
  return (
    <MainRoot className={mergeClasses([layoutClasses.main, className])} layoutMode={layoutMode} sx={sx} {...other}>
      {children}
    </MainRoot>
  );
}

// ----------------------------------------------------------------------

const MainRoot = styled('main', {
  shouldForwardProp: (prop) => prop !== 'layoutMode',
})<{ layoutMode?: 'fixed' | 'scrollable' }>(({ layoutMode }) => ({
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  ...(layoutMode === 'fixed' && {
    minHeight: 0,
    overflow: 'hidden',
  }),
}));
