/**
 * Case Tabs Debug Drawer — DEV/QA 전용 payload 확인
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt
 */

import { useCallback } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { useCaseTabsDebug, type TabDebugPayload } from '../context/case-tabs-debug-context';

const TAB_TO_PATH: Record<string, (caseId: string) => string> = {
  analysis: (id) => `/api/synapse/cases/${encodeURIComponent(id)}/analysis`,
  confidence: (id) => `/api/synapse/cases/${encodeURIComponent(id)}/confidence`,
  similar: (id) => `/api/synapse/cases/${encodeURIComponent(id)}/similar`,
  policies: (id) => `/api/synapse/cases/${encodeURIComponent(id)}/rag/evidence`,
};

type CaseTabsDebugDrawerProps = {
  open: boolean;
  onClose: () => void;
  caseId: string | undefined;
};

export const CaseTabsDebugDrawer = ({ open, onClose, caseId }: CaseTabsDebugDrawerProps) => {
  const ctx = useCaseTabsDebug();
  const activeTab = ctx?.activeTab ?? '';
  const payloads = ctx?.payloads ?? {};
  const current = activeTab ? payloads[activeTab] : undefined;

  const handleCopyJson = useCallback(() => {
    if (!current?.payload) return;
    const text = JSON.stringify(current.payload, null, 2);
    void navigator.clipboard.writeText(text);
  }, [current?.payload]);

  const path = caseId && activeTab ? TAB_TO_PATH[activeTab]?.(caseId) : undefined;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          maxWidth: '95vw',
        },
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:code-square-bold-duotone" width={20} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Tab Debug (DEV)
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}>
            <Iconify icon="solar:close-circle-bold-duotone" width={20} />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Active Tab
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {activeTab || '—'}
            </Typography>
          </Box>

          {path && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                URL
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {path}
              </Typography>
            </Box>
          )}

          {current && (
            <>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Status
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    color: current.status === 'success' ? 'success.main' : 'error.main',
                  }}
                >
                  {current.status === 'success' ? '200 OK' : 'Error'}
                  {current.error && ` — ${current.error}`}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Payload
                  </Typography>
                  <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:copy-bold-duotone" width={16} />} onClick={handleCopyJson}>
                    Copy JSON
                  </Button>
                </Stack>
                <Box
                  component="pre"
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {formatPayload(current)}
                </Box>
              </Box>
            </>
          )}

          {!current && activeTab && TAB_TO_PATH[activeTab] && (
            <Typography variant="body2" color="text.secondary">
              Switch to this tab and wait for the API response to see the payload.
            </Typography>
          )}

          {!current && (!activeTab || !TAB_TO_PATH[activeTab]) && (
            <Typography variant="body2" color="text.secondary">
              Select a tab (Analysis, Confidence, Similar, RAG) to view its API payload.
            </Typography>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
};

function formatPayload(p: TabDebugPayload): string {
  try {
    return JSON.stringify(p.payload, null, 2);
  } catch {
    return String(p.payload);
  }
}
