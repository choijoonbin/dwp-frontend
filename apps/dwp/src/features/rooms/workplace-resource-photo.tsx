import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { foundationTokens } from '@dwp-frontend/design-system';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Monitor } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FormField } from '@dwp-frontend/design-system';
import {
  deleteWorkplaceResourcePhoto,
  getWorkplaceResourcePhoto,
  getWorkplaceResourcePhotoMetadata,
  HttpError,
  uploadWorkplaceResourcePhoto,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { WorkplaceExperiencePanel } from './workplace-experience-ui';

export function WorkplaceResourcePhoto({
  resourceId,
  alt,
  height = 150,
  admin = false,
}: {
  resourceId: string;
  alt: string;
  height?: number;
  admin?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const identity = authorityKey;
  const allowed = admin ? capabilities.canViewWorkplaceAdmin : capabilities.canViewWorkplace;
  const [source, setSource] = useState<{
    identity: string;
    resourceId: string;
    version: number;
    admin: boolean;
    url: string;
  } | null>(null);
  const metadata = useQuery({
    queryKey: ['workplace', 'photo-metadata', identity, resourceId, admin],
    queryFn: () => getWorkplaceResourcePhotoMetadata(resourceId, admin),
    enabled: capabilities.isLoaded && allowed && Boolean(resourceId),
    staleTime: 30_000,
    retry: false,
  });
  const query = useQuery({
    queryKey: ['workplace', 'photo', identity, resourceId, admin, metadata.data?.version],
    queryFn: () => getWorkplaceResourcePhoto(resourceId, admin, metadata.data?.sha256),
    enabled: capabilities.isLoaded && allowed && Boolean(resourceId) && metadata.isSuccess,
    staleTime: 30_000,
    retry: false,
  });
  useEffect(() => {
    if (!query.data || query.isError || metadata.isError || !metadata.data || !allowed) return;
    const url = URL.createObjectURL(query.data);
    setSource({ identity, resourceId, version: metadata.data.version, admin, url });
    return () => URL.revokeObjectURL(url);
  }, [
    query.data,
    query.isError,
    metadata.data,
    metadata.isError,
    allowed,
    identity,
    resourceId,
    admin,
  ]);
  const visible =
    source &&
    source.identity === identity &&
    source.resourceId === resourceId &&
    source.admin === admin &&
    source.version === metadata.data?.version &&
    !query.isError &&
    !metadata.isError &&
    capabilities.isLoaded &&
    allowed;
  const absent = metadata.error instanceof HttpError && metadata.error.status === 404;
  const unavailable = (metadata.isError && !absent) || query.isError || !allowed;
  return (
    <Box
      sx={{
        height,
        minWidth: 0,
        borderRadius: foundationTokens.radius.control + 'px',
        overflow: 'hidden',
        bgcolor: 'var(--dwp-product-soft)',
        color: 'var(--dwp-product-accent)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {visible ? (
        <Box
          component="img"
          src={source.url}
          alt={metadata.data?.altText || alt}
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Stack gap={0.75} alignItems="center" sx={{ p: 1 }}>
          <Monitor aria-hidden="true" size={28} />
          <Typography variant="caption">
            {t(
              !capabilities.isLoaded || metadata.isLoading || query.isFetching
                ? 'workplace.experience.refreshing'
                : unavailable
                  ? 'workplace.experience.photoUnavailable'
                  : 'workplace.experience.photoEmpty'
            )}
          </Typography>
          {unavailable && capabilities.isLoaded && allowed ? (
            <ActionButton
              intent="quiet"
              onClick={async () => {
                const result = await metadata.refetch();
                if (result.isSuccess) await query.refetch();
              }}
            >
              {t('actions.retry')}
            </ActionButton>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

type PhotoCommand = {
  scope: string;
  generation: number;
  resourceId: string;
  version: number;
  reason: string;
  remove: boolean;
  file: File | null;
  altText: string;
};

export function WorkplaceResourceMediaEditor({
  resourceId,
  name,
}: {
  resourceId: string;
  name: string;
}) {
  const { t } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const authorityKey = useWorkplaceExperienceAuthority();
  const queryClient = useQueryClient();
  const identity = authorityKey;
  const scope = `${identity}:${resourceId}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const commandContext = useRef({ scope, generation: 0 });
  if (commandContext.current.scope !== scope)
    commandContext.current = { scope, generation: commandContext.current.generation + 1 };
  const inFlight = useRef<PhotoCommand | null>(null);
  useEffect(
    () => () => {
      commandContext.current.generation += 1;
      inFlight.current = null;
    },
    []
  );
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [locked, setLocked] = useState(false);
  const query = useQuery({
    queryKey: ['workplace', 'photo-metadata', identity, resourceId],
    queryFn: () => getWorkplaceResourcePhotoMetadata(resourceId, true),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 0,
    retry: false,
  });
  const missing = query.error instanceof HttpError && query.error.status === 404;
  const permitted =
    governance.isLoaded &&
    governance.hierarchy.canManage &&
    capabilities.canCreateWorkplaceAdmin &&
    capabilities.canManageWorkplaceAdmin &&
    !locked &&
    !query.isFetching &&
    (!query.isError || missing);
  useEffect(() => setConfirmed(false), [query.data?.version]);
  const matchesCommand = (command: PhotoCommand) =>
    command.scope === activeScope.current &&
    command.generation === commandContext.current.generation;
  const mutation = useMutation<unknown, Error, PhotoCommand>({
    mutationFn: (command) => {
      if (!matchesCommand(command) || !permitted || !confirmed || !command.reason)
        throw new Error('Photo permission or reason unavailable');
      if (command.remove)
        return deleteWorkplaceResourcePhoto(command.resourceId, command.version, command.reason);
      if (
        !command.file ||
        !['image/png', 'image/jpeg'].includes(command.file.type) ||
        command.file.size > 10 * 1024 * 1024 ||
        !command.altText
      )
        throw new Error('Invalid photo');
      return uploadWorkplaceResourcePhoto(
        command.resourceId,
        command.file,
        command.version,
        command.reason,
        command.altText
      );
    },
    onSuccess: async (_result, command) => {
      if (!matchesCommand(command)) return;
      setFile(null);
      setReason('');
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'photo'] });
      if (!matchesCommand(command)) return;
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'photo-metadata'] });
    },
    onError: (_error, command) => {
      if (matchesCommand(command)) {
        setLocked(true);
        setConfirmed(false);
      }
    },
    onSettled: (_data, _error, command) => {
      if (inFlight.current === command) inFlight.current = null;
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => {
    setFile(null);
    setAltText('');
    setReason('');
    setConfirmed(false);
    setLocked(false);
    resetMutation();
  }, [scope, resetMutation]);
  const submit = (remove: boolean) => {
    if (inFlight.current) return;
    const command = {
      scope,
      generation: commandContext.current.generation,
      resourceId,
      version: query.data?.version ?? 0,
      reason: reason.trim(),
      remove,
      file,
      altText: altText.trim(),
    };
    inFlight.current = command;
    mutation.mutate(command);
  };
  return (
    <WorkplaceExperiencePanel title={t('workplace.experience.photo')} description={name}>
      <Stack gap={1.5}>
        {query.isError && !missing ? (
          <InlineFeedback severity="error">{t('workplace.experience.loadError')}</InlineFeedback>
        ) : null}
        {mutation.isError ? (
          <InlineFeedback severity="error">
            {t('workplace.experience.changeUnknown')}
          </InlineFeedback>
        ) : null}
        {query.data ? (
          <Typography variant="caption">{query.data.altText}</Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('workplace.experience.photoEmpty')}
          </Typography>
        )}
        <FormField
          type="file"
          label={t('workplace.experience.photoFile')}
          InputLabelProps={{ shrink: true }}
          inputProps={{ accept: 'image/png,image/jpeg' }}
          disabled={!permitted || mutation.isPending}
          onChange={(event) => {
            setFile((event.target as HTMLInputElement).files?.[0] ?? null);
            setConfirmed(false);
          }}
        />
        <FormField
          label={t('workplace.experience.photoAlt')}
          value={altText}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => {
            setAltText(event.target.value);
            setConfirmed(false);
          }}
          disabled={!permitted || mutation.isPending}
        />
        <FormField
          label={t('workplace.experience.reason')}
          value={reason}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => {
            setReason(event.target.value);
            setConfirmed(false);
          }}
          disabled={!permitted || mutation.isPending}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              disabled={!permitted || mutation.isPending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
          }
          label={t('workplace.experience.confirmImpact')}
        />
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionButton
            intent="primary"
            startIcon={<ImagePlus size={16} />}
            disabled={
              !permitted ||
              !confirmed ||
              !file ||
              !altText.trim() ||
              !reason.trim() ||
              mutation.isPending
            }
            onClick={() => submit(false)}
          >
            {t('workplace.experience.photoUpload')}
          </ActionButton>
          {query.data ? (
            <ActionButton
              intent="danger"
              disabled={!permitted || !confirmed || !reason.trim() || mutation.isPending}
              onClick={() => submit(true)}
            >
              {t('workplace.experience.photoRemove')}
            </ActionButton>
          ) : null}
          {mutation.isError ? (
            <ActionButton
              intent="secondary"
              onClick={async () => {
                const generation = commandContext.current.generation;
                const result = await query.refetch();
                if (
                  activeScope.current === scope &&
                  generation === commandContext.current.generation &&
                  (result.isSuccess ||
                    (result.error instanceof HttpError && result.error.status === 404))
                ) {
                  setLocked(false);
                  setFile(null);
                  setConfirmed(false);
                  mutation.reset();
                }
              }}
            >
              {t('workplace.experience.recheck')}
            </ActionButton>
          ) : null}
        </Stack>
      </Stack>
    </WorkplaceExperiencePanel>
  );
}
