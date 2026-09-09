import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, Download, Link2, RefreshCw } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import {
  downloadVideoMeetingIntelligenceReport,
  type VideoMeetingIntelligenceExportFormat,
  type VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { meetingSurface } from './meeting-visual-system';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_EXPORT_BYTES = 2_000_000;

type DistributionStatus = 'COPIED' | 'COPY_FAILED' | 'EXPORTED' | 'EXPORT_FAILED' | null;

export function meetingRecapDeepLink(origin: string, meetingId: string, reportId: string): string {
  if (!uuid.test(meetingId) || !uuid.test(reportId)) {
    throw new Error('Meeting recap links require canonical identifiers.');
  }
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Meeting recap links require a trusted web origin.');
  }
  const target = new URL('/meetings/history', base.origin);
  target.searchParams.set('meeting', meetingId);
  target.searchParams.set('reportId', reportId);
  return target.href;
}

function exportFilename(
  report: VideoMeetingIntelligenceReport,
  format: VideoMeetingIntelligenceExportFormat
) {
  return `dwp-meeting-recap-${report.reportId}-v${report.version}.${format === 'JSON' ? 'json' : 'md'}`;
}

function assertExportBlob(blob: Blob, format: VideoMeetingIntelligenceExportFormat) {
  const contentType = blob.type.split(';', 1)[0]?.toLowerCase();
  const expected = format === 'JSON' ? 'application/json' : 'text/markdown';
  if (!blob.size || blob.size > MAX_EXPORT_BYTES || contentType !== expected) {
    throw new Error('Meeting recap export response is invalid.');
  }
}

function saveExport(
  blob: Blob,
  report: VideoMeetingIntelligenceReport,
  format: VideoMeetingIntelligenceExportFormat
) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = exportFilename(report, format);
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function MeetingRecapDistribution({
  meetingId,
  report,
}: {
  meetingId: string;
  report: VideoMeetingIntelligenceReport;
}) {
  const { t } = useTranslation('meetings');
  const authorizeExport = useProductActionMutation(
    'route.meetings.work.intelligence-report-export.action'
  );
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState<VideoMeetingIntelligenceExportFormat | null>(null);
  const [lastFormat, setLastFormat] = useState<VideoMeetingIntelligenceExportFormat>('MARKDOWN');
  const [status, setStatus] = useState<DistributionStatus>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, [meetingId, report.reportId, report.version]);

  const exportReport = async (format: VideoMeetingIntelligenceExportFormat) => {
    if (request.current || report.state !== 'PUBLISHED') return;
    const controller = new AbortController();
    request.current = controller;
    setLastFormat(format);
    setExporting(format);
    setStatus(null);
    try {
      const blob = await authorizeExport((authority) =>
        downloadVideoMeetingIntelligenceReport(
          meetingId,
          report.reportId,
          report.version,
          format,
          authority,
          crypto.randomUUID(),
          controller.signal
        )
      );
      if (!mounted.current || request.current !== controller) return;
      assertExportBlob(blob, format);
      saveExport(blob, report, format);
      setStatus('EXPORTED');
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      setStatus('EXPORT_FAILED');
    } finally {
      if (mounted.current && request.current === controller) {
        request.current = null;
        setExporting(null);
      }
    }
  };

  const copyLink = async () => {
    if (request.current) return;
    setStatus(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable.');
      await navigator.clipboard.writeText(
        meetingRecapDeepLink(window.location.origin, meetingId, report.reportId)
      );
      if (mounted.current) setStatus('COPIED');
    } catch {
      if (mounted.current) setStatus('COPY_FAILED');
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="meeting-recap-distribution-title"
      data-testid="meeting-recap-distribution"
      sx={(theme) => ({
        ...meetingSurface(theme, { elevated: false }),
        mt: { xs: 1.5, sm: 2 },
        p: { xs: 1.5, sm: 2 },
      })}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} justifyContent="space-between">
        <Box sx={{ minWidth: 0, maxWidth: 720 }}>
          <Typography
            id="meeting-recap-distribution-title"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('history.recap.distribution.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('history.recap.distribution.description')}
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          sx={{ flexShrink: 0, '& .MuiButton-root': { minHeight: 44 } }}
        >
          <ActionButton
            intent="quiet"
            startIcon={<Link2 size={16} aria-hidden="true" />}
            disabled={Boolean(exporting)}
            onClick={() => void copyLink()}
          >
            {t('history.recap.distribution.copyLink')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<Braces size={16} aria-hidden="true" />}
            loading={exporting === 'JSON'}
            loadingLabel={t('history.recap.distribution.exportingJson')}
            disabled={Boolean(exporting)}
            onClick={() => void exportReport('JSON')}
          >
            {t('history.recap.distribution.exportJson')}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<Download size={16} aria-hidden="true" />}
            loading={exporting === 'MARKDOWN'}
            loadingLabel={t('history.recap.distribution.exportingMarkdown')}
            disabled={Boolean(exporting)}
            onClick={() => void exportReport('MARKDOWN')}
          >
            {t('history.recap.distribution.exportMarkdown')}
          </ActionButton>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('history.recap.distribution.retentionNotice')}
      </Typography>
      {status && (
        <InlineFeedback
          severity={status === 'COPY_FAILED' || status === 'EXPORT_FAILED' ? 'warning' : 'success'}
          title={t(`history.recap.distribution.status.${status}`)}
          sx={{ mt: 1.5 }}
        >
          {status === 'EXPORT_FAILED' && (
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={() => void exportReport(lastFormat)}
              sx={{ mt: 1, minHeight: 44 }}
            >
              {t('history.recap.distribution.retry')}
            </ActionButton>
          )}
        </InlineFeedback>
      )}
    </Box>
  );
}
