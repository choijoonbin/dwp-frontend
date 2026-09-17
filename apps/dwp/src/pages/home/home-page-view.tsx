import { Suspense } from 'react';
import { HOME_WIDGET_LIBRARY_ENABLED } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';

import { HomePreferenceConflictDialog } from '../../components/home-preference-conflict-dialog';
import { HomePageStatePanel } from '../../features/home/runtime/home-page-state-panel';
import { HomeEditorSafeArea } from '../../features/home/home-editor-safe-area';
import { HomeEditorGuards } from '../../features/home/runtime/home-editor-guards';
import { HomeFooter } from '../../features/home/home-footer';
import { HomeItemGallery } from '../../features/home/home-item-gallery';
import { HomeRecommendationActionFeedback } from '../../features/home/runtime/home-recommendation-action-feedback';
import { ClassicHome } from '../../features/home/classic-home/classic-home';
import { FlowHome } from '../../features/home/flow-home/flow-home';
import { MzHome } from '../../features/home/mz-home/mz-home';
import { LazyHomePersonalizationStudio } from '../../features/home-personalization/home-personalization-studio-lazy';
import { homeV2RuntimeEvidence } from '../../features/home/runtime/home-owner-widget-region';
import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import { placeLaunchpadApp } from '../../components/workspace-composer/app-launchpad-model';
import { setHomeWidgetVisibility } from '../../features/home/home-widget-registry';

import type { useHomePageController } from './use-home-page-controller';

type HomePageViewProps = ReturnType<typeof useHomePageController>;

