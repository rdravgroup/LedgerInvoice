SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.tbl_company', N'U') IS NULL
BEGIN
    RAISERROR('Table dbo.tbl_company does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.tbl_company', 'discount_mode') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_company ADD discount_mode VARCHAR(20) NOT NULL CONSTRAINT DF_tbl_company_discount_mode DEFAULT ''none'';');

IF COL_LENGTH('dbo.tbl_company', 'discount_type') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_company ADD discount_type VARCHAR(20) NOT NULL CONSTRAINT DF_tbl_company_discount_type DEFAULT ''percentage'';');

IF COL_LENGTH('dbo.tbl_company', 'discount_value') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_company ADD discount_value DECIMAL(18,2) NOT NULL CONSTRAINT DF_tbl_company_discount_value DEFAULT 0;');

EXEC(N'UPDATE dbo.tbl_company
SET discount_mode = CASE WHEN discount_mode NOT IN (''none'',''itemwise'',''invoicewise'',''both'') THEN ''none'' ELSE discount_mode END,
    discount_type = CASE WHEN discount_type NOT IN (''percentage'',''manual'') THEN ''percentage'' ELSE discount_type END,
    discount_value = CASE WHEN discount_value < 0 THEN 0 ELSE discount_value END;');

IF OBJECT_ID(N'dbo.tbl_Invoice', N'U') IS NULL
BEGIN
    RAISERROR('Table dbo.tbl_Invoice does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.tbl_Invoice', 'discount_amount') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_Invoice ADD discount_amount DECIMAL(18,2) NULL;');

IF COL_LENGTH('dbo.tbl_Invoice', 'itemwise_discount_amount') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_Invoice ADD itemwise_discount_amount DECIMAL(18,2) NULL;');

IF COL_LENGTH('dbo.tbl_Invoice', 'invoicewise_discount_amount') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_Invoice ADD invoicewise_discount_amount DECIMAL(18,2) NULL;');

IF COL_LENGTH('dbo.tbl_Invoice', 'overall_discount_value') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_Invoice ADD overall_discount_value DECIMAL(18,2) NULL;');

IF COL_LENGTH('dbo.tbl_Invoice', 'overall_discount_type') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_Invoice ADD overall_discount_type VARCHAR(20) NULL;');

IF OBJECT_ID(N'dbo.tbl_sales_productinfo', N'U') IS NULL
BEGIN
    RAISERROR('Table dbo.tbl_sales_productinfo does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.tbl_sales_productinfo', 'item_discount_value') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_sales_productinfo ADD item_discount_value DECIMAL(18,2) NULL;');

IF COL_LENGTH('dbo.tbl_sales_productinfo', 'item_discount_type') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_sales_productinfo ADD item_discount_type VARCHAR(20) NULL;');

IF COL_LENGTH('dbo.tbl_product', 'discount_type') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_product ADD discount_type VARCHAR(20) NULL;');

IF COL_LENGTH('dbo.tbl_product', 'discount_value') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_product ADD discount_value DECIMAL(18,2) NULL;');

PRINT 'Company, product, invoice-header, and invoice-line discount columns are ready.';
