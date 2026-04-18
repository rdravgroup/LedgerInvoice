# Ledger Module - Complete Setup Guide

## Overview
This document explains how to enable ledger page access in your Angular application after login through database configuration and UI integration.

---

## Phase 1: Database Setup

### Step 1: Execute SQL Script
Run the SQL script on your **store_app** database:

**File:** `D:\App_Development\store_app\ledger_menu_setup.sql`

**What it does:**
1. Inserts 3 new menu items into `tbl_menu`:
   - `ledger` → Ledger Dashboard (/ledger)
   - `ledger/outstanding-ar` → Outstanding A/R (/ledger/outstanding-ar)
   - `ledger/maintenance` → Ledger Maintenance (/ledger/maintenance)

2. Adds role-based permissions to `tbl_rolepermission`:

   | Role | Menu | View | Add | Edit | Delete |
   |------|------|------|-----|------|--------|
   | super_admin | ledger | ✓ | ✓ | ✓ | ✓ |
   | super_admin | ledger/outstanding-ar | ✓ | ✓ | ✓ | ✓ |
   | super_admin | ledger/maintenance | ✓ | ✓ | ✓ | ✓ |
   | admin | ledger | ✓ | ✗ | ✗ | ✗ |
   | admin | ledger/outstanding-ar | ✓ | ✗ | ✗ | ✗ |
   | guest | ledger | ✓ | ✗ | ✗ | ✗ |
   | guest | ledger/outstanding-ar | ✓ | ✗ | ✗ | ✗ |

#### Execution Steps:
```sql
-- Open SQL Server Management Studio
-- Connect to your server and database (store_app)
-- Open the ledger_menu_setup.sql file
-- Execute (F5 or Execute button)
-- Verify the output messages confirm successful inserts
```

---

## Phase 2: Frontend Changes (Already Complete)

### ✅ Routes Added (app.routes.ts)
```typescript
{ path: 'ledger', component: LedgerDashboardComponent, canActivate: [authGuard] },
{ path: 'ledger/dashboard', component: LedgerDashboardComponent, canActivate: [authGuard] },
{ path: 'ledger/outstanding-ar', component: OutstandingARComponent, canActivate: [authGuard] },
{ path: 'ledger/maintenance', component: MaintenancePanelComponent, canActivate: [superAdminGuard] },
```

### ✅ Menu Component Updated (appmenu.component.html)
The navigation menu now:
1. Dynamically loads menu items from the database based on user role
2. Displays ledger items with specific icons:
   - **account_balance_wallet** - Ledger Dashboard
   - **trending_up** - Outstanding A/R
   - **settings** - Ledger Maintenance

### ✅ Bug Fixes Applied
- Fixed optional chaining operators in ledger-dashboard template
- Escaped @ symbols in maintenance-panel template for Angular compatibility

---

## Phase 3: Testing & Verification

### After running the SQL script and restarting your app:

#### Test 1: Super Admin Login
```
1. Login as a super_admin user
2. You should see 3 ledger menu items in the sidebar:
   - Ledger Dashboard (with wallet icon)
   - Outstanding A/R (with trending up icon)
   - Ledger Maintenance (with settings icon)
3. Click each menu item and verify pages load correctly
```

#### Test 2: Admin Login
```
1. Login as an admin user
2. You should see 2 ledger menu items:
   - Ledger Dashboard
   - Outstanding A/R
3. Ledger Maintenance should NOT appear (no access)
4. Try clicking each item - they should load
```

#### Test 3: Guest Login
```
1. Login as a guest user
2. You should see 2 ledger menu items (same as admin)
3. They should load correctly
```

#### Test 4: Menu Permissions
```
- If permissions are correct, users see only the menu items they have access to
- If they try to navigate directly to a restricted route (e.g., /ledger/maintenance),
  the superAdminGuard should block non-super-admin users
```

---

## Database Schema Reference

