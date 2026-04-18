# Session Timeout Configuration & Implementation Guide

## Overview
Enhanced session management system that automatically logs out users after 30 minutes of inactivity and refreshes tokens every 12 minutes to maintain active sessions. The backend server tokens expire after 15 minutes.

## Session Timeout Flow

```
User Login → Token stored (exp: 15 min from now)
     ↓
Token Refresh Scheduled (in 12 minutes)
     ↓
Inactivity Timer Started (30 minutes)
     ↓
User Activity (API call) → Inactivity Timer Reset
     ↓
If 12 minutes elapsed → Token Refresh (token reset for another 15 min)
     ↓
If no activity for 30 minutes → Auto Logout
     ↓
Logout → Clear all tokens & timers
```

## Configuration

### Current Settings (in authentication.service.ts)

```typescript
// Token expires at backend after 15 minutes
private readonly TOKEN_EXPIRY_MINUTES = 15;

// Refresh token after 12 minutes (3 min buffer before expiry)
private readonly TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // milliseconds

// Auto-logout after 30 minutes of inactivity
private readonly INACTIVITY_TIMEOUT_MINUTES = 30;
```

### How to Modify Timeouts

#### 1. **Increase Session Duration (Longer Inactivity Timeout)**

Edit `src/app/_service/authentication.service.ts`:

```typescript
// Change this line (currently 30):
private readonly INACTIVITY_TIMEOUT_MINUTES = 60;  // 60 minutes instead of 30
```

**⚠️ Note:** This only affects inactivity timeout. The backend token still expires at 15 minutes. Users will be logged out if the backend API is not called within 15 minutes, even if the app is open.

#### 2. **Increase Backend Token Lifetime**

The backend token expiry (15 minutes) is controlled by your .NET API server, **not** the Angular app.

