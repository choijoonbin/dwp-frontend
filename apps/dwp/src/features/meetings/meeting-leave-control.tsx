import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@livekit/components-react';
import { PhoneOff } from 'lucide-react';

export function MeetingLeaveControl({
  onError,
}: {
  onError: () => void;
}) {
  const { t } = useTranslation('meetings');
  const room = useRoomContext();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await room.disconnect();
    } catch {
      setLeaving(false);
      onError();
    }
  };

  return (
    <button
      type="button"
      className="dwp-meeting-control dwp-meeting-control--leave"
      aria-label={t('room.controls.leave')}
      title={t('room.controls.leave')}
      disabled={leaving}
      onClick={() => void leave()}
    >
      <PhoneOff size={20} aria-hidden="true" />
      <span>{t(leaving ? 'room.leaving' : 'room.leave')}</span>
    </button>
  );
}
