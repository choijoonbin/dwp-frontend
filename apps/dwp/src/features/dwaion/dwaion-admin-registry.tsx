import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ContentDialog,
  foundationTokens,
  GuidedEmptyState,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

export function useAdminRegistryCopy() {
  const { i18n } = useTranslation('work');
  return resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko'
    ? {
        loading: '관리 항목을 불러오는 중',
        owningApp: '담당 앱',
        unknownApp: '현재 카탈로그 확인 필요',
        actionOwners: new Map([
          ['CALENDAR.EVENT.CREATE', '캘린더'],
          ['MAIL.DRAFT.CREATE', '메일'],
          ['SERVICE.REQUEST.CREATE', '직원 서비스'],
          ['APPROVAL.REQUEST.CREATE', '전자결재'],
        ]),
        exported: '현재 서버 필터 범위의 CSV를 만들었습니다.',
        exportLimit: '서버 최대 행 수',
        truncated: '서버 제한으로 일부 행이 제외되었습니다.',
        exportUnknown: '서버가 내보내기 범위 증거를 제공하지 않았습니다.',
        previous: '이전 페이지',
        next: '다음 페이지',
        refreshVersion: '현재 버전 불러와 비교',
        gateRatio: '준비 비율은 필수 Gate 승인 비율입니다. 가용률이나 자동 진단 결과가 아닙니다.',
        search: '조회된 항목 검색',
        filter: '상태',
        all: '모든 상태',
        inspect: '선택 항목 검토',
        item: '관리 항목',
        select: '항목을 선택해 정책과 변경 경계를 검토하세요.',
        close: '상세 닫기',
        empty: '조회된 항목이 없습니다.',
        noMatch: '검색 조건에 맞는 항목이 없습니다.',
        before: '현재 값',
        after: '요청할 값',
        review: '변경 검토',
        updated: '수정 시각',
        version: '정책 버전',
        limit: '첫 100건 안에서 검색합니다. 레지스트리 상태는 실제 모델 연결 상태와 별개입니다.',
        sourceBoundary:
          '소스 정책은 읽기 범위와 설정 참조를 제어합니다. 설정 연결은 실제 연결 시험 결과가 아니며 원본 데이터 권한을 부여하지 않습니다.',
        actionBoundary:
          '사용자 확인 후 담당 앱으로 인계합니다. 최종 변경은 해당 앱의 현재 권한과 정책으로 확정합니다. 정책 저장은 업무 실행이나 승인 완료가 아닙니다.',
        activate:
          '선택 리비전을 활성화하면 사용자 레지스트리에 제공됩니다. 실제 모델 연결이나 운영 Gate 준비를 보장하지 않습니다.',
        retire:
          '선택 리비전을 퇴역시키면 새 사용자 시작에 제공하지 않습니다. 기존 대화와 원본 업무는 삭제하지 않습니다.',
        history: '리비전 이력',
        historyError: '리비전 이력을 확인하지 못했습니다.',
        noLongerDraft:
          '이 리비전은 더 이상 초안이 아닙니다. 입력은 보존되며 게시된 리비전을 덮어쓸 수 없습니다.',
      }
    : {
        loading: 'Loading governance items',
        owningApp: 'Owning app',
        unknownApp: 'Check the current catalog',
        actionOwners: new Map([
          ['CALENDAR.EVENT.CREATE', 'Calendar'],
          ['MAIL.DRAFT.CREATE', 'Mail'],
          ['SERVICE.REQUEST.CREATE', 'Employee services'],
          ['APPROVAL.REQUEST.CREATE', 'Approvals'],
        ]),
        exported: 'CSV prepared for the current server filters.',
        exportLimit: 'Server row limit',
        truncated: 'Some rows were excluded by the server limit.',
        exportUnknown: 'The server did not provide export scope evidence.',
        previous: 'Previous page',
        next: 'Next page',
        refreshVersion: 'Load current version for comparison',
        gateRatio:
          'Readiness is the proportion of required Gates approved. It is not availability or an automatic diagnostic result.',
        search: 'Search loaded items',
        filter: 'Status',
        all: 'All statuses',
        inspect: 'Review selected item',
        item: 'Item',
        select: 'Select an item to review its policy and change boundaries.',
        close: 'Close details',
        empty: 'There are no loaded items.',
        noMatch: 'No items match these filters.',
        before: 'Current value',
        after: 'Requested value',
        review: 'Review changes',
        updated: 'Updated at',
        version: 'Policy version',
        limit:
          'Search covers the first 100 entries. Registry lifecycle is separate from actual model connectivity.',
        sourceBoundary:
          'Source policy controls reading scope and configuration references. Configured connectivity is not a connection test and does not grant source-data permissions.',
        actionBoundary:
          'The user reviews the handoff and the owning app confirms the final change using current permissions and policy. Saving this policy does not execute or approve the business action.',
        activate:
          'Activating this revision makes it available in the user registry. It does not verify model connectivity or operational Gate readiness.',
        retire:
          'Retiring this revision removes it from new user starts. Existing conversations and source work are not deleted.',
        history: 'Revision history',
        historyError: 'Revision history could not be verified.',
        noLongerDraft:
          'This revision is no longer a draft. Your input is retained and the published revision cannot be overwritten.',
      };
}

