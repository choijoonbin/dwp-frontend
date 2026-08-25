import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import {
  WORKSPACE_WIDGET_EDITOR_CHROME_PX,
  workspaceWidgetBlockSize,
  workspaceWidgetGridColumn,
} from './workspace-widget-layout-policy';
import { useReadModeWidgetLongPress } from './workspace-edit-motion';

import type { HomeWidgetHeight, HomeWidgetSize } from '@dwp-frontend/shared-utils';

export type GovernedWorkspaceWidget = {
  widgetKey: string;
  label: string;
  governance?: 'ORGANIZATION' | 'SYSTEM';
  size: HomeWidgetSize;
  height: HomeWidgetHeight;
  surface?: 'card' | 'plain';
  content: React.ReactNode;
};

export function WorkspaceWidgetContent({
  children,
  editing,
  scrollMode,
}: {
  children: React.ReactNode;
  editing: boolean;
  scrollMode: 'contained' | 'document';
}) {
  const documentScroll = scrollMode === 'document';
  return (
    <Box
      data-workspace-widget-content
      data-workspace-widget-content-state={editing ? 'editing-preview' : 'interactive'}
      inert={editing ? true : undefined}
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        opacity: editing ? 0.68 : 1,
        pointerEvents: editing ? 'none' : 'auto',
        userSelect: editing ? 'none' : 'auto',
        overflowX: documentScroll
          ? editing
            ? 'hidden'
            : 'visible'
          : { xs: 'visible', sm: 'hidden' },
        overflowY: documentScroll
          ? editing
            ? 'hidden'
            : 'visible'
          : { xs: 'visible', sm: 'auto' },
        overscrollBehaviorY: 'auto',
        scrollbarGutter: documentScroll ? 'auto' : 'stable',
        '& > section': {
          height: documentScroll && editing ? '100% !important' : 'auto !important',
          flex: documentScroll && !editing ? '0 0 auto' : '1 1 auto',
          alignSelf: 'stretch',
          minHeight: documentScroll ? '0 !important' : '100% !important',
          overflow: documentScroll && editing ? 'hidden !important' : 'visible !important',
        },
      }}
    >
      {children}
    </Box>
  );
}

export function GovernedWidget({
  widget,
  editing,
  inlineInset,
  scrollMode,
  onStartEditing,
}: {
  widget: GovernedWorkspaceWidget;
  editing: boolean;
  inlineInset: Readonly<{ xs: number; sm: number; lg: number }>;
  scrollMode: 'contained' | 'document';
  onStartEditing?: () => void;
}) {
  const { t } = useTranslation('composer');
  const governance = widget.governance ?? 'ORGANIZATION';
  const governanceLabel = t(governance === 'SYSTEM' ? 'governedSystem' : 'governedOrganization');
  const readModeLongPress = useReadModeWidgetLongPress(!editing ? onStartEditing : undefined);
  const blockSize = workspaceWidgetBlockSize(widget.height);
  const editorChrome = editing ? WORKSPACE_WIDGET_EDITOR_CHROME_PX : 0;
  return (
    <Box
      {...readModeLongPress}
      data-workspace-widget={widget.widgetKey}
      data-workspace-widget-size={widget.size}
      data-workspace-widget-height={widget.height}
      data-workspace-widget-policy="GOVERNED"
      data-workspace-widget-governance={governance}
      data-workspace-widget-surface={widget.surface ?? 'plain'}
      data-workspace-widget-long-press={!editing && onStartEditing ? 'enabled' : undefined}
      role={editing ? 'group' : undefined}
      aria-label={editing ? `${widget.label} · ${governanceLabel}` : undefined}
      sx={{
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        pt: editing ? `${editorChrome}px` : 0,
        px: {
          xs: `${inlineInset.xs}px`,
          sm: `${inlineInset.sm}px`,
          lg: `${inlineInset.lg}px`,
        },
        gridColumn: workspaceWidgetGridColumn(widget.size),
        height:
          scrollMode === 'document'
            ? editing
              ? {
                  xs: 'auto',
                  sm: blockSize.sm + editorChrome,
                }
              : 'auto'
            : {
                xs: 'auto',
                sm: blockSize.sm + editorChrome,
              },
        minHeight: 0,
        alignSelf: scrollMode === 'document' ? 'start' : 'stretch',
        '&::after': editing
          ? {
              content: '""',
              position: 'absolute',
              insetBlock: 0,
              left: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              right: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 'var(--home-radius-section, 16px)',
              pointerEvents: 'none',
              zIndex: 5,
            }
          : undefined,
        '@media (forced-colors: active)': {
          '&::after': {
            borderColor: 'CanvasText',
          },
        },
      }}
    >
      {editing && (
        <Box
          data-workspace-governance-label
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 0,
            left: {
              xs: inlineInset.xs,
              sm: inlineInset.sm,
              lg: inlineInset.lg,
            },
            right: {
              xs: inlineInset.xs,
              sm: inlineInset.sm,
              lg: inlineInset.lg,
            },
            zIndex: 6,
            height: WORKSPACE_WIDGET_EDITOR_CHROME_PX,
            px: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            overflow: 'hidden',
            bgcolor: 'var(--home-surface-subtle, #FFFFFF)',
            color: 'text.secondary',
            borderBlockEnd: '1px solid',
            borderColor: 'divider',
            borderStartStartRadius: 'var(--home-radius-section, 16px)',
            borderStartEndRadius: 'var(--home-radius-section, 16px)',
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              color: 'CanvasText',
              borderColor: 'CanvasText',
            },
          }}
        >
          <LockKeyhole size={14} aria-hidden="true" />
          <Typography variant="caption" fontWeight={750} noWrap color="text.primary">
            {widget.label}
          </Typography>
          <Typography variant="caption" noWrap color="text.secondary">
            · {governanceLabel}
          </Typography>
        </Box>
      )}
      <WorkspaceWidgetContent editing={editing} scrollMode={scrollMode}>
        {widget.content}
      </WorkspaceWidgetContent>
    </Box>
  );
}
