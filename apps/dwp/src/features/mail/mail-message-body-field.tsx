import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type MailMessageBodyFieldHandle = {
  insertText: (text: string) => void;
};

type RichTextCommand = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList';

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
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    unorderedList: false,
    orderedList: false,
  });

  const rememberHtmlSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      htmlSelectionRef.current = range.cloneRange();
      setFormatState(resolveRichTextFormatState(editor, range));
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
    if (!editor || document.activeElement === editor) return;
    const clean = sanitizeRichMailHtml(value);
    if (editor.innerHTML !== clean) editor.innerHTML = clean;
    if (clean !== value) onChange(clean);
  }, [onChange, value]);
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
  const apply = (command: RichTextCommand) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const nextRange = applyRichTextCommand(editor, command, htmlSelectionRef.current);
    if (nextRange) htmlSelectionRef.current = nextRange.cloneRange();
    rememberHtmlSelection();
    const clean = sanitizeRichMailHtml(editor.innerHTML);
    if (clean !== editor.innerHTML) {
      editor.innerHTML = clean;
      htmlSelectionRef.current = null;
    }
    onChange(clean);
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
          aria-pressed={formatState.bold}
          onClick={() => apply('bold')}
        >
          <Bold size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatItalic')}
          disabled={disabled}
          aria-pressed={formatState.italic}
          onClick={() => apply('italic')}
        >
          <Italic size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatBulletList')}
          disabled={disabled}
          aria-pressed={formatState.unorderedList}
          onClick={() => apply('insertUnorderedList')}
        >
          <List size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('compose.formatNumberedList')}
          disabled={disabled}
          aria-pressed={formatState.orderedList}
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
          const clean = sanitizeRichMailHtml(event.currentTarget.innerHTML);
          if (clean !== event.currentTarget.innerHTML) event.currentTarget.innerHTML = clean;
          onChange(clean);
        }}
        onPaste={(event) => {
          event.preventDefault();
          const editor = event.currentTarget;
          const clipboardHtml = event.clipboardData.getData('text/html');
          const clean = clipboardHtml
            ? sanitizeRichMailHtml(clipboardHtml)
            : plainTextToRichMailHtml(event.clipboardData.getData('text/plain'));
          insertRichMailHtmlAtSelection(editor, clean, htmlSelectionRef.current);
          rememberHtmlSelection();
          const next = sanitizeRichMailHtml(editor.innerHTML);
          if (next !== editor.innerHTML) editor.innerHTML = next;
          onChange(next);
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
  const dangerous = new Set([
    'SCRIPT',
    'STYLE',
    'TEMPLATE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'LINK',
    'META',
    'BASE',
    'NOSCRIPT',
  ]);
  const elements = [...documentNode.body.querySelectorAll('*')];
  for (const element of elements) {
    if (!element.isConnected) continue;
    const normalizedTagName = element.tagName.toUpperCase();
    if (dangerous.has(normalizedTagName)) {
      element.remove();
      continue;
    }
    if (!allowed.has(normalizedTagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  }
  return documentNode.body.innerHTML;
}

export function applyRichTextCommand(
  editor: HTMLDivElement,
  command: RichTextCommand,
  rememberedRange: Range | null = null
) {
  const range = resolveEditorRange(editor, rememberedRange);
  const nextRange =
    command === 'bold' || command === 'italic'
      ? toggleInlineFormat(editor, range, command === 'bold' ? 'strong' : 'em')
      : toggleListFormat(editor, range, command === 'insertUnorderedList' ? 'ul' : 'ol');
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(nextRange);
  return nextRange;
}

export function plainTextToRichMailHtml(value: string) {
  if (typeof document === 'undefined') return value;
  const container = document.createElement('div');
  container.textContent = value;
  return container.innerHTML.replace(/\r?\n/gu, '<br>');
}

function insertRichMailHtmlAtSelection(
  editor: HTMLDivElement,
  html: string,
  rememberedRange: Range | null
) {
  const selection = window.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const selectedRangeInside =
    selectedRange && editor.contains(selectedRange.commonAncestorContainer) ? selectedRange : null;
  const rememberedRangeInside =
    rememberedRange && editor.contains(rememberedRange.commonAncestorContainer)
      ? rememberedRange
      : null;
  const range =
    (selectedRangeInside ?? rememberedRangeInside)?.cloneRange() ?? document.createRange();
  if (!selectedRangeInside && !rememberedRangeInside) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.deleteContents();
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

function resolveEditorRange(editor: HTMLDivElement, rememberedRange: Range | null) {
  const selection = window.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (selectedRange && editor.contains(selectedRange.commonAncestorContainer)) {
    return selectedRange.cloneRange();
  }
  if (rememberedRange && editor.contains(rememberedRange.commonAncestorContainer)) {
    return rememberedRange.cloneRange();
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

type SelectionMarkers =
  { collapsed: true; caret: Comment } | { collapsed: false; start: Comment; end: Comment };

function insertSelectionMarkers(range: Range): SelectionMarkers {
  if (range.collapsed) {
    const caret = document.createComment('mail-caret');
    range.insertNode(caret);
    return { collapsed: true, caret };
  }
  const start = document.createComment('mail-selection-start');
  const end = document.createComment('mail-selection-end');
  const startRange = range.cloneRange();
  const endRange = range.cloneRange();
  endRange.collapse(false);
  endRange.insertNode(end);
  startRange.collapse(true);
  startRange.insertNode(start);
  return { collapsed: false, start, end };
}

function rangeFromSelectionMarkers(markers: SelectionMarkers) {
  const range = document.createRange();
  if (markers.collapsed) {
    range.setStartBefore(markers.caret);
    range.collapse(true);
    markers.caret.remove();
    return range;
  }
  range.setStartAfter(markers.start);
  range.setEndBefore(markers.end);
  markers.start.remove();
  markers.end.remove();
  return range;
}

function rangeBetweenSelectionMarkers(markers: Exclude<SelectionMarkers, { collapsed: true }>) {
  const range = document.createRange();
  range.setStartAfter(markers.start);
  range.setEndBefore(markers.end);
  return range;
}

function toggleInlineFormat(editor: HTMLDivElement, range: Range, tagName: 'strong' | 'em') {
  const selector = tagName === 'strong' ? 'strong, b' : 'em, i';
  const active = inlineFormatAncestor(editor, range.startContainer, selector);
  const markers = insertSelectionMarkers(range);
  if (markers.collapsed) {
    if (active) splitInlineFormatAtCaret(active, markers.caret);
    else {
      const wrapper = document.createElement(tagName);
      markers.caret.before(wrapper);
      wrapper.append(markers.caret);
    }
    return rangeFromSelectionMarkers(markers);
  }

  if (active) {
    removeInlineFormatBetween(editor, markers, selector);
  } else {
    const selectedRange = rangeBetweenSelectionMarkers(markers);
    const fragment = selectedRange.extractContents();
    wrapUnformattedTextNodes(fragment, selector, tagName);
    selectedRange.insertNode(fragment);
  }
  return rangeFromSelectionMarkers(markers);
}

function inlineFormatAncestor(editor: HTMLDivElement, node: Node, selector: string) {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const match = element?.closest(selector);
  return match instanceof HTMLElement && editor.contains(match) ? match : null;
}

function splitInlineFormatAtCaret(element: HTMLElement, marker: Comment) {
  const parent = element.parentNode;
  if (!parent) return;
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(element);
  beforeRange.setEndBefore(marker);
  const before = beforeRange.extractContents();
  const afterRange = document.createRange();
  afterRange.selectNodeContents(element);
  afterRange.setStartAfter(marker);
  const after = afterRange.extractContents();
  if (fragmentHasContent(before)) {
    const beforeElement = element.cloneNode(false) as HTMLElement;
    beforeElement.append(before);
    parent.insertBefore(beforeElement, element);
  }
  parent.insertBefore(marker, element);
  if (fragmentHasContent(after)) {
    const afterElement = element.cloneNode(false) as HTMLElement;
    afterElement.append(after);
    parent.insertBefore(afterElement, element);
  }
  element.remove();
}

function removeInlineFormatBetween(
  editor: HTMLDivElement,
  markers: Exclude<SelectionMarkers, { collapsed: true }>,
  selector: string
) {
  const selectedRange = rangeBetweenSelectionMarkers(markers);
  const elements = [...editor.querySelectorAll<HTMLElement>(selector)]
    .filter(
      (element) =>
        element.contains(markers.start) ||
        element.contains(markers.end) ||
        selectedRange.intersectsNode(element)
    )
    .sort((left, right) => elementDepth(right) - elementDepth(left));
  for (const element of elements) {
    if (!element.isConnected) continue;
    if (element.contains(markers.start)) splitElementBeforeMarker(element, markers.start);
    if (element.contains(markers.end)) splitElementAfterMarker(element, markers.end);
    element.replaceWith(...Array.from(element.childNodes));
  }
}

function elementDepth(element: Element) {
  let depth = 0;
  for (let current = element.parentElement; current; current = current.parentElement) depth += 1;
  return depth;
}

function splitElementBeforeMarker(element: HTMLElement, marker: Comment) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEndBefore(marker);
  const before = range.extractContents();
  if (!fragmentHasContent(before)) return;
  const clone = element.cloneNode(false) as HTMLElement;
  clone.append(before);
  element.before(clone);
}

function splitElementAfterMarker(element: HTMLElement, marker: Comment) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setStartAfter(marker);
  const after = range.extractContents();
  if (!fragmentHasContent(after)) return;
  const clone = element.cloneNode(false) as HTMLElement;
  clone.append(after);
  element.after(clone);
}

function wrapUnformattedTextNodes(fragment: DocumentFragment, selector: string, tagName: string) {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent) textNodes.push(node as Text);
  }
  for (const textNode of textNodes) {
    if (textNode.parentElement?.closest(selector)) continue;
    const wrapper = document.createElement(tagName);
    textNode.before(wrapper);
    wrapper.append(textNode);
  }
}

function fragmentHasContent(fragment: DocumentFragment) {
  return [...fragment.childNodes].some(
    (node) => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent)
  );
}

function toggleListFormat(editor: HTMLDivElement, range: Range, tagName: 'ul' | 'ol') {
  const markers = insertSelectionMarkers(range);
  const anchor = markers.collapsed ? markers.caret : markers.start;
  const selectedRange = markers.collapsed ? null : rangeBetweenSelectionMarkers(markers);
  const selectedLists = [...editor.querySelectorAll<HTMLUListElement | HTMLOListElement>('ul, ol')]
    .filter(
      (list) =>
        list.contains(anchor) ||
        (!markers.collapsed && list.contains(markers.end)) ||
        Boolean(selectedRange?.intersectsNode(list))
    )
    .filter(
      (list, index, lists) =>
        !lists.some((other, otherIndex) => otherIndex !== index && other.contains(list))
    );

  if (selectedLists.length) {
    for (const list of selectedLists) {
      if (list.tagName.toLowerCase() === tagName) unwrapList(list);
      else replaceListType(list, tagName);
    }
    return rangeFromSelectionMarkers(markers);
  }

  const directBlocks = [...editor.children].filter(
    (element): element is HTMLParagraphElement | HTMLDivElement =>
      (element.tagName === 'P' || element.tagName === 'DIV') &&
      (element.contains(anchor) ||
        (!markers.collapsed && element.contains(markers.end)) ||
        Boolean(selectedRange?.intersectsNode(element)))
  );
  const list = document.createElement(tagName);
  if (directBlocks.length) {
    directBlocks[0]?.before(list);
    for (const block of directBlocks) {
      const item = document.createElement('li');
      item.append(...Array.from(block.childNodes));
      list.append(item);
      block.remove();
    }
  } else {
    const item = document.createElement('li');
    if (markers.collapsed) {
      markers.caret.before(list);
      item.append(markers.caret);
    } else {
      const contents = rangeBetweenSelectionMarkers(markers).extractContents();
      markers.start.before(list);
      item.append(contents);
    }
    list.append(item);
  }
  return rangeFromSelectionMarkers(markers);
}

function replaceListType(list: HTMLUListElement | HTMLOListElement, tagName: 'ul' | 'ol') {
  const replacement = document.createElement(tagName);
  replacement.append(...Array.from(list.childNodes));
  list.replaceWith(replacement);
}

function unwrapList(list: HTMLUListElement | HTMLOListElement) {
  const fragment = document.createDocumentFragment();
  for (const child of [...list.children]) {
    const block = document.createElement('p');
    block.append(...Array.from(child.childNodes));
    fragment.append(block);
  }
  list.replaceWith(fragment);
}

function resolveRichTextFormatState(editor: HTMLDivElement, range: Range) {
  const start =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const closest = (selector: string) => {
    const match = start?.closest(selector);
    return Boolean(match && editor.contains(match));
  };
  return {
    bold: closest('strong, b'),
    italic: closest('em, i'),
    unorderedList: closest('ul'),
    orderedList: closest('ol'),
  };
}
