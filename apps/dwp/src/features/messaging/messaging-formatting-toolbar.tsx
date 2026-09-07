import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Code2, Italic, List, ListOrdered, SquareCode } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import type { MessagingFormatAction } from './messaging-formatting-model';

const actions = [
  { action: 'bold', icon: Bold, label: 'Bold' },
  { action: 'italic', icon: Italic, label: 'Italic' },
  { action: 'inlineCode', icon: Code2, label: 'Inline code' },
  { action: 'codeBlock', icon: SquareCode, label: 'Code block' },
  { action: 'bulletList', icon: List, label: 'Bulleted list' },
  { action: 'numberedList', icon: ListOrdered, label: 'Numbered list' },
] as const;

export function MessagingFormattingToolbar({
  disabled,
  onFormat,
}: {
  disabled: boolean;
  onFormat: (action: MessagingFormatAction) => void;
}) {
  const { t } = useTranslation('messaging');
  const [activeIndex, setActiveIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <Stack
      role="toolbar"
      aria-label={t('formatting.toolbar', { defaultValue: 'Message formatting' })}
      aria-orientation="horizontal"
      direction="row"
      spacing={0.25}
      sx={{
        minWidth: 0,
        px: 0.25,
        color: 'text.secondary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? actions.length - 1
              : (activeIndex + (event.key === 'ArrowRight' ? 1 : -1) + actions.length) %
                actions.length;
        setActiveIndex(index);
        buttons.current[index]?.focus();
      }}
    >
      {actions.map(({ action, icon: Icon, label }, index) => (
        <ActionIconButton
          key={action}
          ref={(button) => {
            buttons.current[index] = button;
          }}
          label={t(`formatting.${action}`, { defaultValue: label })}
          disabled={disabled}
          size="small"
          tabIndex={index === activeIndex ? 0 : -1}
          onFocus={() => setActiveIndex(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFormat(action)}
          sx={{ width: 30, height: 30 }}
        >
          <Icon size={14} />
        </ActionIconButton>
      ))}
    </Stack>
  );
}