export type AdminRegistryItem = {
  id: string;
  title: string;
  description?: string | null;
  state: string;
  stateTone?: 'default' | 'success' | 'info' | 'warning' | 'error';
  fields: Array<[string, string | number]>;
  actions?: ReactNode;
  detail?: ReactNode;
};

export function DwaionAdminRegistry({
  items,
  label,
  notice,
  filterable = true,
  pageSize,
  showInspectorFields = true,
  inspectorMaxHeight,
}: {
  items: AdminRegistryItem[];
  label: string;
  notice?: string;
  filterable?: boolean;
  pageSize?: number;
  showInspectorFields?: boolean;
  inspectorMaxHeight?: number | string;
}) {
  const copy = useAdminRegistryCopy();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const autoPagedSelection = useRef<string | null>(null);
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'));
  const selected = items.find((item) => item.id === params.get('entry'));
  const select = (id?: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set('entry', id);
        else next.delete('entry');
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  const filtered = items.filter(
    (item) =>
      (filter === 'ALL' || item.state === filter) &&
      [item.title, item.description, ...item.fields.flat()]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
  );
  const registryColumns = 'minmax(0, 1.65fr) repeat(3, minmax(0, .75fr)) minmax(0, 1.1fr)';
  const previewFields = items[0]?.fields.slice(0, 3) ?? [];
  const pageCount = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const visible = pageSize ? filtered.slice(page * pageSize, (page + 1) * pageSize) : filtered;

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (!pageSize || !selected || search || filter !== 'ALL') {
      autoPagedSelection.current = null;
      return;
    }
    if (autoPagedSelection.current === selected.id) return;
    const selectedIndex = filtered.findIndex((item) => item.id === selected.id);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize));
    autoPagedSelection.current = selected.id;
  }, [filter, filtered, pageSize, search, selected]);
  const details = selected ? (
    <Stack spacing={1.5} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Typography component="h2" variant="h6">
          {selected.title}
        </Typography>
        <Chip
          label={selected.state}
          color={selected.stateTone ?? 'default'}
          size="small"
          variant="outlined"
          sx={{
            flexShrink: 0,
            maxWidth: '45%',
            height: 'auto',
            minHeight: 24,
            '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
          }}
        />
      </Stack>
      {selected.description && (
        <Typography variant="body2" color="text.secondary">
          {selected.description}
        </Typography>
      )}
      {showInspectorFields && (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {selected.fields.map(([name, value]) => (
            <Box key={name} sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {name}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {selected.detail}
      {selected.actions && (
        <Stack
          direction="row"
          gap={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider', '& > button': { minHeight: 44 } }}
        >
          {selected.actions}
        </Stack>
      )}
    </Stack>
  ) : (
    <Typography color="text.secondary">{copy.select}</Typography>
  );
  return (
    <Box component="section" aria-label={label} sx={{ mt: 2, minWidth: 0 }}>
      {filterable && (
        <Stack
          gap={1.5}
          sx={{
            mb: 1.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'minmax(0, 1fr) minmax(180px, 240px)',
            },
          }}
        >
          <FormField
            label={copy.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <SelectField
            label={copy.filter}
            value={filter}
            onValueChange={(value) => value && setFilter(value)}
            options={[
              { value: 'ALL', label: copy.all },
              ...Array.from(new Set(items.map((item) => item.state))).map((value) => ({
                value,
                label: value,
              })),
            ]}
            sx={{ minWidth: { sm: 180 } }}
          />
        </Stack>
      )}
      {notice && (
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1.5 }}>
          {notice}
        </Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 3fr) minmax(19rem, 2fr)',
          },
          gap: { xs: 1.5, md: 2 },
          alignItems: 'start',
        }}
      >
        <Stack
          component="div"
          role="list"
          aria-label={label}
          sx={{ borderTop: 1, borderColor: 'divider', minWidth: 0 }}
        >
          {Boolean(visible.length && previewFields.length) && (
            <Box
              aria-hidden="true"
              sx={{
                display: { xs: 'none', lg: 'grid' },
                gridTemplateColumns: registryColumns,
                gap: 1,
                alignItems: 'center',
                minHeight: 36,
                px: 1.25,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07),
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
                {copy.item}
              </Typography>
              {previewFields.map(([name]) => (
                <Typography
                  key={name}
                  variant="caption"
                  color="text.secondary"
                  fontWeight="fontWeightBold"
                  noWrap
                >
                  {name}
                </Typography>
              ))}
              <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
                {copy.filter}
              </Typography>
            </Box>
          )}
          {!visible.length && (
            <GuidedEmptyState
              kind="empty"
              title={items.length ? copy.noMatch : copy.empty}
              description={copy.select}
              size="compact"
            />
          )}
          {visible.map((item) => (
            <Box role="listitem" key={item.id}>
              <ButtonBase
                onClick={() => select(item.id)}
                aria-pressed={selected?.id === item.id}
                sx={{
                  position: 'relative',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  width: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  minHeight: { xs: 72, lg: 76 },
                  p: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected?.id === item.id ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  ...(selected?.id === item.id
                    ? {
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          insetBlock: 0,
                          insetInlineStart: 0,
                          width: 3,
                          bgcolor: 'primary.main',
                        },
                      }
                    : {}),
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    width: 1,
                    display: { xs: 'block', lg: 'grid' },
                    gridTemplateColumns: registryColumns,
                    gap: 1,
                    alignItems: 'center',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: { xs: 'none', lg: 'block' } }}
                      >
                        {item.description}
                      </Typography>
                    )}
                  </Stack>
                  {item.fields.slice(0, 3).map(([name, value]) => (
                    <Box key={name} sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        title={String(value)}
                        sx={{
                          display: '-webkit-box',
                          maxWidth: 1,
                          overflowWrap: 'anywhere',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {String(value)}
                      </Typography>
                    </Box>
                  ))}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={item.state}
                    color={item.stateTone ?? 'default'}
                    sx={{
                      justifySelf: 'end',
                      flexShrink: 0,
                      maxWidth: '100%',
                      height: 'auto',
                      minHeight: 24,
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
                      mt: { xs: 0.5, lg: 0 },
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: { xs: 'block', lg: 'none' }, mt: 0.35 }}
                  >
                    {item.fields
                      .slice(0, 3)
                      .map(([, value]) => value)
                      .join(' · ')}
                  </Typography>
                </Box>
              </ButtonBase>
            </Box>
          ))}
          {pageSize && filtered.length > pageSize && (
            <Box role="listitem">
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ pt: 1 }}
              >
                <ButtonBase
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  sx={{
                    minHeight: 44,
                    px: 1.25,
                    borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                  }}
                >
                  {copy.previous}
                </ButtonBase>
                <Typography variant="caption" color="text.secondary">
                  {page + 1} / {pageCount} · {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, filtered.length)} / {filtered.length}
                </Typography>
                <ButtonBase
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  sx={{
                    minHeight: 44,
                    px: 1.25,
                    borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                  }}
                >
                  {copy.next}
                </ButtonBase>
              </Stack>
            </Box>
          )}
        </Stack>
        {!mobile && (
          <Box
            component="aside"
            aria-label={copy.inspect}
            sx={{
              minWidth: 0,
              border: 1,
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.18),
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
              borderRadius: foundationTokens.radius.surface + 'px',
              p: 1.75,
              borderTop: 3,
              borderTopColor: 'primary.main',
              alignSelf: 'start',
              ...(inspectorMaxHeight
                ? {
                    position: 'sticky',
                    top: 16,
                    maxHeight: inspectorMaxHeight,
                    overflowY: 'auto',
                    pr: 0.5,
                  }
                : {}),
            }}
          >
            {details}
          </Box>
        )}
      </Box>
      {mobile && (
        <ContentDialog
          open={Boolean(selected)}
          title={copy.inspect}
          closeLabel={copy.close}
          onClose={() => select()}
          fullScreen
          closeButtonSx={{ minWidth: 44, minHeight: 44 }}
        >
          {details}
        </ContentDialog>
      )}
    </Box>
  );
}

export function DwaionAdminChangeReview({ fields }: { fields: Array<[string, unknown, unknown]> }) {
  const copy = useAdminRegistryCopy();
  return (
    <Box
      component="section"
      aria-label={copy.review}
      sx={{
        borderBlock: 1,
        borderColor: 'divider',
        py: 1.5,
        overflowWrap: 'anywhere',
      }}
    >
      <Typography component="h3" variant="subtitle2">
        {copy.review}
      </Typography>
      {fields.map(([label, before, after]) => (
        <Box key={label} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2">
            {copy.before}: {String(before ?? '—')}
          </Typography>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.after}: {String(after ?? '—')}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
