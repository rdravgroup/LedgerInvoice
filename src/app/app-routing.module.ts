import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OauthLoginComponent } from './Component/oauth-login/oauth-login.component';

const routes: Routes = [
  { path: 'oauth-login', component: OauthLoginComponent },
  { path: 'admin/gateways', loadComponent: () => import('./Component/payment-admin/payment-gateway-admin.component').then(m => m.PaymentGatewayAdminComponent) },
  // ... other routes can be added here
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }