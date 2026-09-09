export type MeetingHomeQueueState = {
  status: 'loading' | 'ready' | 'error';
  count: number;
};

export const initialMeetingHomeQueueState: MeetingHomeQueueState = {
  status: 'loading',
  count: 0,
};
