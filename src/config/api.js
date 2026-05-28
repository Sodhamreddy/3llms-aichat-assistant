export const PLAYWRIGHT_SERVER =
  import.meta.env.VITE_PLAYWRIGHT_SERVER_URL || 'http://localhost:3001';

const isLocalBrowser =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const REMOTE_LOGIN_MODE =
  import.meta.env.VITE_REMOTE_LOGIN_MODE ||
  (isLocalBrowser ? 'native' : 'preview');

export const SHARED_BROWSER_CLIENT_ID =
  import.meta.env.VITE_SHARED_BROWSER_CLIENT_ID || '';

export const USE_SHARED_BROWSER = Boolean(SHARED_BROWSER_CLIENT_ID);
