/** Supported platforms */
export type Platform = 'win32' | 'darwin' | 'linux';

/** Application configuration constants */
export const APP_CONFIG = {
  TARGET_URL: 'https://anisocial.de',
  APP_NAME: 'AniSocial',
  MAX_BADGE_COUNT: 99,
  UPDATE_INTERVAL_MS: 4 * 60 * 60 * 1000, // 4 hours
  RELEASES_URL: 'https://github.com/VandoOmi/AniSocialDesktop/releases',
  WINDOW: {
    DEFAULT_WIDTH: 1280,
    DEFAULT_HEIGHT: 800,
    MIN_WIDTH: 400,
    MIN_HEIGHT: 600,
  },
} as const;

/** Platform-specific tray icon filenames */
export const TRAY_ICONS: Record<Platform, string> = {
  win32: 'icon.ico',
  darwin: 'icon.png',
  linux: 'icon.png',
};
