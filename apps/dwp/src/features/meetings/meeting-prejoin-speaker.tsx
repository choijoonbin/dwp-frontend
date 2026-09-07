import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2 } from 'lucide-react';
import {
  ActionButton,
  InlineFeedback,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { meetingDeviceFailure, type MeetingDeviceFailure } from './meeting-device-session';
import { useMeetingDevicePreview } from './use-meeting-device-preview';

export function MeetingPreJoinSpeaker({
  speakerDeviceId,
  onSpeakerDeviceChange,
}: {
  speakerDeviceId: string;
  onSpeakerDeviceChange: (speakerDeviceId: string) => void;
}) {
  const { t } = useTranslation('meetings');
  const preview = useMeetingDevicePreview();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [inventoryFailure, setInventoryFailure] = useState<MeetingDeviceFailure | null>(null);

  useEffect(() => {
    let current = true;
    try {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.enumerateDevices) {
        setInventoryFailure('unsupported');
        return () => {
          current = false;
        };
      }
      void mediaDevices.enumerateDevices().then(
        (inventory) => {
          if (!current) return;
          setDevices(inventory.filter((device) => device.kind === 'audiooutput'));
          setInventoryFailure(null);
        },
        (error: unknown) => {
          if (current) setInventoryFailure(meetingDeviceFailure(error));
        }
      );
    } catch (error) {
      setInventoryFailure(meetingDeviceFailure(error));
    }
    return () => {
      current = false;
    };
  }, []);

  const options = useMemo(
    () => [
      { value: 'default', label: t('preferences.devices.systemDefault') },
      ...devices
        .filter((device) => device.deviceId && device.deviceId !== 'default')
        .map((device, index) => ({
          value: device.deviceId,
          label: device.label || t('preferences.devices.unnamed', { count: index + 1 }),
        })),
      ...(speakerDeviceId !== 'default' &&
      !devices.some((device) => device.deviceId === speakerDeviceId)
        ? [{ value: speakerDeviceId, label: t('preferences.devices.savedUnavailable') }]
        : []),
    ],
    [devices, speakerDeviceId, t]
  );
  const failure = preview.error ?? inventoryFailure;

  return (
    <Box
      component="section"
      className="dwp-meeting-prejoin__speaker"
      data-testid="meeting-prejoin-speaker"
      aria-labelledby="meeting-prejoin-speaker-heading"
    >
      <SectionHeader
        id="meeting-prejoin-speaker-heading"
        density="compact"
        glyph="plain"
        icon={Volume2}
        title={t('preferences.audio.speaker')}
        meta={t('preferences.audio.outputHint')}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 1.5 }}>
        <SelectField
          label={t('preferences.audio.speaker')}
          value={speakerDeviceId}
          options={options}
          disabled={inventoryFailure === 'unsupported'}
          onValueChange={(id) => {
            preview.stopSpeaker();
            onSpeakerDeviceChange(id);
          }}
        />
        <ActionButton
          intent="secondary"
          loading={preview.speakerActive}
          loadingLabel={t('preferences.devices.states.requesting')}
          onClick={() => void preview.testSpeaker(speakerDeviceId)}
          startIcon={<Volume2 size={16} aria-hidden="true" />}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {t('preferences.audio.testSpeaker')}
        </ActionButton>
      </Stack>
      {failure && (
        <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
          {t(`preferences.devices.errors.${failure}`)}
        </InlineFeedback>
      )}
    </Box>
  );
}
