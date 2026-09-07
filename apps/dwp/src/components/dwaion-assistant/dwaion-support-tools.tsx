import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpenText, Check, ContactRound, RadioTower } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';

export type DwaionSupportTool = 'guide' | 'contacts' | 'status';

type DwaionSupportToolsProps = {
  activeTool: DwaionSupportTool | null;
  onSelect: (tool: DwaionSupportTool) => void;
  onOpenGuide?: () => void;
  onOpenContacts?: () => void;
  onOpenStatus: () => void;
  onDetailEntered?: () => void;
};

type ToolDefinition = {
  key: DwaionSupportTool;
  icon: LucideIcon;
  tone: string;
  surface: string;
  available: boolean;
};

export function DwaionSupportTools({
  activeTool,
  onSelect,
  onOpenGuide,
  onOpenContacts,
  onOpenStatus,
  onDetailEntered,
}: DwaionSupportToolsProps) {
  const { t } = useTranslation('home');
  const tools = (
    [
      {
        key: 'guide',
        icon: BookOpenText,
        tone: '#2D5DCC',
        surface: 'rgba(45, 93, 204, 0.1)',
        available: Boolean(onOpenGuide),
      },
      {
        key: 'contacts',
        icon: ContactRound,
        tone: '#087F72',
        surface: 'rgba(8, 127, 114, 0.1)',
        available: Boolean(onOpenContacts),
      },
      {
        key: 'status',
        icon: RadioTower,
        tone: '#A95816',
        surface: 'rgba(169, 88, 22, 0.1)',
        available: true,
      },
    ] satisfies ToolDefinition[]
  ).filter((tool) => tool.available);

  return (
    <Box component="section" aria-labelledby="dwaion-support-tools-title">
      <Typography
        id="dwaion-support-tools-title"
        component="h3"
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ display: 'block', mb: 1 }}
      >
        {t('dwaion.tools.title')}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))`,
          gap: 1,
        }}
      >
        {tools.map(({ key, icon: Icon, tone, surface }) => {
          const selected = activeTool === key;
          return (
            <ActionButton
              key={key}
              intent="quiet"
              aria-pressed={selected}
              disableRipple
              onClick={() => onSelect(key)}
              sx={{
                minWidth: 0,
                minHeight: 76,
                px: 0.75,
                py: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.6,
                border: 1,
                borderColor: selected ? tone : 'divider',
                bgcolor: selected ? surface : 'background.paper',
                color: 'text.primary',
                '&:hover': { borderColor: tone, bgcolor: surface },
              }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: tone,
                  bgcolor: surface,
                }}
              >
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
              </Box>
              <Typography
                component="span"
                variant="caption"
                fontWeight={700}
                sx={{ lineHeight: '16px' }}
              >
                {t(`dwaion.tools.${key}.label`)}
              </Typography>
            </ActionButton>
          );
        })}
      </Box>

      <Collapse in={activeTool !== null} mountOnEnter unmountOnExit onEntered={onDetailEntered}>
        {activeTool && (
          <ToolDetail
            tool={activeTool}
            onOpenGuide={onOpenGuide}
            onOpenContacts={onOpenContacts}
            onOpenStatus={onOpenStatus}
          />
        )}
      </Collapse>
    </Box>
  );
}

function ToolDetail({
  tool,
  onOpenGuide,
  onOpenContacts,
  onOpenStatus,
}: {
  tool: DwaionSupportTool;
  onOpenGuide?: () => void;
  onOpenContacts?: () => void;
  onOpenStatus: () => void;
}) {
  const { t } = useTranslation('home');
  const target =
    tool === 'guide' ? onOpenGuide : tool === 'contacts' ? onOpenContacts : onOpenStatus;

  return (
    <Box
      role="region"
      aria-label={t(`dwaion.tools.${tool}.label`)}
      data-testid={`dwaion-tool-${tool}`}
      sx={{
        mt: 1.25,
        pt: 1.4,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Typography component="h4" variant="subtitle2" fontWeight={750}>
        {t(`dwaion.tools.${tool}.detailTitle`)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
        {t(`dwaion.tools.${tool}.detailDescription`)}
      </Typography>

      {tool === 'guide' && (
        <Stack component="ol" spacing={0.8} sx={{ p: 0, m: 0, mt: 1.25, listStyle: 'none' }}>
          {(['launch', 'personalize', 'explore'] as const).map((step, index) => (
            <Stack component="li" key={step} direction="row" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: index === 0 ? 'primary.main' : 'action.selected',
                  color: index === 0 ? 'primary.contrastText' : 'text.secondary',
                  flex: '0 0 auto',
                }}
              >
                {index === 0 ? (
                  <Check size={13} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Typography component="span" variant="caption" fontWeight={750}>
                    {index + 1}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption">{t(`dwaion.tools.guide.steps.${step}`)}</Typography>
            </Stack>
          ))}
        </Stack>
      )}

      {target && (
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          onClick={target}
          sx={{ mt: 1.15, px: 1, minHeight: 44 }}
        >
          {t(`dwaion.tools.${tool}.cta`)}
        </ActionButton>
      )}
    </Box>
  );
}
