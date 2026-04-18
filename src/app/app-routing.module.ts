import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OauthLoginComponent } from './Component/oauth-login/oauth-login.component';

const routes: Routes = [
  { path: 'oauth-login', component: OauthLoginComponent },
  // ... other routes can be added here
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }