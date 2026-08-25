import Box from '@mui/material/Box';

export function HomeEditorSafeArea() {
  return (
    <Box
      aria-hidden="true"
      data-home-editor-safe-area
      sx={{
        flex: '0 0 auto',
        height: {
          xs: 'calc(220px + env(safe-area-inset-bottom))',
          sm: 'calc(112px + env(safe-area-inset-bottom))',
        },
      }}
    />
  );
}
