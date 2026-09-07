import type { VideoMeetingIntelligenceCitation } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import {
  formatMeetingIntelligenceCitation,
  meetingIntelligenceTimestampDuration,
} from './meeting-intelligence-report-model';
import { useMeetingPlaybackSync } from './meeting-playback-sync';

export function MeetingIntelligenceCitationList({
  citations,
  labels,
}: {
  citations: VideoMeetingIntelligenceCitation[];
  labels: {
    citationLabel: (value: string) => string;
    citationDetail: (segmentId: string, value: string) => string;
    citationSeek: (segmentId: string, value: string) => string;
  };
}) {
  const playbackSync = useMeetingPlaybackSync();
  if (!citations.length) return null;
  return (
    <Stack role="list" direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
      {citations.map((citation, index) => {
        const range = formatMeetingIntelligenceCitation(citation);
        return (
          <Chip
            key={`${citation.segmentId}-${citation.startMillis}-${index}`}
            role="listitem"
            size="small"
            variant="outlined"
            label={
              <time dateTime={meetingIntelligenceTimestampDuration(citation.startMillis)}>
                {labels.citationLabel(range)}
              </time>
            }
            clickable={Boolean(playbackSync)}
            onClick={playbackSync ? () => playbackSync.seekTo(citation.startMillis) : undefined}
            aria-label={
              playbackSync
                ? labels.citationSeek(citation.segmentId, range)
                : labels.citationDetail(citation.segmentId, range)
            }
          />
        );
      })}
    </Stack>
  );
}
