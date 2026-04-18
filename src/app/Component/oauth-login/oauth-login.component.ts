import { Component } from '@angular/core';
// import { GoogleAuthService } from '../services/google-auth.service';

@Component({
  selector: 'app-oauth-login',
  templateUrl: './oauth-login.component.html',
  styleUrls: []
})
export class OauthLoginComponent {
  errorMsg: string = '';

  // constructor(private googleAuth: GoogleAuthService) {}
  constructor() {}

  loginWithGoogle(): void {
    // this.googleAuth.initiateOAuth();
    // OAuth implementation pending
  }
}