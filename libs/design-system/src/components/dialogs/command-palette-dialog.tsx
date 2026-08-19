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
  onQueryChange: (value: string) => void;
  onClose: () => void;
  children: React.ReactNode;
};

export function CommandPaletteDialog({
  open,
  label,
  placeholder,
  query,
  onQueryChange,
  onClose,
  children,
}: CommandPaletteDialogProps) {
  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      aria-label={label}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            position: 'fixed',
            top: { xs: 20, sm: 80 },
            m: 0,
            maxHeight: 'min(560px, calc(100dvh - 40px))',
            overflow: 'hidden',
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
            borderColor: 'divider',
            borderRadius: 0,
          },
        }}
      />
      {children}
    </Dialog>
  );
}
