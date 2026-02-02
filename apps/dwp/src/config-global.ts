// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  /** 로그인 후 첫 페이지 및 루트(/) 접속 시 리다이렉트 대상. 예: '/dashboard', '/menu.command-center' */
  defaultAfterLoginPath: string;
};

export const CONFIG: ConfigValue = {
  appName: 'DWP',
  appVersion: __APP_VERSION__,
  defaultAfterLoginPath: '/command-center',
};
