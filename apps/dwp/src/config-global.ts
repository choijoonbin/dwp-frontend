// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  /** 로그인 후 첫 페이지 및 루트(/) 접속 시 리다이렉트 대상. /synapse/command-center 사용 금지 — 반드시 /synapse/workbench 로 고정 */
  defaultAfterLoginPath: string;
};

export const CONFIG: ConfigValue = {
  appName: 'DWP',
  appVersion: __APP_VERSION__,
  defaultAfterLoginPath: '/synapse/workbench',
};
