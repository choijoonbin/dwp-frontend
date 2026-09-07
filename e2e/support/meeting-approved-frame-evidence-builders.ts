import type { MeetingApprovedFrameImplementationGolden } from './meeting-approved-frame-contract';

export type ImplementationCaptureEvidence = Pick<
  MeetingApprovedFrameImplementationGolden,
  'captureClass' | 'expectedRasterHeight' | 'orderedLandmarks' | 'clearance' | 'sha256'
>;

const MOBILE_NAVIGATION_SELECTOR = '[data-testid="meeting-mobile-navigation"]';
const MOBILE_NAVIGATION_CONTENT_SELECTOR = '[data-testid="meeting-mobile-navigation-content"]';

export function fullDocumentEvidence(
  expectedRasterHeight: number,
  sha256: string,
  orderedLandmarks: readonly string[],
  lastContentSelector: string,
  fixedMobileNavigation = false
): ImplementationCaptureEvidence {
  return {
    captureClass: 'FULL_DOCUMENT',
    expectedRasterHeight,
    sha256,
    orderedLandmarks,
    clearance: {
      horizontalOverflowTolerancePx: 1,
      lastContentSelector,
      maxTrailingGapPx: 128,
      ...(fixedMobileNavigation
        ? {
            fixedOverlaySelector: MOBILE_NAVIGATION_SELECTOR,
            fixedOverlayContentSelector: MOBILE_NAVIGATION_CONTENT_SELECTOR,
          }
        : {}),
    },
  };
}

export function immersiveEvidence(
  expectedRasterHeight: number,
  sha256: string,
  orderedLandmarks: readonly string[]
): ImplementationCaptureEvidence {
  return {
    captureClass: 'IMMERSIVE_VIEWPORT',
    expectedRasterHeight,
    sha256,
    orderedLandmarks,
    clearance: {
      horizontalOverflowTolerancePx: 1,
      lastContentSelector: '.dwp-video-meeting-room',
      maxTrailingGapPx: 1,
    },
  };
}
