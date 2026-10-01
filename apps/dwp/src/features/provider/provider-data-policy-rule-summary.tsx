import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderDataPolicy, ProviderDataPolicyRevision } from '@dwp-frontend/shared-utils';

import { providerPolicyRuleFacts } from './provider-data-policy-presentation';

export function ProviderDataPolicyRuleSummary({
  type,
  revision,
}: {
  type: ProviderDataPolicy['policyType'];
  revision: ProviderDataPolicyRevision;
}) {
  const { t } = useTranslation('provider');
  const facts = providerPolicyRuleFacts(type, revision.policyRule);
  return (
    <Box>
      <Typography variant="subtitle2">{t('dataGovernance.policy.fields.rule')}</Typography>
      {!facts ? (
        <Alert severity="warning" sx={{ mt: 0.75 }}>
          {t('dataGovernance.policy.ruleUnavailable')}
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
            mt: 0.75,
          }}
        >
          {facts.map((fact) => (
            <Box
              key={fact.field}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25, minWidth: 0 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t(`dataGovernance.policy.fields.${fact.field}`)}
              </Typography>
              {fact.items ? (
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {fact.items.map((item) => (
                    <Chip key={item} size="small" variant="outlined" label={item} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" fontWeight={650} sx={{ mt: 0.25 }}>
                  {fact.translationKey ? t(fact.translationKey) : fact.text}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