### tbl_menu Table
```sql
CREATE TABLE tbl_menu (
    [code] NVARCHAR(50) PRIMARY KEY,           -- Menu identifier (used as route)
    [name] NVARCHAR(200) NOT NULL,             -- Display name in menu
    [status] BIT NULL,                         -- 1=active, 0=inactive
    [create_date] DATETIME NULL,               -- Creation timestamp
    [update_date] DATETIME NULL,               -- Last update timestamp
    [create_ip] NVARCHAR(20) NULL,             -- IP where created
    [update_ip] NVARCHAR(20) NULL              -- IP where updated
)
```

### tbl_rolepermission Table
```sql
CREATE TABLE tbl_rolepermission (
    [id] INT IDENTITY PRIMARY KEY,
    [userrole] NVARCHAR(50) NOT NULL,          -- Role name (super_admin, admin, guest, etc.)
    [menucode] NVARCHAR(50) NOT NULL,          -- Menu code reference
    [haveview] BIT NOT NULL,                   -- Can view/access menu item
    [haveadd] BIT NOT NULL,                    -- Can add/create
    [haveedit] BIT NOT NULL,                   -- Can edit
    [havedelete] BIT NOT NULL,                 -- Can delete
    [create_date] DATETIME NULL,
    [create_ip] NVARCHAR(20) NULL,
    [update_ip] NVARCHAR(20) NULL,
    [update_date] DATETIME NULL
)
```

---

## How It Works (Technical Flow)

1. **User Logs In** 
   - User provides credentials and is authenticated
   - User role is stored in session/auth service

2. **Menu Loads** 
   - AppmenuComponent on initialization calls `UserService.loadMenuByRole(userRole)`
   - Backend API: `GET /UserRole/GetAllMenusByRole?userrole={role}`
   - API joins `tbl_menu` with `tbl_rolepermission` where:
     - `tbl_rolepermission.userrole = {logged-in user's role}`
     - `tbl_rolepermission.haveview = 1` (user has view permission)
   - Returns Menu[] array with `menucode` and `menuname`

3. **Menu Displays**
   - Angular loops through the Menu[] array
   - Each item displays with appropriate icon based on `menucode`
   - `routerLink` is set to construct the route (e.g., `/ledger`, `/ledger/outstanding-ar`)

4. **User Navigates**
   - User clicks a menu item
   - Angular routing takes user to the route
   - Route guard (`authGuard`, `superAdminGuard`) validates access
   - Component loads and displays

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Menu items not showing | Run SQL script, ensure `haveview=1` in database |
| Can't access pages after login | Check database for menu items and permissions |
| Wrong icons showing | Verify menu codes match: `ledger`, `ledger/outstanding-ar`, `ledger/maintenance` |
| Build errors | Run `ng build` to verify all components compile correctly |
| Permission denied errors | Check `superAdminGuard` on /ledger/maintenance route - only super_admin can access |

---

## Next Steps

1. ✅ **Database**: Execute the SQL script
2. ✅ **Frontend**: Changes already applied (rebuild and restart)
3. ⏭️ **Test**: Log in with different roles and verify menu visibility
4. ⏭️ **Deploy**: Push changes to production environment

---

## Files Modified

- `D:\App_Development\store_app\src\app\app.routes.ts` - Added ledger routes
- `D:\App_Development\store_app\src\app\Component\appmenu\appmenu.component.html` - Updated menu with icons
- `D:\App_Development\store_app\src\app\Component\ledger\ledger-dashboard\ledger-dashboard.component.html` - Fixed optional chaining operators
- `D:\App_Development\store_app\src\app\Component\ledger\maintenance-panel\maintenance-panel.component.html` - Escaped @ symbols

## Files Created

- `D:\App_Development\store_app\ledger_menu_setup.sql` - Database setup script

---

## Questions?

Verify the following if issues arise:
- SQL script executed without errors
- Browser cache cleared after rebuilding
- User role is correctly set in database
- Routes are correctly defined in `app.routes.ts`
