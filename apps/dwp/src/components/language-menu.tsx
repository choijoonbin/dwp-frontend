import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe2, ChevronDown } from 'lucide-react';
import { productLocales } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';

import { usePreferredLanguage } from './use-preferred-language';

export function LanguageMenu() {
  const { t } = useTranslation('common');
  const { language, setLanguage, isSaving } = usePreferredLanguage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const currentLocale =
    productLocales.find((locale) => locale.code === language) ?? productLocales[0];

  const select = async (locale: (typeof productLocales)[number]['code']) => {
    setAnchor(null);
    await setLanguage(locale);
  };

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        aria-label={`${t('language.label')}: ${currentLocale.nativeName}`}
        aria-haspopup="menu"
        aria-controls={anchor ? 'language-menu' : undefined}
        aria-expanded={Boolean(anchor)}
        disabled={isSaving}
        startIcon={<Globe2 size={18} strokeWidth={1.8} aria-hidden="true" />}
        endIcon={
          <ChevronDown
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            style={{
              transform: anchor ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 120ms ease-out',
            }}
          />
        }
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          minWidth: 126,
          minHeight: 42,
          px: 1.5,
          justifyContent: 'space-between',
          color: 'text.secondary',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          fontSize: '0.8125rem',
          fontWeight: 650,
          '&:hover': {
            color: 'text.primary',
            borderColor: 'text.disabled',
            bgcolor: 'action.hover',
          },
        }}
      >
        <Box component="span" lang={currentLocale.code}>
          {currentLocale.nativeName}
        </Box>
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.75, borderRadius: 1 } } }}
      >
        {productLocales.map((locale) => (
          <MenuItem
            key={locale.code}
            role="menuitemradio"
            aria-checked={language === locale.code}
            selected={language === locale.code}
            lang={locale.code}
            onClick={() => void select(locale.code)}
            sx={{ minHeight: 48, px: 1.5 }}
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
