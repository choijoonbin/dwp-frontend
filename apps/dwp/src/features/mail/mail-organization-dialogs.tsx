import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  MailAccount,
  MailFolder,
  MailFolderColor,
  MailFolderInput,
  MailImportance,
  MailRule,
  MailRuleAction,
  MailRuleActionType,
  MailRuleCondition,
  MailRuleField,
  MailRuleInput,
  MailRuleMatchMode,
  MailRuleOperator,
} from '@dwp-frontend/shared-utils';

const COLORS: MailFolderColor[] = ['NEUTRAL', 'BLUE', 'TEAL', 'GREEN', 'AMBER', 'CORAL', 'VIOLET'];
const FIELDS: MailRuleField[] = [
  'SENDER',
  'RECIPIENT',
  'SUBJECT',
  'BODY',
  'HAS_ATTACHMENT',
  'IMPORTANCE',
];
const TEXT_OPERATORS: MailRuleOperator[] = ['CONTAINS', 'EQUALS', 'STARTS_WITH', 'ENDS_WITH'];
const ACTIONS: MailRuleActionType[] = ['MOVE_TO_FOLDER', 'MARK_READ', 'STAR', 'SET_IMPORTANCE'];
const IMPORTANCE: MailImportance[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

type FolderForm = MailFolderInput;
type RuleForm = MailRuleInput;

const emptyCondition = (): MailRuleCondition => ({
  field: 'SENDER',
  operator: 'CONTAINS',
  value: '',
});
const emptyAction = (): MailRuleAction => ({ type: 'MOVE_TO_FOLDER', folderId: null });

export function MailFolderDialog({
  open,
  folder,
  accounts,
  folders,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  folder: MailFolder | null;
  accounts: MailAccount[];
  folders: MailFolder[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: FolderForm) => void;
}) {
  const { t } = useTranslation('mail');
  const defaultAccount =
    accounts.find((item) => item.defaultAccount && item.accountKind === 'PERSONAL') ??
    accounts.find((item) => item.accountKind === 'PERSONAL');
  const [form, setForm] = useState<FolderForm>({
    accountId: '',
    parentFolderId: null,
    displayName: '',
    color: 'BLUE',
  });
  const [validationVisible, setValidationVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      folder
        ? {
            accountId: folder.accountId,
            parentFolderId: folder.parentFolderId ?? null,
            displayName: folder.displayName,
            color: folder.color,
          }
        : {
            accountId: defaultAccount?.accountId ?? '',
            parentFolderId: null,
            displayName: '',
            color: 'BLUE',
          }
    );
    setValidationVisible(false);
  }, [defaultAccount?.accountId, folder, open]);

  const valid = Boolean(form.accountId && form.displayName.trim());
  const parentOptions = folders
    .filter((item) => item.folderType === 'CUSTOM')
    .filter((item) => item.accountId === form.accountId && item.folderId !== folder?.folderId)
    .map((item) => ({ value: item.folderId, label: item.displayName }));

  return (
    <FormDialog
      open={open}
      title={t(folder ? 'organization.folder.editTitle' : 'organization.folder.createTitle')}
      description={t('organization.folder.dialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      busy={busy}
      onClose={onClose}
      onSubmit={() => {
        if (valid) onSave({ ...form, displayName: form.displayName.trim() });
        else setValidationVisible(true);
      }}
    >
      <Stack spacing={2}>
        <SelectField<string>
          required
          disabled={Boolean(folder)}
          label={t('organization.folder.account')}
          value={form.accountId}
          options={accounts
            .filter((item) => item.accountKind === 'PERSONAL')
            .map((item) => ({ value: item.accountId, label: item.emailAddress }))}
          onValueChange={(accountId) =>
            setForm((current) => ({ ...current, accountId, parentFolderId: null }))
          }
        />
        <FormField
          required
          autoFocus
          label={t('organization.folder.name')}
          value={form.displayName}
          inputProps={{ maxLength: 160 }}
          errorMessage={
            validationVisible && !form.displayName.trim()
              ? t('organization.validation.required')
              : undefined
          }
          onChange={(event) =>
            setForm((current) => ({ ...current, displayName: event.target.value }))
          }
        />
        <SelectField<string>
          label={t('organization.folder.parent')}
          value={form.parentFolderId ?? ''}
          placeholder={t('organization.folder.noParent')}
          options={parentOptions}
          onValueChange={(parentFolderId) =>
            setForm((current) => ({ ...current, parentFolderId: parentFolderId || null }))
          }
        />
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('organization.folder.color')}
          </Typography>
          <Box
            role="group"
            aria-label={t('organization.folder.color')}
            sx={{
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(7, 1fr)' },
              gap: 1,
            }}
          >
            {COLORS.map((color) => (
              <ActionButton
                key={color}
                size="small"
                intent={form.color === color ? 'primary' : 'quiet'}
                aria-label={t(`organization.colors.${color}`)}
                aria-pressed={form.color === color}
                onClick={() => setForm((current) => ({ ...current, color }))}
                sx={{ minWidth: 0, width: 1, px: 1 }}
              >
                <Box
                  aria-hidden
                  sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: colorValue(color) }}
                />
              </ActionButton>
            ))}
          </Box>
        </Box>
      </Stack>
    </FormDialog>
  );
}

