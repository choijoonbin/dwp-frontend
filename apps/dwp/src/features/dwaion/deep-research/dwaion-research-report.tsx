import { Fragment, useMemo } from 'react';
import { Lexer } from 'marked';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { foundationTokens } from '@dwp-frontend/design-system';

import type { MarkedToken } from 'marked';
import type { ReactNode } from 'react';

export type DwaionResearchReportNode =
  | { kind: 'text'; value: string }
  | { kind: 'paragraph' | 'strong' | 'emphasis' | 'deleted'; children: DwaionResearchReportNode[] }
  | { kind: 'heading'; depth: number; children: DwaionResearchReportNode[] }
  | { kind: 'code'; value: string; language?: string }
  | { kind: 'inlineCode'; value: string }
  | { kind: 'break' | 'divider' }
  | { kind: 'link'; href: string; children: DwaionResearchReportNode[] }
  | { kind: 'quote'; children: DwaionResearchReportNode[] }
  | {
      kind: 'list';
      ordered: boolean;
      start: number;
      items: DwaionResearchReportNode[][];
    }
  | {
      kind: 'table';
      align: Array<'center' | 'left' | 'right' | null>;
      header: DwaionResearchReportNode[][];
      rows: DwaionResearchReportNode[][][];
    };

const literal = (value: string): DwaionResearchReportNode => ({ kind: 'text', value });

