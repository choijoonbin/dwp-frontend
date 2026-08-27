import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type {
  OnboardingPlanRequest,
  ProviderEntitlement,
  ProviderRegion,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

type Props = {
  entitlements: ProviderEntitlement[];
  regions: ProviderRegion[];
  busy: boolean;
  onClose: () => void;
  onPreview: (request: OnboardingPlanRequest) => Promise<void>;
};

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,79}$/;
const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function ProviderOnboardingDialog({
  entitlements,
  regions,
  busy,
  onClose,
  onPreview,
}: Props) {
  const { t } = useTranslation('provider');
  const [step, setStep] = useState(0);
  const [organizationKey, setOrganizationKey] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [tenantKey, setTenantKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [environmentKey, setEnvironmentKey] = useState('production');
  const [serviceTier, setServiceTier] = useState<ProviderTenant['serviceTier']>('ENTERPRISE');
  const [dataRegion, setDataRegion] = useState(
    regions.find((region) => region.lifecycleState === 'ACTIVE')?.regionKey ?? 'ap-northeast-2'
  );
  const [isolationModel, setIsolationModel] = useState<ProviderTenant['isolationModel']>('POOL');
  const [defaultLocale, setDefaultLocale] = useState('ko-KR');
  const [timeZone, setTimeZone] = useState('Asia/Seoul');
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(
      entitlements
        .filter((item) => item.entitlementKey === 'core.workspace')
        .map((item) => item.entitlementKey)
    )
  );
  const [justification, setJustification] = useState('');

  const steps = [
    t('onboarding.steps.organization'),
    t('onboarding.steps.environment'),
    t('onboarding.steps.access'),
    t('onboarding.steps.review'),
  ];
  const stepValid = useMemo(() => {
    if (step === 0) return KEY_PATTERN.test(organizationKey) && Boolean(organizationName.trim());
    if (step === 1)
      return (
        KEY_PATTERN.test(tenantKey) &&
        Boolean(displayName.trim()) &&
        ENVIRONMENT_PATTERN.test(environmentKey) &&
        Boolean(dataRegion) &&
        Boolean(defaultLocale.trim()) &&
        Boolean(timeZone.trim()) &&
        (!primaryDomain || DOMAIN_PATTERN.test(primaryDomain))
      );
    if (step === 2) return Boolean(adminDisplayName.trim()) && EMAIL_PATTERN.test(adminEmail);
    return selected.size > 0 && Boolean(justification.trim());
  }, [
    adminDisplayName,
    adminEmail,
    dataRegion,
    defaultLocale,
    displayName,
    environmentKey,
    justification,
    organizationKey,
    organizationName,
    primaryDomain,
    selected.size,
    step,
    tenantKey,
    timeZone,
  ]);

  const toggleEntitlement = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = () =>
    onPreview({
      organizationKey,
      organizationName: organizationName.trim(),
      legalName: legalName.trim() || null,
      customerReference: customerReference.trim() || null,
      tenantKey,
      displayName: displayName.trim(),
      environmentKey,
      serviceTier,
      dataRegion,
      isolationModel,
      defaultLocale: defaultLocale.trim(),
      timeZone: timeZone.trim(),
      primaryDomain: primaryDomain.trim() || null,
      initialAdminDisplayName: adminDisplayName.trim(),
      initialAdminEmail: adminEmail.trim().toLowerCase(),
      entitlementKeys: [...selected],
      justification: justification.trim(),
    });

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('onboarding.title')}</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Stack gap={2}>
            <Typography variant="subtitle2">{t('onboarding.organization')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                autoFocus
                required
                fullWidth
                label={t('fields.organizationKey')}
                value={organizationKey}
                onChange={(event) => setOrganizationKey(event.target.value.toLowerCase())}
                error={Boolean(organizationKey) && !KEY_PATTERN.test(organizationKey)}
                helperText={t('fields.keyHelp')}
              />
              <TextField
                required
                fullWidth
                label={t('fields.organizationName')}
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                fullWidth
                label={t('fields.legalName')}
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
              <TextField
                fullWidth
                label={t('fields.customerReference')}
                value={customerReference}
                onChange={(event) => setCustomerReference(event.target.value)}
              />
            </Stack>
          </Stack>
        )}

        {step === 1 && (
          <Stack gap={2}>
            <Typography variant="subtitle2">{t('onboarding.tenantConfiguration')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                autoFocus
                required
                fullWidth
                label={t('fields.tenantKey')}
                value={tenantKey}
                onChange={(event) => setTenantKey(event.target.value.toLowerCase())}
                error={Boolean(tenantKey) && !KEY_PATTERN.test(tenantKey)}
                helperText={t('fields.keyHelp')}
              />
              <TextField
                required
                fullWidth
                label={t('fields.displayName')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <TextField
                required
                fullWidth
                label={t('fields.environmentKey')}
                value={environmentKey}
                onChange={(event) => setEnvironmentKey(event.target.value.toLowerCase())}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                select
                fullWidth
                label={t('fields.serviceTier')}
                value={serviceTier}
                onChange={(event) =>
                  setServiceTier(event.target.value as ProviderTenant['serviceTier'])
                }
              >
                {['STANDARD', 'ENTERPRISE', 'REGULATED'].map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`tiers.${value}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label={t('fields.dataRegion')}
                value={dataRegion}
                onChange={(event) => setDataRegion(event.target.value)}
              >
                {regions
                  .filter((region) => region.lifecycleState === 'ACTIVE')
                  .map((region) => (
                    <MenuItem key={region.regionKey} value={region.regionKey}>
                      {region.displayName}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                fullWidth
                label={t('fields.isolation')}
                value={isolationModel}
                onChange={(event) =>
                  setIsolationModel(event.target.value as ProviderTenant['isolationModel'])
                }
              >
                {['POOL', 'BRIDGE', 'SILO'].map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`isolation.${value}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                required
                fullWidth
                label={t('fields.defaultLocale')}
                value={defaultLocale}
                onChange={(event) => setDefaultLocale(event.target.value)}
              />
              <TextField
                required
                fullWidth
                label={t('fields.timeZone')}
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
              />
              <TextField
                fullWidth
                label={t('fields.primaryDomain')}
                value={primaryDomain}
                onChange={(event) => setPrimaryDomain(event.target.value.toLowerCase())}
                error={Boolean(primaryDomain) && !DOMAIN_PATTERN.test(primaryDomain)}
                helperText={primaryDomain ? t('fields.domainHelp') : ' '}
              />
            </Stack>
          </Stack>
        )}

        {step === 2 && (
          <Stack gap={2}>
            <Typography variant="subtitle2">{t('onboarding.initialAdministrator')}</Typography>
            <Alert severity="warning">
              <Typography variant="subtitle2">{t('onboarding.identityStaging.title')}</Typography>
              <Typography variant="body2">{t('onboarding.identityStaging.description')}</Typography>
            </Alert>
            <TextField
              autoFocus
              required
              fullWidth
              label={t('fields.initialAdminDisplayName')}
              value={adminDisplayName}
              onChange={(event) => setAdminDisplayName(event.target.value)}
            />
            <TextField
              required
              fullWidth
              type="email"
              inputMode="email"
              autoComplete="email"
              label={t('fields.initialAdminEmail')}
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              error={Boolean(adminEmail) && !EMAIL_PATTERN.test(adminEmail)}
              helperText={adminEmail ? t('fields.emailHelp') : ' '}
            />
          </Stack>
        )}

        {step === 3 && (
          <Stack gap={2.25}>
            <Alert severity="info">{t('onboarding.review.notice')}</Alert>
            <Alert severity="warning">
              <Typography variant="subtitle2">{t('onboarding.identityStaging.title')}</Typography>
              <Typography variant="body2">{t('onboarding.identityStaging.description')}</Typography>
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(280px, 5fr)' },
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0, py: 1.5, pr: { md: 2 } }}>
                <Typography variant="subtitle2">{t('onboarding.review.plan')}</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    mt: 1,
                  }}
                >
                  {[
                    [t('fields.organizationName'), organizationName],
                    [t('fields.organizationKey'), organizationKey],
                    [t('fields.displayName'), displayName],
                    [t('fields.environmentKey'), environmentKey],
                    [t('fields.serviceTier'), t(`tiers.${serviceTier}`)],
                    [
                      t('fields.dataRegion'),
                      regions.find((region) => region.regionKey === dataRegion)?.displayName ??
                        dataRegion,
                    ],
                    [t('fields.isolation'), t(`isolation.${isolationModel}`)],
                    [t('fields.primaryDomain'), primaryDomain || '-'],
                    [t('fields.initialAdminDisplayName'), adminDisplayName],
                    [t('fields.initialAdminEmail'), adminEmail],
                  ].map(([label, value], index) => (
                    <Box
                      key={label}
                      sx={{
                        minWidth: 0,
                        py: 0.8,
                        pr: 1.5,
                        borderTop: index > 1 ? 1 : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="body2" fontWeight={650} sx={{ wordBreak: 'break-word' }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box
                sx={{
                  minWidth: 0,
                  py: 1.5,
                  pl: { md: 2 },
                  borderTop: { xs: 1, md: 0 },
                  borderLeft: { xs: 0, md: 1 },
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography variant="subtitle2">{t('onboarding.entitlements')}</Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('onboarding.review.selected', { count: selected.size })}
                  />
                </Stack>
                <Divider sx={{ my: 1 }} />
                <FormGroup>
                  {entitlements.map((entitlement) => (
                    <FormControlLabel
                      key={entitlement.entitlementId}
                      control={
                        <Checkbox
                          checked={selected.has(entitlement.entitlementKey)}
                          onChange={() => toggleEntitlement(entitlement.entitlementKey)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {entitlement.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entitlement.entitlementKey}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, alignItems: 'flex-start' }}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Box>
            <TextField
              required
              multiline
              minRows={3}
              label={t('fields.justification')}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              helperText={t('onboarding.justificationHelp')}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Box sx={{ flex: 1 }} />
        {step > 0 && (
          <Button startIcon={<ArrowLeft size={17} />} onClick={() => setStep((value) => value - 1)}>
            {t('actions.back')}
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowRight size={17} />}
            disabled={!stepValid}
            onClick={() => setStep((value) => value + 1)}
          >
            {t('actions.next')}
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<ClipboardCheck size={17} />}
            disabled={busy || !stepValid}
            onClick={() => void submit()}
          >
            {t('actions.preview')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
