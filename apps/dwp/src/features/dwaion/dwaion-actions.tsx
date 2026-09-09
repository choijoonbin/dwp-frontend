import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarPlus,
  Clock3,
  FileCheck2,
  MailPlus,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  createDwaionHandoff,
  getWorkplaceActions,
  HttpError,
  useToast,
  type WorkplaceAction,
} from '@dwp-frontend/shared-utils';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { actionDestination, actionInputLabel, catalogCopy } from './dwaion-catalog-copy';
import { CatalogInspector, CatalogSection, CatalogTerm } from './dwaion-catalog-inspector';
import { DwaionActionReviewPanel } from './dwaion-action-review-panel';
import {
  previewMatchesAction,
  readDwaionActionReviewRouteState,
} from './dwaion-action-review-state';

export function DwaionActions() {
  const { t, i18n } = useTranslation('work');
  const language = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = catalogCopy(language);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const query = useQuery({
    queryKey: ['dwaion', 'actions'],
    queryFn: getWorkplaceActions,
    staleTime: 30_000,
  });
  const actions = query.isError ? [] : (query.data ?? []);
  const selectedKey = search.get('action');
  const selected = actions.find((action) => action.actionKey === selectedKey);
  const reviewState = readDwaionActionReviewRouteState(location.state);
  const reviewedAction = reviewState
    ? actions.find((action) => action.actionKey === reviewState.preview.action.actionKey)
    : undefined;
  const previewValid = Boolean(
    reviewState &&
    reviewedAction &&
    previewMatchesAction(reviewState.preview, reviewedAction, reviewState.expectedOrigin, language)
  );
  const destination = selected ? actionDestination(selected.actionKey, language) : null;
  const targetValid = Boolean(
    selected && destination && selected.targetRoute === destination.route
  );
  const select = (key?: string) => {
    const next = new URLSearchParams(search);
    if (key) next.set('action', key);
    else next.delete('action');
    setSearch(next);
  };
  const cancelReview = () => {
    if (!reviewState) return;
    navigate(reviewState.returnTo, { replace: true });
  };
  const handoff = () => {
    if (!reviewState || !reviewedAction || !previewValid) return;
    const preview = reviewState.preview;
    navigate(preview.action.targetRoute, {
      state: {
        dwaionHandoff: createDwaionHandoff({
          actionKey: preview.action.actionKey,
          planHash: preview.plan.planHash,
          reviewedInputs: preview.reviewedInputs,
          sourceReferences: preview.plan.sourceReferences,
          origin: preview.plan.handoffOrigin,
        }),
      },
    });
    toast.success(t('askPage.actionsShelf.handoffComplete'));
  };

  return (
    <PageCanvas topInset="compact">
      <Box data-testid="dwaion-actions" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Box
          component="header"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(0, 1fr) 150px minmax(230px, .34fr)',
            },
            border: 1,
            borderColor: 'divider',
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            gap={{ xs: 1, md: 1.5 }}
            alignItems="flex-start"
            sx={{ p: { xs: 1.4, md: 2.25 } }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: { xs: 34, md: 40 },
                height: { xs: 34, md: 40 },
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <Workflow size={22} />
            </Box>
            <Box minWidth={0}>
              <Typography
                variant="overline"
                color="primary.main"
                sx={{ lineHeight: 'button.lineHeight', display: { xs: 'none', sm: 'block' } }}
              >
                {t('dwaionActions.eyebrow')}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography
                  component="h1"
                  variant="h4"
                  sx={{
                    mt: { xs: 0.35, sm: 0.4 },
                    fontSize: { xs: 'h4.fontSize', sm: 'h3.fontSize', md: 'h2.fontSize' },
                  }}
                >
                  {t('dwaionActions.title')}
                </Typography>
                <Chip
                  size="small"
                  color={reviewState ? 'primary' : 'default'}
                  variant="outlined"
                  label={
                    language === 'ko'
                      ? `검토 대기 ${reviewState ? 1 : 0}건`
                      : `${reviewState ? 1 : 0} awaiting review`
                  }
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, mt: 0.35 }}
                />
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.65, maxWidth: 760, display: { xs: 'none', sm: 'block' } }}
              >
                {t('dwaionActions.description')}
              </Typography>
            </Box>
          </Stack>
          <Stack
            justifyContent="center"
            sx={{
              display: { xs: 'none', md: 'flex' },
              p: 2,
              borderLeft: 1,
              borderColor: 'divider',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {language === 'ko' ? '검토 대기 큐' : 'Review queue'}
            </Typography>
            <Typography
              variant="h5"
              color="primary.main"
              fontWeight="fontWeightBold"
              sx={{ mt: 0.25 }}
            >
              {reviewState ? 1 : 0}
            </Typography>
          </Stack>
          <Stack
            justifyContent="center"
            sx={{
              p: { xs: 1.15, md: 2.25 },
              borderTop: { xs: 1, md: 0 },
              borderLeft: { xs: 0, md: 1 },
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <ShieldCheck size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Typography variant="subtitle2" fontWeight="fontWeightBold">
                {copy.noAutoCommit}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.5 }}
            >
              {copy.noAutoCommitDetail}
            </Typography>
          </Stack>
        </Box>

        <Alert
          severity="info"
          icon={<ShieldCheck size={19} />}
          sx={{
            mt: { xs: 1, md: 2 },
            py: { xs: 0.2, md: 0.75 },
            '& .MuiAlert-message': { fontSize: { xs: 'caption.fontSize', sm: 'body2.fontSize' } },
          }}
        >
          {t('dwaionActions.reviewBoundary')}
        </Alert>

        {query.isError && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <ActionButton intent="quiet" onClick={() => void query.refetch()}>
                {copy.retry}
              </ActionButton>
            }
          >
            {query.error instanceof HttpError && query.error.status === 403
              ? copy.permission
              : t('dwaionActions.loadError')}
          </Alert>
        )}
        {!query.isLoading && !query.isError && selectedKey && !selected && (
          <Box sx={{ mt: 2 }}>
            <ErrorState size="compact" title={copy.unavailable} />
          </Box>
        )}

        <Box
          sx={{
            mt: { xs: 1.5, md: 2 },
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.45fr) minmax(350px, .85fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box component="section" aria-labelledby="dwaion-action-catalog-heading" minWidth={0}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Stack direction="row" alignItems="center" gap={0.8}>
                <Workflow size={19} color="var(--dwp-product-accent)" aria-hidden="true" />
                <Typography id="dwaion-action-catalog-heading" component="h2" variant="h6">
                  {copy.catalogTitle}
                </Typography>
              </Stack>
              {!query.isLoading && !query.isError && (
                <Chip size="small" label={copy.actionCount(actions.length)} />
              )}
            </Stack>

            {query.isLoading ? (
              <Box
                sx={{
                  mt: 1.5,
                  display: { xs: 'flex', sm: 'grid' },
                  gridTemplateColumns: { sm: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))' },
                  gap: 1.25,
                  overflowX: { xs: 'auto', sm: 'visible' },
                  pb: { xs: 0.5, sm: 0 },
                  scrollSnapType: { xs: 'inline mandatory', sm: 'none' },
                }}
              >
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} variant="rounded" height={196} />
                ))}
              </Box>
            ) : actions.length ? (
              <Box
                aria-label={t('dwaionActions.catalogLabel')}
                sx={{
                  mt: 1.5,
                  display: { xs: 'flex', sm: 'grid' },
                  gridTemplateColumns: {
                    sm: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
                  },
                  gap: 1.25,
                  overflowX: { xs: 'auto', sm: 'visible' },
                  pb: { xs: 0.5, sm: 0 },
                  scrollSnapType: { xs: 'inline mandatory', sm: 'none' },
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {actions.map((action) => {
                  const owner = actionDestination(action.actionKey, language);
                  const active = (reviewedAction ?? selected)?.actionKey === action.actionKey;
                  return (
                    <Box
                      key={action.actionKey}
                      sx={{
                        minWidth: 0,
                        p: { xs: 0.75, sm: 1.5 },
                        border: active ? 2 : 1,
                        borderColor: active ? 'primary.main' : 'divider',
                        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                        bgcolor: active ? 'primary.lighter' : 'background.paper',
                        display: 'flex',
                        flexDirection: { xs: 'row', sm: 'column' },
                        alignItems: { xs: 'center', sm: 'stretch' },
                        gap: { xs: 0.65, sm: 0 },
                        flex: { xs: '0 0 68%', sm: 'initial' },
                        scrollSnapAlign: { xs: 'start', sm: 'none' },
                      }}
                    >
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: { xs: 32, sm: 42 },
                          height: { xs: 32, sm: 42 },
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                          bgcolor: 'primary.lighter',
                          color: 'primary.main',
                        }}
                      >
                        <ActionIcon action={action} />
                      </Box>
                      <Typography
                        component="h3"
                        variant="subtitle1"
                        fontWeight="fontWeightBold"
                        sx={{ mt: 1.2, display: { xs: 'none', sm: 'block' } }}
                      >
                        {action.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.45,
                          display: { xs: 'none', sm: '-webkit-box' },
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                        }}
                      >
                        {action.description}
                      </Typography>
                      <Stack
                        direction="row"
                        gap={0.75}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ mt: 1.2, display: { xs: 'none', sm: 'flex' } }}
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${copy.risk} · ${action.riskTier}`}
                        />
                        <Chip size="small" variant="outlined" label={owner.app} />
                      </Stack>
                      <ActionButton
                        intent={active ? 'primary' : 'secondary'}
                        onClick={(event) => {
                          selectionTrigger.current = event.currentTarget;
                          select(action.actionKey);
                        }}
                        aria-pressed={active}
                        aria-label={copy.inspect}
                        sx={{
                          mt: { xs: 0, sm: 'auto' },
                          pt: { xs: 0, sm: 1.5 },
                          px: { xs: 0.5, sm: 1.5 },
                          minHeight: 44,
                          whiteSpace: 'normal',
                          justifyContent: { xs: 'flex-start', sm: 'center' },
                          flex: { xs: 1, sm: 'initial' },
                        }}
                      >
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{ display: { xs: 'inline', sm: 'none' } }}
                        >
                          {action.title} · {owner.app}
                        </Box>
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{ display: { xs: 'none', sm: 'inline' } }}
                        >
                          {copy.inspect}
                        </Box>
                      </ActionButton>
                    </Box>
                  );
                })}
              </Box>
            ) : !query.isError ? (
              <Box sx={{ mt: 1.5 }}>
                <GuidedEmptyState
                  kind="permission"
                  title={t('dwaionActions.emptyTitle')}
                  description={t('dwaionActions.emptyDescription')}
                />
              </Box>
            ) : null}

            <Box component="section" aria-labelledby="dwaion-plan-queue-heading" sx={{ mt: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Clock3 size={19} color="var(--dwp-product-accent)" aria-hidden="true" />
                  <Typography id="dwaion-plan-queue-heading" component="h2" variant="h6">
                    {language === 'ko' ? '계획 검토 대기열' : 'Plan review queue'}
                  </Typography>
                  <Chip size="small" label={reviewState ? 1 : 0} />
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                >
                  {language === 'ko'
                    ? '대화에서 서버 미리보기로 생성됨'
                    : 'Created by a server preview in conversation'}
                </Typography>
              </Stack>
              {reviewState && reviewedAction ? (
                <Box
                  data-testid="dwaion-plan-queue-item"
                  sx={{
                    mt: 1.25,
                    p: { xs: 1.4, sm: 1.75 },
                    border: 2,
                    borderColor: 'primary.main',
                    borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                    bgcolor: 'background.paper',
                    boxShadow: (theme) => `inset 4px 0 0 ${theme.palette.primary.main}`,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" gap={1.1}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 36,
                        height: 36,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                        bgcolor: 'primary.lighter',
                        color: 'primary.main',
                        flex: '0 0 auto',
                      }}
                    >
                      <ActionIcon action={reviewedAction} />
                    </Box>
                    <Box minWidth={0} flex={1}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                          {reviewedAction.title}
                        </Typography>
                        <Chip
                          size="small"
                          color="primary"
                          label={language === 'ko' ? '선택됨' : 'Selected'}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {reviewState.preview.plan.summary}
                      </Typography>
                      <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.9 }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`mutationAllowed=${String(reviewState.preview.plan.mutationAllowed)}`}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${reviewState.preview.plan.steps.length}${language === 'ko' ? '단계' : ' steps'}`}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={actionDestination(reviewedAction.actionKey, language).app}
                        />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              ) : (
                <Box
                  sx={{
                    mt: 1.25,
                    p: 2,
                    border: 1,
                    borderStyle: 'dashed',
                    borderColor: 'divider',
                    borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {language === 'ko'
                      ? '검토할 서버 계획이 없습니다'
                      : 'No server plans are waiting for review'}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.35 }}
                  >
                    {language === 'ko'
                      ? '대화 답변에서 행동을 선택하면 서버가 실제 입력·근거·담당 앱을 검증한 뒤 이 대기열에 전달합니다.'
                      : 'Choose an action from a conversation answer. The server verifies inputs, sources, and the responsible app before adding it here.'}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 2,
                display: { xs: 'none', sm: 'grid' },
                gridTemplateColumns: '32px minmax(0, 1fr)',
                gap: 1,
                bgcolor: 'primary.lighter',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
              }}
            >
              <ShieldCheck size={21} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Box>
                <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.boundaryTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {copy.boundaryDetail}
                </Typography>
              </Box>
            </Box>
          </Box>

          {reviewState && reviewedAction ? (
            <DwaionActionReviewPanel
              action={reviewedAction}
              preview={reviewState.preview}
              language={language}
              valid={previewValid}
              onCancel={cancelReview}
              onHandoff={handoff}
            />
          ) : (
            <CatalogInspector
              open={Boolean(selected)}
              title={copy.actionDetail}
              closeLabel={copy.close}
              emptyLabel={copy.selectAction}
              onClose={() => select()}
              onClosed={() => selectionTrigger.current?.focus({ preventScroll: true })}
            >
              {selected && destination && (
                <>
                  <Box>
                    <Typography component="h2" variant="h5">
                      {selected.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selected.description}
                    </Typography>
                  </Box>
                  <Stack component="dl" gap={1.5} sx={{ m: 0 }}>
                    <CatalogTerm label={copy.mode} value={copy.modes[selected.mode]} />
                    <CatalogTerm label={copy.risk} value={selected.riskTier} />
                    <CatalogTerm
                      label={copy.requiredPermission}
                      value={selected.requiredPermission}
                    />
                    <CatalogTerm
                      label={copy.confirmation}
                      value={
                        selected.confirmationRequired
                          ? copy.confirmationRequired
                          : copy.confirmationNotRequired
                      }
                    />
                    <CatalogTerm label={copy.target} value={destination.app} />
                  </Stack>
                  <CatalogSection title={copy.inputs}>
                    {selected.inputFields.length ? (
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {selected.inputFields.map((field) => (
                          <Typography component="li" variant="body2" key={field} sx={{ mb: 0.5 }}>
                            {actionInputLabel(field, language)}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2">{copy.noInputs}</Typography>
                    )}
                  </CatalogSection>
                  <CatalogSection title={copy.finalLocation}>
                    <Typography variant="body2">{destination.final}</Typography>
                  </CatalogSection>
                  <Typography variant="body2" color="text.secondary">
                    {copy.catalogBoundary}
                  </Typography>
                  {!targetValid && (
                    <ErrorState
                      size="compact"
                      title={copy.invalidTarget}
                      retryLabel={copy.retry}
                      onRetry={() => void query.refetch()}
                    />
                  )}
                  <Box>
                    <ActionButton
                      intent="primary"
                      endIcon={<ArrowRight size={16} />}
                      disabled={!targetValid}
                      onClick={() => {
                        if (targetValid) navigate(selected.targetRoute);
                      }}
                      sx={{ minHeight: 44, whiteSpace: 'normal' }}
                    >
                      {copy.openApp}
                    </ActionButton>
                    <Typography
                      variant="caption"
                      component="p"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {copy.openBoundary}
                    </Typography>
                  </Box>
                </>
              )}
            </CatalogInspector>
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}

function ActionIcon({ action }: { action: WorkplaceAction }) {
  if (action.actionKey.startsWith('MAIL.')) return <MailPlus size={21} aria-hidden="true" />;
  if (action.actionKey.startsWith('CALENDAR.'))
    return <CalendarPlus size={21} aria-hidden="true" />;
  if (action.actionKey.startsWith('APPROVAL.')) return <FileCheck2 size={21} aria-hidden="true" />;
  return <Workflow size={21} aria-hidden="true" />;
}