function safeLink(value: string): string | null {
  if (
    !/^(https?:\/\/|mailto:)/iu.test(value) ||
    /[\s\\]/u.test(value) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function toNodes(tokens: MarkedToken[], depth = 0): DwaionResearchReportNode[] {
  if (depth > 24) return tokens.map((token) => literal(token.raw));
  return tokens.flatMap((token): DwaionResearchReportNode[] => {
    const children = () =>
      toNodes(('tokens' in token ? (token.tokens ?? []) : []) as MarkedToken[], depth + 1);
    switch (token.type) {
      case 'paragraph':
        return [{ kind: 'paragraph', children: children() }];
      case 'heading':
        return [{ kind: 'heading', depth: token.depth, children: children() }];
      case 'strong':
        return [{ kind: 'strong', children: children() }];
      case 'em':
        return [{ kind: 'emphasis', children: children() }];
      case 'del':
        return [{ kind: 'deleted', children: children() }];
      case 'text':
        return token.tokens ? children() : [literal(token.text)];
      case 'escape':
        return [literal(token.text)];
      case 'space':
      case 'def':
        return [];
      case 'br':
        return [{ kind: 'break' }];
      case 'hr':
        return [{ kind: 'divider' }];
      case 'code':
        return [{ kind: 'code', value: token.text, language: token.lang }];
      case 'codespan':
        return [{ kind: 'inlineCode', value: token.text }];
      case 'blockquote':
        return [
          {
            kind: 'quote',
            children: toNodes(token.tokens as MarkedToken[], depth + 1),
          },
        ];
      case 'list':
        return [
          {
            kind: 'list',
            ordered: token.ordered,
            start: typeof token.start === 'number' ? token.start : 1,
            items: token.items.map((item) => [
              ...(item.task ? [literal(item.checked ? '[x] ' : '[ ] ')] : []),
              ...toNodes(item.tokens as MarkedToken[], depth + 1),
            ]),
          },
        ];
      case 'link': {
        const href = safeLink(token.href);
        return href ? [{ kind: 'link', href, children: children() }] : [literal(token.raw)];
      }
      case 'table':
        return [
          {
            kind: 'table',
            align: token.align,
            header: token.header.map((cell) => toNodes(cell.tokens as MarkedToken[], depth + 1)),
            rows: token.rows.map((row) =>
              row.map((cell) => toNodes(cell.tokens as MarkedToken[], depth + 1))
            ),
          },
        ];
      // HTML and images stay inert. No server report can inject DOM or make a remote image request.
      default:
        return [literal(token.raw)];
    }
  });
}

export function parseDwaionResearchMarkdown(value: string): DwaionResearchReportNode[] {
  try {
    return toNodes(Lexer.lex(value, { gfm: true, breaks: true }) as MarkedToken[]);
  } catch {
    return [literal(value)];
  }
}

function renderNodes(nodes: DwaionResearchReportNode[], tableLabel: string): ReactNode {
  return nodes.map((node, index) => {
    let content: ReactNode;
    switch (node.kind) {
      case 'text':
        content = node.value;
        break;
      case 'strong':
        content = <strong>{renderNodes(node.children, tableLabel)}</strong>;
        break;
      case 'emphasis':
        content = <em>{renderNodes(node.children, tableLabel)}</em>;
        break;
      case 'deleted':
        content = <del>{renderNodes(node.children, tableLabel)}</del>;
        break;
      case 'paragraph':
        content = (
          <Typography component="p" variant="body2" sx={{ my: 0.75, lineHeight: 1.75 }}>
            {renderNodes(node.children, tableLabel)}
          </Typography>
        );
        break;
      case 'heading': {
        const level = Math.min(6, Math.max(2, node.depth + 1)) as 2 | 3 | 4 | 5 | 6;
        const component = `h${level}` as const;
        content = (
          <Typography
            component={component}
            variant={level <= 2 ? 'h5' : level === 3 ? 'h6' : 'subtitle1'}
            sx={{ mt: level === 2 ? 2.5 : 2, mb: 0.75, fontWeight: 800 }}
          >
            {renderNodes(node.children, tableLabel)}
          </Typography>
        );
        break;
      }
      case 'break':
        content = <br />;
        break;
      case 'divider':
        content = <Divider sx={{ my: 2 }} />;
        break;
      case 'inlineCode':
        content = (
          <Box
            component="code"
            sx={{
              px: 0.5,
              py: 0.15,
              borderRadius: 0.5,
              bgcolor: 'action.hover',
              fontFamily: foundationTokens.font.mono,
              fontSize: '0.86em',
            }}
          >
            {node.value}
          </Box>
        );
        break;
      case 'code':
        content = (
          <Box
            component="pre"
            tabIndex={0}
            aria-label={node.language ? `Code: ${node.language}` : 'Code'}
            sx={{
              my: 1.25,
              p: 1.5,
              overflowX: 'auto',
              borderRadius: 1,
              bgcolor: 'grey.900',
              color: 'grey.100',
              fontFamily: foundationTokens.font.mono,
              fontSize: '0.8rem',
              whiteSpace: 'pre',
            }}
          >
            <code>{node.value}</code>
          </Box>
        );
        break;
      case 'link':
        content = (
          <Link
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {renderNodes(node.children, tableLabel)}
          </Link>
        );
        break;
      case 'quote':
        content = (
          <Box
            component="blockquote"
            sx={{ my: 1.25, mx: 0, pl: 1.5, borderLeft: 3, borderColor: 'primary.main' }}
          >
            {renderNodes(node.children, tableLabel)}
          </Box>
        );
        break;
      case 'list':
        content = (
          <Box
            component={node.ordered ? 'ol' : 'ul'}
            {...(node.ordered ? { start: node.start } : {})}
            sx={{ my: 1, pl: 3, '& > li': { pl: 0.25 } }}
          >
            {node.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderNodes(item, tableLabel)}</li>
            ))}
          </Box>
        );
        break;
      case 'table':
        content = (
          <TableContainer
            component={Box}
            sx={{ my: 1.5, maxWidth: '100%', overflowX: 'auto', border: 1, borderColor: 'divider' }}
          >
            <Table size="small" aria-label={tableLabel}>
              <TableHead>
                <TableRow>
                  {node.header.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      align={node.align[cellIndex] ?? 'left'}
                      sx={{ fontWeight: 800, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}
                    >
                      {renderNodes(cell, tableLabel)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {node.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        align={node.align[cellIndex] ?? 'left'}
                        sx={{ minWidth: 96, overflowWrap: 'anywhere' }}
                      >
                        {renderNodes(cell, tableLabel)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
        break;
    }
    return <Fragment key={index}>{content}</Fragment>;
  });
}

export function DwaionResearchReport({
  markdown,
  locale,
}: {
  markdown: string;
  locale: 'ko' | 'en';
}) {
  const nodes = useMemo(() => parseDwaionResearchMarkdown(markdown), [markdown]);
  return (
    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      {renderNodes(nodes, locale === 'ko' ? '리서치 보고서 데이터' : 'Research report data')}
    </Box>
  );
}
