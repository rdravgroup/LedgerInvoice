// src/app/app.routes.ts
// CHANGED: Added sales-reports lazy-loaded route only.
// All other routes are identical to the original — editinvoice/:invoiceno preserved.

import { Routes } from '@angular/router';
import { HomeComponent } from './Component/home/home.component';
import { RegisterComponent } from './Component/register/register.component';
import { LoginComponent } from './Component/login/login.component';
import { ConfirmotpComponent } from './Component/confirmotp/confirmotp.component';
import { ForgetpasswordComponent } from './Component/forgetpassword/forgetpassword.component';
import { UpdatepasswordComponent } from './Component/updatepassword/updatepassword.component';
import { ProfileComponent } from './Component/profile/profile.component';
import { CustomerComponent } from './Component/customer/customer.component';
import { UserComponent } from './Component/user/user.component';
import { authGuard } from './_guard/auth.guard';
import { companyActivationGuard } from './_guard/company-activation.guard';
import { superAdminGuard } from './_guard/super-admin.guard';
import { AddcustomerComponent } from './Component/addcustomer/addcustomer.component';
import { UserroleComponent } from './Component/userrole/userrole.component';
import { CreateinvoiceComponent } from './Component/createinvoice/createinvoice.component';
import { ListinvoiceComponent } from './Component/listinvoice/listinvoice.component';
import { RatingComponent } from './Component/rating/rating.component';
import { TestInvoiceGeneratorComponent } from './Component/test-invoice-generator/test-invoice-generator.component';
import { UITestRunnerComponent } from './Component/ui-test-runner/ui-test-runner.component';
import { CategoryComponent } from './Component/category/category.component';
import { ProductComponent } from './Component/product/product.component';
import { QuickInvoiceComponent } from './Component/quick-invoice/quick-invoice.component';
import { LedgerDashboardComponent } from './Component/ledger/ledger-dashboard/ledger-dashboard.component';
import { OutstandingARComponent } from './Component/ledger/outstanding-ar/outstanding-ar.component';
import { MaintenancePanelComponent } from './Component/ledger/maintenance-panel/maintenance-panel.component';
import { CompanyManageComponent } from './Component/companymanage/companymanage.component';
import { CompanDeclarationComponent } from './Component/compandeclaration/compandeclaration.component';
import { PurchaseOrderComponent } from './Component/purchase/purchase-order/purchase-order.component';
import { AiChatComponent } from './Component/ai-chat/ai-chat.component';

export const routes: Routes = [
  { path: '',         component: HomeComponent, canActivate: [authGuard, companyActivationGuard] },
  { path: 'home',     component: HomeComponent, canActivate: [authGuard, companyActivationGuard] },
  { path: 'register', component: RegisterComponent },
  { path: 'login',    component: LoginComponent },
  { path: 'confirmotp',      component: ConfirmotpComponent },
  { path: 'forgetpassword',  component: ForgetpasswordComponent },
  { path: 'profile',         component: ProfileComponent,         canActivate: [authGuard] },
  { path: 'updatepassword',  component: UpdatepasswordComponent,  canActivate: [authGuard] },
  { path: 'customer',        component: CustomerComponent,        canActivate: [authGuard] },
  { path: 'customer/add',    component: AddcustomerComponent,     canActivate: [authGuard] },
  { path: 'customer/edit/:uniqueKeyID', component: AddcustomerComponent, canActivate: [authGuard] },
  { path: 'user',       component: UserComponent,       canActivate: [superAdminGuard] },
  { path: 'userrole',   component: UserroleComponent,   canActivate: [superAdminGuard] },
  { path: 'createinvoice',            component: CreateinvoiceComponent, canActivate: [authGuard, companyActivationGuard] },
  // ── IMPORTANT: editinvoice must be preserved — Editinvoice() in listinvoice navigates here ──
  { path: 'editinvoice/:invoiceno',   component: CreateinvoiceComponent, canActivate: [authGuard, companyActivationGuard] },
  { path: 'listinvoice',              component: ListinvoiceComponent,   canActivate: [authGuard, companyActivationGuard] },
  { path: 'rating',         component: RatingComponent,         canActivate: [authGuard] },
  { path: 'category',       component: CategoryComponent,       canActivate: [authGuard] },
  { path: 'productcategory',component: CategoryComponent,       canActivate: [authGuard] },
  { path: 'product',        component: ProductComponent,        canActivate: [authGuard] },
  { path: 'productdetails', component: ProductComponent,        canActivate: [authGuard] },
  { path: 'test-invoices',  component: TestInvoiceGeneratorComponent, canActivate: [authGuard] },
  { path: 'ui-test',        component: UITestRunnerComponent,   canActivate: [authGuard] },
  { path: 'quick-invoice',  component: QuickInvoiceComponent,   canActivate: [authGuard] },
  { path: 'ai-chat',        component: AiChatComponent,          canActivate: [authGuard] },
  { path: 'ledger-dashboard',     component: LedgerDashboardComponent, canActivate: [authGuard] },
  { path: 'ledger',               component: LedgerDashboardComponent, canActivate: [authGuard] },
  { path: 'ledger-outstanding-ar',component: OutstandingARComponent,   canActivate: [authGuard] },
  { path: 'ledger-maintenance',   component: MaintenancePanelComponent,canActivate: [superAdminGuard] },
  { path: 'company',         component: CompanyManageComponent,   canActivate: [authGuard] },
  { path: 'companydeclare',  component: CompanDeclarationComponent,canActivate: [authGuard] },
  { path: 'payment-admin',
    loadComponent: () => import('./Component/payment-admin/payment-admin.component').then(m => m.PaymentAdminComponent) },
  { path: 'payment-callback',
    loadComponent: () => import('./Component/payment-admin/payment-callback.component').then(m => m.PaymentCallbackComponent) },
  { path: 'voucher-admin',
    loadComponent: () => import('./Component/voucher-admin/voucher-admin.component').then(m => m.VoucherAdminComponent) },
  { path: 'purchase/vendors',
    loadComponent: () => import('./Component/purchase/vendor/vendor.component').then(m => m.VendorComponent),
    canActivate: [authGuard] },
  { path: 'purchase/orders', component: PurchaseOrderComponent, canActivate: [authGuard] },
  { path: 'purchase/invoices',
    loadComponent: () => import('./Component/purchase/purchase-invoice/purchase-invoice.component').then(m => m.PurchaseInvoiceComponent),
    canActivate: [authGuard] },
  { path: 'purchase/payments',
    loadComponent: () => import('./Component/purchase/purchase-payment/purchase-payment.component').then(m => m.PurchasePaymentComponent),
    canActivate: [authGuard] },
  { path: 'purchase/returns',
    loadComponent: () => import('./Component/purchase/purchase-return/purchase-return.component').then(m => m.PurchaseReturnComponent),
    canActivate: [authGuard] },
  { path: 'purchase/reports',
    loadComponent: () => import('./Component/purchase/purchase-reports/purchase-reports.component').then(m => m.PurchaseReportsComponent),
    canActivate: [authGuard] },

  // ── NEW: Sales Reports page ────────────────────────────────────────────
  { path: 'sales-reports',
    loadComponent: () => import('./Component/sales-reports/sales-reports.component').then(m => m.SalesReportsComponent),
    canActivate: [authGuard] },

  // ── NEW: Sales Returns page ─────────────────────────────────────────────
  { path: 'sales-returns',
    loadComponent: () => import('./Component/sales-returns/sales-returns.component').then(m => m.SalesReturnsComponent),
    canActivate: [authGuard] },

  { path: '**', redirectTo: '' }
];
