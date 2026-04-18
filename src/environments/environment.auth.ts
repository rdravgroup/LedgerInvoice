// Dual-Auth Environment Configuration
export const authEnvironment = {
  // API endpoints for dual-auth system
  apiUrl: 'https://localhost:7238/api',
  // Backwards-compatible alias
  apiBaseUrl: 'https://localhost:7238/api',
  
  // Google OAuth configuration
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  googleRedirectUri: 'http://localhost:4200/auth/callback',
  
  // OAuth scopes
  googleScopes: 'email profile openid',
  
  // Password policy
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  }
};

// Production environment overrides
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  authEnvironment.apiUrl = 'https://your-production-api.com/api';
  authEnvironment.apiBaseUrl = authEnvironment.apiUrl;
  authEnvironment.googleRedirectUri = 'https://your-production-domain.com/auth/callback';
}