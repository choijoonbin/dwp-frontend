import { ActionButton, GuidedEmptyState, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { ClockEvent, ClockException, ClockWorkspace } from '../model/clock-ingestion-model';
import type { ClockIngestionCopy } from '../model/clock-ingestion-copy';

export type ClockEvidenceFilter = 'ALL' | 'NEEDS_REVIEW';
export type ClockPageEntryMode = 'CLOCK_INGESTION' | 'TIME_EXCEPTIONS';

export type ClockIngestionCommandCenterProps = Readonly<{
  workspace: ClockWorkspace;
  copy: ClockIngestionCopy;
  entryMode: ClockPageEntryMode;
  selectedEventId: string | null;
  filter: ClockEvidenceFilter;
  busy?: boolean;
  canIngest?: boolean;
  canVoid?: boolean;
  onSelectEvent: (event: ClockEvent) => void;
  onSelectException: (exception: ClockException) => void;
  onFilterChange: (filter: ClockEvidenceFilter) => void;
  onRefresh?: () => void;
  onIngest?: () => void;
  onVoid?: (event: ClockEvent) => void;
  onLoadMoreEvents?: () => void;
  onLoadMoreExceptions?: () => void;
  loadingMoreEvents?: boolean;
  loadingMoreExceptions?: boolean;
}>;

function shortId(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function statusFor(event: ClockEvent) {
  return event.statusCode;
}

function eventColor(status: string): 'default' | 'success' | 'warning' {
  return status === 'ACCEPTED' ? 'success' : status === 'VOIDED' ? 'warning' : 'default';
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ClockIngestionCommandCenter({
  workspace,
  copy,
  entryMode,
  selectedEventId,
  filter,
  busy = false,
  canIngest = false,
  canVoid = false,
  onSelectEvent,
  onSelectException,
  onFilterChange,
  onRefresh,
  onIngest,
  onVoid,
  onLoadMoreEvents,
  onLoadMoreExceptions,
  loadingMoreEvents = false,
  loadingMoreExceptions = false,
}: ClockIngestionCommandCenterProps) {
  const exceptionEventIds = new Set(
    workspace.exceptions
      .filter((exception) => exception.state === 'OPEN' && exception.clockEventId)
      .map((exception) => exception.clockEventId as string)
  );
  const events = workspace.events.filter(
    (event) => filter === 'ALL' || exceptionEventIds.has(event.clockEventId)
  );
  const selected = workspace.events.find((event) => event.clockEventId === selectedEventId) ?? null;
  const openExceptions = workspace.exceptions.filter((exception) => exception.state === 'OPEN');

  return (
    <Stack gap={2.5} data-testid="clock-ingestion-command-center">
      <Stack
        component="header"
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        gap={2}
      >
        <Box minWidth={0}>
          <Typography component="h1" variant="h4">
            {entryMode === 'TIME_EXCEPTIONS' ? copy.exceptionsTitle : copy.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {entryMode === 'TIME_EXCEPTIONS' ? copy.exceptionsDescription : copy.description}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.5 }}>
            <Chip size="small" label={`${copy.freshness}: ${workspace.freshness}`} />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {copy.lastRefresh}: {workspace.asOf ?? '—'}
            </Typography>
          </Stack>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {onRefresh && (
            <ActionButton intent="secondary" disabled={busy} onClick={onRefresh}>
              {copy.refresh}
            </ActionButton>
          )}
          {onIngest && (
            <ActionButton intent="primary" disabled={busy || !canIngest} onClick={onIngest}>
              {copy.ingest}
            </ActionButton>
          )}
        </Stack>
      </Stack>

      {workspace.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription} {workspace.failures.join(' · ')}
        </InlineFeedback>
      )}
      {workspace.freshness === 'STALE' && (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          {copy.staleDescription}
        </InlineFeedback>
      )}
      {workspace.state === 'ERROR' && (
        <InlineFeedback severity="error" title={copy.unavailableTitle}>
          {copy.unavailableDescription}
        </InlineFeedback>
      )}
      {workspace.state === 'LOADING' && (
        <Paper variant="outlined" sx={{ p: 3 }} role="status">
          <Typography>{copy.loading}</Typography>
        </Paper>
      )}

      {workspace.state !== 'LOADING' && workspace.state !== 'ERROR' && (
        <>
          <Box
            sx={{
              order: entryMode === 'TIME_EXCEPTIONS' ? 3 : 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {copy.accepted}
              </Typography>
              <Typography variant="h5">
                {workspace.events.filter((event) => event.statusCode === 'ACCEPTED').length}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {copy.openExceptions}
              </Typography>
              <Typography variant="h5">{openExceptions.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {copy.corrected}
              </Typography>
              <Typography variant="h5">
                {
                  workspace.events.filter((event) =>
                    ['CORRECTIVE_VOID', 'VOIDED'].includes(event.statusCode)
                  ).length
                }
              </Typography>
            </Paper>
          </Box>

          {workspace.state === 'EMPTY' ? (
            <GuidedEmptyState
              kind="empty"
              size="compact"
              title={copy.emptyTitle}
              description={copy.emptyDescription}
            />
          ) : (
            <Box
              sx={{
                order: entryMode === 'TIME_EXCEPTIONS' ? 4 : 3,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'minmax(0, 2fr) minmax(280px, 1fr)',
                },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                  sx={{ p: 2 }}
                >
                  <Typography component="h2" variant="h6">
                    {copy.evidence}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
                    <InputLabel id="clock-evidence-filter-label">{copy.filter}</InputLabel>
                    <Select
                      labelId="clock-evidence-filter-label"
                      label={copy.filter}
                      value={filter}
                      onChange={(event) =>
                        onFilterChange(event.target.value as ClockEvidenceFilter)
                      }
                    >
                      <MenuItem value="ALL">{copy.all}</MenuItem>
                      <MenuItem value="NEEDS_REVIEW">{copy.needsReview}</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Divider />
                <TableContainer sx={{ display: { xs: 'none', md: 'block' }, maxHeight: 560 }}>
                  <Table stickyHeader size="small" aria-label={copy.evidence}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{copy.event}</TableCell>
                        <TableCell>{copy.source}</TableCell>
                        <TableCell>{copy.occurred}</TableCell>
                        <TableCell>{copy.state}</TableCell>
                        <TableCell align="right">{copy.review}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {events.map((event) => {
                        const status = statusFor(event);
                        return (
                          <TableRow
                            key={event.clockEventId}
                            selected={event.clockEventId === selectedEventId}
                          >
                            <TableCell>
                              <Typography variant="subtitle2">{event.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {shortId(event.clockEventId)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {event.qualityCode ?? '—'} · #{event.eventOrder ?? '—'}
                              <Typography variant="caption" display="block" color="text.secondary">
                                {event.evidenceDigest ? shortId(event.evidenceDigest) : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {event.occurredAt ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" color={eventColor(status)} label={status} />
                            </TableCell>
                            <TableCell align="right">
                              <ActionButton
                                intent="quiet"
                                size="small"
                                onClick={() => onSelectEvent(event)}
                                aria-label={`${copy.review}: ${event.title} ${shortId(event.clockEventId)}`}
                              >
                                {event.clockEventId === selectedEventId
                                  ? copy.selected
                                  : copy.review}
                              </ActionButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Stack
                  component="ul"
                  gap={1}
                  sx={{ display: { xs: 'flex', md: 'none' }, p: 1.5, m: 0, listStyle: 'none' }}
                >
                  {events.map((event) => (
                    <Paper
                      component="li"
                      variant="outlined"
                      key={event.clockEventId}
                      sx={{ p: 1.5, minWidth: 0 }}
                    >
                      <Stack gap={1}>
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Box minWidth={0}>
                            <Typography variant="subtitle2">
                              {event.title} · {shortId(event.clockEventId)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {event.qualityCode ?? '—'} / {event.occurredAt ?? '—'}
                            </Typography>
                          </Box>
                          <Chip size="small" label={statusFor(event)} />
                        </Stack>
                        <ActionButton
                          intent="secondary"
                          size="small"
                          onClick={() => onSelectEvent(event)}
                        >
                          {copy.review}
                        </ActionButton>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
                {workspace.eventPage.nextCursor && onLoadMoreEvents && (
                  <Box sx={{ p: 1.5, pt: 0 }}>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      loading={loadingMoreEvents}
                      loadingLabel={copy.loadingMore}
                      onClick={onLoadMoreEvents}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {copy.loadMore}
                    </ActionButton>
                  </Box>
                )}
              </Paper>

              <Paper
                component="aside"
                variant="outlined"
                sx={{ p: 2, minWidth: 0 }}
                aria-label={copy.details}
              >
                <Typography component="h2" variant="h6">
                  {copy.details}
                </Typography>
                {!selected ? (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {copy.noSelection}
                  </Typography>
                ) : (
                  <Stack gap={1.5} sx={{ mt: 1.5 }}>
                    <InlineFeedback severity="info" title={selected.title}>
                      {copy.originalEvidence}
                    </InlineFeedback>
                    <Fact label={copy.source} value={selected.qualityCode ?? '—'} />
                    <Fact label={copy.ordering} value={`#${selected.eventOrder ?? '—'}`} />
                    <Fact label={copy.civilTime} value={selected.occurredAt ?? '—'} />
                    <Fact label={copy.provenance} value={selected.evidenceDigest ?? '—'} />
                    {onVoid &&
                      selected.availableActions.some(
                        (action) => action.actionKey === 'hris.action.tim.clock.void'
                      ) && (
                        <ActionButton
                          intent="danger"
                          disabled={busy || !canVoid}
                          onClick={() => onVoid(selected)}
                        >
                          {copy.voidAction}
                        </ActionButton>
                      )}
                  </Stack>
                )}
              </Paper>
            </Box>
          )}

          <Paper
            component="section"
            variant="outlined"
            sx={{
              p: 2,
              minWidth: 0,
              order: entryMode === 'TIME_EXCEPTIONS' ? 2 : 4,
            }}
          >
            <Typography component="h2" variant="h6">
              {copy.exceptions}
            </Typography>
            {workspace.exceptions.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                0
              </Typography>
            ) : (
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small" aria-label={copy.exceptions}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{copy.exceptionCode}</TableCell>
                      <TableCell>{copy.event}</TableCell>
                      <TableCell>{copy.state}</TableCell>
                      <TableCell align="right">{copy.review}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workspace.exceptions.map((exception) => (
                      <TableRow key={exception.exceptionId}>
                        <TableCell>{exception.code}</TableCell>
                        <TableCell>
                          {exception.clockEventId ? shortId(exception.clockEventId) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={exception.state === 'OPEN' ? 'warning' : 'success'}
                            label={exception.state}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <ActionButton
                            intent="quiet"
                            size="small"
                            disabled={!exception.clockEventId}
                            onClick={() => onSelectException(exception)}
                          >
                            {copy.review}
                          </ActionButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {workspace.exceptionPage.nextCursor && onLoadMoreExceptions && (
              <ActionButton
                intent="secondary"
                size="small"
                loading={loadingMoreExceptions}
                loadingLabel={copy.loadingMore}
                onClick={onLoadMoreExceptions}
                sx={{ mt: 1.5, width: { xs: '100%', sm: 'auto' } }}
              >
                {copy.loadMore}
              </ActionButton>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
