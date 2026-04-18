-- ===================================================================
-- Ledger Module - Database Setup Script
-- Add menu items and role permissions for ledger functionality
-- Date: 2026-03-29
-- ===================================================================

USE [store_app]
GO

-- ===================================================================
-- STEP 1: Insert Menu Items into tbl_menu
-- ===================================================================

-- Check if menu items already exist before inserting
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

-- ===================================================================
-- STEP 2: Insert Role Permissions into tbl_rolepermission
-- ===================================================================

-- SUPER_ADMIN: Full access to all ledger features
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-dashboard', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Role permission added - super_admin : ledger-dashboard'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-outstanding-ar', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Role permission added - super_admin : ledger-outstanding-ar'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'super_admin' AND [menucode] = 'ledger-maintenance')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('super_admin', 'ledger-maintenance', 1, 1, 1, 1, GETDATE(), NULL)
    PRINT 'Role permission added - super_admin : ledger-maintenance'
END
GO

-- ADMIN: Full access to dashboard and AR (no maintenance)
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'admin' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('admin', 'ledger-dashboard', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Role permission added - admin : ledger-dashboard (view only)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'admin' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('admin', 'ledger-outstanding-ar', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Role permission added - admin : ledger-outstanding-ar (view only)'
END
GO

-- No maintenance access for admin
-- GUEST: Minimal access (view only)
IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'guest' AND [menucode] = 'ledger-dashboard')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('guest', 'ledger-dashboard', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Role permission added - guest : ledger-dashboard (view only)'
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[tbl_rolepermission] 
               WHERE [userrole] = 'guest' AND [menucode] = 'ledger-outstanding-ar')
BEGIN
    INSERT INTO [dbo].[tbl_rolepermission] 
    ([userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date], [create_ip])
    VALUES ('guest', 'ledger-outstanding-ar', 1, 0, 0, 0, GETDATE(), NULL)
    PRINT 'Role permission added - guest : ledger-outstanding-ar (view only)'
END
GO

-- ===================================================================
-- STEP 3: Verification Queries
-- ===================================================================

PRINT ''
PRINT '=== VERIFICATION: New Menu Items ==='
SELECT [code], [name], [status], [create_date] FROM [dbo].[tbl_menu] 
WHERE [code] IN ('ledger-dashboard', 'ledger-outstanding-ar', 'ledger-maintenance')
ORDER BY [code]
GO

PRINT ''
PRINT '=== VERIFICATION: New Role Permissions ==='
SELECT [userrole], [menucode], [haveview], [haveadd], [haveedit], [havedelete], [create_date]
FROM [dbo].[tbl_rolepermission]
WHERE [menucode] IN ('ledger-dashboard', 'ledger-outstanding-ar', 'ledger-maintenance')
ORDER BY [userrole], [menucode]
GO

PRINT ''
PRINT '=== Setup Complete ==='
