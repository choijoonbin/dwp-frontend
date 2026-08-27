import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@livekit/components-react';
import { PhoneOff } from 'lucide-react';

import { leaveVideoMeeting } from '@dwp-frontend/shared-utils/api/video-meeting-api';

export function MeetingLeaveControl({
  meetingId,
  onError,
}: {
  meetingId: string;
  onError: () => void;
}) {
  const { t } = useTranslation('meetings');
  const room = useRoomContext();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveVideoMeeting(meetingId);
    } catch {
      onError();
    } finally {
      await room.disconnect();
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
