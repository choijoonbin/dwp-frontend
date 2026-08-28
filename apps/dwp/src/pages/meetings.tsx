import { useLocation } from 'react-router-dom';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { MeetingAdminOperations, MeetingAdminPolicies } from '../features/meetings/meeting-admin';
import { MeetingAdminIntelligencePage } from '../features/meetings/meeting-admin-intelligence-page';
import { MeetingHistory } from '../features/meetings/meeting-history';
import { MeetingHome } from '../features/meetings/meeting-home';
import { MeetingJoin } from '../features/meetings/meeting-join';
import { MeetingRoomExperience } from '../features/meetings/meeting-room-experience';
import { MyMeetings } from '../features/meetings/my-meetings';
import {
  findMeetingsNavigationItem,
  meetingIdFromPath,
  MEETINGS_NAVIGATION,
} from '../features/meetings/meetings-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function MeetingsPage() {
  const { pathname } = useLocation();
  const meetingId = meetingIdFromPath(pathname);
  const page = findMeetingsNavigationItem(pathname);

  if (meetingId) {
    const joinAccess = MEETINGS_NAVIGATION.flatMap((group) => group.items).find(
      (item) => item.view === 'join'
    );
    if (!joinAccess) return <ProductSurfaceLocalNotFound />;
    return (
      <ProductAreaNavigationItemAccessGuard item={joinAccess}>
        <MeetingRoomExperience meetingId={meetingId} />
      </ProductAreaNavigationItemAccessGuard>
    );
  }

  if (!page) return <ProductSurfaceLocalNotFound />;

  const content = {
    home: <MeetingHome />,
    mine: <MyMeetings />,
    history: <MeetingHistory />,
    join: <MeetingJoin />,
    'admin-operations': <MeetingAdminOperations />,
    'admin-policies': <MeetingAdminPolicies />,
    'admin-intelligence': <MeetingAdminIntelligencePage />,
  }[page.view];

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {content}
    </ProductAreaNavigationItemAccessGuard>
  );
}
