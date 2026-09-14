import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import type {
  ApprovalPolicyImpact,
  ApprovalPolicyImpactFamily,
} from '@dwp-frontend/shared-utils/api/approval-policy-impact-contract';

const categories = ['constraintChanged', 'pinConflict', 'configurationOnly', 'unknown'] as const;
export function ApprovalPolicyImpactResults({ result }: { result: ApprovalPolicyImpact }) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Stack gap={2} minWidth={0}>
      <InlineFeedback severity={result.status === 'PARTIAL' ? 'warning' : 'info'}>
        {t(`admin.impact.status.${result.status}`)}
      </InlineFeedback>
      <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {t('admin.impact.observedAt', {
          at: formatDate(result.observedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale),
        })}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(3,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        {(['workflows', 'requests', 'tasks'] as const).map((key) => (
          <ImpactFamily key={key} name={t(`admin.impact.families.${key}`)} family={result[key]} />
        ))}
      </Box>
      {result.semanticDiff.length > 0 && (
        <Box component="section" aria-label={t('admin.impact.differences')}>
          <Box component="h3" sx={{ typography: 'subtitle2', m: 0, mb: 1 }}>
            {t('admin.impact.differences')}
          </Box>
          <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {result.semanticDiff.map((diff, index) => (
              <Box
                component="li"
                key={`${diff.path}:${index}`}
                sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={t(`admin.impact.diffKinds.${diff.kind}`)} />
                  <Box component="code" sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                    {diff.path}
                  </Box>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
                    gap: 1,
                    mt: 1,
                  }}
                >
                  {(['current', 'proposed'] as const).map((side) => (
                    <Box
                      key={side}
                      sx={{
                        bgcolor: side === 'proposed' ? 'action.selected' : 'action.hover',
                        p: 1.5,
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                        {t(`admin.impact.${side}`)}
                      </Box>
                      <Box
                        component="pre"
                        sx={{
                          typography: 'body2',
                          m: 0,
                          mt: 0.5,
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {diff[side] == null
                          ? t('admin.impact.noValue')
                          : JSON.stringify(diff[side], null, 2)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
      <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {t('admin.impact.sourceDigest', { digest: result.sourceDigest })}
      </Box>
    </Stack>
  );
}

function ImpactFamily({ name, family }: { name: string; family: ApprovalPolicyImpactFamily }) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      component="section"
      aria-label={name}
      sx={{
        minWidth: 0,
        borderInlineStart: 3,
        borderColor: family.counts.complete ? 'success.main' : 'warning.main',
        pl: 1.5,
      }}
    >
      <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
        {name}
      </Box>
      <Box sx={{ typography: 'h5', color: 'text.primary', mt: 1 }}>{family.counts.examined}</Box>
      <Box sx={{ typography: 'caption', color: 'text.secondary', mb: 1 }}>
        {t(family.counts.complete ? 'admin.impact.exactCount' : 'admin.impact.lowerBound')}
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          gap: 0.5,
          typography: 'body2',
        }}
      >
        {categories.map((key) => (
          <Box key={key} sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ color: 'text.secondary' }}>
              {t(`admin.impact.counts.${key}`)}
            </Box>
            <Box
              component="dd"
              sx={{
                m: 0,
                color:
                  key === 'unknown' && family.counts[key] > 0 ? 'warning.main' : 'text.primary',
              }}
            >
              {family.counts[key]}
            </Box>
          </Box>
        ))}
      </Box>
      {family.items.length > 0 && (
        <Box component="details" sx={{ mt: 1.5, typography: 'caption' }}>
          <Box component="summary" sx={{ cursor: 'pointer', py: 0.75 }}>
            {t('admin.impact.sample', { count: family.items.length })}
          </Box>
          <Stack
            component="ul"
            sx={{ p: 0, m: 0, listStyle: 'none', maxHeight: 280, overflowY: 'auto' }}
          >
            {family.items.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{ py: 1, borderTop: 1, borderColor: 'divider', overflowWrap: 'anywhere' }}
              >
                <Box component="code">{item.id}</Box>
                <Box sx={{ mt: 0.5, color: 'text.secondary' }}>
                  {item.effect.reasons
                    .map((reason) => t(`admin.impact.reasons.${reason}`, { defaultValue: reason }))
                    .join(' · ')}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
