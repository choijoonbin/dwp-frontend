import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useLanguage } from '@dwp-frontend/shared-i18n';

import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

export function LanguageMenu() {
  const { language, setLanguage } = useLanguage();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const selectLanguage = (nextLanguage: 'ko' | 'en') => {
    setLanguage(nextLanguage);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Language">
        <IconButton aria-label="Language" onClick={(event) => setAnchorEl(event.currentTarget)}>
          <Iconify icon="solar:global-bold-duotone" width={22} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem selected={language === 'ko'} onClick={() => selectLanguage('ko')}>
          한국어
        </MenuItem>
        <MenuItem selected={language === 'en'} onClick={() => selectLanguage('en')}>
          English
        </MenuItem>
      </Menu>
    </>
  );
}
