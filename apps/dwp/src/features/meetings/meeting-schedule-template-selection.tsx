import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronDown, LayoutTemplate } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingTemplate,
  type VideoMeetingTemplate,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingShape } from './meeting-visual-system';

type Evidence = { key: string; template: VideoMeetingTemplate | null; failed: boolean };

/** Presentation evidence is read from the authorized current revision, never persisted in a draft. */
export function MeetingScheduleTemplateSelection({
  templateId,
  version,
  busy,
  onChoose,
  onRevoke,
}: {
  templateId?: string;
  version?: number;
  busy: boolean;
  onChoose: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation('meetings');
  const descriptionId = useId();
  const key = JSON.stringify([templateId, version]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [retry, setRetry] = useState(0);
  const fence = useRef(0);
  useEffect(() => {
    if (!templateId || !Number.isSafeInteger(version)) return;
    let current = true;
    let controller: AbortController | undefined;
    const clear = () => {
      fence.current += 1;
      controller?.abort();
      setEvidence(null);
    };
    const check = () => {
      clear();
      if (document.visibilityState === 'hidden') return;
      const generation = fence.current;
      controller = new AbortController();
      const signal = controller.signal;
      void getVideoMeetingTemplate(templateId, signal)
        .then((template) => {
          if (!current || signal.aborted || generation !== fence.current) return;
          const matches =
            template.templateId === templateId &&
            template.version === version &&
            typeof template.name === 'string' &&
            Boolean(template.name.trim()) &&
            typeof template.purpose === 'string' &&
            ['PERSONAL', 'ORGANIZATION'].includes(template.scope);
          setEvidence({ key, template: matches ? template : null, failed: !matches });
        })
        .catch((error) => {
          if (!current || signal.aborted || generation !== fence.current) return;
          setEvidence({ key, template: null, failed: true });
          if (error instanceof HttpError && [401, 403].includes(error.status)) onRevoke();
        });
    };
    check();
    // A returned tab and a bounded foreground refresh must revalidate before showing its old name.
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 30_000);
    return () => {
      current = false;
      fence.current += 1;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [key, templateId, version, retry, onRevoke]);
  const current = evidence?.key === key ? evidence : null;
  const template = current?.template;
  const label = t('scheduleWorkspace.design.chooseTemplate');
  return (
    <Stack gap={1}>
      <ActionButton
        intent="secondary"
        aria-label={label}
        aria-describedby={template ? descriptionId : undefined}
        startIcon={template ? <BadgeCheck size={21} /> : <LayoutTemplate size={17} />}
        endIcon={template ? <ChevronDown size={17} /> : undefined}
        disabled={busy}
        onClick={onChoose}
        sx={{
          justifyContent: template ? 'flex-start' : 'center',
          textAlign: 'left',
          whiteSpace: 'normal',
          p: template ? 1.5 : undefined,
          borderRadius: meetingShape.control,
          bgcolor: template ? 'action.selected' : undefined,
          '& .MuiButton-endIcon': { ml: 'auto' },
        }}
      >
        {template ? (
          <Stack gap={0.5} id={descriptionId} data-testid="schedule-template-selection">
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="subtitle2">{template.name}</Typography>
              <Typography variant="caption" color="primary.main">
                {t('templates.version', { version: template.version })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('templates.scopes.' + template.scope)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {template.purpose}
            </Typography>
          </Stack>
        ) : (
          label
        )}
      </ActionButton>
      {templateId && !current && (
        <Typography role="status" variant="caption" color="text.secondary">
          {t('templates.loading')}
        </Typography>
      )}
      {current?.failed && (
        <InlineFeedback severity="warning">
          <Stack gap={1}>
            <Typography variant="caption">{t('scheduleWorkspace.design.sourceFailed')}</Typography>
            <ActionButton
              intent="quiet"
              disabled={busy}
              onClick={() => setRetry((value) => value + 1)}
            >
              {t('actions.retry')}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      )}
    </Stack>
  );
}
