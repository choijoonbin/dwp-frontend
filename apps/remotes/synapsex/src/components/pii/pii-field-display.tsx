/**
 * PII Field Display — handling=MASK/HASH_ONLY/ENCRYPT/FORBID에 따른 표시/차단
 * @see SynapseX 운영형 UX 마감 - PII/권한 기반 UI
 */

import { Iconify } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export type PiiHandling = 'ALLOW' | 'MASK' | 'HASH_ONLY' | 'ENCRYPT' | 'FORBID';

type PiiFieldDisplayProps = {
  label: string;
  value?: string | null;
  handling: PiiHandling;
  onRequestAccess?: () => void;
};

const FORBIDDEN_PLACEHOLDER = '접근 불가';
const ENCRYPTED_PLACEHOLDER = '암호화됨';
const MASKED_PLACEHOLDER = '••••••••••';

/**
 * PII 정책에 따라 필드 값을 표시합니다.
 * - ALLOW: 원본 값 표시
 * - MASK: 마스킹된 값 또는 placeholder 표시
 * - HASH_ONLY: 해시 값 + Hash 배지
 * - ENCRYPT: "암호화됨" placeholder
 * - FORBID: "접근 불가" 또는 필드 숨김
 */
export const PiiFieldDisplay = ({
  label,
  value,
  handling,
  onRequestAccess,
}: PiiFieldDisplayProps) => {
  if (handling === 'FORBID') {
    return (
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip label={FORBIDDEN_PLACEHOLDER} size="small" color="error" variant="filled" sx={{ fontSize: 11 }} />
          {onRequestAccess && (
            <Button variant="text" size="small" onClick={onRequestAccess} sx={{ minWidth: 'auto', px: 1, height: 24 }}>
              <Iconify icon="solar:lock-password-bold" width={14} sx={{ mr: 0.5 }} />
              <Typography variant="caption">Request</Typography>
            </Button>
          )}
        </Stack>
      </Stack>
    );
  }

  if (handling === 'ENCRYPT') {
    return (
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Chip label={ENCRYPTED_PLACEHOLDER} size="small" color="warning" variant="filled" sx={{ fontSize: 11 }} />
      </Stack>
    );
  }

  if (handling === 'HASH_ONLY') {
    const displayValue = value || '—';
    return (
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayValue}
          </Typography>
          <Chip label="Hash" size="small" color="default" variant="filled" sx={{ fontSize: 10 }} />
        </Stack>
      </Stack>
    );
  }

  if (handling === 'MASK') {
    const displayValue = value || MASKED_PLACEHOLDER;
    return (
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {displayValue}
          </Typography>
          {onRequestAccess && (
            <Button variant="text" size="small" onClick={onRequestAccess} sx={{ minWidth: 'auto', px: 1, height: 24 }}>
              <Iconify icon="solar:lock-password-bold" width={14} sx={{ mr: 0.5 }} />
              <Typography variant="caption">Request</Typography>
            </Button>
          )}
        </Stack>
      </Stack>
    );
  }

  // ALLOW
  if (!value) return null;
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Stack>
  );
};
