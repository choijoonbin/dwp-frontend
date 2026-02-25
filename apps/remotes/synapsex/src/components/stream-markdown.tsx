/**
 * Clean Stream 전용: content/thought_stream 마크다운 렌더링
 * **굵게** · *기울임* 인라인만 지원, TypingMarkdownContent로 타이핑 효과
 */

import { useRef, useState, useEffect } from 'react';

import Typography from '@mui/material/Typography';

const TYPING_INTERVAL_MS = 20;
const TYPING_CHUNK = 2;

/** 인라인 **굵게** *기울임* 렌더 */
function renderInlineMarkdown(raw: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = raw;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    const boldIdx = boldMatch?.index ?? Infinity;
    const italicIdx = italicMatch?.index ?? Infinity;
    const first = Math.min(boldIdx, italicIdx);
    if (first === Infinity) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining}</span>);
      break;
    }
    if (first > 0) parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining.slice(0, first)}</span>);
    if (boldIdx === first && boldMatch) {
      parts.push(
        <Typography key={`${keyPrefix}-${key++}`} component="span" sx={{ fontWeight: 700 }}>
          {boldMatch[1]}
        </Typography>
      );
      remaining = remaining.slice(first + boldMatch[0].length);
    } else if (italicMatch) {
      parts.push(
        <Typography key={`${keyPrefix}-${key++}`} component="span" sx={{ fontStyle: 'italic' }}>
          {italicMatch[1]}
        </Typography>
      );
      remaining = remaining.slice(first + italicMatch[0].length);
    }
  }
  return parts;
}

export const StreamMarkdownBlock = ({ text }: { text: string }) => {
  if (!text.trim()) return null;
  return (
    <Typography variant="body2" component="span" sx={{ display: 'block', lineHeight: 1.7, whiteSpace: 'pre-wrap', mb: 1 }}>
      {renderInlineMarkdown(text, 'sm')}
    </Typography>
  );
};

/** 타이핑 효과가 있는 마크다운 블록 (스트림 마지막 문장용). 이전 문장과 동일하면 타이핑 스킵·최신 데이터로만 갱신(멱등 렌더링). */
export const TypingMarkdownContent = ({ text, active = true }: { text: string; active?: boolean }) => {
  const [visibleLength, setVisibleLength] = useState(0);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!text.length) {
      prevTextRef.current = '';
      setVisibleLength(0);
      return () => {};
    }
    if (text === prevTextRef.current) {
      setVisibleLength(text.length);
      return () => {};
    }
    prevTextRef.current = text;
    setVisibleLength(0);
    let mounted = true;
    const timer = setInterval(() => {
      if (!mounted) return;
      setVisibleLength((prev) => Math.min(prev + TYPING_CHUNK, text.length));
    }, TYPING_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [text]);

  const visible = active ? text.slice(0, visibleLength) : text;
  if (!visible) return null;
  return (
    <Typography variant="body2" component="span" sx={{ display: 'block', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
      {renderInlineMarkdown(visible, 'ty')}
    </Typography>
  );
};
