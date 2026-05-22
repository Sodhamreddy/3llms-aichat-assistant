const USER_KEY = 'ph_user';

export const createClientId = () =>
  `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const loadStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  } catch {
    return {};
  }
};

export const saveStoredUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
};

export const attachClientId = (userData = {}) => {
  const clientId = userData.clientId || userData.client_id || createClientId();
  return { ...userData, clientId };
};

export const ensureClientId = () => {
  const user = loadStoredUser();
  const existing = user.clientId || user.client_id;
  if (existing) return existing;

  const clientId = createClientId();
  saveStoredUser({ ...user, clientId });
  return clientId;
};
