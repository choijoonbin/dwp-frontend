import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '@dwp-frontend/shared-i18n';

import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

export function LanguageMenu() {
  const { language, setLanguage } = useLanguage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const select = (next: 'ko' | 'en') => {
    setLanguage(next);
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title="Language">
        <IconButton aria-label="Language" onClick={(event) => setAnchor(event.currentTarget)}>
          <Languages size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem selected={language === 'ko'} onClick={() => select('ko')}>
          한국어
        </MenuItem>
        <MenuItem selected={language === 'en'} onClick={() => select('en')}>
          English
        </MenuItem>
      </Menu>
    </>
  );
}
