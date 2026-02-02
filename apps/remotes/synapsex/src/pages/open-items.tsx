import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import {
  mockTenants,
  mockOpenItems,
  type OpenItem,
  mockCompanyCodes,
} from '../data/mock-data';

// ----------------------------------------------------------------------

// Aging Bucket Card
function AgingBucketCard({
  label,
  count,
  amount,
  currency,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  amount: number;
  currency: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amt);

  return (
    <Button
      onClick={onClick}
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 120,
        p: 1.5,
        textAlign: 'left',
        textTransform: 'none',
        bgcolor: isActive ? 'primary.50' : 'background.paper',
        borderColor: isActive ? 'primary.main' : 'divider',
        '&:hover': {
          bgcolor: isActive ? 'primary.100' : 'action.hover',
        },
      }}
    >
      <Stack spacing={0.5} sx={{ width: '100%' }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {formatCurrency(amount)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count} items
        </Typography>
      </Stack>
    </Button>
  );
}

// Guardrail Status Badge
function GuardrailBadge({ status }: { status?: 'allowed' | 'approval_required' | 'blocked' }) {
  if (!status) return null;

  const config = {
    allowed: {
      icon: 'solar:shield-check-bold',
      label: 'Allowed',
      color: 'success' as const,
    },
    approval_required: {
      icon: 'solar:shield-warning-bold',
      label: 'Approval Required',
      color: 'warning' as const,
    },
    blocked: {
      icon: 'solar:shield-cross-bold',
      label: 'Blocked',
      color: 'error' as const,
    },
  };

  const { icon, label, color } = config[status];

  return (
    <Label color={color} startIcon={<Iconify icon={icon} width={14} />} sx={{ fontSize: '0.75rem' }}>
      {label}
    </Label>
  );
}

// Column definitions
const columns = [
  { id: 'id', label: 'Item ID', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'entityName', label: 'Entity', visible: true },
  { id: 'dueDate', label: 'Due Date', visible: true },
  { id: 'daysPastDue', label: 'Overdue', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'disputeFlag', label: 'Dispute', visible: true },
  { id: 'paymentBlock', label: 'Block', visible: true },
  { id: 'docNumber', label: 'Document', visible: true },
  { id: 'recommendedAction', label: 'Recommended', visible: true },
  { id: 'status', label: 'Status', visible: true },
];

// ----------------------------------------------------------------------

