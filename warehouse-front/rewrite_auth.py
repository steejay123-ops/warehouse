import re

file_path = r'e:\warehouse project\warehouse-front\src\app\core\auth\auth.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update login
content = content.replace(
    'login(username: string, password: string): Observable<LoginResponse> {',
    'login(username: string, password: string, rememberMe: boolean = true): Observable<LoginResponse> {'
)
content = content.replace(
    'return this.mockLogin(username, password);',
    'return this.mockLogin(username, password, rememberMe);'
)
content = content.replace(
    'tap((response) => this.handleLoginSuccess(response)),',
    'tap((response) => this.handleLoginSuccess(response, rememberMe)),'
)

# 2. Update refreshToken
content = content.replace(
    'const refresh = localStorage.getItem(REFRESH_KEY);',
    'const refresh = this.getItem(REFRESH_KEY);'
)
content = content.replace(
    'tap((response) => localStorage.setItem(TOKEN_KEY, response.access)),',
    'tap((response) => this.setItem(TOKEN_KEY, response.access)),'
)

# 3. Update getAccessToken
content = content.replace(
    'getAccessToken(): string | null {\n    return localStorage.getItem(TOKEN_KEY);\n  }',
    'getAccessToken(): string | null {\n    return this.getItem(TOKEN_KEY);\n  }'
)

# 4. Storage Helpers and replace mockLogin/handleLoginSuccess/clearAuth/loadUserFromStorage
storage_helpers = '''  // ────────── Storage Helpers ──────────

  private setItem(key: string, value: string, rememberMe?: boolean): void {
    if (rememberMe === true) {
      localStorage.setItem(key, value);
    } else if (rememberMe === false) {
      sessionStorage.setItem(key, value);
    } else {
      if (sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, value);
      }
    }
  }

  private getItem(key: string): string | null {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  }

  private removeItem(key: string): void {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  // ────────── Private ──────────'''

content = content.replace('  // ────────── Private ──────────', storage_helpers)

content = content.replace(
    'localStorage.setItem(USER_KEY, JSON.stringify(u));',
    'this.setItem(USER_KEY, JSON.stringify(u));'
)

content = content.replace(
    'private mockLogin(username: string, password: string): Observable<LoginResponse> {',
    'private mockLogin(username: string, password: string, rememberMe: boolean): Observable<LoginResponse> {'
)
content = content.replace(
    'this.handleLoginSuccess(response);',
    'this.handleLoginSuccess(response, rememberMe);'
)

content = content.replace(
    'private handleLoginSuccess(response: LoginResponse): void {\n    localStorage.setItem(TOKEN_KEY, response.tokens.access);\n    localStorage.setItem(REFRESH_KEY, response.tokens.refresh);\n    localStorage.setItem(USER_KEY, JSON.stringify(response.user));',
    'private handleLoginSuccess(response: LoginResponse, rememberMe: boolean): void {\n    this.setItem(TOKEN_KEY, response.tokens.access, rememberMe);\n    this.setItem(REFRESH_KEY, response.tokens.refresh, rememberMe);\n    this.setItem(USER_KEY, JSON.stringify(response.user), rememberMe);'
)

content = content.replace(
    'private clearAuth(): void {\n    localStorage.removeItem(TOKEN_KEY);\n    localStorage.removeItem(REFRESH_KEY);\n    localStorage.removeItem(USER_KEY);',
    'private clearAuth(): void {\n    this.removeItem(TOKEN_KEY);\n    this.removeItem(REFRESH_KEY);\n    this.removeItem(USER_KEY);'
)

content = content.replace(
    'const raw = localStorage.getItem(USER_KEY);',
    'const raw = typeof window !== "undefined" ? (sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)) : null;'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
