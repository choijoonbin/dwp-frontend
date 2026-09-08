import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  InlineFeedback,
  ProgressMeter,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { PersonalWorkChecklistItem } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export function WorkTaskChecklistEditor({
  value,
  disabled,
  onChange,
  editTitles = true,
  showItemActions = true,
  progressItems = value,
  progressLabel,
}: {
  value: readonly PersonalWorkChecklistItem[];
  disabled: boolean;
  onChange: (next: PersonalWorkChecklistItem[]) => void;
  editTitles?: boolean;
  showItemActions?: boolean;
  progressItems?: readonly PersonalWorkChecklistItem[];
  progressLabel?: string;
}) {
  const { t } = useTranslation('work');
  const [title, setTitle] = useState('');
  const completed = progressItems.filter((entry) => entry.completed).length;
  const progress = progressItems.length ? Math.round((completed / progressItems.length) * 100) : 0;
  const move = (index: number, offset: number) => {
    const next = [...value];
    const removed = next.splice(index, 1)[0];
    if (removed) {
      next.splice(index + offset, 0, removed);
      onChange(next);
    }
  };
  const add = () => {
    if (disabled || value.length >= 100 || !title.trim() || title.length > 500) return;
    onChange([...value, { itemId: crypto.randomUUID(), title: title.trim(), completed: false }]);
    setTitle('');
  };
  return (
    <Stack gap={1.5}>
      <ProgressMeter
        label={
          progressLabel ??
          t('workHub.checklist.progress', { completed, total: progressItems.length })
        }
        value={progress}
        valueLabel={`${progress}%`}
        size="compact"
      />
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {value.map((entry, index) => (
          <Box
            component="li"
            key={entry.itemId}
            sx={{
              py: editTitles ? 1 : 0.25,
              mb: 0.75,
              bgcolor: entry.completed ? 'action.selected' : 'action.hover',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            <Stack direction="row" gap={0.5} alignItems="center">
              <Checkbox
                checked={entry.completed}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((candidate) =>
                      candidate.itemId === entry.itemId
                        ? { ...candidate, completed: event.target.checked }
                        : candidate
                    )
                  )
                }
                inputProps={{ 'aria-label': t('workHub.checklist.toggle', { title: entry.title }) }}
                sx={{ minWidth: 44, minHeight: 44 }}
              />
              {editTitles ? (
                <FormField
                  label={t('workHub.checklist.itemTitle', { index: index + 1 })}
                  size="small"
                  value={entry.title}
                  disabled={disabled}
                  inputProps={{ maxLength: 500 }}
                  sx={{ flex: 1, minWidth: 0 }}
                  onChange={(event) =>
                    onChange(
                      value.map((candidate) =>
                        candidate.itemId === entry.itemId
                          ? { ...candidate, title: event.target.value }
                          : candidate
                      )
                    )
                  }
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    textDecoration: entry.completed ? 'line-through' : undefined,
                    color: entry.completed ? 'text.secondary' : 'text.primary',
                  }}
                >
                  {entry.title}
                </Typography>
              )}
            </Stack>
            {showItemActions && (
              <Stack direction="row" justifyContent="flex-end" gap={0.25}>
                <ActionIconButton
                  label={t('workHub.checklist.up', { title: entry.title })}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <ArrowUp size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('workHub.checklist.down', { title: entry.title })}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <ArrowDown size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('workHub.checklist.remove', { title: entry.title })}
                  disabled={disabled}
                  onClick={() =>
                    onChange(value.filter((candidate) => candidate.itemId !== entry.itemId))
                  }
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Stack>
            )}
          </Box>
        ))}
      </Box>
      {!value.length && (
        <Typography variant="body2" color="text.secondary">
          {t('workHub.checklist.empty')}
        </Typography>
      )}
      {value.length >= 100 ? (
        <InlineFeedback severity="info">{t('workHub.checklist.limit')}</InlineFeedback>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <FormField
            label={t('workHub.checklist.newTitle')}
            size="small"
            value={title}
            disabled={disabled}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                add();
              }
            }}
            sx={{ flex: 1 }}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Plus size={17} />}
            disabled={disabled || !title.trim()}
            onClick={add}
            sx={{ minHeight: 44 }}
          >
            {t('workHub.checklist.add')}
          </ActionButton>
        </Stack>
      )}
    </Stack>
  );
}
