import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type {
  SignatureProviderKms,
  SignatureProviderWorm,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import {
  SignatureDiagnosticFacts,
  SignatureDiagnosticStatus,
} from './approval-signature-diagnostics-facts';
import { signatureDiagnosticsObservation } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

export function SignatureDiagnosticsInspection({
  kms,
  worm,
  readState,
  now,
  kmsAction,
  wormAction,
}: {
  kms: SignatureProviderKms;
  worm: SignatureProviderWorm;
  readState: SignatureDiagnosticsReadState;
  now: number;
  kmsAction?: ReactNode;
  wormAction?: ReactNode;
}) {
  const { t, i18n } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  const value = (data: string | null) => data ?? label('unknown');
  const date = (data: string | null) =>
    data === null
      ? label('unknown')
      : formatDate(
          data,
          { dateStyle: 'medium', timeStyle: 'short' },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
        gap: 3,
        borderTop: 1,
        borderColor: 'divider',
        pt: 2,
      }}
    >
      <Stack component="section" aria-label={label('kms')} gap={1.5} minWidth={0}>
        <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
          {label('kms')}
        </Box>
        <SignatureDiagnosticStatus status={signatureDiagnosticsObservation(kms, readState, now)} />
        <SignatureDiagnosticFacts
          rows={[
            { key: 'backend', label: label('backend'), value: kms.backend },
            {
              key: 'verificationKind',
              label: label('verificationKind'),
              value: t(`admin.signatureDiagnostics.verificationKinds.${kms.verificationKind}`),
            },
            { key: 'algorithm', label: label('algorithm'), value: value(kms.algorithm) },
            { key: 'keySha', label: label('keySha'), value: value(kms.keySha256) },
            { key: 'keySource', label: label('keySource'), value: kms.source },
            { key: 'observedAt', label: label('observedAt'), value: date(kms.checkedAt) },
            { key: 'validUntil', label: label('validUntil'), value: date(kms.validUntil) },
          ]}
        />
        {kmsAction}
      </Stack>
      <Stack component="section" aria-label={label('worm')} gap={1.5} minWidth={0}>
        <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
          {label('worm')}
        </Box>
        <SignatureDiagnosticStatus status={signatureDiagnosticsObservation(worm, readState, now)} />
        <SignatureDiagnosticFacts
          rows={[
            { key: 'objectLockMode', label: label('objectLockMode'), value: worm.objectLockMode },
            {
              key: 'storageSha',
              label: label('storageSha'),
              value: value(worm.storageLocatorSha256),
            },
            { key: 'objectSha', label: label('objectSha'), value: value(worm.objectVersionSha256) },
            { key: 'retainUntil', label: label('retainUntil'), value: date(worm.retainUntil) },
            {
              key: 'legalHold',
              label: label('legalHold'),
              value: label(worm.legalHold === null ? 'unknown' : worm.legalHold ? 'yes' : 'no'),
            },
            { key: 'observedAt', label: label('observedAt'), value: date(worm.checkedAt) },
            { key: 'validUntil', label: label('validUntil'), value: date(worm.validUntil) },
          ]}
        />
        {worm.retentionFloorSeconds === null ? null : (
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.signatureDiagnostics.labels.retentionFloor', {
              seconds: worm.retentionFloorSeconds,
            })}
          </Box>
        )}
        {wormAction}
      </Stack>
    </Box>
  );
}
