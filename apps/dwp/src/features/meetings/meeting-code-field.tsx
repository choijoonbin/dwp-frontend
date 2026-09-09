import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type ForwardedRef,
} from 'react';
import { FormField } from '@dwp-frontend/design-system';
import { normalizeVideoMeetingCode } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { formatJoinCode, maskJoinCode, MAX_FORMATTED_JOIN_CODE_LENGTH } from './meeting-join-model';

type MeetingCodeFieldProps = {
  code: string;
  accessibleLabel?: string;
  disabled?: boolean;
  masked?: boolean;
  label: string;
  placeholder: string;
  supportingText: string;
  onCodeChange: (code: string) => void;
};

function assignRef(ref: ForwardedRef<HTMLInputElement>, node: HTMLInputElement | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

function formattedCaretPosition(value: string, canonicalCharacters: number): number {
  if (canonicalCharacters <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '-') seen += 1;
    if (seen === canonicalCharacters) return index + 1;
  }
  return value.length;
}

/**
 * A code field that defers canonical formatting during IME composition and restores the
 * logical caret after grouping. Code normalization therefore never interrupts composition,
 * paste, or an edit made in the middle of a group.
 */
export const MeetingCodeField = forwardRef<HTMLInputElement, MeetingCodeFieldProps>(
  function MeetingCodeField(
    {
      code,
      accessibleLabel,
      disabled = false,
      masked = false,
      label,
      placeholder,
      supportingText,
      onCodeChange,
    },
    forwardedRef
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const composingRef = useRef(false);
    const pendingCaretRef = useRef<number | null>(null);
    const [draft, setDraft] = useState(() => (masked ? maskJoinCode(code) : formatJoinCode(code)));

    useEffect(() => {
      if (!composingRef.current) setDraft(masked ? maskJoinCode(code) : formatJoinCode(code));
    }, [code, masked]);

    useLayoutEffect(() => {
      const canonicalCaret = pendingCaretRef.current;
      if (canonicalCaret === null || !inputRef.current) return;
      pendingCaretRef.current = null;
      const position = formattedCaretPosition(draft, canonicalCaret);
      inputRef.current.setSelectionRange(position, position);
    }, [draft]);

    const commit = (value: string, caret: number | null) => {
      const canonicalCaret = normalizeVideoMeetingCode(
        value.slice(0, caret ?? value.length)
      ).length;
      const nextCode = normalizeVideoMeetingCode(value);
      pendingCaretRef.current = canonicalCaret;
      setDraft(formatJoinCode(nextCode));
      onCodeChange(nextCode);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) {
        setDraft(event.target.value);
        return;
      }
      commit(event.target.value, event.target.selectionStart);
    };

    const handleCompositionStart = () => {
      composingRef.current = true;
    };

    const handleCompositionEnd = (_event: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const input = inputRef.current;
      commit(input?.value ?? draft, input?.selectionStart ?? draft.length);
    };

    return (
      <FormField
        required
        disabled={disabled}
        label={label}
        placeholder={placeholder}
        value={draft}
        supportingText={supportingText}
        inputRef={(node: HTMLInputElement | null) => {
          inputRef.current = node;
          assignRef(forwardedRef, node);
        }}
        slotProps={{
          htmlInput: {
            autoComplete: 'one-time-code',
            autoCapitalize: 'characters',
            inputMode: 'text',
            maxLength: MAX_FORMATTED_JOIN_CODE_LENGTH,
            'aria-label': accessibleLabel ?? label,
          },
        }}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    );
  }
);
