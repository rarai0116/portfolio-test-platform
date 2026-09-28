export const AppInfoChannels = {
  get: 'appInfo:get',
} as const;

export type AppInfoResult =
  | {
      ok: true;
      name: string;
      version: string;
      isPackaged: boolean;
    }
  | {
      ok: false;
      error: string;
    };