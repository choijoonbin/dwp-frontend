import type { IconButtonProps } from '@mui/material/IconButton';

import { useCallback } from 'react';
import { usePopover, useToast } from '@dwp-frontend/shared-utils';
import { useLanguage, useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import IconButton from '@mui/material/IconButton';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type LanguagePopoverProps = IconButtonProps & {
  data?: {
    value: string;
    label: string;
    icon: string;
  }[];
};

/** Iconify 아이콘(예: circle-flags:kr) 또는 img 경로(예: /assets/...) 지원 */
const renderFlag = (label?: string, icon?: string) => {
  if (!icon) return null;
  if (icon.includes(':')) {
    return <Iconify icon={icon} width={26} height={20} sx={{ borderRadius: 0.5 }} />;
  }
  return (
    <Box
      component="img"
      alt={label}
      src={icon}
      sx={{ width: 26, height: 20, borderRadius: 0.5, objectFit: 'cover' }}
    />
  );
};

export function LanguagePopover({ data = [], sx, ...other }: LanguagePopoverProps) {
  const { open, anchorEl, onClose, onOpen } = usePopover();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation('common');
  const toast = useToast();

  const handleChangeLang = useCallback(
    (newLang: string) => {
      if (newLang === 'ko' || newLang === 'en') {
        setLanguage(newLang);
        const msg = newLang === 'en' ? t('language.switched_en') : t('language.switched', { lang: t('language.ko') });
        toast.success(msg);
      }
      onClose();
    },
    [onClose, setLanguage, t, toast]
  );

  const locale = language === 'ko' || language === 'en' ? language : 'ko';
  const currentLang = data.find((lang) => lang.value === locale);

  const renderMenuList = () => (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuList
        sx={{
          p: 0.5,
          gap: 0.5,
          width: 160,
          minHeight: 72,
          display: 'flex',
          flexDirection: 'column',
          [`& .${menuItemClasses.root}`]: {
            px: 1,
            gap: 2,
            borderRadius: 0.75,
            [`&.${menuItemClasses.selected}`]: {
              bgcolor: 'action.selected',
              fontWeight: 'fontWeightSemiBold',
            },
          },
        }}
      >
        {data?.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === locale}
            onClick={() => handleChangeLang(option.value)}
          >
            {renderFlag(option.label, option.icon)}
            {option.label}
          </MenuItem>
        ))}
      </MenuList>
    </Popover>
  );

  return (
    <>
      <IconButton
        aria-label="Languages button"
        onClick={onOpen}
        sx={[
          (theme) => ({
            p: 0,
            width: 40,
            height: 40,
            ...(open && { bgcolor: theme.vars.palette.action.selected }),
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {renderFlag(currentLang?.label ?? data[0]?.label, currentLang?.icon ?? data[0]?.icon)}
      </IconButton>

      {renderMenuList()}
    </>
  );
}
