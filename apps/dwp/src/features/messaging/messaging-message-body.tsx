import { Check, Copy } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { messagingVisualTokens } from './messaging-visual-model';
import {
  messagingFormattedText,
  parseMessagingMarkdown,
  splitMessagingMentionText,
} from './messaging-formatting-parser';

import type { MessagingMention } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';
import type { MessagingFormattedNode } from './messaging-formatting-parser';

export { parseMessagingMarkdown } from './messaging-formatting-parser';

function mentionTokens(mentions: MessagingMention[]) {
  return [
    ...(mentions.some((mention) => mention.mentionKind === 'ALL')
      ? ['@모두', '@everyone', '@all']
      : []),
    ...mentions
      .filter((mention) => mention.mentionKind === 'USER')
      .map((mention) => `@${mention.displayName}`),
  ]
    .filter((token, index, all) => all.indexOf(token) === index)
    .sort((left, right) => right.length - left.length);
}

function renderMentionText(value: string, tokens: string[]): ReactNode {
  if (!tokens.length) return value;
  return splitMessagingMentionText(value, tokens).map((part, index) =>
    part.mention ? (
      <Box
        component="span"
        key={`${part.value}-${index}`}
        sx={{
          display: 'inline',
          px: 0.35,
          py: 0.1,
          borderRadius: 0.5,
          bgcolor: 'var(--dwp-product-soft)',
          color: 'var(--dwp-product-accent)',
          fontWeight: 780,
        }}
      >
        {part.value}
      </Box>
    ) : (
      part.value
    )
  );
}

export function messagingPlainTextPreview(value: string) {
  return messagingFormattedText(value).replace(/\s+/gu, ' ').trim();
}

function MessagingCodeBlock({ value, language }: { value: string; language?: string }) {
  const { t } = useTranslation('messaging');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Box
      sx={{
        my: 0.75,
        border: 1,
        borderColor: 'divider',
        borderRadius: messagingVisualTokens.radius.compact,
        bgcolor: 'grey.900',
        color: 'grey.100',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-start"
        spacing={0.75}
        sx={{ minHeight: 31, px: 1.1, borderBottom: 1, borderColor: 'grey.700' }}
      >
        <Typography variant="caption" noWrap sx={{ color: 'grey.300', minWidth: 0 }}>
          {language || t('message.code')}
        </Typography>
        <ActionIconButton
          label={copied ? t('message.codeCopied') : t('message.copyCode')}
          size="small"
          onClick={copy}
          sx={{ color: 'grey.200' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </ActionIconButton>
      </Stack>
      {copyFailed && (
        <Typography role="status" variant="caption" sx={{ px: 1.1, color: 'grey.100' }}>
          {t('formatting.copyFailed', { defaultValue: 'Copy failed. Select and copy the code.' })}
        </Typography>
      )}
      <Box
        component="pre"
        tabIndex={0}
        sx={{
          m: 0,
          p: 1.25,
          overflowX: 'auto',
          fontFamily: foundationTokens.font.mono,
          fontSize: 'caption.fontSize',
          lineHeight: 'body1.lineHeight',
          whiteSpace: 'pre',
        }}
      >
        <code>{value}</code>
      </Box>
    </Box>
  );
}

function renderFormattedNodes(nodes: MessagingFormattedNode[], mentions: string[]): ReactNode {
  return nodes.map((node, index) => {
    let content: ReactNode;
    switch (node.kind) {
      case 'text':
        content = node.mentions ? renderMentionText(node.value, mentions) : node.value;
        break;
      case 'strong':
        content = <strong>{renderFormattedNodes(node.children, mentions)}</strong>;
        break;
      case 'em':
        content = <em>{renderFormattedNodes(node.children, mentions)}</em>;
        break;
      case 'paragraph':
        content = (
          <Box component="p" sx={{ m: 0, '& + p': { mt: 0.65 } }}>
            {renderFormattedNodes(node.children, mentions)}
          </Box>
        );
        break;
      case 'break':
        content = <br />;
        break;
      case 'inlineCode':
        content = (
          <Box
            component="code"
            sx={{
              fontFamily: foundationTokens.font.mono,
              bgcolor: 'action.hover',
              px: 0.4,
              py: 0.1,
              borderRadius: messagingVisualTokens.radius.compact,
              overflowWrap: 'anywhere',
            }}
          >
            {node.value}
          </Box>
        );
        break;
      case 'code':
        content = <MessagingCodeBlock value={node.value} language={node.language} />;
        break;
      case 'list':
        content = (
          <Box
            component={node.ordered ? 'ol' : 'ul'}
            {...(node.ordered ? { start: node.start } : {})}
            sx={{
              my: 0.5,
              pl: 2.5,
              whiteSpace: 'normal',
              '& > li': { pl: 0.25, whiteSpace: 'pre-wrap' },
            }}
          >
            {node.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderFormattedNodes(item, mentions)}</li>
            ))}
          </Box>
        );
        break;
      case 'link':
        content = (
          <Box
            component="a"
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            sx={{
              color: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              overflowWrap: 'anywhere',
            }}
          >
            {renderFormattedNodes(node.children, [])}
          </Box>
        );
        break;
    }
    return <Fragment key={index}>{content}</Fragment>;
  });
}

export function MessagingMessageBody({
  body,
  mentions = [],
}: {
  body: string;
  mentions?: MessagingMention[];
}) {
  const tokens = mentionTokens(mentions);
  const nodes = useMemo(() => parseMessagingMarkdown(body), [body]);

  return (
    <Box sx={{ minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {renderFormattedNodes(nodes, tokens)}
    </Box>
  );
}
