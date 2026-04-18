-- ===================================================================
-- Ledger Module - Database Cleanup and Setup
-- Removes old ledger menu items and adds new ones with correct codes
-- Date: 2026-03-29
-- ===================================================================

USE [store_app]
GO

PRINT ''
PRINT '========== STEP 1: Cleanup Old Ledger Menu Items =========='
PRINT ''

-- Delete old role permissions for old ledger menu codes
IF EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] WHERE [menucode] IN ('ledger', 'outstanding-ar', 'ledger-maintenance', 'ledger/outstanding-ar', 'ledger/maintenance'))
BEGIN
    DELETE FROM [dbo].[tbl_rolepermission] 
    WHERE [menucode] IN ('ledger', 'outstanding-ar', 'ledger-maintenance', 'ledger/outstanding-ar', 'ledger/maintenance')
    PRINT 'Deleted old role permissions'
END
ELSE
    PRINT 'No old role permissions found'
GO

-- Delete old menu items
IF EXISTS (SELECT 1 FROM [dbo].[tbl_menu] WHERE [code] IN ('ledger', 'outstanding-ar', 'ledger-maintenance', 'ledger/outstanding-ar', 'ledger/maintenance'))
BEGIN
    DELETE FROM [dbo].[tbl_menu] 
    WHERE [code] IN ('ledger', 'outstanding-ar', 'ledger-maintenance', 'ledger/outstanding-ar', 'ledger/maintenance')
    PRINT 'Deleted old menu items'
END
ELSE
    PRINT 'No old menu items found'
GO

PRINT ''
PRINT '========== STEP 2: Insert New Ledger Menu Items =========='
PRINT ''

-- Insert new menu items with correct codes (no slashes)
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_menu] WHERE [code] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_menu] ([code], [name], [status], [create_date], [create_ip])
    VALUES ('ledger-dashboard', 'Ledger Dashboard', 1, GETDATE(), NULL)
    PRINT 'Menu item "ledger-dashboard" added successfully'
END
ELSE
    PRINT 'Menu item "ledger-dashboard" already exists'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_menu] WHERE [code] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_menu] ([code], [name], [status], [create_date], [create_ip])
    VALUES ('ledger-outstanding-ar', 'Outstanding A/R', 1, GETDATE(), NULL)
    PRINT 'Menu item "ledger-outstanding-ar" added successfully'
END
ELSE
    PRINT 'Menu item "ledger-outstanding-ar" already exists'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_menu] WHERE [code] = 'ledger-maintenance')
BEGIN
    INSERT INTO [dbo].[tbl_menu] ([code], [name], [status], [create_date], [create_ip])
    VALUES ('ledger-maintenance', 'Ledger Maintenance', 1, GETDATE(), NULL)
    PRINT 'Menu item "ledger-maintenance" added successfully'
END
ELSE
    PRINT 'Menu item "ledger-maintenance" already exists'
GO

PRINT ''
PRINT '========== STEP 3: Insert Role Permissions =========='
PRINT ''

-- SUPER_ADMIN: Full access to all ledger features
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-dashboard', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Added: super_admin → ledger-dashboard (Full Access)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-outstanding-ar', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Added: super_admin → ledger-outstanding-ar (Full Access)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-maintenance')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-maintenance', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Added: super_admin → ledger-maintenance (Full Access)'
END
GO

-- ADMIN: View-only access to dashboard and AR
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'admin' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('admin', 'ledger-dashboard', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Added: admin → ledger-dashboard (View Only)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'admin' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('admin', 'ledger-outstanding-ar', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Added: admin → ledger-outstanding-ar (View Only)'
END
GO

-- GUEST: View-only access to dashboard and AR
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'guest' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('guest', 'ledger-dashboard', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Added: guest → ledger-dashboard (View Only)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'guest' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('guest', 'ledger-outstanding-ar', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Added: guest → ledger-outstanding-ar (View Only)'
END
GO

PRINT ''
PRINT '========== STEP 4: Verification =========='
PRINT ''

PRINT ''
PRINT '--- Menu Items ---'
SELECT [code], [name], [status], [create_date] FROM [dbo].[tbl_menu] 
WHERE [code] IN ('ledger-dashboard', 'ledger-outstanding-ar', 'ledger-maintenance')
ORDER BY [code]
GO

PRINT ''
PRINT '--- Role Permissions ---'
SELECT [userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete]
FROM [dbo].[tbl_rolepermission]
WHERE [menucode] IN ('ledger-dashboard', 'ledger-outstanding-ar', 'ledger-maintenance')
ORDER BY [userrole], [menucode]
GO

PRINT ''
PRINT '========== Setup Complete! =========='
PRINT 'Menu items and permissions have been set up correctly.'
PRINT 'Please restart your Angular application and login again.'
