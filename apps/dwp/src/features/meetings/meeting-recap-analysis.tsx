import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  CircleAlert,
  FileQuestion,
  MessageSquareText,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import type { PublishedMeetingRecap } from './meeting-recap-intelligence-model';
import { meetingSurface } from './meeting-visual-system';

type ReadyMeetingRecap = Extract<PublishedMeetingRecap, { state: 'READY' }>;

export function MeetingRecapAnalysis({ recap }: { recap: PublishedMeetingRecap }) {
  const { t } = useTranslation('meetings');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [open, setOpen] = useState(false);
  if (recap.state !== 'READY') return null;
  if (!compact) {
    return (
      <Box
        component="section"
        data-testid="meeting-recap-analysis"
        sx={(currentTheme) => ({
          ...meetingSurface(currentTheme, { elevated: false }),
          gridArea: 'analysis',
          minWidth: 0,
          overflow: 'hidden',
          borderTop: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        })}
      >
        <AnalysisContent recap={recap} />
      </Box>
    );
  }
  return (
    <Box
      component="details"
      data-testid="meeting-recap-analysis"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      sx={(currentTheme) => ({
        ...meetingSurface(currentTheme, { elevated: false }),
        gridArea: 'analysis',
        minWidth: 0,
        overflow: 'hidden',
        '&[open] > summary': { borderBottom: 1, borderColor: 'divider' },
      })}
    >
      <Box
        component="summary"
        data-testid="meeting-recap-analysis-toggle"
        sx={{
          minHeight: 52,
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" variant="subtitle2" fontWeight="fontWeightBold">
              {t('history.recap.intelligence.analysisDetailsTitle')}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary" display="block">
              {t('history.recap.intelligence.analysisDetailsDescription')}
            </Typography>
          </Box>
          <ChevronDown
            size={18}
            aria-hidden="true"
            style={{ flex: '0 0 auto', transform: open ? 'rotate(180deg)' : undefined }}
          />
        </Stack>
      </Box>
      <AnalysisContent recap={recap} />
    </Box>
  );
}

function AnalysisContent({ recap }: { recap: ReadyMeetingRecap }) {
  const { t } = useTranslation('meetings');
  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.2fr) minmax(0, .8fr)' },
          '& > section + section': {
            borderLeft: { xs: 0, xl: 1 },
            borderColor: 'divider',
          },
        }}
      >
        <RecapSection title={t('history.recap.intelligence.sections.topics')} first>
          <OutcomeList
            icon={MessageSquareText}
            items={recap.topics}
            empty={t('history.recap.intelligence.sectionEmpty')}
          />
        </RecapSection>
        <RecapSection title={t('history.recap.intelligence.sections.conversationClimate')} first>
          <Stack gap={1.25}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <Sparkles size={18} aria-hidden="true" />
              <Typography fontWeight="fontWeightBold">
                {t(`history.recap.intelligence.climateLabels.${recap.conversationClimate.label}`)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('history.recap.intelligence.climateDescription')}
            </Typography>
            {recap.conversationClimate.signals.length > 0 && (
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {recap.conversationClimate.signals.map((signal) => (
                  <Chip
                    key={signal}
                    size="small"
                    variant="outlined"
                    label={t(`history.recap.intelligence.climateSignals.${signal}`)}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </RecapSection>
      </Box>
      {(recap.openQuestions.length > 0 || recap.risks.length > 0) && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
            borderTop: 1,
            borderColor: 'divider',
            '& > section': { borderTop: 0 },
            '& > section + section': {
              borderTop: { xs: 1, xl: 0 },
              borderLeft: { xs: 0, xl: 1 },
              borderColor: 'divider',
            },
          }}
        >
          <RecapSection title={t('history.recap.intelligence.sections.openQuestions')}>
            <OutcomeList
              icon={FileQuestion}
              items={recap.openQuestions}
              empty={t('history.recap.intelligence.sectionEmpty')}
            />
          </RecapSection>
          <RecapSection title={t('history.recap.intelligence.sections.risks')}>
            <OutcomeList
              icon={TriangleAlert}
              items={recap.risks}
              empty={t('history.recap.intelligence.sectionEmpty')}
            />
          </RecapSection>
        </Box>
      )}
    </>
  );
}

function OutcomeList({
  icon: Icon,
  items,
  empty,
}: {
  icon: typeof MessageSquareText;
  items: string[];
  empty: string;
}) {
  if (!items.length) return <OutcomeEmpty text={empty} />;
  return (
    <Stack component="ul" gap={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {items.map((item, index) => (
        <Stack component="li" key={`${item}-${index}`} direction="row" gap={1} alignItems="start">
          <Icon size={16} aria-hidden="true" style={{ marginTop: 3, flex: '0 0 auto' }} />
          <Typography variant="body2" fontWeight="fontWeightMedium">
            {item}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function RecapSection({
  title,
  children,
  first = false,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <Box
      component="section"
      sx={{
        height: '100%',
        p: { xs: 2, sm: 2.5 },
        borderTop: first ? 0 : 1,
        borderColor: 'divider',
      }}
    >
      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold" sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function OutcomeEmpty({ text }: { text: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={1} color="text.secondary" sx={{ py: 1 }}>
      <CircleAlert size={17} aria-hidden="true" />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}
