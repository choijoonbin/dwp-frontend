import { createContext, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import { meetingShape } from './meeting-visual-system';

const sections = ['01', '02', '03', '04'] as const;
type PolicySection = (typeof sections)[number];
const PolicySectionContext = createContext<{
  selected: string | null;
  select: (section: string | null) => void;
  summaries: Record<PolicySection, string>;
} | null>(null);

export const useMeetingPolicyMobileSections = () => useContext(PolicySectionContext);

export function MeetingPolicyMobileSections({
  children,
  recordingPolicy,
  retentionDays,
}: {
  children: ReactNode;
  recordingPolicy: 'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED';
  retentionDays: number;
}) {
  const [selected, select] = useState<string | null>('01');
  const { t } = useTranslation('meetings');
  return (
    <PolicySectionContext.Provider
      value={{
        selected,
        select,
        summaries: {
          '01': t('admin.policy.mobileSections.accessHint'),
          '02': t(`admin.intelligence.recordingPolicies.${recordingPolicy}`),
          '03': t('admin.policy.mobileSections.aiHint'),
          '04': t('admin.policy.mobileSections.retentionHint', { days: retentionDays }),
        },
      }}
    >
      {children}
    </PolicySectionContext.Provider>
  );
}

export function MeetingPolicyMobileNavigation() {
  const context = useMeetingPolicyMobileSections();
  const { t } = useTranslation('meetings');
  if (!context) return null;
  return (
    <Box
      component="nav"
      aria-label={t('admin.policy.mobileSections.label')}
      data-testid="meeting-policy-mobile-sections"
      sx={{
        display: { xs: 'flex', md: 'none' },
        gap: 0.75,
        overflowX: 'auto',
        maxWidth: '100%',
        minWidth: 0,
        pb: 0.5,
      }}
    >
      {sections.map((section) => (
        <ActionButton
          key={section}
          size="small"
          intent={context.selected === section ? 'primary' : 'secondary'}
          aria-pressed={context.selected === section}
          aria-controls={`meeting-policy-section-${section}`}
          onClick={() => context.select(section)}
          sx={{ flexShrink: 0, minHeight: 44, borderRadius: meetingShape.stage }}
        >
          {section}. {t(`admin.policy.mobileSections.${section}`)}
        </ActionButton>
      ))}
    </Box>
  );
}
