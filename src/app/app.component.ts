import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from './_service/authentication.service';
import { AppmenuComponent } from './Component/appmenu/appmenu.component';
import { LoadingOverlayComponent } from './Component/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, AppmenuComponent, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'store-app';

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private authService: AuthService
  ) {
    this.matIconRegistry.addSvgIcon(
      'facebook',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/svg/facebook.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'instagram',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/svg/instagram.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'whatsapp',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/svg/whatsapp.svg')
    );

    // If the initial route is a login/auth route, clear any stale auth state
    // immediately so child components do not make protected API calls with
    // invalid tokens and produce 401 popups during app startup.
    try {
      const current = this.router.url || '';
      const authRoutes = ['/login', '/oauth-login', '/confirmotp', '/register', '/resetpassword', '/forgetpassword'];
      if (authRoutes.some(r => current.startsWith(r))) {
        this.authService.logout();
      }
    } catch { /* ignore during server-side rendering or early bootstrap */ }
  }
}
