import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileLock2, ReceiptText, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  SectionHeader,
} from '@dwp-frontend/design-system';
import { formatCivilDate, formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { useHrisPayrollWorkspace } from '../hooks/use-hris-payroll-workspace';

import type { PayrollSelfServiceModel } from '../model/payroll-self-service-model';

const PAYROLL_COPY = {
  en: {
    boundaryTitle: 'Read-only payroll source view',
    boundaryDescription:
      'This page does not calculate payroll, confirm payroll results, or initiate payment. It only shows status and secure statement references supplied by the payroll source.',
    sourceTitle: 'Source and privacy',
    sourceDescription: 'Provenance and monetary-data handling reported by the source.',
    dataOrigin: 'Next-cycle data origin',
    sourceConfirmed: 'Source confirmation reported',
    monetaryRedaction: 'Monetary data redacted by source',
    yes: 'Yes',
    no: 'No',
    unknown: 'Not reported',
    cycleUnavailable: 'No upcoming cycle was supplied by the source.',
    statementAvailability: 'Source availability',
    statementDownloadability: 'Source downloadability',
    downloadable: 'Downloadable',
    notDownloadable: 'Not downloadable',
    download: 'Download statement',
    downloadFor: 'Download pay statement for {{period}}',
    downloadConnectionPending:
      'The source marks this statement downloadable, but secure download is not connected here yet.',
    statementNotAvailable: 'The source has not made this statement available for download.',
    downloadError: 'The secure statement could not be opened. Nothing was changed.',
  },
  ko: {
    boundaryTitle: '급여 원천 조회 전용 화면',
    boundaryDescription:
      '이 화면은 급여를 계산하거나 결과를 확정하거나 지급을 실행하지 않습니다. 급여 원천이 제공한 상태와 보안 명세 참조만 보여줍니다.',
    sourceTitle: '원천 및 개인정보 보호',
    sourceDescription: '원천이 보고한 데이터 출처와 금액 데이터 처리 상태입니다.',
    dataOrigin: '다음 급여 주기 데이터 출처',
    sourceConfirmed: '원천 확인 보고 여부',
    monetaryRedaction: '원천의 금액 데이터 마스킹',
    yes: '예',
    no: '아니요',
    unknown: '보고되지 않음',
    cycleUnavailable: '원천에서 제공한 예정 급여 주기가 없습니다.',
    statementAvailability: '원천 이용 가능 상태',
    statementDownloadability: '원천 다운로드 가능 여부',
    downloadable: '다운로드 가능',
    notDownloadable: '다운로드 불가',
    download: '급여 명세 다운로드',
    downloadFor: '{{period}} 급여 명세 다운로드',
    downloadConnectionPending:
      '원천은 다운로드 가능으로 보고했지만 이 화면에는 보안 다운로드가 아직 연결되지 않았습니다.',
    statementNotAvailable: '원천에서 이 명세를 다운로드 가능 상태로 제공하지 않았습니다.',
    downloadError: '보안 급여 명세를 열지 못했습니다. 변경된 내용은 없습니다.',
  },
} as const;

type PayrollCopy = (typeof PAYROLL_COPY)[keyof typeof PAYROLL_COPY];

export type HrisPayrollWorkspaceProps = {
  onDownloadStatement?: (statementId: string) => void | Promise<void>;
};

function interpolatePeriod(template: string, period: string): string {
  return template.replace('{{period}}', period);
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={2}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

function PayrollWorkspaceView({
  model,
  copy,
  onDownloadStatement,
}: {
  model: PayrollSelfServiceModel;
  copy: PayrollCopy;
  onDownloadStatement?: HrisPayrollWorkspaceProps['onDownloadStatement'];
}) {
  const { t } = useTranslation('hcm');
  const [downloadStates, setDownloadStates] = useState(
    () => new Map<string, { loading: boolean; error: boolean }>()
  );
  const activeDownloads = useRef(new Map<string, symbol>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const tokens = activeDownloads.current;
    return () => {
      mounted.current = false;
      tokens.clear();
    };
  }, []);

  const downloadStatement = async (statementId: string) => {
    if (!onDownloadStatement || !mounted.current || activeDownloads.current.has(statementId))
      return;
    const token = Symbol(statementId);
    activeDownloads.current.set(statementId, token);
    setDownloadStates((previous) =>
      new Map(previous).set(statementId, { loading: true, error: false })
    );
    let failed = false;
    try {
      await onDownloadStatement(statementId);
    } catch {
      failed = true;
    } finally {
      // Authority-key remounts invalidate UI completion, not external callback side effects.
      // Native cancellation/re-authorization remains the future secure adapter's responsibility.
      if (mounted.current && activeDownloads.current.get(statementId) === token) {
        activeDownloads.current.delete(statementId);
        setDownloadStates((previous) =>
          new Map(previous).set(statementId, { loading: false, error: failed })
        );
      }
    }
  };

  return (
    <Stack gap={2} data-testid="hris-payroll-workspace">
      <Stack
        component="aside"
        role="note"
        direction="row"
        alignItems="flex-start"
        gap={1}
        sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
      >
        <FileLock2 size={18} aria-hidden="true" />
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle2">
            {copy.boundaryTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.boundaryDescription}
          </Typography>
        </Box>
      </Stack>

      {model.containsReferenceData && (
        <InlineFeedback severity="info" title={t('domains.reference.title')}>
          {t('domains.reference.description')}
        </InlineFeedback>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <ShieldCheck size={19} aria-hidden="true" />
            <Box>
              <Typography component="h2" variant="subtitle1">
                {copy.sourceTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {copy.sourceDescription}
              </Typography>
            </Box>
          </Stack>
          <Stack gap={1}>
            <SourceFact label={copy.dataOrigin} value={model.dataOrigin} />
            <SourceFact
              label={copy.sourceConfirmed}
              value={
                model.sourceConfirmed === null
                  ? copy.unknown
                  : model.sourceConfirmed
                    ? copy.yes
                    : copy.no
              }
            />
            <SourceFact
              label={copy.monetaryRedaction}
              value={model.monetaryDataRedacted ? copy.yes : copy.no}
            />
          </Stack>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography component="h2" variant="subtitle1">
              {t('domains.pay.nextPayDay')}
            </Typography>
            {model.nextCycle && (
              <Chip size="small" variant="outlined" label={model.nextCycle.status} />
            )}
          </Stack>
          {model.nextCycle ? (
            <Stack gap={0.75} sx={{ mt: 1.25 }}>
              <Typography component="p" variant="h5">
                {formatCivilDate(model.nextCycle.payDate, { dateStyle: 'long' })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {model.nextCycle.name}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${t('domains.pay.readinessItems.time')}: ${model.nextCycle.timeValidated ? copy.yes : copy.no}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${t('domains.pay.readinessItems.absence')}: ${model.nextCycle.absenceValidated ? copy.yes : copy.no}`}
                />
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
              {copy.cycleUnavailable}
            </Typography>
          )}
        </Paper>
      </Box>

      <Paper component="section" variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ px: 2, py: 1.75 }}>
          <SectionHeader
            icon={ReceiptText}
            title={t('domains.pay.statementsTitle')}
            meta={t('domains.pay.statementsDescription')}
            glyph="plain"
          />
        </Box>
        <Divider />
        {model.statements.length ? (
          <Box>
            {model.statements.map((statement, index) => {
              const hasDownloadHandler = Boolean(onDownloadStatement);
              const canDownload = statement.sourceDownloadable && hasDownloadHandler;
              return (
                <Box key={statement.statementId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <ReceiptText size={19} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography component="h3" variant="subtitle2">
                        {statement.periodLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {statement.publishedAt
                          ? formatDate(statement.publishedAt, { dateStyle: 'medium' })
                          : t('domains.pay.awaitingPublication')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {copy.statementAvailability}: {statement.sourceAvailability || 'UNKNOWN'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {copy.statementDownloadability}:{' '}
                        {statement.sourceDownloadable ? copy.downloadable : copy.notDownloadable}
                      </Typography>
                      {!statement.sourceDownloadable && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {copy.statementNotAvailable}
                        </Typography>
                      )}
                      {statement.sourceDownloadable && !hasDownloadHandler && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {copy.downloadConnectionPending}
                        </Typography>
                      )}
                      {downloadStates.get(statement.statementId)?.error && (
                        <Typography role="alert" variant="caption" color="error" display="block">
                          {copy.downloadError}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="small" variant="outlined" label={statement.availability} />
                    {canDownload && (
                      <ActionButton
                        intent="secondary"
                        size="small"
                        startIcon={<Download size={15} aria-hidden="true" />}
                        loading={downloadStates.get(statement.statementId)?.loading ?? false}
                        aria-label={interpolatePeriod(copy.downloadFor, statement.periodLabel)}
                        onClick={() => void downloadStatement(statement.statementId)}
                      >
                        {copy.download}
                      </ActionButton>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        ) : (
          <EmptyState
            size="compact"
            title={t('domains.pay.emptyTitle')}
            description={t('domains.pay.emptyDescription')}
          />
        )}
      </Paper>
    </Stack>
  );
}

export function HrisPayrollWorkspace({ onDownloadStatement }: HrisPayrollWorkspaceProps) {
  const { i18n } = useTranslation('hcm');
  const copy = PAYROLL_COPY[resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)];
  const query = useHrisPayrollWorkspace();

  if (!query.ready || query.isLoading || query.error) {
    return (
      <HcmQueryState
        loading={!query.ready || query.isLoading}
        error={query.error}
        retrying={query.isFetching}
        onRetry={query.retry}
        size="page"
      />
    );
  }
  if (!query.model) return null;
  return (
    <PayrollWorkspaceView
      key={query.authorityKey}
      model={query.model}
      copy={copy}
      onDownloadStatement={onDownloadStatement}
    />
  );
}

export default HrisPayrollWorkspace;
