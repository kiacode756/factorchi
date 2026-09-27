/**
 * Safe multi-tier storage with resilience against:
 * - Safari / iOS Private Browsing restrictions
 * - Cross-origin iframe storage partitioning
 * - LocalStorage QuotaExceeded errors
 * - Accidental session loss on page refresh
 */

class SafeStorageService {
  private memoryFallback: Map<string, string> = new Map();

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    try {
      const match = document.cookie.match(new RegExp('(^|;\\s*)' + encodeURIComponent(name) + '=([^;]*)'));
      return match ? decodeURIComponent(match[2]) : null;
    } catch {
      return null;
    }
  }

  private setCookie(name: string, value: string, days = 30): void {
    if (typeof document === 'undefined') return;
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // ignore
    }
  }

  private removeCookie(name: string): void {
    if (typeof document === 'undefined') return;
    try {
      document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    } catch {
      // ignore
    }
  }

  public getItem(key: string): string | null {
    // 1. Try localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch {
      // Ignore security or quota errors
    }

    // 2. Try sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch {
      // Ignore
    }

    // 3. Try cookies (especially for auth & user tokens)
    try {
      const cookieVal = this.getCookie(key);
      if (cookieVal !== null && cookieVal !== undefined) return cookieVal;
    } catch {
      // Ignore
    }

    // 4. Memory fallback
    return this.memoryFallback.get(key) || null;
  }

  public setItem(key: string, value: string): void {
    this.memoryFallback.set(key, value);

    // 1. Try localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[SafeStorage] localStorage write notice for ${key}:`, e);
    }

    // 2. Try sessionStorage for dual persistence
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }

    // 3. For critical auth keys, also sync to cookie
    if (key === 'factorchi_auth' || key === 'factorchi_user' || key === 'factorchi_token') {
      try {
        this.setCookie(key, value, 30);
      } catch {
        // Ignore
      }
    }
  }

  public removeItem(key: string): void {
    this.memoryFallback.delete(key);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }

    try {
      this.removeCookie(key);
    } catch {
      // Ignore
    }
  }
}

export const safeStorage = new SafeStorageService();
