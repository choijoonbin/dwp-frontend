export const HRIS_NAVIGATION_POLICY_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_NAVIGATION_POLICY_ENABLED === 'true' ? 'ON' : 'OFF';

export function isHrisNavigationPolicyRuntimeEnabled() {
  return HRIS_NAVIGATION_POLICY_RUNTIME_STATE === 'ON';
}
