import { useLocation, useNavigate } from 'react-router-dom';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { MeetingAdminOperations, MeetingAdminPolicies } from '../features/meetings/meeting-admin';
import { MeetingAdminIntelligencePage } from '../features/meetings/meeting-admin-intelligence-page';
import { MeetingHistory } from '../features/meetings/meeting-history';
import { MeetingFollowUps } from '../features/meetings/meeting-follow-ups';
import { MeetingHome } from '../features/meetings/meeting-home';
import { MeetingJoin } from '../features/meetings/meeting-join';
import { MeetingRoomExperience } from '../features/meetings/meeting-room-experience';
import { MeetingContextWorkspace } from '../features/meetings/meeting-context-workspace';
import {
  meetingPersonalRoomRequest,
  meetingTemplateSchedulePath,
} from '../features/meetings/meeting-context-routing';
import { MeetingPersonalRoomInvitation } from '../features/meetings/meeting-personal-room-invitation';
import { MeetingPreferences } from '../features/meetings/meeting-preferences';
import { MeetingTemplates } from '../features/meetings/meeting-templates';
import {
  MeetingMobileNavigation,
  meetingMobileNavigationVisible,
} from '../features/meetings/meeting-mobile-navigation';
import {
  findMeetingsNavigationItem,
  meetingIdFromPath,
  MEETINGS_NAVIGATION,
} from '../features/meetings/meetings-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function MeetingsPage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
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
  const personalRoom = meetingPersonalRoomRequest(search);

  const content = {
    home: <MeetingHome />,
    mine: <MeetingContextWorkspace />,
    history: <MeetingHistory />,
    'follow-ups': <MeetingFollowUps />,
    join:
      personalRoom === 'invalid' ? (
        <ProductSurfaceLocalNotFound />
      ) : personalRoom ? (
        <MeetingPersonalRoomInvitation
          {...personalRoom}
          onEnterMeeting={(id) => navigate('/meetings/room/' + encodeURIComponent(id))}
        />
      ) : (
        <MeetingJoin />
      ),
    templates: (
      <MeetingTemplates onApplyDraft={(draft) => navigate(meetingTemplateSchedulePath(draft))} />
    ),
    preferences: <MeetingPreferences />,
    'admin-operations': <MeetingAdminOperations />,
    'admin-policies': <MeetingAdminPolicies />,
    'admin-intelligence': <MeetingAdminIntelligencePage />,
  }[page.view];

  const mobileNavigation = meetingMobileNavigationVisible(page.view, search);

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {mobileNavigation ? (
        <MeetingMobileNavigation
          activeView={page.view as 'home' | 'mine' | 'history' | 'follow-ups' | 'preferences'}
        >
          {content}
        </MeetingMobileNavigation>
      ) : (
        content
      )}
    </ProductAreaNavigationItemAccessGuard>
  );
}
