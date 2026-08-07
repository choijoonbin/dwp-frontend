import { useLanguage } from '@dwp-frontend/shared-i18n';
import { useThemeMode } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode();
  const { language, setLanguage } = useLanguage();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography component="h1" variant="h4">
        Settings
      </Typography>
      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'grid', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2">Dark mode</Typography>
            <Typography variant="body2" color="text.secondary">
              Use the dark color scheme
            </Typography>
          </Box>
          <Switch
            checked={mode === 'dark'}
            inputProps={{ 'aria-label': 'Dark mode' }}
            onChange={(_, checked) => setMode(checked ? 'dark' : 'light')}
          />
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Language</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={language}
            aria-label="Language"
            onChange={(_, value: 'ko' | 'en' | null) => value && setLanguage(value)}
          >
            <ToggleButton value="ko">한국어</ToggleButton>
            <ToggleButton value="en">English</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Container>
  );
}
