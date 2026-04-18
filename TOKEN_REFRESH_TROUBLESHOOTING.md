# Token Refresh Failure - Troubleshooting Guide

## Error Summary

```
POST http://sanjulogin.runasp.net/api/Authorize/GenerateRefreshToken - Error: undefined
{message: 'Bad request. Please check your input.', status: undefined}
AUTH_SERVICE: Token refresh failed, logging out
```

## Root Causes & Solutions

### 1. **Invalid Refresh Token** (Most Common)

**Symptoms:**
- Status: 400 or undefined
- Message: "Bad request"
- After login, using the app for a while works, then suddenly stops

**Causes:**
- Refresh token expired
- Refresh token format is invalid
- Refresh token was cleared from storage
- Mismatched token/refresh-token pair

**Solution:**
```typescript
// Check in browser console
localStorage.getItem('refreshToken')      // Should return a token string
localStorage.getItem('token')             // Should return a token string
localStorage.getItem('username')          // Should return username
```

If any are missing/null, **user needs to login again**.

---

### 2. **Network/CORS Error**

**Symptoms:**
- Status: undefined or 0
- Error shows "Network error"
- Works locally but fails in production

**Causes:**
- CORS not configured properly on backend
- Network timeout
- Proxy issues
- SSL certificate problems

**Solution:**
Check backend CORS configuration:
```csharp
// In your API startup
services.AddCors(options => {
    options.AddPolicy("AllowAngularApp", builder => {
        builder.WithOrigins("https://your-domain.com")
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials();
    });
});
```

---

### 3. **API Endpoint Mismatch**

**Symptoms:**
- Request URL: `http://sanjulogin.runasp.net/api/Authorize/GenerateRefreshToken`
- But endpoint might be different on backend

**Causes:**
- API endpoint changed
- Wrong base URL configuration
- Controller name changed

**Solution:**
Verify in `environment.ts` or `environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://sanjulogin.runasp.net/api/'  // Must end with /
};
```

Should result in URL: `http://sanjulogin.runasp.net/api/Authorize/GenerateRefreshToken`

---

### 4. **Wrong Request Body Format**

**Symptoms:**
- Status: 400
- Message: "Bad request"
- Other endpoints work fine

**Causes:**
- API expects different property name (e.g., `refresh_token` instead of `refreshToken`)
- API expects JSON in different format
- Property name case sensitivity

**Solution:**
Check what backend expects:
```csharp
// Backend might expect:
public class RefreshTokenRequest {
    public string RefreshToken { get; set; }
}

// Or different name:
public string refresh_token { get; set; }
```