To increase backend token lifetime, you need to modify your backend code (C# API):
- Look for JWT token configuration in your API startup/middleware
- Typically set in `Startup.cs` or `Program.cs` with claims like `aud` or `SigningCredentials`
- Increase the `expires` parameter (currently likely 15 minutes)

#### 3. **Increase Token Refresh Interval**

If you want to refresh tokens more frequently:

```typescript
// Change this line (currently 12 * 60 * 1000):
private readonly TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000;  // Every 10 minutes
```

**Recommendation:** Keep this value **at least 3 minutes before** the backend token expiry.

## Key Features

### ✅ Automatic Token Refresh
- Tokens are automatically refreshed before expiry
- Prevents session loss during active use
- Scheduled 12 minutes after login (3-minute buffer before 15-minute expiry)

### ✅ Inactivity Detection
- Users are logged out after 30 minutes of inactivity
- Timer resets on every successful API call
- Inactivity timer starts immediately after login

### ✅ Graceful Logout Handling
- All timers are properly cleared on logout
- localStorage is completely cleaned
- User is redirected to login page (configured in auth guard)

### ✅ Session Status Queries
```typescript
// Get session configuration info:
private sessionTimeoutService = inject(SessionTimeoutService);

const info = this.sessionTimeoutService.getSessionInfo();
console.log(info);
// Output: {
//   inactivityTimeoutMinutes: 30,
//   tokenRefreshIntervalMinutes: 12,
//   warningBeforeLogoutMinutes: 2
// }
```

## Usage in Components

### 1. **Monitor Authentication Status**

```typescript
import { AuthService } from './_service/authentication.service';
import { inject } from '@angular/core';

export class MyComponent {
  private authService = inject(AuthService);
  isAuthenticated$ = this.authService.isAuthenticated$; // Signal as observable
  
  ngOnInit() {
    // Check current auth status
    if (this.authService.getAuthStatus()) {
      console.log('User is authenticated');
    }
  }
}
```

### 2. **Listen to Session Expiry Warnings**

```typescript
import { SessionTimeoutService } from './_service/session-timeout.service';

export class AppComponent implements OnInit, OnDestroy {
  private sessionTimeoutService = inject(SessionTimeoutService);
  
  ngOnInit() {
    // Get session warning info
    this.sessionTimeoutService.sessionWarningShown.subscribe(shown => {
      if (shown) {
        console.log('Session warning is displayed to user');
      }
    });
    
    // Or manually trigger a warning
    this.sessionTimeoutService.showSessionExpiryWarning(2); // 2 minutes left
  }
  
  ngOnDestroy() {
    this.sessionTimeoutService.destroy();
  }
}
```

### 3. **Manually Reset Inactivity Timer**

```typescript
// Called automatically on API responses, but you can call it manually:
this.authService.resetInactivityTimer();

// E.g., after user interaction that doesn't trigger API call
@HostListener('document:mousemove')
@HostListener('document:keypress')
onUserActivity() {
  this.authService.resetInactivityTimer();
}
```

## Testing Session Timeout

### 1. **Test Token Refresh**
```typescript
// In browser console while logged in:
localStorage.getItem('token'); // Shows current token
// Wait 12 minutes...
localStorage.getItem('token'); // Should be a NEW token if API called
```

### 2. **Test Inactivity Timeout**
```typescript
// To quickly test inactivity logout:
// 1. Login to the app
// 2. Don't make any API calls for 30 minutes, OR
// 3. Modify INACTIVITY_TIMEOUT_MINUTES to 1 (for testing)
//    Then wait 1 minute without activity
// 4. Should be auto-logged out
```

### 3. **Test Token Expiry**
```typescript
// Manually expire token (for testing):
const expiredToken = generateTokenWithExpiry(new Date()); // Expired now
localStorage.setItem('token', expiredToken);

// Next API call should return 401 and trigger logout
```

## API Integration

The following API endpoints must support token refresh:

```
POST /api/Authorize/GenerateRefreshToken
{
  "refreshToken": "your-refresh-token-here"
}

Response:
{
  "token": "new-jwt-token",
  "refreshToken": "new-refresh-token",
  "expiresIn": 900, // 15 minutes in seconds
  "userRole": "admin"
}
```

If token refresh fails (400+ status), user is automatically logged out.

## Security Considerations

✅ **Good Practices Implemented:**
- Tokens stored in localStorage (simple) - consider moving to secure cookie with HttpOnly flag
- Automatic cleanup on logout
- Token validation on app startup
- Inactivity-based logout
- Graceful handling of 401 errors (expired token)

⚠️ **Recommendations:**
1. Session tokens should ideally be in HttpOnly cookies for XSS protection
2. Add CSRF token validation for state-changing operations (POST/PUT/DELETE)
3. Monitor failed token refresh attempts
4. Log security events for audit trail

## Troubleshooting

### User gets logged out after 15 minutes despite app being open

**Cause:** No API calls made in 15 minutes, token expires, next call gets 401

**Solution:** 
- Increase inactivity timeout: `INACTIVITY_TIMEOUT_MINUTES = 45` (or higher)
- OR increase backend token expiry (contact backend team)
- OR add periodic background health check API call

### User session stays active too long

**Cause:** Inactivity timeout set too high

**Solution:** 
- Reduce `INACTIVITY_TIMEOUT_MINUTES` (e.g., from 30 to 15)
- Balance security with usability

### Token refresh keeps failing

**Cause:** Backend refresh endpoint issues or refresh token expired

**Solution:**
- Check API logs for errors
- Verify `GenerateRefreshToken` endpoint is working
- Ensure refresh token hasn't expired (usually longer than access token)
- Check firewall/network configuration

## Files Modified

1. **authentication.service.ts** - Core session management
   - Added inactivity timeout support
   - Enhanced token refresh scheduling
   - Better logout cleanup

2. **token.interceptor.ts** - HTTP request/response handling
   - Resets inactivity timer on successful API responses
   - Handles 401 errors with logout

3. **session-timeout.service.ts** - NEW
   - User-facing session warnings
   - Session information queries
   - Notification handling

## Next Steps

1. **Test the session timeout** in development environment
2. **Adjust timeouts** based on your business requirements
3. **Implement UI notifications** (optional) using SessionTimeoutService
4. **Add session persistence** if needed (e.g., remember me functionality)
5. **Coordinate with backend team** if you need to increase server-side token expiry

## Support

For issues or questions:
- Check browser console for AUTH_SERVICE logs
- Verify token structure: `localStorage.getItem('token')`
- Check Network tab for failed API calls
- Review error messages in toastr notifications