/** Open Items Page */
export const OpenItemsPage = () => {
  const [searchParams] = useSearchParams();
  const currentTenant = mockTenants[0]; // Mock: use first tenant

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'all');
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>(
    searchParams.get('companyCode') || 'all'
  );
  const [entityFilter, setEntityFilter] = useState<string>(searchParams.get('entityId') || '');
  const [disputeFilter, setDisputeFilter] = useState<string>('all');
  const [blockFilter, setBlockFilter] = useState<string>('all');
  const [agingFilter, setAgingFilter] = useState<string | null>(null);

  // Table state
  const [visibleColumns, setVisibleColumns] = useState(columns);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string>('daysPastDue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer state
  const [selectedItem, setSelectedItem] = useState<OpenItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Dialogs
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewScope, setNewViewScope] = useState<'personal' | 'team' | 'org'>('personal');

  // Column visibility menu
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [savedViewsMenuAnchor, setSavedViewsMenuAnchor] = useState<null | HTMLElement>(null);

  // Calculate aging buckets
  const agingBuckets = useMemo(() => {
    const tenantItems = mockOpenItems.filter((oi) => oi.tenantId === currentTenant.id);
    const buckets = {
      current: { count: 0, amount: 0 },
      '1-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 },
    };

    tenantItems.forEach((item) => {
      const days = item.daysPastDue;
      const bucket =
        days <= 0
          ? 'current'
          : days <= 30
            ? '1-30'
            : days <= 60
              ? '31-60'
              : days <= 90
                ? '61-90'
                : '90+';
      buckets[bucket].count++;
      buckets[bucket].amount += item.amount;
    });

    return buckets;
  }, [currentTenant]);

  // Filter open items
  const filteredItems = useMemo(() => mockOpenItems.filter((item) => {
      // Tenant filter
      if (item.tenantId !== currentTenant.id) return false;

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.id.toLowerCase().includes(query) &&
          !item.docNumber.toLowerCase().includes(query) &&
          !item.entityName.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }

      // Company code
      if (selectedCompanyCode !== 'all' && item.companyCode !== selectedCompanyCode) {
        return false;
      }

      // Entity filter
      if (entityFilter && item.entityId !== entityFilter) {
        return false;
      }

      // Dispute filter
      if (disputeFilter === 'yes' && !item.disputeFlag) return false;
      if (disputeFilter === 'no' && item.disputeFlag) return false;

      // Block filter
      if (blockFilter === 'yes' && !item.paymentBlock) return false;
      if (blockFilter === 'no' && item.paymentBlock) return false;

      // Aging filter
      if (agingFilter) {
        const days = item.daysPastDue;
        switch (agingFilter) {
          case 'current':
            if (days > 0) return false;
            break;
          case '1-30':
            if (days <= 0 || days > 30) return false;
            break;
          case '31-60':
            if (days <= 30 || days > 60) return false;
            break;
          case '61-90':
            if (days <= 60 || days > 90) return false;
            break;
          case '90+':
            if (days <= 90) return false;
            break;
          default:
            break;
        }
      }

      return true;
    }), [
    currentTenant,
    searchQuery,
    selectedType,
    selectedCompanyCode,
    entityFilter,
    disputeFilter,
    blockFilter,
    agingFilter,
  ]);

  // Sort items
  const sortedItems = useMemo(() => [...filteredItems].sort((a, b) => {
      const aVal = a[sortColumn as keyof OpenItem];
      const bVal = b[sortColumn as keyof OpenItem];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortDirection === 'asc'
          ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
          : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }
      return sortDirection === 'asc'
        ? String(aVal || '').localeCompare(String(bVal || ''))
        : String(bVal || '').localeCompare(String(aVal || ''));
    }), [filteredItems, sortColumn, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedItems.length / pageSize);
  const paginatedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Active filters
  const activeFilters = [
    ...(selectedType !== 'all' ? [{ key: 'type', label: `Type: ${selectedType}` }] : []),
    ...(selectedCompanyCode !== 'all'
      ? [{ key: 'company', label: `Company: ${selectedCompanyCode}` }]
      : []),
    ...(entityFilter ? [{ key: 'entity', label: `Entity: ${entityFilter}` }] : []),
    ...(disputeFilter !== 'all' ? [{ key: 'dispute', label: `Dispute: ${disputeFilter}` }] : []),
    ...(blockFilter !== 'all' ? [{ key: 'block', label: `Blocked: ${blockFilter}` }] : []),
    ...(agingFilter ? [{ key: 'aging', label: `Aging: ${agingFilter}` }] : []),
  ];

  const clearFilter = (key: string) => {
    switch (key) {
      case 'type':
        setSelectedType('all');
        break;
      case 'company':
        setSelectedCompanyCode('all');
        break;
      case 'entity':
        setEntityFilter('');
        break;
      case 'dispute':
        setDisputeFilter('all');
        break;
      case 'block':
        setBlockFilter('all');
        break;
      case 'aging':
        setAgingFilter(null);
        break;
      default:
        break;
    }
  };

  const handleRowClick = (item: OpenItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleSelectRow = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows((prev) => [...prev, itemId]);
    } else {
      setSelectedRows((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedItems.map((i) => i.id));
    } else {
      setSelectedRows([]);
    }
  };

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getActionLabel = (action?: string) => {
    switch (action) {
      case 'send_reminder':
        return 'Send Reminder';
      case 'request_approval':
        return 'Request Approval';
      case 'create_case':
        return 'Create Case';
      case 'escalate':
        return 'Escalate';
      case 'auto_clear':
        return 'Auto Clear';
      default:
        return '-';
    }
  };

  // Get selected items type for bulk actions
  const selectedItemsType = useMemo(() => {
    if (selectedRows.length === 0) return null;
    const items = mockOpenItems.filter((i) => selectedRows.includes(i.id));
    const types = new Set(items.map((i) => i.type));
    if (types.size === 1) return Array.from(types)[0];
    return 'mixed';
  }, [selectedRows]);

  const companyCodes = mockCompanyCodes.filter((cc) => cc.tenantId === currentTenant.id);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:wallet-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Open Items
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              AR/AP operational view for overdue risk and recommended actions
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => setSavedViewsMenuAnchor(e.currentTarget)}
              startIcon={<Iconify icon="solar:bookmark-bold" width={18} />}
              endIcon={<Iconify icon="solar:alt-arrow-down-linear" width={14} />}
              sx={{ bgcolor: 'transparent' }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Saved Views
              </Box>
            </Button>
            <Menu
              anchorEl={savedViewsMenuAnchor}
              open={Boolean(savedViewsMenuAnchor)}
              onClose={() => setSavedViewsMenuAnchor(null)}
            >
              <MenuItem disabled>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Views
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem>All Open Items</MenuItem>
              <MenuItem>Overdue AP</MenuItem>
              <MenuItem>Disputed Items</MenuItem>
              <Divider />
              <MenuItem onClick={() => setSaveViewOpen(true)}>
                <ListItemIcon>
                  <Iconify icon="solar:add-circle-bold" width={18} />
                </ListItemIcon>
                <ListItemText>Save Current View</ListItemText>
              </MenuItem>
            </Menu>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Export
              </Box>
            </Button>
          </Stack>
        </Stack>

        {/* Aging Buckets */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:clock-circle-bold" width={18} sx={{ color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Aging Analysis
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                  <Tabs
                    value={selectedType}
                    onChange={(_, v) => setSelectedType(v)}
                    sx={{ minHeight: 'auto' }}
                  >
                    <Tab
                      label="All"
                      value="all"
                      sx={{ minHeight: 'auto', py: 0.5, px: 1, fontSize: '0.75rem' }}
                    />
                    <Tab
                      label="AR"
                      value="AR"
                      sx={{ minHeight: 'auto', py: 0.5, px: 1, fontSize: '0.75rem' }}
                    />
                    <Tab
                      label="AP"
                      value="AP"
                      sx={{ minHeight: 'auto', py: 0.5, px: 1, fontSize: '0.75rem' }}
                    />
                  </Tabs>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                <AgingBucketCard
                  label="Current"
                  count={agingBuckets.current.count}
                  amount={agingBuckets.current.amount}
                  currency="USD"
                  isActive={agingFilter === 'current'}
                  onClick={() => setAgingFilter(agingFilter === 'current' ? null : 'current')}
                />
                <AgingBucketCard
                  label="1-30 Days"
                  count={agingBuckets['1-30'].count}
                  amount={agingBuckets['1-30'].amount}
                  currency="USD"
                  isActive={agingFilter === '1-30'}
                  onClick={() => setAgingFilter(agingFilter === '1-30' ? null : '1-30')}
                />
                <AgingBucketCard
                  label="31-60 Days"
                  count={agingBuckets['31-60'].count}
                  amount={agingBuckets['31-60'].amount}
                  currency="USD"
                  isActive={agingFilter === '31-60'}
                  onClick={() => setAgingFilter(agingFilter === '31-60' ? null : '31-60')}
                />
                <AgingBucketCard
                  label="61-90 Days"
                  count={agingBuckets['61-90'].count}
                  amount={agingBuckets['61-90'].amount}
                  currency="USD"
                  isActive={agingFilter === '61-90'}
                  onClick={() => setAgingFilter(agingFilter === '61-90' ? null : '61-90')}
                />
                <AgingBucketCard
                  label="90+ Days"
                  count={agingBuckets['90+'].count}
                  amount={agingBuckets['90+'].amount}
                  currency="USD"
                  isActive={agingFilter === '90+'}
                  onClick={() => setAgingFilter(agingFilter === '90+' ? null : '90+')}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Filter Bar */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                flexWrap="wrap"
                alignItems="center"
              >
                <TextField
                  size="small"
                  placeholder="Search item ID, document, or entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Iconify icon="solar:magnifer-linear" width={18} sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                  sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 }, maxWidth: { sm: 400 } }}
                />

                <Select
                  size="small"
                  value={selectedCompanyCode}
                  onChange={(e: SelectChangeEvent) => setSelectedCompanyCode(e.target.value)}
                  displayEmpty
                  sx={{ width: { xs: '100%', sm: 140 } }}
                >
                  <MenuItem value="all">All Companies</MenuItem>
                  {companyCodes.map((cc) => (
                    <MenuItem key={cc.id} value={cc.id}>
                      {cc.id} - {cc.name}
                    </MenuItem>
                  ))}
                </Select>

                <Select
                  size="small"
                  value={disputeFilter}
                  onChange={(e: SelectChangeEvent) => setDisputeFilter(e.target.value)}
                  displayEmpty
                  sx={{ width: { xs: '100%', sm: 120 } }}
                >
                  <MenuItem value="all">All Disputes</MenuItem>
                  <MenuItem value="yes">Disputed</MenuItem>
                  <MenuItem value="no">Not Disputed</MenuItem>
                </Select>

                <Select
                  size="small"
                  value={blockFilter}
                  onChange={(e: SelectChangeEvent) => setBlockFilter(e.target.value)}
                  displayEmpty
                  sx={{ width: { xs: '100%', sm: 120 } }}
                >
                  <MenuItem value="all">All Blocks</MenuItem>
                  <MenuItem value="yes">Blocked</MenuItem>
                  <MenuItem value="no">Not Blocked</MenuItem>
                </Select>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
                  startIcon={<Iconify icon="solar:widget-4-bold" width={18} />}
                  sx={{ bgcolor: 'transparent' }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    Columns
                  </Box>
                </Button>
                <Menu
                  anchorEl={columnMenuAnchor}
                  open={Boolean(columnMenuAnchor)}
                  onClose={() => setColumnMenuAnchor(null)}
                >
                  {visibleColumns.map((col) => (
                    <MenuItem
                      key={col.id}
                      onClick={() => {
                        setVisibleColumns((prev) =>
                          prev.map((c) => (c.id === col.id ? { ...c, visible: !c.visible } : c))
                        );
                      }}
                    >
                      <Checkbox checked={col.visible} size="small" sx={{ mr: 1 }} />
                      {col.label}
                    </MenuItem>
                  ))}
                </Menu>
              </Stack>

              {/* Active filters */}
              {activeFilters.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Active filters:
                  </Typography>
                  {activeFilters.map((filter) => (
                    <Chip
                      key={filter.key}
                      label={filter.label}
                      size="small"
                      onDelete={() => clearFilter(filter.key)}
                      deleteIcon={<Iconify icon="solar:close-circle-bold" width={14} />}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setSelectedType('all');
                      setSelectedCompanyCode('all');
                      setEntityFilter('');
                      setDisputeFilter('all');
                      setBlockFilter('all');
                      setAgingFilter(null);
                    }}
                    sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                  >
                    Clear all
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedRows.length > 0 && (
          <Card
            variant="outlined"
            sx={{
              bgcolor: 'primary.50',
              borderColor: 'primary.main',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedRows.length} item(s) selected
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedItemsType === 'AR' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Iconify icon="solar:letter-bold" width={16} />}
                      sx={{ bgcolor: 'transparent' }}
                    >
                      Send Reminder
                    </Button>
                  )}
                  {selectedItemsType === 'AP' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Iconify icon="solar:check-circle-bold" width={16} />}
                      sx={{ bgcolor: 'transparent' }}
                    >
                      Request Approval
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:danger-triangle-bold" width={16} />}
                    sx={{ bgcolor: 'transparent' }}
                  >
                    Create Case
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:play-bold" width={16} />}
                    sx={{ bgcolor: 'transparent' }}
                  >
                    Simulate Action
                  </Button>
                  <Button variant="text" size="small" onClick={() => setSelectedRows([])}>
                    Clear Selection
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={paginatedItems.length > 0 && selectedRows.length === paginatedItems.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    {visibleColumns
                      .filter((c) => c.visible)
                      .map((col) => (
                        <TableCell
                          key={col.id}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => {
                            if (sortColumn === col.id) {
                              setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            } else {
                              setSortColumn(col.id);
                              setSortDirection('desc');
                            }
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {col.label}
                            {sortColumn === col.id && (
                              <Iconify
                                icon={sortDirection === 'asc' ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                                width={14}
                                sx={{ color: 'primary.main' }}
                              />
                            )}
                          </Stack>
                        </TableCell>
                      ))}
                    <TableCell width={40} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.filter((c) => c.visible).length + 2}
                        align="center"
                        sx={{ py: 10 }}
                      >
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:wallet-bold-duotone" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            No open items found matching your filters
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => (
                      <TableRow
                        key={item.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          bgcolor:
                            selectedRows.includes(item.id)
                              ? 'primary.50'
                              : selectedItem?.id === item.id
                                ? 'primary.100'
                                : 'transparent',
                        }}
                        onClick={() => handleRowClick(item)}
                      >
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedRows.includes(item.id)}
                            onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                          />
                        </TableCell>
                        {visibleColumns
                          .filter((c) => c.visible)
                          .map((col) => (
                            <TableCell key={col.id}>
                              {col.id === 'id' && (
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                  {item.id}
                                </Typography>
                              )}
                              {col.id === 'type' && (
                                <Chip
                                  label={item.type}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.75rem',
                                    bgcolor: item.type === 'AR' ? 'info.50' : 'primary.50',
                                    color: item.type === 'AR' ? 'info.main' : 'primary.main',
                                  }}
                                />
                              )}
                              {col.id === 'entityName' && (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {item.entityName}
                                </Typography>
                              )}
                              {col.id === 'dueDate' && <Typography variant="body2">{formatDate(item.dueDate)}</Typography>}
                              {col.id === 'daysPastDue' && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: item.daysPastDue > 0 ? 'error.main' : 'text.secondary',
                                    fontWeight: item.daysPastDue > 0 ? 600 : 400,
                                  }}
                                >
                                  {item.daysPastDue > 0 ? `+${item.daysPastDue}d` : '-'}
                                </Typography>
                              )}
                              {col.id === 'amount' && (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {formatCurrency(item.amount, item.currency)}
                                </Typography>
                              )}
                              {col.id === 'disputeFlag' &&
                                (item.disputeFlag ? (
                                  <Chip
                                    label="Yes"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem', bgcolor: 'warning.50', color: 'warning.main' }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    -
                                  </Typography>
                                ))}
                              {col.id === 'paymentBlock' &&
                                (item.paymentBlock ? (
                                  <Chip
                                    label="Blocked"
                                    size="small"
                                    variant="outlined"
                                    icon={<Iconify icon="solar:forbidden-circle-bold" width={14} />}
                                    sx={{ fontSize: '0.75rem', bgcolor: 'error.50', color: 'error.main' }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    -
                                  </Typography>
                                ))}
                              {col.id === 'docNumber' && (
                                <Link
                                  to={`${SYNAPSE_ROUTES.DOCUMENT_DETAIL.replace(':id', item.docId)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ textDecoration: 'none' }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: 'monospace',
                                      color: 'primary.main',
                                      '&:hover': { textDecoration: 'underline' },
                                    }}
                                  >
                                    {item.docNumber}
                                  </Typography>
                                </Link>
                              )}
                              {col.id === 'recommendedAction' && (
                                <Typography variant="caption">{getActionLabel(item.recommendedAction)}</Typography>
                              )}
                              {col.id === 'status' && (
                                <Chip
                                  label={item.status.replace('_', ' ')}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              )}
                            </TableCell>
                          ))}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Add menu for row actions
                            }}
                          >
                            <Iconify icon="solar:menu-dots-bold" width={18} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedItems.length)} of{' '}
                  {sortedItems.length}
                </Typography>
                <Select
                  size="small"
                  value={String(pageSize)}
                  onChange={(e: SelectChangeEvent) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  sx={{ width: 70, height: 32 }}
                >
                  <MenuItem value="10">10</MenuItem>
                  <MenuItem value="25">25</MenuItem>
                  <MenuItem value="50">50</MenuItem>
                </Select>
                <Typography variant="body2" color="text.secondary">
                  per page
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton
                  size="small"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  sx={{ bgcolor: 'transparent' }}
                >
                  <Iconify icon="solar:double-alt-arrow-left-bold" width={18} />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  sx={{ bgcolor: 'transparent' }}
                >
                  <Iconify icon="solar:alt-arrow-left-bold" width={18} />
                </IconButton>
                <Typography variant="body2" sx={{ px: 1.5 }}>
                  Page {currentPage} of {totalPages || 1}
                </Typography>
                <IconButton
                  size="small"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  sx={{ bgcolor: 'transparent' }}
                >
                  <Iconify icon="solar:alt-arrow-right-bold" width={18} />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  sx={{ bgcolor: 'transparent' }}
                >
                  <Iconify icon="solar:double-alt-arrow-right-bold" width={18} />
                </IconButton>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Detail Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: { width: { xs: '100%', sm: 400 } },
          }}
        >
          {selectedItem && (
            <Box sx={{ p: 3, width: '100%', height: '100%', overflow: 'auto' }}>
              <Stack spacing={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:wallet-bold-duotone" width={20} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Open Item Details
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedItem.id} - {selectedItem.entityName}
                </Typography>

                <Divider />

                {/* Item Summary */}
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Amount
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {formatCurrency(selectedItem.amount, selectedItem.currency)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Due Date
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            color: selectedItem.daysPastDue > 0 ? 'error.main' : 'text.primary',
                          }}
                        >
                          {selectedItem.daysPastDue > 0
                            ? `+${selectedItem.daysPastDue}d`
                            : formatDate(selectedItem.dueDate)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={selectedItem.type}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.75rem',
                        bgcolor: selectedItem.type === 'AR' ? 'info.50' : 'primary.50',
                        color: selectedItem.type === 'AR' ? 'info.main' : 'primary.main',
                      }}
                    />
                    {selectedItem.disputeFlag && (
                      <Chip
                        label="Dispute"
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', bgcolor: 'warning.50', color: 'warning.main' }}
                      />
                    )}
                    {selectedItem.paymentBlock && (
                      <Chip
                        label="Blocked"
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', bgcolor: 'error.50', color: 'error.main' }}
                      />
                    )}
                    <Chip
                      label={selectedItem.status.replace('_', ' ')}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  </Stack>
                  {selectedItem.blockReason && (
                    <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Block reason:</strong> {selectedItem.blockReason}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                <Divider />

                {/* Linked Evidence */}
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Linked Evidence
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      component={Link}
                      to={`${SYNAPSE_ROUTES.DOCUMENT_DETAIL.replace(':id', selectedItem.docId)}`}
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:document-text-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      FI Document: {selectedItem.docNumber}
                    </Button>
                    <Button
                      component={Link}
                      to={`${SYNAPSE_ROUTES.ENTITY_DETAIL.replace(':id', selectedItem.entityId)}`}
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:buildings-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      Entity: {selectedItem.entityName}
                    </Button>
                    <Button
                      component={Link}
                      to={`${SYNAPSE_ROUTES.LINEAGE}?openItemId=${selectedItem.id}`}
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:link-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      View Lineage
                    </Button>
                  </Stack>
                </Stack>

                <Divider />

                {/* Recommended Actions */}
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Recommended Actions
                  </Typography>
                  {selectedItem.guardrailStatus && (
                    <Box sx={{ mb: 1 }}>
                      <GuardrailBadge status={selectedItem.guardrailStatus} />
                    </Box>
                  )}
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:play-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      Run Simulation
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:danger-triangle-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      Create/Link Case
                    </Button>
                    <Button
                      component={Link}
                      to={SYNAPSE_ROUTES.ACTIONS}
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<Iconify icon="solar:bolt-bold" width={18} />}
                      sx={{ justifyContent: 'flex-start', bgcolor: 'transparent' }}
                    >
                      Go to Action Center
                    </Button>
                  </Stack>
                </Stack>

                {/* Clearing History */}
                {selectedItem.clearingHistory && selectedItem.clearingHistory.length > 0 && (
                  <>
                    <Divider />
                    <Stack spacing={2}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Clearing History
                      </Typography>
                      <Stack spacing={1}>
                        {selectedItem.clearingHistory.map((entry, i) => (
                          <Stack
                            key={i}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ py: 1, borderBottom: i < selectedItem.clearingHistory!.length - 1 ? 1 : 0, borderColor: 'divider' }}
                          >
                            <Box>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                                {entry.clearingDoc}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(entry.date)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatCurrency(entry.amount, selectedItem.currency)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </>
                )}

                <Divider />

                {/* Mini Audit Timeline */}
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Activity
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          mt: 0.75,
                        }}
                      />
                      <Box>
                        <Typography variant="body2">Item created</Typography>
                        <Typography variant="caption" color="text.secondary">
                          System import
                        </Typography>
                      </Box>
                    </Stack>
                    {selectedItem.paymentBlock && (
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'error.main',
                            mt: 0.75,
                          }}
                        />
                        <Box>
                          <Typography variant="body2">Payment blocked</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedItem.blockReason || 'Automatic rule'}
                          </Typography>
                        </Box>
                      </Stack>
                    )}
                    {selectedItem.disputeFlag && (
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                            mt: 0.75,
                          }}
                        />
                        <Box>
                          <Typography variant="body2">Dispute raised</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Manual flag
                          </Typography>
                        </Box>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </Box>
          )}
        </Drawer>

        {/* Save View Dialog */}
        <Dialog open={saveViewOpen} onClose={() => setSaveViewOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Save your current filters and column settings as a reusable view.
            </Typography>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="View Name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Overdue AP Items"
              />
              <Select
                fullWidth
                value={newViewScope}
                onChange={(e: SelectChangeEvent) =>
                  setNewViewScope(e.target.value as 'personal' | 'team' | 'org')
                }
              >
                <MenuItem value="personal">Personal (only me)</MenuItem>
                <MenuItem value="team">Team (my team)</MenuItem>
                <MenuItem value="org">Organization (everyone)</MenuItem>
              </Select>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveViewOpen(false)} sx={{ bgcolor: 'transparent' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setSaveViewOpen(false);
                setNewViewName('');
              }}
              startIcon={<Iconify icon="solar:check-circle-bold" width={18} />}
            >
              Save View
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
};
