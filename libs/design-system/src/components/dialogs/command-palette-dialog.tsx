import { Search } from 'lucide-react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';

import { FormField } from '../forms';

export type CommandPaletteDialogProps = {
  open: boolean;
  label: string;
  placeholder: string;
  query: string;
  appearance?: 'default' | 'inverted';
  onQueryChange: (value: string) => void;
  onClose: () => void;
  children: React.ReactNode;
};

export function CommandPaletteDialog({
  open,
  label,
  placeholder,
  query,
  appearance = 'default',
  onQueryChange,
  onClose,
  children,
}: CommandPaletteDialogProps) {
  const inverted = appearance === 'inverted';
  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      aria-label={label}
      data-command-palette-appearance={appearance}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: inverted
            ? {
                backgroundColor: 'rgba(15, 23, 42, 0.3)',
                backdropFilter: 'blur(2px)',
                '@media (forced-colors: active)': {
                  backgroundColor: 'Canvas',
                  opacity: 0.75,
                },
              }
            : undefined,
        },
        paper: {
          className: `DwpCommandPalette-${appearance}`,
          sx: {
            position: 'fixed',
            top: inverted ? { xs: 20, sm: '15vh' } : { xs: 20, sm: 80 },
            m: 0,
            borderRadius: inverted ? '12px' : undefined,
            color: inverted ? '#F8FAFC' : undefined,
            background: inverted ? 'rgba(15, 23, 42, 0.9)' : undefined,
            backdropFilter: inverted ? 'blur(16px) saturate(180%)' : undefined,
            WebkitBackdropFilter: inverted ? 'blur(16px) saturate(180%)' : undefined,
            border: inverted ? '1px solid rgba(255, 255, 255, 0.12)' : undefined,
            boxShadow: inverted
              ? '0 24px 48px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)'
              : undefined,
            maxHeight: 'min(560px, calc(100dvh - 40px))',
            overflow: 'hidden',
            '@media (forced-colors: active)': inverted
              ? {
                  color: 'CanvasText',
                  background: 'Canvas',
                  borderColor: 'CanvasText',
                  boxShadow: 'none',
                  backdropFilter: 'none',
                }
              : undefined,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {label}
      </DialogTitle>
      <FormField
        autoFocus
        value={query}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.target.value)}
        slotProps={{
          htmlInput: { 'aria-label': placeholder },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} aria-hidden />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-notchedOutline': { border: 0 },
          '& .MuiInputBase-root': {
            minHeight: 58,
            borderBottom: 1,
            borderColor: inverted ? 'rgba(148, 163, 184, 0.36)' : 'divider',
            borderRadius: 0,
            color: inverted ? '#F8FAFC' : undefined,
            backgroundColor: 'transparent',
            fontSize: inverted ? 16 : undefined,
            '&.Mui-focused': {
              borderBottomColor: inverted ? '#2563EB' : undefined,
            },
          },
          '& .MuiInputAdornment-root': {
            color: inverted ? '#94A3B8' : undefined,
          },
          '& input::placeholder': {
            color: inverted ? '#94A3B8' : undefined,
            opacity: inverted ? 1 : undefined,
          },
          '@media (forced-colors: active)': {
            '& .MuiInputBase-root': {
              color: 'CanvasText',
              borderBottomColor: 'CanvasText',
            },
            '& .MuiInputAdornment-root': { color: 'CanvasText' },
          },
        }}
      />
      {children}
    </Dialog>
  );
}
