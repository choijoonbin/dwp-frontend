import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import {
  meetingPersonalRoomRequest,
  meetingTemplateSchedulePath,
} from '../features/meetings/meeting-context-routing';
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
import { RouteFallback } from '../routes/route-support';

const MeetingAdminOperations = lazy(() =>
  import('../features/meetings/meeting-admin').then((module) => ({
    default: module.MeetingAdminOperations,
  }))
);
const MeetingAdminPolicies = lazy(() =>
  import('../features/meetings/meeting-admin').then((module) => ({
    default: module.MeetingAdminPolicies,
  }))
);
const MeetingAdminIntelligencePage = lazy(() =>
  import('../features/meetings/meeting-admin-intelligence-page').then((module) => ({
    default: module.MeetingAdminIntelligencePage,
  }))
);
const MeetingContextWorkspace = lazy(() =>
  import('../features/meetings/meeting-context-workspace').then((module) => ({
    default: module.MeetingContextWorkspace,
  }))
);
const MeetingFollowUps = lazy(() =>
  import('../features/meetings/meeting-follow-ups').then((module) => ({
    default: module.MeetingFollowUps,
  }))
);
const MeetingHistory = lazy(() =>
  import('../features/meetings/meeting-history').then((module) => ({
    default: module.MeetingHistory,
  }))
);
const MeetingHome = lazy(() =>
  import('../features/meetings/meeting-home').then((module) => ({
    default: module.MeetingHome,
  }))
);
const MeetingJoin = lazy(() =>
  import('../features/meetings/meeting-join').then((module) => ({
    default: module.MeetingJoin,
  }))
);
const MeetingPersonalRoomInvitation = lazy(() =>
  import('../features/meetings/meeting-personal-room-invitation').then((module) => ({
    default: module.MeetingPersonalRoomInvitation,
  }))
);
const MeetingPreferences = lazy(() =>
  import('../features/meetings/meeting-preferences').then((module) => ({
    default: module.MeetingPreferences,
  }))
);
const MeetingRoomExperience = lazy(() =>
  import('../features/meetings/meeting-room-experience').then((module) => ({
    default: module.MeetingRoomExperience,
  }))
);
const MeetingTemplates = lazy(() =>
  import('../features/meetings/meeting-templates').then((module) => ({
    default: module.MeetingTemplates,
  }))
);

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
        <Suspense fallback={<RouteFallback />}>
          <MeetingRoomExperience meetingId={meetingId} />
        </Suspense>
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
      <Suspense fallback={<RouteFallback />}>
        {mobileNavigation ? (
          <MeetingMobileNavigation activeView={page.view}>{content}</MeetingMobileNavigation>
        ) : (
          content
        )}
      </Suspense>
    </ProductAreaNavigationItemAccessGuard>
  );
}
