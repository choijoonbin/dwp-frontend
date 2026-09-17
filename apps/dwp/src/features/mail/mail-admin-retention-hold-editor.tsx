import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { buildMailLegalHoldScope, mailLegalHoldScopeEditor } from './mail-admin-operations-model';
import { Facts } from './mail-admin-operations-ui-shared';

import type { MailLegalHold, MailLegalHoldInput } from './mail-admin-operations-model';

export function HoldEditor({
  open,
  hold,
  policyVersion,
  resourceTypeOptions,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  hold: MailLegalHold | null;
  policyVersion: number;
  resourceTypeOptions: readonly string[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: MailLegalHoldInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [name, setName] = useState(hold?.name ?? '');
  const [safeCaseRef, setSafeCaseRef] = useState(hold?.safeCaseRef ?? '');
  const scopeEditor = mailLegalHoldScopeEditor(hold?.scope);
  const [scopeMode, setScopeMode] = useState(scopeEditor.mode);
  const [scopeIds, setScopeIds] = useState(scopeEditor.ids);
  const [resourceTypes, setResourceTypes] = useState<readonly string[]>(scopeEditor.resourceTypes);
  const [expiresAt, setExpiresAt] = useState(hold?.expiresAt?.slice(0, 10) ?? '');
  const protectionLocked = hold?.status === 'ACTIVE';
  const scope = buildMailLegalHoldScope(scopeMode, scopeIds, resourceTypes);
  const toggleResourceType = (resourceType: string) =>
    setResourceTypes((current) =>
      current.includes(resourceType)
        ? current.filter((item) => item !== resourceType)
        : [...current, resourceType]
    );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('admin.operationsWorkspace.a05.createHold', {
          defaultValue: hold ? 'Edit legal hold' : 'Create legal hold',
        })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('admin.operationsWorkspace.a05.holdName', { defaultValue: 'Hold name' })}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label={t('admin.operationsWorkspace.a05.caseReference', {
              defaultValue: 'Safe case reference',
            })}
            value={safeCaseRef}
            onChange={(event) => setSafeCaseRef(event.target.value)}
          />
          {protectionLocked ? (
            <>
              <InlineFeedback severity="info">
                {t('admin.operationsWorkspace.a05.activeHoldProtectionLocked', {
                  defaultValue:
                    'Protection scope and dates are locked while this hold is active. Use the reviewed release workflow to remove protection.',
                })}
              </InlineFeedback>
              <Facts
                items={[
                  {
                    label: t('admin.operationsWorkspace.a05.protectedScope', {
                      defaultValue: 'Protected scope',
                    }),
                    value: JSON.stringify(hold.scope),
                  },
                  {
                    label: t('admin.operationsWorkspace.a05.protectionStarts', {
                      defaultValue: 'Protection starts',
                    }),
                    value: hold.startsAt,
                  },
                  {
                    label: t('admin.operationsWorkspace.a05.protectionExpires', {
                      defaultValue: 'Protection expires',
                    }),
                    value:
                      hold.expiresAt ??
                      t('admin.operationsWorkspace.a05.noExpiry', {
                        defaultValue: 'No expiry',
                      }),
                  },
                ]}
              />
            </>
          ) : !scopeEditor.editable ? (
            <InlineFeedback severity="warning">
              {t('admin.operationsWorkspace.a05.redactedScope', {
                defaultValue:
                  'This hold scope is redacted or unsupported in the current response and cannot be edited.',
              })}
            </InlineFeedback>
          ) : (
            <>
              <SelectField
                label={t('admin.operationsWorkspace.a05.scope', {
                  defaultValue: 'Resource scope',
                })}
                value={scopeMode}
                options={(['TENANT', 'ACCOUNT', 'THREAD'] as const).map((value) => ({
                  value,
                  label: t(`admin.operationsWorkspace.a05.scopeMode.${value}`, {
                    defaultValue: value,
                  }),
                }))}
                onValueChange={(value) => value && setScopeMode(value)}
              />
              {scopeMode !== 'TENANT' ? (
                <TextField
                  label={t(
                    scopeMode === 'ACCOUNT'
                      ? 'admin.operationsWorkspace.a05.accountIds'
                      : 'admin.operationsWorkspace.a05.threadIds',
                    {
                      defaultValue:
                        scopeMode === 'ACCOUNT'
                          ? 'Account UUIDs (comma separated)'
                          : 'Thread UUIDs (comma separated)',
                    }
                  )}
                  value={scopeIds}
                  error={Boolean(scopeIds.trim()) && !scope}
                  helperText={
                    scopeIds.trim() && !scope
                      ? t('admin.operationsWorkspace.a05.scopeUuidError', {
                          defaultValue: 'Enter one or more valid UUIDs.',
                        })
                      : undefined
                  }
                  onChange={(event) => setScopeIds(event.target.value)}
                />
              ) : null}
              <Box>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('admin.operationsWorkspace.a05.scopeResourceTypes', {
                    defaultValue: 'Resource types (optional)',
                  })}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap flexWrap="wrap">
                  {resourceTypeOptions.map((resourceType) => (
                    <FormControlLabel
                      key={resourceType}
                      control={
                        <Checkbox
                          checked={resourceTypes.includes(resourceType)}
                          onChange={() => toggleResourceType(resourceType)}
                        />
                      }
                      label={resourceType}
                    />
                  ))}
                </Stack>
              </Box>
            </>
          )}
          {!protectionLocked ? (
            <TextField
              label={t('admin.operationsWorkspace.a05.expiresAt', {
                defaultValue: 'Expiry (optional)',
              })}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton intent="quiet" onClick={onClose}>
          {t('actions.cancel')}
        </ActionButton>
        <ActionButton
          intent="primary"
          loading={busy}
          disabled={
            !name.trim() ||
            !safeCaseRef.trim() ||
            (!protectionLocked && (!scopeEditor.editable || !scope))
          }
          onClick={() =>
            onSave({
              name: name.trim(),
              safeCaseRef: safeCaseRef.trim(),
              scope: protectionLocked ? hold.scope : scope!,
              startsAt: protectionLocked ? hold.startsAt : hold?.startsAt,
              expiresAt: protectionLocked
                ? (hold.expiresAt ?? null)
                : expiresAt
                  ? `${expiresAt}T23:59:59.999Z`
                  : null,
              version: hold?.version ?? policyVersion,
            })
          }
        >
          {t('actions.save')}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
