import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import { productLocales } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';

import { usePreferredLanguage } from './use-preferred-language';

export function LanguageMenu() {
  const { t } = useTranslation('common');
  const { language, setLanguage, isSaving } = usePreferredLanguage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const select = async (locale: (typeof productLocales)[number]['code']) => {
    setAnchor(null);
    await setLanguage(locale);
  };

  return (
    <>
      <Tooltip title={t('language.label')}>
        <IconButton
          aria-label={t('language.label')}
          aria-haspopup="menu"
          aria-controls={anchor ? 'language-menu' : undefined}
          aria-expanded={Boolean(anchor)}
          disabled={isSaving}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <Languages size={20} strokeWidth={1.8} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <Menu
        id="language-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.75 } } }}
      >
        {productLocales.map((locale) => (
          <MenuItem
            key={locale.code}
            selected={language === locale.code}
            lang={locale.code}
            onClick={() => void select(locale.code)}
            sx={{ minHeight: 48 }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              {language === locale.code ? (
                <Check size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Box sx={{ width: 18 }} />
              )}
            </ListItemIcon>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span" variant="body2" fontWeight={650}>
                {locale.nativeName}
              </Typography>
              {locale.nativeName !== locale.englishName && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {locale.englishName}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