Update request in [authentication.service.ts](authentication.service.ts#L375):
```typescript
// Current (might be correct):
return this.http.post<LoginResponse>(
  `${this.baseUrl}Authorize/GenerateRefreshToken`,
  { refreshToken }  // ← Check this property name
);

// If needed, change to:
// { refresh_token }
// { "refresh_token": refreshToken }
```

---

### 5. **Refresh Token Expired**

**Symptoms:**
- Works initially after login
- After some time (hours/days), starts failing
- Status: 400

**Causes:**
- Refresh token has its own expiration (usually longer than access token)
- Token has been sitting unused too long
- Logout wasn't called properly

**Solution:**
Implement refresh token refresh logic:
```typescript
// Add method to refresh the refresh token
private REFRESH_TOKEN_EXPIRY_HOURS = 7;  // Adjust based on backend

// Periodically refresh tokens before expiry
private scheduleRefreshTokenRefresh(): void {
  setTimeout(() => {
    this.refreshToken().subscribe({
      next: () => this.scheduleRefreshTokenRefresh(),
      error: () => this.logout()
    });
  }, this.REFRESH_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
}
```

---

## Enhanced Error Handling (Implemented)

The updated authentication service now:

✅ **Better Logging:**
```
AUTH_SERVICE: Starting token refresh...
AUTH_SERVICE: Has refresh token: true
AUTH_SERVICE: Has access token: true
AUTH_SERVICE: Username: john_doe
AUTH_SERVICE: Sending refresh token request to: https://...
AUTH_SERVICE: Payload keys: ['refreshToken']
```

✅ **Differentiated Error Handling:**
- **400/401 errors**: Invalid token, logout user
- **Network errors**: Retry after 30 seconds instead of logout
- **Unknown errors**: Log details for debugging

✅ **Validation Before Refresh:**
- Checks if refresh token exists
- Checks if username exists
- Logs all validation failures

✅ **Retry Logic:**
```typescript
// On network error, retry instead of logout
if (err.message.includes('Network error')) {
  setTimeout(() => {
    this.scheduleTokenRefresh();
  }, 30000); // Retry after 30 seconds
}
```

---

## Debugging Steps

### 1. Check Console Logs

Open browser DevTools (F12) → Console, look for logs starting with `AUTH_SERVICE`:

```
✅ Good signs:
AUTH_SERVICE: Token refresh successful
AUTH_SERVICE: New tokens stored successfully

❌ Bad signs:
AUTH_SERVICE: Error status: 400
AUTH_SERVICE: Error message: Bad request
```

### 2. Check LocalStorage

Console → Storage → LocalStorage:
```
token: eyJhbGciOiJIUzI1NiIs... ← Should be present
refreshToken: eyJhbGciOiJIUzI1NiIs... ← Should be present
username: john_doe ← Should be present
```

### 3. Check Network Tab

DevTools → Network → Filter for "GenerateRefreshToken":
```
POST /api/Authorize/GenerateRefreshToken
Request Headers:
  - Content-Type: application/json
  
Request Body:
  {"refreshToken":"eyJ..."}

Response:
  Status: 200 OK or 400 Bad Request
  Body: { "token": "...", "refreshToken": "..." }
```

### 4. Test Refresh Token Manually

Console:
```javascript
// Get current tokens
const token = localStorage.getItem('token');
const refreshToken = localStorage.getItem('refreshToken');

console.log('Token valid:', !!token);
console.log('Refresh token valid:', !!refreshToken);

// Try manual refresh
fetch('/api/Authorize/GenerateRefreshToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
})
.then(r => r.json())
.then(d => console.log('Refresh response:', d))
.catch(e => console.error('Refresh error:', e));
```

---

## Backend Checklist

If error persists, verify backend:

- [ ] `GenerateRefreshToken` endpoint exists and accessible
- [ ] Accepts POST requests
- [ ] Request validation:
  - [ ] Accepts `refreshToken` property (case-sensitive)
  - [ ] Validates refresh token existence
  - [ ] Validates refresh token not expired
  - [ ] Validates refresh token belongs to valid user
- [ ] Response format:
  - [ ] Returns `token` field
  - [ ] Returns `refreshToken` field
  - [ ] Returns `expiresIn` (optional but good)
  - [ ] Returns 200 status on success
  - [ ] Returns 400 on invalid token input
  - [ ] Returns 401 on expired/invalid token
- [ ] CORS configured for frontend domain
- [ ] No rate limiting blocking requests
- [ ] Database connection working for token validation

---

## Files Modified

1. **authentication.service.ts**
   - Enhanced `refreshToken()` with detailed logging
   - Improved error differentiation (400 vs network vs other)
   - Better validation before refresh request
   - Retry logic for network errors

2. **token.interceptor.ts**
   - Better error handling in catchError
   - Differentiated handling for 400/401/0 errors
   - Special handling for GenerateRefreshToken endpoint
   - Network error handling without auto-logout

---

## Quick Fixes to Try

### Fix #1: Clear and Re-login
```javascript
// In browser console:
localStorage.clear();
// Then reload page and login again
window.location.reload();
```

### Fix #2: Check Token Format
The token should be JWT format (three parts separated by dots):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFON...
```

If different format, backend might be using different token type.

### Fix #3: Check Base URL
```typescript
// In environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:7238/api/'  // ← Make sure this is correct
};

// Should create URL like:
// http://localhost:7238/api/Authorize/GenerateRefreshToken
```

---

## When to Contact Backend Team

If after trying the above fixes the issue persists:

1. **Share console logs** showing AUTH_SERVICE error details
2. **Share Network tab request/response** for GenerateRefreshToken endpoint
3. **Confirm refresh token format** (should be JWT or similar)
4. **Ask about:**
   - Refresh token expiration time
   - Required request body format
   - Any validation rules for refresh token
   - CORS configuration
   - Rate limiting on that endpoint

---

## Related Documentation

- [SESSION_TIMEOUT_GUIDE.md](SESSION_TIMEOUT_GUIDE.md) - Session management overview
- [EDIT_INVOICE_CUSTOMER_DISABLED.md](EDIT_INVOICE_CUSTOMER_DISABLED.md) - Other features
- Authentication Service: `src/app/_service/authentication.service.ts`
- Token Interceptor: `src/app/_service/token.interceptor.ts`
