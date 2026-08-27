import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  MESSAGING_EXPRESSIONS,
  messagingExpressionLabel,
  messagingExpressionValue,
  type MessagingExpression,
  type MessagingExpressionCategory,
} from './messaging-expression-catalog';

const RECENT_STORAGE_KEY = 'dwp.messaging.recent-expressions.v1';
const RECENT_LIMIT = 16;

type PickerCategory = 'recent' | MessagingExpressionCategory;

function readRecentExpressions(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecentExpression(value: string, current: string[]) {
  const next = [value, ...current.filter((item) => item !== value)].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A blocked preference store must never block message composition.
  }
  return next;
}

export function MessagingExpressionPicker({
  anchorEl,
  open,
  mode = 'composer',
  onClose,
  onSelect,
}: {
  anchorEl: HTMLElement | null;
  open: boolean;
  mode?: 'composer' | 'reaction';
  onClose: () => void;
  onSelect: (expression: MessagingExpression) => void;
}) {
  const { t, i18n } = useTranslation('messaging');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [category, setCategory] = useState<PickerCategory>('recent');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecentExpressions());
    setQuery('');
  }, [open]);

  const categories = useMemo<PickerCategory[]>(
    () =>
      mode === 'reaction'
        ? ['recent', 'people', 'work', 'objects', 'symbols']
        : ['recent', 'people', 'work', 'objects', 'symbols', 'stamps'],
    [mode]
  );
  useEffect(() => {
    if (!categories.includes(category)) setCategory('recent');
  }, [categories, category]);

  const expressions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const available = MESSAGING_EXPRESSIONS.filter((item) => mode === 'composer' || !item.stamp);
    if (normalizedQuery) {
      return available.filter((item) =>
        `${item.label} ${messagingExpressionLabel(item, 'en')} ${item.keywords}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      );
    }
    if (category === 'recent') {
      return recent
        .map((value) => available.find((item) => item.value === value))
        .filter((item): item is MessagingExpression => Boolean(item));
    }
    return available.filter((item) => item.category === category);
  }, [category, mode, query, recent]);

  const select = (expression: MessagingExpression) => {
    setRecent((current) => writeRecentExpression(expression.value, current));
    onSelect({
      ...expression,
      label: messagingExpressionLabel(expression, language),
      value: messagingExpressionValue(expression, language),
    });
    onClose();
  };

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: 'min(404px, calc(100vw - 24px))',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: '0 18px 52px rgba(15, 23, 42, 0.18)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ p: 1.25, pb: 0.75 }}>
        <FormField
          fullWidth
          size="small"
          value={query}
          autoFocus
          placeholder={t('expressions.search')}
          onChange={(event) => setQuery(event.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': t('expressions.search') },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      {!query && (
        <Tabs
          value={category}
          onChange={(_event, value: PickerCategory) => setCategory(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label={t('expressions.categories.label')}
          sx={{ minHeight: 38, borderBottom: 1, borderColor: 'divider' }}
        >
          {categories.map((item) => (
            <Tab
              key={item}
              value={item}
              label={t(`expressions.categories.${item}`)}
              sx={{ minHeight: 38, minWidth: 64, px: 1, fontSize: 12 }}
            />
          ))}
        </Tabs>
      )}
      <Box sx={{ minHeight: 220, maxHeight: 300, overflowY: 'auto', p: 1.25 }}>
        {expressions.length ? (
          category === 'stamps' && !query ? (
            <Stack spacing={0.5}>
              {expressions.map((expression) => (
                <ButtonBase
                  key={expression.value}
                  onClick={() => select(expression)}
                  sx={{
                    width: 1,
                    minHeight: 42,
                    justifyContent: 'flex-start',
                    px: 1.25,
                    borderRadius: 1,
                    color: 'text.primary',
                    textAlign: 'left',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    {messagingExpressionValue(expression, language)}
                  </Typography>
                </ButtonBase>
              ))}
            </Stack>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(36px, 1fr))',
                gap: 0.25,
              }}
            >
              {expressions.map((expression) => (
                <Tooltip
                  key={expression.value}
                  title={messagingExpressionLabel(expression, language)}
                  enterDelay={450}
                >
                  <ButtonBase
                    aria-label={messagingExpressionLabel(expression, language)}
                    onClick={() => select(expression)}
                    sx={{
                      width: 1,
                      minWidth: 36,
                      height: 40,
                      borderRadius: 1,
                      fontSize: 23,
                      lineHeight: 1,
                      '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                      '@media (prefers-reduced-motion: reduce)': {
                        '&:hover': { transform: 'none' },
                      },
                    }}
                  >
                    {expression.value}
                  </ButtonBase>
                </Tooltip>
              ))}
            </Box>
          )
        ) : (
          <Box sx={{ minHeight: 196, display: 'grid', placeItems: 'center', px: 3 }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {category === 'recent' && !query
                ? t('expressions.recentEmpty')
                : t('expressions.empty')}
            </Typography>
          </Box>
        )}
      </Box>
    </Popover>
  );
}
