import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  FileText,
  Radio,
  Sparkles,
  Upload,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { meetingShape, meetingType } from './meeting-visual-system';

/** Every stage reflects available owner-service evidence, never an inferred provider success. */
export function MeetingRecapPipeline({
  recording,
  transcript,
  analysis,
  approved,
  published,
  compact = false,
  embedded = false,
}: {
  recording: boolean;
  transcript: boolean;
  analysis: boolean;
  approved: boolean;
  published: boolean;
  compact?: boolean;
  embedded?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const stages = [
    { key: 'recording', icon: Radio, ready: recording },
    { key: 'transcript', icon: FileText, ready: transcript },
    { key: 'analysis', icon: Sparkles, ready: analysis },
    { key: 'review', icon: FileCheck2, ready: approved },
    { key: 'published', icon: Upload, ready: published },
  ];
  return (
    <Box
      component="section"
      aria-label={t('designReview.pipeline.title')}
      data-testid="meeting-recap-pipeline"
      sx={(theme) => ({
        p: { xs: embedded ? 0 : 1.5, sm: compact ? 1.5 : 2 },
        bgcolor: embedded
          ? 'transparent'
          : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.045),
        borderRadius: { xs: meetingShape.control, sm: meetingShape.inset },
      })}
    >
      <Typography
        variant="caption"
        fontWeight="fontWeightBold"
        sx={{ display: { xs: embedded ? 'none' : 'block', sm: 'block' }, mb: 1.25 }}
      >
        {t('designReview.pipeline.title')}
      </Typography>
      <Box
        component="ol"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(5, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' },
          gap: { xs: 0.5, sm: compact ? 0.5 : 1 },
          m: 0,
          p: 0,
          listStyle: 'none',
        }}
      >
        {stages.map(({ key, icon: Icon, ready }) => (
          <Stack
            component="li"
            key={key}
            aria-label={`${t(`designReview.pipeline.${key}`)}: ${t(ready ? 'designReview.pipeline.verified' : 'designReview.pipeline.unavailable')}`}
            gap={0.5}
            sx={(theme) => ({
              minWidth: 0,
              p: { xs: 0.5, sm: compact ? 0.5 : 1.25 },
              borderRadius: meetingShape.inset,
              bgcolor: {
                xs: 'transparent',
                sm: published && key === 'published' ? 'primary.main' : 'background.paper',
              },
              color: {
                xs: ready
                  ? theme.palette.mode === 'dark'
                    ? 'success.main'
                    : 'success.dark'
                  : 'text.secondary',
                sm:
                  published && key === 'published'
                    ? 'primary.contrastText'
                    : ready
                      ? theme.palette.mode === 'dark'
                        ? 'success.main'
                        : 'success.dark'
                      : 'text.secondary',
              },
              border: { xs: 0, sm: `1px solid ${alpha(theme.palette.primary.main, 0.06)}` },
            })}
          >
            <Stack
              direction={{ xs: 'column', sm: compact ? 'column' : 'row' }}
              gap={0.5}
              alignItems="center"
            >
              <Icon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              <Typography
                variant="caption"
                fontWeight="fontWeightBold"
                sx={{
                  ...meetingType.micro,
                  overflowWrap: compact ? 'normal' : 'anywhere',
                  textAlign: { xs: 'center', sm: compact ? 'center' : 'left' },
                }}
              >
                {t(`designReview.pipeline.${embedded ? 'mobile.' : ''}${key}`)}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              gap={0.4}
              alignItems="center"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              {ready ? (
                <CheckCircle2 size={11} aria-hidden="true" />
              ) : (
                <CircleDashed size={11} aria-hidden="true" />
              )}
              <Typography variant="caption" sx={meetingType.micro}>
                {t(ready ? 'designReview.pipeline.verified' : 'designReview.pipeline.unavailable')}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
