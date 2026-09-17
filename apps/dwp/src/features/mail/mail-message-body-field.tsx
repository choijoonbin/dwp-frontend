import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type MailMessageBodyFieldHandle = {
  insertText: (text: string) => void;
};

export const MailMessageBodyField = forwardRef<
  MailMessageBodyFieldHandle,
  {
    format: 'TEXT' | 'HTML';
    value: string;
    disabled: boolean;
    minRows?: number;
    onChange: (value: string) => void;
  }
>(function MailMessageBodyField({ format, value, disabled, minRows = 10, onChange }, forwardedRef) {
  const { t } = useTranslation('mail');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const htmlSelectionRef = useRef<Range | null>(null);

  const rememberHtmlSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      htmlSelectionRef.current = range.cloneRange();
    }
  };

  useImperativeHandle(
    forwardedRef,
    () => ({
      insertText(text) {
        if (disabled) return;
        if (format === 'TEXT') {
          const input = textRef.current;
          const start = input?.selectionStart ?? value.length;
          const end = input?.selectionEnd ?? start;
          onChange(`${value.slice(0, start)}${text}${value.slice(end)}`);
          requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(start + text.length, start + text.length);
          });
          return;
        }

        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const selection = window.getSelection();
        const range = htmlSelectionRef.current?.cloneRange() ?? document.createRange();
        if (!htmlSelectionRef.current) {
          range.selectNodeContents(editor);
          range.collapse(false);
        }
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        htmlSelectionRef.current = range.cloneRange();
        onChange(sanitizeRichMailHtml(editor.innerHTML));
      },
    }),
    [disabled, format, onChange, value]
  );
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);
  if (format === 'TEXT') {
    return (
      <FormField
        multiline
        minRows={minRows}
        maxRows={24}
        label={t('compose.body')}
        value={value}
        disabled={disabled}
        inputRef={textRef}
        inputProps={{ maxLength: 100_000 }}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  const apply = (command: 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList') => {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) onChange(sanitizeRichMailHtml(editorRef.current.innerHTML));
  };
  return (
    <Box>
      <Typography
        component="label"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5 }}
      >
        {t('compose.body')}
      </Typography>
      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderBottom: 0,
          borderRadius: '4px 4px 0 0',
          p: 0.5,
        }}
      >
        <ActionIconButton
          label={t('compose.formatBold')}
          disabled={disabled}
          onClick={() => apply('bold')}
        >
          <Bold size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatItalic')}
          disabled={disabled}
          onClick={() => apply('italic')}
        >
          <Italic size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatBulletList')}
          disabled={disabled}
          onClick={() => apply('insertUnorderedList')}
        >
          <List size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatNumberedList')}
          disabled={disabled}
          onClick={() => apply('insertOrderedList')}
        >
          <ListOrdered size={16} />
        </ActionIconButton>
      </Stack>
      <Box
        ref={editorRef}
        role="textbox"
        aria-label={t('compose.body')}
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        sx={{
          minHeight: minRows * 24,
          maxHeight: 576,
          overflowY: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: '0 0 4px 4px',
          p: 1.5,
          bgcolor: disabled ? 'action.disabledBackground' : 'background.paper',
          overflowWrap: 'anywhere',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
        }}
        onInput={(event) => {
          rememberHtmlSelection();
          onChange(sanitizeRichMailHtml(event.currentTarget.innerHTML));
        }}
        onKeyUp={rememberHtmlSelection}
        onMouseUp={rememberHtmlSelection}
        onBlur={(event) => {
          rememberHtmlSelection();
          const clean = sanitizeRichMailHtml(event.currentTarget.innerHTML);
          if (clean !== event.currentTarget.innerHTML) event.currentTarget.innerHTML = clean;
          onChange(clean);
        }}
      />
    </Box>
  );
});

export function sanitizeRichMailHtml(value: string) {
  if (typeof DOMParser === 'undefined') return value;
  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  const allowed = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI']);
  const elements = [...documentNode.body.querySelectorAll('*')];
  for (const element of elements) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  }
  return documentNode.body.innerHTML;
}
