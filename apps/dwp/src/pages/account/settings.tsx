import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@dwp-frontend/shared-i18n';
import {
  PageCanvas,
  colorModeOptions,
  densityOptions,
  useAppearance,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

type PreferenceRowProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

function PreferenceRow({ title, description, children }: PreferenceRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        py: 2.5,
        alignItems: 'center',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) minmax(280px, auto)' },
      }}
    >
      <Box>
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ minWidth: 0, justifySelf: { md: 'end' } }}>{children}</Box>
    </Box>
  );
}

export default function SettingsPage() {
  const appearance = useAppearance();
  const { language, setLanguage } = useLanguage();
  const managedFontName = appearance.tenant.fontFamily ?? 'System UI';

  return (
    <PageCanvas mode="focus">
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Box>
          <Typography component="h1" variant="h4">
            Preferences
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Personal accessibility and display preferences
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RotateCcw size={17} />}
          onClick={appearance.resetPreferences}
        >
          Reset
        </Button>
      </Stack>

      <Typography component="h2" variant="h6" sx={{ mt: 5 }}>
        Personal settings
      </Typography>
      <Divider sx={{ mt: 1 }} />

      <PreferenceRow title="Color mode" description="Follow the system or choose a fixed mode">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={appearance.preference.mode}
          aria-label="Color mode"
          onChange={(_, value) => value && appearance.setMode(value)}
        >
          {colorModeOptions.map((mode) => (
            <ToggleButton key={mode} value={mode} sx={{ textTransform: 'capitalize' }}>
              {mode}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="High contrast" description="Increase boundaries and text contrast">
        <Switch
          checked={appearance.preference.highContrast}
          slotProps={{ input: { 'aria-label': 'High contrast' } }}
          onChange={(_, checked) => appearance.setHighContrast(checked)}
        />
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="Density" description="Adjust the spacing of operational controls">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={appearance.preference.density}
          aria-label="Interface density"
          onChange={(_, value) => value && appearance.setDensity(value)}
        >
          {densityOptions.map((density) => (
            <ToggleButton key={density} value={density} sx={{ textTransform: 'capitalize' }}>
              {density}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="Reduce motion" description="Minimize nonessential interface motion">
        <Switch
          checked={appearance.preference.reduceMotion}
          slotProps={{ input: { 'aria-label': 'Reduce motion' } }}
          onChange={(_, checked) => appearance.setReduceMotion(checked)}
        />
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="Language">
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
      </PreferenceRow>

      <Typography component="h2" variant="h6" sx={{ mt: 6 }}>
        Organization appearance
      </Typography>
      <Divider sx={{ mt: 1 }} />

      <PreferenceRow title="Product font">
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography variant="body2" sx={{ maxWidth: 360 }} noWrap>
            {managedFontName}
          </Typography>
          <Chip size="small" label="Managed" variant="outlined" />
        </Stack>
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="Brand accent">
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box
            role="img"
            aria-label={`Brand color ${appearance.accentColor}`}
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: appearance.accentColor,
              border: 1,
              borderColor: 'divider',
            }}
          />
          <Typography variant="body2">{appearance.accentColor}</Typography>
          <Chip size="small" label="Managed" variant="outlined" />
        </Stack>
      </PreferenceRow>
      <Divider />

      <PreferenceRow title="Navigation pattern">
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
            {appearance.navigationPattern}
          </Typography>
          <Chip size="small" label="Managed" variant="outlined" />
        </Stack>
      </PreferenceRow>
    </PageCanvas>
  );
}
