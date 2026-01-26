import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useAuraActions } from '@dwp-frontend/shared-utils/aura/use-aura-store';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type AuraInsightStatus = 'success' | 'warning' | 'error';

type AuraInsightBarProps = {
  insightText: string;
  status: AuraInsightStatus;
};

const STATUS_COLORS: Record<AuraInsightStatus, string> = {
  success: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
};

const HIGHLIGHT_PATTERN =
  /(\d+(?:\.\d+)?%|\/[A-Za-z0-9._/-]+|\b(?:\d{1,3}\.){3}\d{1,3}\b|특정 IP)/g;

const highlightText = (text: string, color: string) => {
  const segments = text.split(HIGHLIGHT_PATTERN);
  const matches = text.match(HIGHLIGHT_PATTERN) ?? [];

  return segments.flatMap((segment, index) => {
    const match = matches[index];
    if (!match) return [segment];
    return [
      segment,
      <Box
        key={`${match}-${index}`}
        component="span"
        sx={{ color, fontWeight: 700 }}
      >
        {match}
      </Box>,
    ];
  });
};

export const AuraInsightBar = ({ insightText, status }: AuraInsightBarProps) => {
  const [displayText, setDisplayText] = useState('');
  const accentColor = STATUS_COLORS[status];
  const { toggleOverlay } = useAuraActions();

  useEffect(() => {
    let index = 0;
    setDisplayText('');
    const interval = setInterval(() => {
      index += 1;
      setDisplayText(insightText.slice(0, index));
      if (index >= insightText.length) {
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [insightText]);

  const renderedText = useMemo(
    () => highlightText(displayText, accentColor),
    [displayText, accentColor]
  );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      sx={{
        position: 'relative',
        px: 3,
        py: 2,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid transparent',
        background:
          'linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.45)) padding-box, linear-gradient(135deg, rgba(59, 130, 246, 0.35), rgba(148, 163, 184, 0.15)) border-box',
        color: '#e2e8f0',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${alpha(
                accentColor,
                0.6
              )}, transparent 70%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
              boxShadow: `0 0 12px ${alpha(accentColor, 0.4)}`,
            }}
          >
            <Iconify icon="solar:brain-bold" width={22} />
          </Box>
          <Typography variant="body2" sx={{ color: '#e2e8f0', lineHeight: 1.6 }}>
            {renderedText}
            {displayText.length < insightText.length && (
              <Box component="span" sx={{ color: accentColor, ml: 0.5 }}>
                |
              </Box>
            )}
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          onClick={toggleOverlay}
          sx={{
            borderColor: alpha('#e2e8f0', 0.3),
            color: '#e2e8f0',
            bgcolor: alpha('#0f172a', 0.3),
            textTransform: 'none',
            px: 2,
            '&:hover': {
              borderColor: alpha('#e2e8f0', 0.5),
              bgcolor: alpha('#0f172a', 0.5),
            },
          }}
        >
          AI와 대화하기
        </Button>
      </Stack>
    </Box>
  );
};
