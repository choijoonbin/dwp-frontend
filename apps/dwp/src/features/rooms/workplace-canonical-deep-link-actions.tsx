import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const allowedQueries = {
  '/workplace/find': new Set([
    'accessible',
    'capacity',
    'date',
    'duration',
    'features',
    'floors',
    'neighborhood',
    'q',
    'resource',
    'sites',
    'sort',
    'start',
    'types',
    'tz',
    'v',
    'view',
  ]),
  '/workplace/navigation': new Set([
    'accessible',
    'avoidStairs',
    'destinationPoiId',
    'destinationResourceId',
    'originPoiId',
    'siteId',
    'v',
  ]),
} as const;

export type WorkplaceCanonicalRoute = keyof typeof allowedQueries;

export function buildWorkplaceCanonicalDeepLink(
  routePath: WorkplaceCanonicalRoute,
  query: Readonly<Record<string, string | number | boolean | null | undefined>>,
  baseUrl = window.location.origin
) {
  const url = new URL(routePath, baseUrl);
  const allowed = allowedQueries[routePath];
  Object.entries(query)
    .filter(([key, value]) => allowed.has(key as never) && value !== null && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      const normalized = String(value).trim();
      if (normalized) url.searchParams.set(key, normalized);
    });
  return url.toString();
}

type Props = Readonly<{
  routePath: WorkplaceCanonicalRoute;
  query: Readonly<Record<string, string | number | boolean | null | undefined>>;
  title: string;
  text: string;
  shareLabel: string;
  copyLabel: string;
  copiedLabel: string;
  errorLabel: string;
  variant?: 'compact' | 'stacked';
}>;

async function copyUrl(url: string) {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
  await navigator.clipboard.writeText(url);
}

export function WorkplaceCanonicalDeepLinkActions({
  routePath,
  query,
  title,
  text,
  shareLabel,
  copyLabel,
  copiedLabel,
  errorLabel,
  variant = 'compact',
}: Props) {
  const [feedback, setFeedback] = useState('');
  const url = buildWorkplaceCanonicalDeepLink(routePath, query);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else await copyUrl(url);
      setFeedback(copiedLabel);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback(errorLabel);
    }
  };
  const copy = async () => {
    try {
      await copyUrl(url);
      setFeedback(copiedLabel);
    } catch {
      setFeedback(errorLabel);
    }
  };

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Stack
        direction={variant === 'stacked' ? 'column' : 'row'}
        gap={1}
        useFlexGap
        flexWrap="wrap"
      >
        <ActionButton intent="secondary" startIcon={<Share2 size={16} />} onClick={share}>
          {shareLabel}
        </ActionButton>
        <ActionButton intent="quiet" startIcon={<Copy size={16} />} onClick={copy}>
          {copyLabel}
        </ActionButton>
      </Stack>
      <Typography
        component="span"
        role="status"
        aria-live="polite"
        variant="caption"
        color={feedback === errorLabel ? 'error.main' : 'success.main'}
        sx={{ minHeight: '1.25em' }}
      >
        {feedback ? (
          <Stack component="span" direction="row" gap={0.5} alignItems="center">
            {feedback === copiedLabel ? <Check size={14} aria-hidden="true" /> : null}
            {feedback}
          </Stack>
        ) : null}
      </Typography>
    </Stack>
  );
}
