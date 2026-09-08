import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import type { VideoMeetingTemplateInput } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import { meetingTemplateInputError, normalizeMeetingTemplateInput } from './meeting-template-model';

export function parseMeetingTemplateImport(source: string): VideoMeetingTemplateInput | null {
  if (source.length > 128_000) return null;
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.name !== 'string' ||
      typeof record.purpose !== 'string' ||
      typeof record.category !== 'string' ||
      typeof record.durationMinutes !== 'number' ||
      !Array.isArray(record.agendaItems) ||
      record.agendaItems.length > 50
    )
      return null;
    const agendaItems = record.agendaItems.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new Error('Invalid agenda');
      const item = entry as Record<string, unknown>;
      if (
        typeof item.title !== 'string' ||
        typeof item.description !== 'string' ||
        typeof item.role !== 'string' ||
        typeof item.durationMinutes !== 'number'
      )
        throw new Error('Invalid agenda');
      return {
        title: item.title,
        description: item.description,
        role: item.role,
        durationMinutes: item.durationMinutes,
      };
    });
    const input = {
      name: record.name,
      purpose: record.purpose,
      category: record.category,
      durationMinutes: record.durationMinutes,
      agendaItems,
    };
    return meetingTemplateInputError(input) ? null : normalizeMeetingTemplateInput(input);
  } catch {
    return null;
  }
}

export function MeetingTemplateImport({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (template: VideoMeetingTemplateInput) => void;
}) {
  const { t } = useTranslation('meetings');
  const [source, setSource] = useState('');
  const parsed = parseMeetingTemplateImport(source);
  return (
    <FormDialog
      open
      title={t('stitch.templates.import')}
      description={t('stitch.templates.importHint')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('stitch.templates.importReview')}
      submitDisabled={!parsed}
      onClose={onClose}
      onSubmit={() => {
        if (parsed) onImport(parsed);
      }}
    >
      <FormField
        multiline
        minRows={10}
        label={t('stitch.templates.importJson')}
        value={source}
        inputProps={{ maxLength: 128_000 }}
        onChange={(event) => setSource(event.target.value)}
      />
      {source && !parsed && (
        <InlineFeedback severity="warning" sx={{ mt: 2 }}>
          {t('stitch.templates.importInvalid')}
        </InlineFeedback>
      )}
    </FormDialog>
  );
}
