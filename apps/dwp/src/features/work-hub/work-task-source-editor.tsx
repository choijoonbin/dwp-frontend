import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubReferenceKey } from './work-hub-contracts';

import type {
  PersonalWorkSource,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export type WorkTaskSourceOption = { reference: WorkSourceReference; label: string };
export function WorkTaskSourceEditor({
  sources,
  selected,
  options,
  disabled,
  clearUnavailable,
  onClearUnavailable,
  onChange,
}: {
  sources: readonly PersonalWorkSource[];
  selected: readonly WorkSourceReference[];
  options: readonly WorkTaskSourceOption[];
  disabled: boolean;
  clearUnavailable: boolean;
  onClearUnavailable: (clear: boolean) => void;
  onChange: (sources: WorkSourceReference[]) => void;
}) {
  const { t } = useTranslation('work');
  const [query, setQuery] = useState('');
  const hasUnavailable = sources.some((source) => source.availability === 'UNAVAILABLE');
  const locked = disabled || (hasUnavailable && !clearUnavailable);
  const availableLabels = new Map(
    options.map((option) => [workHubReferenceKey(option.reference), option.label])
  );
  sources.forEach((source) => {
    if (source.availability === 'AVAILABLE')
      availableLabels.set(workHubReferenceKey(source.reference), source.title);
  });
  const selectedKeys = new Set(selected.map(workHubReferenceKey));
  const candidates = options.filter(
    (option) =>
      !selectedKeys.has(workHubReferenceKey(option.reference)) &&
      option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  return (
    <Stack gap={1.25}>
      {hasUnavailable && (
        <>
          <InlineFeedback severity="warning">
            {t('workHub.taskSources.unavailableNotice')}
          </InlineFeedback>
          <FormControlLabel
            control={
              <Checkbox
                checked={clearUnavailable}
                disabled={disabled}
                onChange={(event) => onClearUnavailable(event.target.checked)}
                sx={{ minWidth: 44, minHeight: 44 }}
              />
            }
            label={t('workHub.taskSources.clearUnavailable')}
          />
        </>
      )}
      <Stack component="ul" gap={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {selected.map((reference) => (
          <Box
            component="li"
            key={workHubReferenceKey(reference)}
            sx={{
              p: 1.25,
              bgcolor: 'action.hover',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Link2 size={16} aria-hidden="true" />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                {availableLabels.get(workHubReferenceKey(reference)) ||
                  t('workHub.taskForm.sourceLinkedReferenceOnly')}
              </Typography>
              <ActionIconButton
                label={t('workHub.taskSources.remove')}
                disabled={locked}
                onClick={() =>
                  onChange(
                    selected.filter(
                      (candidate) =>
                        workHubReferenceKey(candidate) !== workHubReferenceKey(reference)
                    )
                  )
                }
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <X size={16} />
              </ActionIconButton>
            </Stack>
          </Box>
        ))}
      </Stack>
      {!selected.length && (
        <Typography variant="body2" color="text.secondary">
          {t('workHub.taskSources.empty')}
        </Typography>
      )}
      {selected.length >= 10 ? (
        <Typography variant="caption" color="text.secondary">
          {t('workHub.taskSources.limit')}
        </Typography>
      ) : (
        <>
          <FormField
            size="small"
            label={t('workHub.taskSources.search')}
            value={query}
            disabled={locked}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Stack gap={0.5} sx={{ maxHeight: 220, overflowY: 'auto' }}>
            {candidates.slice(0, 20).map((option) => (
              <ActionButton
                key={workHubReferenceKey(option.reference)}
                intent="quiet"
                startIcon={<Link2 size={16} />}
                disabled={locked}
                onClick={() => onChange([...selected, option.reference])}
                sx={{ justifyContent: 'flex-start', minHeight: 44 }}
              >
                {option.label}
              </ActionButton>
            ))}
          </Stack>
          {candidates.length > 20 && (
            <Typography variant="caption" color="text.secondary">
              {t('workHub.taskSources.refineSearch')}
            </Typography>
          )}
        </>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('workHub.taskSources.help')}
      </Typography>
    </Stack>
  );
}