/** Renders the Home experience from controller-owned state without owning server behavior. */
export function HomePageView({
  activeAppLayout,
  activeHomeMode,
  activeDeviceOverlay,
  activePresentation,
  activeWidgetConfigurations,
  activeWidgets,
  announcementsZone,
  audienceProfile,
  auth,
  availableWidth,
  backgroundUrl,
  beginEditing,
  cancelEditing,
  closeHomeStudio,
  composerEnabled,
  conflictTarget,
  currentDate,
  currentInstant,
  customizationBusy,
  deviceClass,
  discardEditorOpen,
  draftChangeCount,
  draftDirty,
  draftHistory,
  draftPresentation,
  editorActive,
  editorFlowHomeEnabled,
  editorOpen,
  editorResetAvailable,
  editorSourceFailed,
  editSession,
  effectiveHomeLayout,
  effectiveHomeStudioContractScope,
  effectiveWidgetCatalog,
  entitledApps,
  flowFutureRuntimeProps,
  flowSections,
  galleryOpen,
  governedCanvasWidgets,
  homeAssistantAvailable,
  homeContributionRuntime,
  homeDataRetry,
  homeExperience,
  homeHeadline,
  homeNativeRuntimeState,
  homeOverview,
  homeOverviewHardFailed,
  homeOverviewQuery,
  homeOverviewRefreshPartial,
  homePageGate,
  homePreferenceQuery,
  homeRuntimePartial,
  homeStudioEnabled,
  homeSubheadline,
  homeV2Runtime,
  homeViewsQuery,
  launchApp,
  launcherSummaryPartial,
  launchpadCatalog,
  markHomeStudioEditStarted,
  mzIntentBusy,
  navigate,
  navigationBlocker,
  openHomeStudio,
  openStudioFromGallery,
  ownerWidgetRegion,
  personalCustomizationEnabled,
  persistedSourceFailed,
  persistedSourceLoading,
  previewDevice,
  recommendationAction,
  reapplyAfterConflict,
  reloadLatestAfterConflict,
  requestCancelEditing,
  resetDraft,
  restorableHomeItemCount,
  restoreHomeStudioEntryFocus,
  rolloutDraftPreserved,
  saveHome,
  startMzIntent,
  setConflictTarget,
  setDiscardEditorOpen,
  setDraftAppLayout,
  setDraftPresentation,
  setDraftWidgets,
  setGalleryOpen,
  setPreviewDevice,
  shadowComparison,
  studioContractScope,
  studioOpen,
  t,
  timeZone,
  undoDraft,
  redoDraft,
  updateFlowSections,
  wave2Evidence,
  widgetKeys,
  widgetRuntimeDecisions,
  widgetShadowObservation,
  workspaceUpdatedAt,
}: HomePageViewProps) {
  const AdaptiveHome = activeHomeMode === 'MZ_V1' ? MzHome : FlowHome;
  return (
    <Box
      ref={availableWidth.elementRef}
      data-home-assistant-rail={homeAssistantAvailable ? 'header' : 'none'}
      data-home-widget-shadow-status={widgetShadowObservation.status}
      data-home-widget-shadow-mismatch-count={widgetShadowObservation.mismatchCount}
      data-home-widget-shadow-decision-revision={widgetShadowObservation.decisionRevision ?? 'none'}
      {...homeV2RuntimeEvidence(
        homeV2Runtime,
        recommendationAction.command.status,
        rolloutDraftPreserved,
        shadowComparison
      )}
      data-home-available-width-class={availableWidth.widthClass}
      data-home-device-class={deviceClass}
      data-home-mode={activeHomeMode}
      data-home-personal-customization-enabled={personalCustomizationEnabled ? 'true' : 'false'}
      data-home-editor-state={editorOpen ? (editSession ? 'ready' : 'opening') : 'closed'}
      data-home-persisted-source-state={
        persistedSourceLoading ? 'loading' : persistedSourceFailed ? 'failed' : 'ready'
      }
      sx={{
        width: 1,
        maxWidth: '100%',
        minHeight: 0,
        minWidth: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'clip',
        '& > footer': { mt: 'auto' },
      }}
    >
      {homePageGate.state.kind !== 'ready' ? (
        <HomePageStatePanel
          state={homePageGate.state}
          retrying={homePageGate.retrying}
          onRetry={homePageGate.retry}
        />
      ) : editorFlowHomeEnabled ? (
        <AdaptiveHome
          audience={audienceProfile}
          now={currentInstant}
          currentDate={currentDate}
          headline={homeHeadline}
          subheadline={homeSubheadline}
          updatedAt={workspaceUpdatedAt}
          timeZone={timeZone}
          backgroundUrl={
            activeHomeMode === 'MZ_V1'
              ? backgroundUrl
              : homeExperience?.backgroundUrl
                ? backgroundUrl
                : undefined
          }
          backgroundPosition={homeExperience?.backgroundPosition ?? 'RIGHT'}
          focalX={homeExperience?.backgroundFocalX}
          focalY={homeExperience?.backgroundFocalY}
          mobileFocalX={homeExperience?.mobileBackgroundFocalX}
          mobileFocalY={homeExperience?.mobileBackgroundFocalY}
          contentAlignment={homeExperience?.contentAlignment}
          overlayOpacity={homeExperience?.overlayOpacity ?? 18}
          apps={entitledApps}
          appGroups={launchpadCatalog.groups}
          appLayout={activeAppLayout}
          sections={flowSections}
          widgetConfigurations={activeWidgetConfigurations}
          widgetRuntimeDecisions={widgetRuntimeDecisions}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          supplementalPartial={
            homeRuntimePartial || homeOverviewRefreshPartial || homeContributionRuntime.partial
          }
          notificationPartial={launcherSummaryPartial}
          contributionModel={homeContributionRuntime.model}
          contributionLoading={homeContributionRuntime.loading}
          contributionFetching={homeContributionRuntime.fetching}
          contributionPartial={homeContributionRuntime.partial}
          announcementsPolicy={announcementsZone}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          retrying={homeDataRetry.retrying}
          presentation={activePresentation}
          density={activeDeviceOverlay?.density ?? 'comfortable'}
          previewDevice={previewDevice}
          availableWidth={availableWidth.value}
          feedbackBusy={recommendationAction.busy}
          onBrowseAllApps={() => navigate('/apps')}
          onStartEditing={homePageGate.editActionAvailable ? () => beginEditing() : undefined}
          onOpenStudio={homeStudioEnabled && !editorOpen ? openHomeStudio : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onSectionsChange={updateFlowSections}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={homeDataRetry.retry}
          onRetryContributions={homeDataRetry.retry}
          onRecommendationFeedback={recommendationAction.dismiss}
          onStartMzIntent={startMzIntent}
          mzIntentBusy={mzIntentBusy}
          futureWidgetStateByKey={wave2Evidence.loadedFlow}
          {...flowFutureRuntimeProps}
          ownerWidgetRegion={ownerWidgetRegion}
        />
      ) : (
        <ClassicHome
          audience={audienceProfile}
          currentDate={currentDate}
          headline={homeHeadline}
          subheadline={homeSubheadline}
          backgroundUrl={backgroundUrl}
          usesDefaultBackground={!homeExperience?.backgroundUrl}
          backgroundPosition={homeExperience?.backgroundPosition ?? 'RIGHT'}
          overlayOpacity={homeExperience?.overlayOpacity ?? 18}
          apps={entitledApps}
          appGroups={launchpadCatalog.groups}
          appLayout={activeAppLayout}
          widgets={activeWidgets}
          widgetRuntimeDecisions={widgetRuntimeDecisions}
          governedWidgets={governedCanvasWidgets}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          nativeRuntimeState={homeNativeRuntimeState}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          personalizationLoading={homePreferenceQuery.isLoading}
          presentation={activePresentation}
          availableWidth={availableWidth.value}
          feedbackBusy={recommendationAction.busy}
          showRecommendationCommand={
            homeV2Runtime.activation.kind === 'ACTIVE' &&
            homeV2Runtime.activation.result.metadata.actionAuthority === 'EXACT_ALLOWLIST'
          }
          onBrowseAllApps={() => navigate('/apps')}
          onOpenOrganizationUpdates={() => navigate('/communications')}
          onStartEditing={homePageGate.editActionAvailable ? () => beginEditing() : undefined}
          onOpenStudio={homeStudioEnabled && !editorOpen ? openHomeStudio : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onWidgetsChange={setDraftWidgets}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={() => void homeOverviewQuery.refetch()}
          onRecommendationFeedback={recommendationAction.dismiss}
          organizationResourceState={wave2Evidence.resource}
          disabledAppIds={
            wave2Evidence.resource?.kind === 'forbidden'
              ? ['ref-app-erp', 'ref-app-legacy', 'dwp-admin']
              : undefined
          }
          ownerWidgetRegion={ownerWidgetRegion}
        />
      )}
      <HomeFooter
        updatedAt={workspaceUpdatedAt}
        freshnessInHeader={homePageGate.state.kind === 'ready' && editorFlowHomeEnabled}
      />
      {editorActive && editorFlowHomeEnabled && <HomeEditorSafeArea />}
      <HomeItemGallery
        open={galleryOpen}
        availableApps={entitledApps}
        appLayout={activeAppLayout}
        availableWidgetKeys={widgetKeys}
        widgetPreferences={activeWidgets}
        widgetRuntimeDecisions={widgetRuntimeDecisions}
        catalogEnabled={HOME_WIDGET_LIBRARY_ENABLED}
        flow={editorFlowHomeEnabled}
        busy={customizationBusy}
        onClose={() => setGalleryOpen(false)}
        onAddApp={(app) => setDraftAppLayout((current) => placeLaunchpadApp(current, app))}
        onAddWidget={(widgetKey) =>
          setDraftWidgets((current) =>
            setHomeWidgetVisibility(current, widgetKey, true, widgetRuntimeDecisions)
          )
        }
        onOpenStudio={homeStudioEnabled ? openStudioFromGallery : undefined}
      />
      {editorActive && personalCustomizationEnabled && (
        <WorkspaceComposerToolbar
          placement="floating"
          widePresentation
          presentation={draftPresentation}
          busy={customizationBusy}
          addLabel={t(
            HOME_WIDGET_LIBRARY_ENABLED ? 'editor.addItems' : 'editor.restoreHiddenItems'
          )}
          addUnavailableReason={
            !HOME_WIDGET_LIBRARY_ENABLED && restorableHomeItemCount === 0
              ? t('editor.noHiddenItemsAvailable')
              : undefined
          }
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={resetDraft}
          onCancel={requestCancelEditing}
          onDone={saveHome}
          canUndo={draftHistory.past.length > 0}
          canRedo={draftHistory.future.length > 0}
          canReset={editorResetAvailable || draftDirty}
          canSave={draftDirty && !editorSourceFailed}
          dirtyCount={draftChangeCount}
          previewDevice={editorFlowHomeEnabled ? previewDevice : undefined}
          onUndo={undoDraft}
          onRedo={redoDraft}
          onPreviewDeviceChange={editorFlowHomeEnabled ? setPreviewDevice : undefined}
        />
      )}
      <HomePreferenceConflictDialog
        open={conflictTarget !== null}
        changeCount={draftChangeCount}
        baseVersion={editSession?.version}
        latestVersion={conflictTarget?.version}
        busy={homePreferenceQuery.isFetching || homeViewsQuery.isFetching}
        onReloadLatest={reloadLatestAfterConflict}
        onReapply={reapplyAfterConflict}
        onClose={() => setConflictTarget(null)}
      />
      <HomeEditorGuards
        discardOpen={discardEditorOpen}
        navigationBlocked={navigationBlocker.state === 'blocked'}
        onKeepDraft={() => setDiscardEditorOpen(false)}
        onDiscardDraft={cancelEditing}
        onStayOnHome={() => navigationBlocker.reset?.()}
        onLeaveHome={() => navigationBlocker.proceed?.()}
      />
      {(homeStudioEnabled || (studioOpen && studioContractScope !== null)) && (
        <Suspense fallback={null}>
          <LazyHomePersonalizationStudio
            open={studioOpen}
            composerEnabled={composerEnabled}
            modeKey={effectiveHomeStudioContractScope.modeKey}
            modeScopedViews={effectiveHomeStudioContractScope.modeScopedViews}
            preferenceStore={effectiveHomeStudioContractScope.preferenceStore}
            legacyPreference={
              effectiveHomeStudioContractScope.preferenceStore === 'LEGACY'
                ? homePreferenceQuery.data
                : undefined
            }
            fourDeviceLayoutsSupported={effectiveHomeStudioContractScope.fourDeviceLayoutsSupported}
            tenantId={auth.user?.tenantId}
            userId={auth.user?.userId}
            seedLayout={effectiveHomeLayout ?? null}
            overview={homeOverview}
            overviewLoading={homeOverviewQuery.isLoading}
            overviewFetching={homeOverviewQuery.isFetching}
            overviewFailed={homeOverviewHardFailed}
            widgetRuntimeDecisions={widgetRuntimeDecisions}
            effectiveWidgetCatalog={effectiveWidgetCatalog}
            feedbackBusy={recommendationAction.busy}
            onRetryOverview={homeDataRetry.retry}
            onRecommendationFeedback={recommendationAction.dismiss}
            onClose={closeHomeStudio}
            onExited={restoreHomeStudioEntryFocus}
            onEditView={(view) => {
              markHomeStudioEditStarted();
              beginEditing(view);
            }}
          />
        </Suspense>
      )}
      <HomeRecommendationActionFeedback action={recommendationAction} />
    </Box>
  );
}
