import { useState } from 'react';
import { ExternalLink, FilePlus2, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import type {
  RegisterVideoMeetingMaterialInput,
  VideoMeetingMaterialAccessTicket,
  VideoMeetingPreparation,
  VideoMeetingPreparationMaterial,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Props = {
  preparation: VideoMeetingPreparation;
  busy: boolean;
  conflict: boolean;
  onRegister: (
    input: RegisterVideoMeetingMaterialInput,
    expectedMaterialsVersion: number
  ) => Promise<boolean>;
  onRemove: (
    materialId: string,
    expectedMaterialsVersion: number,
    expectedVersion: number
  ) => Promise<boolean>;
  onAccess: (
    materialId: string,
    expectedVersion: number
  ) => Promise<VideoMeetingMaterialAccessTicket | null>;
};
type MaterialDraft = {
  displayName: string;
  contentType: string;
  referenceProvider: VideoMeetingPreparationMaterial['referenceProvider'];
  opaqueReference: string;
  sourceVersion: string;
  classification: VideoMeetingPreparationMaterial['classification'];
  sizeBytes: string;
  contentSha256: string;
};
const emptyDraft: MaterialDraft = {
  displayName: '',
  contentType: 'application/pdf',
  referenceProvider: 'DWP_FILES',
  opaqueReference: '',
  sourceVersion: '',
  classification: 'INTERNAL',
  sizeBytes: '',
  contentSha256: '',
};

export function MeetingPreparationMaterials({
  preparation,
  busy,
  conflict,
  onRegister,
  onRemove,
  onAccess,
}: Props) {
  const { t, i18n } = useTranslation('meetings');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MaterialDraft>(emptyDraft);
  const [remove, setRemove] = useState<VideoMeetingPreparationMaterial | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Record<string, VideoMeetingMaterialAccessTicket>>({});
  const disabled = busy || localBusy;
  const patch = (value: Partial<MaterialDraft>) => {
    setDraft((current) => ({ ...current, ...value }));
    setInvalid(false);
  };
  const submit = async () => {
    const size = draft.sizeBytes.trim() ? Number(draft.sizeBytes) : null;
    const contentType = draft.contentType.trim().toLowerCase();
    const sourceVersion = draft.sourceVersion.trim();
    const valid =
      draft.displayName.trim().length > 0 &&
      /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/u.test(contentType) &&
      /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u.test(draft.opaqueReference.trim()) &&
      (!sourceVersion || /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(sourceVersion)) &&
      (size === null || (Number.isSafeInteger(size) && size >= 0 && size <= 10_737_418_240)) &&
      (!draft.contentSha256.trim() || /^[0-9a-f]{64}$/u.test(draft.contentSha256.trim()));
    if (!valid) {
      setInvalid(true);
      return;
    }
    setLocalBusy(true);
    const saved = await onRegister(
      {
        displayName: draft.displayName,
        contentType,
        referenceProvider: draft.referenceProvider,
        opaqueReference: draft.opaqueReference,
        sourceVersion: sourceVersion || null,
        classification: draft.classification,
        sizeBytes: size,
        contentSha256: draft.contentSha256 || null,
      },
      preparation.materialsVersion
    );
    setLocalBusy(false);
    if (saved) {
      setOpen(false);
      setDraft(emptyDraft);
    }
  };
  const confirmRemove = async () => {
    if (!remove) return;
    setLocalBusy(true);
    const removed = await onRemove(remove.materialId, preparation.materialsVersion, remove.version);
    setLocalBusy(false);
    if (removed) setRemove(null);
  };
  const verifyAccess = async (material: VideoMeetingPreparationMaterial) => {
    setAccessError(null);
    setLocalBusy(true);
    const ticket = await onAccess(material.materialId, material.version);
    setLocalBusy(false);
    if (!ticket) {
      setAccessError(material.materialId);
      return;
    }
    setTickets((current) => ({ ...current, [material.materialId]: ticket }));
  };
  return (
    <Stack gap={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {t('preparation.materialsVersion', { version: preparation.materialsVersion })}
        </Typography>
        {preparation.canManageMaterials && (
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<FilePlus2 size={15} aria-hidden="true" />}
            disabled={disabled}
            onClick={() => setOpen(true)}
            sx={{ minHeight: 44 }}
          >
            {t('preparation.addMaterial')}
          </ActionButton>
        )}
      </Stack>
      <InlineFeedback severity="info">
        <Typography variant="body2">{t('preparation.materialVerificationNotice')}</Typography>
      </InlineFeedback>
      {conflict && (
        <InlineFeedback severity="warning">{t('preparation.materialConflict')}</InlineFeedback>
      )}
      {accessError && (
        <InlineFeedback severity="error">{t('preparation.materialAccessError')}</InlineFeedback>
      )}
      {preparation.materials.length ? (
        <Stack component="ul" gap={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {preparation.materials.map((material) => (
            <Box
              component="li"
              key={material.materialId}
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: foundationTokens.radius.control + 'px',
              }}
            >
              <Stack direction="row" alignItems="start" justifyContent="space-between" gap={1}>
                <Stack gap={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                    {material.displayName}
                  </Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`preparation.materialClassifications.${material.classification}`)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('preparation.materialPending')}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('preparation.materialSource', {
                      provider: material.referenceProvider,
                      version: material.sourceVersion || t('preparation.materialVersionUnknown'),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('preparation.materialRetention', {
                      value: formatDate(
                        material.retentionUntil,
                        { dateStyle: 'medium' },
                        resolveSupportedLocale(i18n.language)
                      ),
                    })}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  {tickets[material.materialId] ? (
                    <ActionButton
                      component="a"
                      href={tickets[material.materialId].accessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      intent="secondary"
                      size="small"
                      endIcon={<ExternalLink size={15} aria-hidden="true" />}
                      sx={{ minHeight: 44 }}
                    >
                      {t('preparation.openMaterial')}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<ShieldCheck size={15} aria-hidden="true" />}
                      disabled={disabled}
                      onClick={() => void verifyAccess(material)}
                      sx={{ minHeight: 44 }}
                    >
                      {t('preparation.verifyMaterialAccess')}
                    </ActionButton>
                  )}
                  {preparation.canManageMaterials && (
                    <ActionIconButton
                      label={t('preparation.removeMaterial')}
                      disabled={disabled}
                      onClick={() => setRemove(material)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </ActionIconButton>
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t(
            preparation.canManageMaterials
              ? 'preparation.noRegisteredMaterials'
              : 'preparation.noVerifiedMaterials'
          )}
        </Typography>
      )}
      <FormDialog
        open={open}
        title={t('preparation.addMaterialTitle')}
        description={t('preparation.addMaterialDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('preparation.registerMaterial')}
        submittingLabel={t('preparation.registeringMaterial')}
        busy={disabled}
        mobileFullScreen
        onClose={() => {
          if (!disabled) setOpen(false);
        }}
        onSubmit={submit}
      >
        <Stack gap={2}>
          {invalid && (
            <InlineFeedback severity="error">{t('preparation.materialInvalid')}</InlineFeedback>
          )}
          <FormField
            required
            label={t('preparation.materialDisplayName')}
            value={draft.displayName}
            inputProps={{ maxLength: 240 }}
            disabled={disabled}
            onChange={(event) => patch({ displayName: event.target.value })}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1.5,
            }}
          >
            <SelectField<MaterialDraft['referenceProvider']>
              label={t('preparation.materialProvider')}
              value={draft.referenceProvider}
              options={(['DWP_FILES', 'SHAREPOINT', 'CONFLUENCE'] as const).map((value) => ({
                value,
                label: value,
              }))}
              disabled={disabled}
              onValueChange={(referenceProvider) =>
                referenceProvider && patch({ referenceProvider })
              }
            />
            <SelectField<MaterialDraft['classification']>
              label={t('preparation.materialClassification')}
              value={draft.classification}
              options={(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const).map((value) => ({
                value,
                label: t(`preparation.materialClassifications.${value}`),
              }))}
              disabled={disabled}
              onValueChange={(classification) => classification && patch({ classification })}
            />
          </Box>
          <FormField
            required
            label={t('preparation.materialOpaqueReference')}
            value={draft.opaqueReference}
            inputProps={{ maxLength: 160 }}
            supportingText={t('preparation.materialOpaqueReferenceHint')}
            disabled={disabled}
            onChange={(event) => patch({ opaqueReference: event.target.value })}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1.5,
            }}
          >
            <FormField
              label={t('preparation.materialSourceVersion')}
              value={draft.sourceVersion}
              inputProps={{ maxLength: 160 }}
              disabled={disabled}
              onChange={(event) => patch({ sourceVersion: event.target.value })}
            />
            <FormField
              required
              label={t('preparation.materialContentType')}
              value={draft.contentType}
              inputProps={{ maxLength: 120 }}
              disabled={disabled}
              onChange={(event) => patch({ contentType: event.target.value })}
            />
            <FormField
              type="number"
              label={t('preparation.materialSize')}
              value={draft.sizeBytes}
              inputProps={{ min: 0, max: 10_737_418_240 }}
              disabled={disabled}
              onChange={(event) => patch({ sizeBytes: event.target.value })}
            />
            <FormField
              label={t('preparation.materialHash')}
              value={draft.contentSha256}
              inputProps={{ maxLength: 64 }}
              disabled={disabled}
              onChange={(event) => patch({ contentSha256: event.target.value })}
            />
          </Box>
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={Boolean(remove)}
        title={t('preparation.removeMaterialTitle')}
        description={t('preparation.removeMaterialDescription', {
          name: remove?.displayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('preparation.removeMaterial')}
        intent="danger"
        busy={disabled}
        onClose={() => {
          if (!disabled) setRemove(null);
        }}
        onConfirm={confirmRemove}
      />
    </Stack>
  );
}
