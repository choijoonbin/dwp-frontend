import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { Link, useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { getChangedFields } from './utils';
import { LineageFlow } from './_components/lineage-flow';
import { EvidencePanel } from './_components/evidence-panel';
import { StepDetailDrawer } from './_components/step-detail-drawer';
import { mockLineageSteps, mockVendorMasterSnapshots } from './mock';
import { StepDetailsInline } from './_components/step-details-inline';
import { TimeTravelSection } from './_components/time-travel-section';

// ----------------------------------------------------------------------

/**
 * Lineage Page - 데이터 계보 및 근거 뷰어
 * 
 * [구조]
 * - Desktop (≥1536px): 3-column 레이아웃
 *   - Left (33%): Lineage Flow
 *   - Center (34%): Time-Travel Viewer
 *   - Right (33%): Evidence Panel
 * 
 * - Mobile/Tablet (<1536px): 단일 column + Evidence Tabs
 */
export const LineagePage = () => {
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('caseId') || 'case-001';

  // State
  const [timeTravelValue, setTimeTravelValue] = useState(0);
  const [selectedStepId, setSelectedStep] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Time-travel: 0-49 = transaction time, 50-100 = current
  const changedFields = getChangedFields(
    mockVendorMasterSnapshots.transaction.data,
    mockVendorMasterSnapshots.current.data
  );

  const selectedStepData = mockLineageSteps.find((s) => s.id === selectedStepId);

  const handleStepClick = (stepId: string) => {
    setSelectedStep(selectedStepId === stepId ? null : stepId);
  };

  const handleOpenDrawer = (stepId: string) => {
    setSelectedStep(stepId);
    setDrawerOpen(true);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 3.5rem)' }}>
      {/* Page Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 3, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link to={`/synapse/cases/${caseId}`}>
              <IconButton size="small" sx={{ bgcolor: 'transparent' }}>
                <Iconify icon="solar:alt-arrow-left-linear" width={16} />
              </IconButton>
            </Link>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Data Lineage & Evidence
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Trace the complete data journey from source to case creation
              </Typography>
            </Box>
          </Box>
          <Chip
            label="Case: CS-2026-0001"
            icon={<Iconify icon="solar:document-text-bold" width={12} />}
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: { xs: 'column', xl: 'row' }, overflow: 'hidden' }}>
        {/* Left: Lineage Flow */}
        <Box
          sx={{
            width: { xl: '33%' },
            borderBottom: { xs: 1, xl: 0 },
            borderRight: { xl: 1 },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:history-bold" width={16} sx={{ color: 'text.secondary' }} />
              Data Lineage Pipeline
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Stack spacing={3}>
              <LineageFlow
                steps={mockLineageSteps}
                selectedStepId={selectedStepId}
                onStepClick={handleStepClick}
                onStepDetail={handleOpenDrawer}
              />

              {/* Selected Step Details (Inline) */}
              {selectedStepData && <StepDetailsInline step={selectedStepData} />}
            </Stack>
          </Box>
        </Box>

        {/* Center: Time-Travel Viewer */}
        <Box
          sx={{
            width: { xl: '34%' },
            borderRight: { xl: 1 },
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:refresh-bold" width={16} sx={{ color: 'text.secondary' }} />
              Time-Travel: Vendor Master Data
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <TimeTravelSection
              transaction={mockVendorMasterSnapshots.transaction}
              current={mockVendorMasterSnapshots.current}
              value={timeTravelValue}
              onChange={setTimeTravelValue}
              changedFields={changedFields}
            />
          </Box>
        </Box>

        {/* Right: Evidence Panel (Desktop Only) */}
        <Box
          sx={{
            width: { xl: '33%' },
            display: { xs: 'none', xl: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:shield-check-bold" width={16} sx={{ color: 'text.secondary' }} />
              Evidence Panel
            </Typography>
          </Box>
          <EvidencePanel steps={mockLineageSteps} isMobile={false} />
        </Box>

        {/* Mobile/Tablet: Evidence Panel as Bottom Tabs */}
        <Box sx={{ display: { xs: 'block', xl: 'none' } }}>
          <EvidencePanel steps={mockLineageSteps} isMobile />
        </Box>
      </Box>

      {/* Step Detail Drawer */}
      <StepDetailDrawer step={selectedStepData || null} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Box>
  );
};