export function MailRuleDialog({
  open,
  rule,
  accounts,
  folders,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  rule: MailRule | null;
  accounts: MailAccount[];
  folders: MailFolder[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: RuleForm) => void;
}) {
  const { t } = useTranslation('mail');
  const defaultAccount =
    accounts.find((item) => item.defaultAccount && item.accountKind === 'PERSONAL') ??
    accounts.find((item) => item.accountKind === 'PERSONAL');
  const [form, setForm] = useState<RuleForm>({
    accountId: '',
    displayName: '',
    priority: 100,
    matchMode: 'ALL',
    conditions: [emptyCondition()],
    actions: [emptyAction()],
    stopProcessing: true,
    enabled: true,
  });
  const [validationVisible, setValidationVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      rule
        ? {
            accountId: rule.accountId,
            displayName: rule.displayName,
            priority: rule.priority,
            matchMode: rule.matchMode,
            conditions: rule.conditions,
            actions: rule.actions,
            stopProcessing: rule.stopProcessing,
            enabled: rule.enabled,
          }
        : {
            accountId: defaultAccount?.accountId ?? '',
            displayName: '',
            priority: 100,
            matchMode: 'ALL',
            conditions: [emptyCondition()],
            actions: [emptyAction()],
            stopProcessing: true,
            enabled: true,
          }
    );
    setValidationVisible(false);
  }, [defaultAccount?.accountId, open, rule]);

  const valid = Boolean(
    form.accountId &&
    form.displayName.trim() &&
    form.conditions.every((item) => item.value.trim()) &&
    form.actions.every((item) => item.type !== 'MOVE_TO_FOLDER' || Boolean(item.folderId))
  );
  const folderOptions = folders
    .filter((item) => item.accountId === form.accountId)
    .filter((item) => ['INBOX', 'ARCHIVE', 'CUSTOM'].includes(item.folderType))
    .map((item) => ({ value: item.folderId, label: item.displayName }));

  const updateCondition = (index: number, patch: Partial<MailRuleCondition>) =>
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((item, position) =>
        position === index
          ? patch.field && patch.field !== item.field
            ? normalizeCondition({ ...item, ...patch })
            : { ...item, ...patch }
          : item
      ),
    }));
  const updateAction = (index: number, patch: Partial<MailRuleAction>) =>
    setForm((current) => ({
      ...current,
      actions: current.actions.map((item, position) =>
        position === index
          ? patch.type && patch.type !== item.type
            ? normalizeAction({ ...item, ...patch })
            : { ...item, ...patch }
          : item
      ),
    }));

  return (
    <FormDialog
      open={open}
      title={t(rule ? 'organization.rule.editTitle' : 'organization.rule.createTitle')}
      description={t('organization.rule.dialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      busy={busy}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => {
        if (valid) onSave({ ...form, displayName: form.displayName.trim() });
        else setValidationVisible(true);
      }}
    >
      <Stack spacing={3}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 140px' },
            gap: 2,
          }}
        >
          <FormField
            required
            label={t('organization.rule.name')}
            value={form.displayName}
            inputProps={{ maxLength: 160 }}
            errorMessage={
              validationVisible && !form.displayName.trim()
                ? t('organization.validation.required')
                : undefined
            }
            onChange={(event) =>
              setForm((current) => ({ ...current, displayName: event.target.value }))
            }
          />
          <FormField
            required
            type="number"
            label={t('organization.rule.priority')}
            value={form.priority}
            inputProps={{ min: 1, max: 10000 }}
            onChange={(event) =>
              setForm((current) => ({ ...current, priority: Number(event.target.value) }))
            }
          />
        </Box>
        <SelectField<string>
          required
          disabled={Boolean(rule)}
          label={t('organization.folder.account')}
          value={form.accountId}
          options={accounts
            .filter((item) => item.accountKind === 'PERSONAL')
            .map((item) => ({ value: item.accountId, label: item.emailAddress }))}
          onValueChange={(accountId) =>
            setForm((current) => ({
              ...current,
              accountId,
              actions: current.actions.map((item) => ({ ...item, folderId: null })),
            }))
          }
        />

        <Box component="section">
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Box>
              <Typography component="h3" variant="subtitle2" fontWeight={800}>
                {t('organization.rule.conditions')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('organization.rule.conditionsDescription')}
              </Typography>
            </Box>
            <SelectField<MailRuleMatchMode>
              size="small"
              label={t('organization.rule.matchMode')}
              value={form.matchMode}
              fullWidth={false}
              sx={{ minWidth: 130 }}
              options={(['ALL', 'ANY'] as const).map((value) => ({
                value,
                label: t(`organization.matchMode.${value}`),
              }))}
              onValueChange={(matchMode) =>
                matchMode && setForm((current) => ({ ...current, matchMode }))
              }
            />
          </Stack>
          <Stack spacing={1}>
            {form.conditions.map((condition, index) => (
              <Box
                key={`${index}-${condition.field}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '150px 150px minmax(0, 1fr) 40px' },
                  gap: 1,
                  alignItems: 'start',
                }}
              >
                <SelectField<MailRuleField>
                  size="small"
                  label={t('organization.rule.field')}
                  value={condition.field}
                  options={FIELDS.map((value) => ({
                    value,
                    label: t(`organization.fields.${value}`),
                  }))}
                  onValueChange={(field) => field && updateCondition(index, { field })}
                />
                <SelectField<MailRuleOperator>
                  size="small"
                  label={t('organization.rule.operator')}
                  value={condition.operator}
                  options={operators(condition.field).map((value) => ({
                    value,
                    label: t(`organization.operators.${value}`),
                  }))}
                  onValueChange={(operator) => operator && updateCondition(index, { operator })}
                />
                {condition.field === 'HAS_ATTACHMENT' ? (
                  <SelectField<string>
                    size="small"
                    label={t('organization.rule.value')}
                    value={condition.value}
                    options={[
                      { value: 'true', label: t('organization.boolean.yes') },
                      { value: 'false', label: t('organization.boolean.no') },
                    ]}
                    onValueChange={(value) => updateCondition(index, { value })}
                  />
                ) : condition.field === 'IMPORTANCE' ? (
                  <SelectField<string>
                    size="small"
                    label={t('organization.rule.value')}
                    value={condition.value}
                    options={IMPORTANCE.map((value) => ({
                      value,
                      label: t(`importance.${value}`),
                    }))}
                    onValueChange={(value) => updateCondition(index, { value })}
                  />
                ) : (
                  <FormField
                    size="small"
                    label={t('organization.rule.value')}
                    value={condition.value}
                    inputProps={{ maxLength: 500 }}
                    errorMessage={
                      validationVisible && !condition.value.trim()
                        ? t('organization.validation.required')
                        : undefined
                    }
                    onChange={(event) => updateCondition(index, { value: event.target.value })}
                  />
                )}
                <ActionIconButton
                  label={t('organization.remove')}
                  disabled={form.conditions.length === 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      conditions: current.conditions.filter(
                        (_item, position) => position !== index
                      ),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Box>
            ))}
          </Stack>
          <ActionButton
            size="small"
            intent="quiet"
            startIcon={<Plus size={15} />}
            disabled={form.conditions.length >= 10}
            sx={{ mt: 1 }}
            onClick={() =>
              setForm((current) => ({
                ...current,
                conditions: [...current.conditions, emptyCondition()],
              }))
            }
          >
            {t('organization.rule.addCondition')}
          </ActionButton>
        </Box>

        <Box component="section">
          <Typography component="h3" variant="subtitle2" fontWeight={800}>
            {t('organization.rule.actions')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('organization.rule.actionsDescription')}
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {form.actions.map((action, index) => (
              <Box
                key={`${index}-${action.type}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr) 40px' },
                  gap: 1,
                  alignItems: 'start',
                }}
              >
                <SelectField<MailRuleActionType>
                  size="small"
                  label={t('organization.rule.action')}
                  value={action.type}
                  options={ACTIONS.map((value) => ({
                    value,
                    label: t(`organization.actions.${value}`),
                  }))}
                  onValueChange={(type) => type && updateAction(index, { type })}
                />
                {action.type === 'MOVE_TO_FOLDER' ? (
                  <SelectField<string>
                    size="small"
                    label={t('organization.rule.targetFolder')}
                    value={action.folderId ?? ''}
                    placeholder={t('organization.rule.targetFolderPlaceholder')}
                    options={folderOptions}
                    errorMessage={
                      validationVisible && !action.folderId
                        ? t('organization.validation.required')
                        : undefined
                    }
                    onValueChange={(folderId) => updateAction(index, { folderId })}
                  />
                ) : action.type === 'SET_IMPORTANCE' ? (
                  <SelectField<MailImportance>
                    size="small"
                    label={t('organization.rule.importance')}
                    value={action.importance ?? 'HIGH'}
                    options={IMPORTANCE.map((value) => ({
                      value,
                      label: t(`importance.${value}`),
                    }))}
                    onValueChange={(importance) =>
                      importance && updateAction(index, { importance })
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ pt: 1.25 }}>
                    {t(`organization.actionDescriptions.${action.type}`)}
                  </Typography>
                )}
                <ActionIconButton
                  label={t('organization.remove')}
                  disabled={form.actions.length === 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      actions: current.actions.filter((_item, position) => position !== index),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Box>
            ))}
          </Stack>
          <ActionButton
            size="small"
            intent="quiet"
            startIcon={<Plus size={15} />}
            disabled={form.actions.length >= 8}
            sx={{ mt: 1 }}
            onClick={() =>
              setForm((current) => ({
                ...current,
                actions: [...current.actions, emptyAction()],
              }))
            }
          >
            {t('organization.rule.addAction')}
          </ActionButton>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={(_event, enabled) => setForm((current) => ({ ...current, enabled }))}
              />
            }
            label={t('organization.rule.enabled')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.stopProcessing}
                onChange={(_event, stopProcessing) =>
                  setForm((current) => ({ ...current, stopProcessing }))
                }
              />
            }
            label={t('organization.rule.stopProcessing')}
          />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export function colorValue(color: MailFolderColor) {
  return {
    NEUTRAL: '#6B7280',
    BLUE: '#2563EB',
    TEAL: '#0F766E',
    GREEN: '#15803D',
    AMBER: '#B45309',
    CORAL: '#C2415D',
    VIOLET: '#7C3AED',
  }[color];
}

function operators(field: MailRuleField): MailRuleOperator[] {
  return field === 'HAS_ATTACHMENT'
    ? ['IS']
    : field === 'IMPORTANCE'
      ? ['IS', 'EQUALS']
      : TEXT_OPERATORS;
}

function normalizeCondition(condition: MailRuleCondition): MailRuleCondition {
  if (condition.field === 'HAS_ATTACHMENT') return { ...condition, operator: 'IS', value: 'true' };
  if (condition.field === 'IMPORTANCE') return { ...condition, operator: 'IS', value: 'HIGH' };
  return condition.operator === 'IS'
    ? { ...condition, operator: 'CONTAINS', value: '' }
    : condition;
}

function normalizeAction(action: MailRuleAction): MailRuleAction {
  if (action.type === 'MOVE_TO_FOLDER') return { type: action.type, folderId: null };
  if (action.type === 'SET_IMPORTANCE') return { type: action.type, importance: 'HIGH' };
  return { type: action.type };
}
