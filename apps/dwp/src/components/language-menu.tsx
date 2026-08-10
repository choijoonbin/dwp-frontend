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
        variant="text"
        color="inherit"
        aria-label={`${t('language.label')}: ${currentLocale.nativeName}`}
        aria-haspopup="menu"
        aria-controls={anchor ? 'language-menu' : undefined}
        aria-expanded={Boolean(anchor)}
        aria-busy={isSaving || undefined}
        disabled={isSaving}
        startIcon={<Globe2 size={17} strokeWidth={1.75} aria-hidden="true" />}
        endIcon={<ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          minWidth: 0,
          minHeight: 44,
          px: 1,
          color: 'text.secondary',
          borderRadius: 1,
          bgcolor: 'transparent',
          fontSize: '0.8125rem',
          fontWeight: 650,
          transition: (theme) =>
            theme.transitions.create(['color', 'background-color', 'transform'], {
              duration: theme.transitions.duration.shortest,
            }),
          '& .MuiButton-startIcon': { mr: 0.75 },
          '& .MuiButton-endIcon': {
            ml: 0.5,
            transform: anchor ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: (theme) =>
              theme.transitions.create('transform', {
                duration: theme.transitions.duration.shortest,
              }),
          },
          '&:hover': {
            color: 'text.primary',
            bgcolor: 'action.hover',
          },
          '&:focus-visible': {
            color: 'text.primary',
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
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { minWidth: 220, mb: 0.75, borderRadius: 1 } },
          list: { 'aria-label': t('language.label') },
        }}
      >
        {productLocales.map((locale) => (
          <MenuItem
            key={locale.code}
            role="menuitemradio"
            aria-checked={language === locale.code}
            selected={language === locale.code}
            lang={locale.code}
            onClick={() => void select(locale.code)}
            sx={{ minHeight: 48, mx: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              {language === locale.code ? (
                <Check
                  size={18}
                  strokeWidth={2}
                  color="currentColor"
                  aria-hidden="true"
                />
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
