/**
 * 실시간 알림 센터 — 우측 상단 종 아이콘 + 배지 + 드롭다운
 * useNotificationStore 연동, 카테고리별 아이콘(학습 완료/승인 완료/이상 징후 등)
 * 드롭다운은 최근 10건만 표시. 알림 클릭 시 link로 딥링크.
 */

import type { IconButtonProps } from '@mui/material/IconButton';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotificationStore,
  type NotificationItem,
  type NotificationCategory,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { fToNow } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

/** 드롭다운에 표시할 최대 알림 개수 (5~10) */
const NOTIFICATION_LIST_MAX = 10;

// ----------------------------------------------------------------------

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  training_complete: 'solar:graduation-bold-duotone',
  approval_complete: 'solar:check-circle-bold-duotone',
  anomaly_detected: 'solar:danger-triangle-bold-duotone',
  info: 'solar:info-circle-bold-duotone',
  warning: 'solar:bell-bing-bold-duotone',
  error: 'solar:close-circle-bold-duotone',
};

/** type 분기별 아이콘 색상 — BE WebSocket type(AI_DETECT 등)에 맞춰 매칭 */
const CATEGORY_COLOR: Record<NotificationCategory, 'error' | 'warning' | 'success' | 'info' | 'default'> = {
  anomaly_detected: 'error',
  training_complete: 'success',
  approval_complete: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  training_complete: '학습 완료',
  approval_complete: '승인 완료',
  anomaly_detected: '이상 징후 발견',
  info: '알림',
  warning: '주의',
  error: '오류',
};

export type NotificationsPopoverProps = IconButtonProps & {
  /** @deprecated 실시간 알림만 사용. 스토어가 비어 있으면 빈 상태만 표시. 하드코딩 데이터 미사용 */
  data?: Array<{
    id: string;
    type: string;
    title: string;
    isUnRead: boolean;
    description: string;
    avatarUrl: string | null;
    postedAt: string | number | null;
  }>;
};

export function NotificationsPopover({ data: _data = [], sx, ...other }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const items = useNotificationStore((s) => s.items);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  const totalUnRead = getUnreadCount();
  const displayList = items;
  const listToShow = displayList.slice(0, NOTIFICATION_LIST_MAX);
  const badgeCount = totalUnRead;
  const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevItemsLengthRef = useRef(0);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 신규 알람 수신 시 Popover 자동 열기, 2초 후 닫기. 추가 알람 시 2초씩 연장
  useEffect(() => {
    const currentLength = items.length;
    if (currentLength <= prevItemsLengthRef.current) return;
    prevItemsLengthRef.current = currentLength;

    if (buttonRef.current) setOpenPopover(buttonRef.current);
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    autoCloseTimeoutRef.current = setTimeout(() => {
      setOpenPopover(null);
      autoCloseTimeoutRef.current = null;
    }, 2000);
  }, [items.length]);

  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, []);

  const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setOpenPopover(event.currentTarget);
  }, []);

  const handleClosePopover = useCallback(() => {
    setOpenPopover(null);
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  }, []);

  const handleViewAll = useCallback(() => {
    markAllAsRead();
    handleClosePopover();
  }, [markAllAsRead, handleClosePopover]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      markAsRead(notification.id);
      if (notification.link) {
        navigate(notification.link);
        handleClosePopover();
      }
    },
    [markAsRead, navigate, handleClosePopover]
  );

  return (
    <>
      <IconButton
        ref={buttonRef}
        color={openPopover ? 'primary' : 'default'}
        onClick={handleOpenPopover}
        sx={sx}
        {...other}
      >
        <Badge badgeContent={badgeCount} color="error">
          <Iconify width={24} icon="solar:bell-bing-bold" />
        </Badge>
      </IconButton>

      <Popover
        open={!!openPopover}
        anchorEl={openPopover}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          sx={{
            py: 1.5,
            pl: 2,
            pr: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2">Notifications</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              You have {badgeCount} unread message{badgeCount !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {badgeCount > 0 && (
            <Tooltip title="Mark all as read">
              <IconButton color="primary" onClick={handleMarkAllAsRead}>
                <Iconify icon="eva:done-all-fill" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Scrollbar fillContent sx={{ minHeight: 200, maxHeight: { xs: 320, sm: 'none' } }}>
          <List disablePadding>
            {listToShow.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No notifications yet
                </Typography>
              </Box>
            ) : (
              listToShow.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onNavigate={handleNotificationClick}
                />
              ))
            )}
          </List>
        </Scrollbar>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Box sx={{ p: 1 }}>
          <Button fullWidth disableRipple color="inherit" onClick={handleViewAll}>
            View all
          </Button>
        </Box>
      </Popover>
    </>
  );
}

// ----------------------------------------------------------------------

function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: NotificationItem;
  onNavigate?: (notification: NotificationItem) => void;
}) {
  const category = notification.category ?? 'info';
  const icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.info;
  const label = CATEGORY_LABEL[category] ?? category;
  const colorKey = CATEGORY_COLOR[category] ?? 'info';

  const handleClick = useCallback(() => {
    onNavigate?.(notification);
  }, [notification, onNavigate]);

  return (
    <ListItemButton
      onClick={handleClick}
      sx={{
        py: 1,
        px: 2,
        mt: '1px',
        ...(notification.isUnRead && {
          bgcolor: 'action.selected',
        }),
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${colorKey}.lighter`,
          color: `${colorKey}.main`,
          flexShrink: 0,
          mr: 1.25,
        }}
      >
        <Iconify width={18} icon={icon} />
      </Box>
      <ListItemText
        primary={
          <Typography variant="body2">
            {notification.title}
            {notification.message && (
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                {' '}
                — {notification.message}
              </Typography>
            )}
          </Typography>
        }
        secondary={
          <Typography
            variant="caption"
            sx={{
              mt: 0.25,
              gap: 0.5,
              display: 'flex',
              alignItems: 'center',
              color: 'text.disabled',
            }}
          >
            <Iconify width={12} icon="solar:clock-circle-outline" />
            {fToNow(notification.createdAt)}
            <Box component="span" sx={{ ml: 0.5 }}>
              · {label}
            </Box>
          </Typography>
        }
      />
    </ListItemButton>
  );
}
