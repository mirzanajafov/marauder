const KEY = 'marauder_token';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    return;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
