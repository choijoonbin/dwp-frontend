import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckSquare2, Save } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { WorkTaskChecklistEditor } from './work-task-checklist-editor';
import { WorkSourceDetailSection } from './work-hub-source-detail-section';

import type {
  PersonalWorkChecklistItem,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export function WorkPersonalChecklist({
  task,
  disabled,
  onSave,
}: {
  task: PersonalWorkTask;
  disabled: boolean;
  onSave: (next: PersonalWorkChecklistItem[], version: number) => Promise<void>;
}) {
  const { t } = useTranslation('work');
  const [draft, setDraft] = useState(task.checklist ?? []);
  const [dirty, setDirty] = useState(false);
  const [draftVersion, setDraftVersion] = useState(task.version);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setDraft(task.checklist ?? []);
      setDraftVersion(task.version);
    }
  }, [dirty, task.checklist, task.version]);
  const conflict = dirty && task.version !== draftVersion;
  const invalid =
    draft.length > 100 || draft.some((entry) => !entry.title.trim() || entry.title.length > 500);
  return (
    <WorkSourceDetailSection title={t('workHub.checklist.title')} icon={CheckSquare2}>
      <Stack gap={1.5}>
        <WorkTaskChecklistEditor
          value={draft}
          disabled={disabled || saving}
          editTitles={false}
          showItemActions={false}
          progressItems={task.checklist ?? []}
          progressLabel={t('workHub.checklist.savedProgress', {
            completed: (task.checklist ?? []).filter((entry) => entry.completed).length,
            total: task.checklist?.length ?? 0,
          })}
          onChange={(next) => {
            if (!dirty) setDraftVersion(task.version);
            setDraft(next);
            setDirty(true);
            setFailed(false);
          }}
        />
        {dirty && (
          <InlineFeedback severity="info">{t('workHub.checklist.unsavedProgress')}</InlineFeedback>
        )}
        {invalid && (
          <InlineFeedback severity="error">{t('workHub.checklist.invalid')}</InlineFeedback>
        )}
        {failed && (
          <InlineFeedback severity="warning">{t('workHub.checklist.saveFailed')}</InlineFeedback>
        )}
        {conflict && (
          <Stack gap={1.5}>
            <InlineFeedback severity="warning">{t('workHub.checklist.conflict')}</InlineFeedback>
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <Typography variant="subtitle2">{t('workHub.checklist.latest')}</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, maxHeight: 200, overflowY: 'auto' }}>
                {(task.checklist ?? []).map((entry) => (
                  <Typography
                    component="li"
                    key={entry.itemId}
                    variant="body2"
                    sx={{
                      overflowWrap: 'anywhere',
                      textDecoration: entry.completed ? 'line-through' : undefined,
                    }}
                  >
                    {entry.title}
                  </Typography>
                ))}
              </Box>
              {!task.checklist?.length && (
                <Typography variant="body2">{t('workHub.checklist.empty')}</Typography>
              )}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                disabled={disabled || saving}
                onClick={() => {
                  setDraft(task.checklist ?? []);
                  setDraftVersion(task.version);
                  setDirty(false);
                  setFailed(false);
                }}
              >
                {t('workHub.checklist.useLatest')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={disabled || saving}
                onClick={() => {
                  setDraftVersion(task.version);
                  setFailed(false);
                }}
              >
                {t('workHub.checklist.replaceLatest')}
              </ActionButton>
            </Stack>
          </Stack>
        )}
        {dirty && (
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            disabled={disabled || invalid || conflict}
            loading={saving}
            loadingLabel={t('workHub.checklist.saving')}
            onClick={async () => {
              if (disabled || saving || invalid || conflict) return;
              setSaving(true);
              setFailed(false);
              try {
                await onSave(
                  draft.map((entry) => ({ ...entry, title: entry.title.trim() })),
                  draftVersion
                );
                setDirty(false);
              } catch {
                setFailed(true);
              } finally {
                setSaving(false);
              }
            }}
          >
            {t('workHub.checklist.save')}
          </ActionButton>
        )}
      </Stack>
    </WorkSourceDetailSection>
  );
}
