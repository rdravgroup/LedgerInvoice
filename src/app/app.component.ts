import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AuthPinDialogComponent } from './Component/auth-pin-dialog/auth-pin-dialog.component';
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
export class AppComponent implements OnInit {
  title = 'store-app';

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private toastr: ToastrService
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
  }
  ngOnInit(): void {
    this.tryRememberedLogin();
  }

  private tryRememberedLogin(): void {
    if (this.authService.getAuthStatus() || localStorage.getItem('token')) {
      return;
    }

    this.authService.checkRememberedSession().subscribe({
      next: session => {
        if (!session?.rememberedSession || !session.pinRequired) {
          return;
        }

        const dialogRef = this.dialog.open(AuthPinDialogComponent, {
          disableClose: true,
          panelClass: 'auth-pin-dialog-panel',
          data: { mode: 'validate', username: session.username }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (!result?.pin) {
            this.authService.clearLocalSession(false);
            return;
          }

          this.authService.validateRememberedPin(result.pin).subscribe({
            next: () => {
              this.toastr.success('Session restored', 'Welcome back');
              this.router.navigateByUrl('/');
            },
            error: error => {
              this.authService.clearLocalSession(false);
              this.toastr.error(error?.error?.errorMessage || 'PIN validation failed. Please login with password.', 'Access PIN');
              this.router.navigateByUrl('/login');
            }
          });
        });
      },
      error: () => {}
    });
  }
}


