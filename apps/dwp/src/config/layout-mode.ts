/**
 * Fixed 레이아웃 적용 경로 (한 곳에서 관리)
 *
 * - Fixed: 브라우저 스크롤 차단, 화면 100% 고정, 내부 패널만 스크롤
 * - Scrollable: 기본값, 브라우저 스크롤 허용
 *
 * @see docs/essentials/LAYOUT_GUIDE.md
 */
export const FIXED_LAYOUT_PATHS = [
  '/ai-workspace',
  '/admin/menus',
  '/admin/roles',
  '/admin/code-usages',
  '/admin/codes',
  '/admin/batch',
  '/admin/batch-monitoring',
  '/admin/audit',
] as const;

/** pathname이 fixed 레이아웃 경로에 해당하는지 */
export function isFixedLayoutPath(pathname: string): boolean {
  return FIXED_LAYOUT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
