export type DwaionMobileDestination = 'home' | 'new' | 'conversations' | 'activity' | 'proposals';

export type DwaionMobileHeaderProfile =
  | {
      kind: 'brand';
      destinations: readonly DwaionMobileDestination[];
      showMore: true;
      showNavigation: true;
    }
  | {
      kind: 'screen';
      screenCode?: string;
      titleKey: string;
      titleLayout?: 'stacked' | 'inline-product' | 'plain';
      actions: readonly ('filter' | 'refresh' | 'search' | 'new' | 'share')[];
      destinations: readonly DwaionMobileDestination[];
      showMore: boolean;
      showNavigation: boolean;
      showNotifications?: boolean;
      showAccount?: boolean;
      backPath: string;
      backLabelKey?: string;
    };

export const DWAION_ACTIVITY_REFRESH_EVENT = 'dwp:dwaion-activity-refresh';
export const DWAION_ACTIVITY_FILTER_FOCUS_EVENT = 'dwp:dwaion-activity-filter-focus';
export const DWAION_ACTIVITY_FILTERS_ID = 'dwaion-activity-filters';
export const DWAION_CONVERSATION_SEARCH_FOCUS_EVENT = 'dwp:dwaion-conversation-search-focus';

const BRAND_PROFILE: DwaionMobileHeaderProfile = {
  kind: 'brand',
  destinations: ['home', 'new', 'conversations', 'proposals'],
  showMore: true,
  showNavigation: true,
};

const SCREEN_PROFILES: ReadonlyArray<{
  matches: (pathname: string, search: string) => boolean;
  profile: DwaionMobileHeaderProfile;
}> = [
  {
    matches: (pathname) => pathname === '/dwaion/activity',
    profile: {
      kind: 'screen',
      screenCode: 'U09',
      titleKey: 'dwaionActivity.mobileHeaderTitle',
      actions: ['filter', 'refresh'],
      destinations: ['home', 'new', 'conversations', 'activity', 'proposals'],
      showMore: false,
      showNavigation: true,
      showAccount: true,
      backPath: '/dwaion/home',
    },
  },
  {
    matches: (pathname) => /^\/dwaion\/conversations\/[^/]+$/.test(pathname),
    profile: {
      kind: 'screen',
      titleKey: 'dwaionMobileHeader.answerTitle',
      titleLayout: 'inline-product',
      actions: ['share', 'new'],
      destinations: [],
      showMore: false,
      showNavigation: false,
      backPath: '/dwaion/conversations',
    },
  },
  {
    matches: (pathname) => pathname === '/dwaion/conversations',
    profile: {
      kind: 'screen',
      titleKey: 'dwaionMobileHeader.conversationsTitle',
      titleLayout: 'plain',
      actions: ['search', 'new'],
      destinations: ['home', 'new', 'conversations', 'proposals'],
      showMore: true,
      showNavigation: true,
      showAccount: true,
      backPath: '/dwaion/home',
    },
  },
  {
    matches: (pathname, search) =>
      pathname === '/dwaion/proposals' && new URLSearchParams(search).has('proposal'),
    profile: {
      kind: 'screen',
      titleKey: 'dwaionMobileHeader.proposalDetailTitle',
      titleLayout: 'plain',
      actions: [],
      destinations: [],
      showMore: false,
      showNavigation: false,
      showNotifications: true,
      showAccount: true,
      backPath: '/dwaion/proposals',
      backLabelKey: 'dwaionProposals.detail.close',
    },
  },
];

/**
 * Adds a dedicated mobile screen without coupling ProductAreaLayout to its route.
 * Unlisted DWAI·ON routes keep the shared branded header and navigation.
 */
export function resolveDwaionMobileHeaderProfile(
  pathname: string,
  search = ''
): DwaionMobileHeaderProfile {
  return SCREEN_PROFILES.find(({ matches }) => matches(pathname, search))?.profile ?? BRAND_PROFILE;
}
