import { Component, DoCheck, OnInit, effect, signal, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { Menu } from '../../_model/user.model';
import { Company } from '../../_model/company.model';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../_service/authentication.service';
import { MatDrawer } from '@angular/material/sidenav';

// Generic API response wrapper
interface ApiResponse<T> {
  responseCode: number;
  result: string;
  errorMessage: string;
  data: T;
}

@Component({
  selector: 'app-appmenu',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterOutlet, RouterLink],
  templateUrl: './appmenu.component.html',
  styleUrls: ['./appmenu.component.css'],
})
export class AppmenuComponent implements OnInit, DoCheck {
  @ViewChild('drawer') drawer!: MatDrawer;
  menulist = signal<Menu[]>([]);
  Loginuser = '';
  companyName = '';
  showmenu = false;
  isSuperAdmin = false;
  headerHasPassword = false;
  headerUserEmail = '';

  isHandset$: Observable<boolean>;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private service: UserService,
    public router: Router,
    private authService: AuthService
  ) {
    this.isHandset$ = this.breakpointObserver.observe(Breakpoints.Handset)
      .pipe(
        map(result => result.matches),
        shareReplay()
      );

    // React to authentication state changes
    effect(() => {
      const isAuth = this.authService.isAuthenticated$();
      if (isAuth) {
        this.loadMenuItems();
        this.loadCompanyDetails();
        this.loadHeaderPasswordState();
      } else {
        this.menulist.set([]);
        this.companyName = '';
      }
    });

    // Refresh header password state on navigation end to pick up changes
    this.router.events.subscribe(evt => {
      if (evt instanceof NavigationEnd) {
        if (this.authService.getAuthStatus()) {
          this.loadHeaderPasswordState();
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.authService.getAuthStatus()) {
      this.loadMenuItems();
      this.loadCompanyDetails();
      this.loadHeaderPasswordState();
    }
  }

  private loadHeaderPasswordState(): void {
    const username = this.authService.getUsername() || localStorage.getItem('username') || '';
    this.headerUserEmail = username;
    if (!username) {
      this.headerHasPassword = false;
      return;
    }
    this.service.getUserByCode(username).subscribe({
      next: (u: any) => {
        // detect if password created; treat EMAIL_AUTH_ONLY as no password
        const detectPasswordCreated = (obj: any): boolean => {
          if (!obj) return false;
          const keys = ['hasPassword', 'isPasswordCreated', 'passwordCreated', 'isPasswordSet', 'haspassword'];
          for (const k of keys) {
            if (obj[k] === true) return true;
            if (typeof obj[k] === 'string' && obj[k].toLowerCase() === 'true') return true;
          }
          if (obj.password && typeof obj.password === 'string' && obj.password.length > 0) {
            const pw = obj.password.toString().trim();
            if (pw.length === 0) return false;
            if (pw.toUpperCase() === 'EMAIL_AUTH_ONLY') return false;
            return true;
          }
          return false;
        };
        this.headerHasPassword = detectPasswordCreated(u);
      },
      error: () => {
        this.headerHasPassword = false;
      }
    });
  }

  private loadMenuItems(): void {
    const userrole = this.authService.getUserRole();
    if (userrole) {
      this.service.loadMenuByRole(userrole).subscribe({
        next: (item) => {
          this.menulist.set(item);
        },
        error: () => {
          this.menulist.set([]);
        }
      });
    }
  }

  private loadCompanyDetails(): void {
    const companyId = this.authService.getCompanyId();
    if (companyId) {
      this.service.getCompanyById(companyId).subscribe({
        next: (company: Company) => {
          console.log('AppmenuComponent: Company details loaded:', company);
          this.companyName = company.name || companyId;
        },
        error: (error) => {
          console.error('AppmenuComponent: Failed to load company details:', error);
          this.companyName = companyId;
        }
      });
    }
  }

  ngDoCheck(): void {
    this.Loginuser = this.authService.getUsername() || '';
    let userrole = this.authService.getUserRole() || '';
    this.isSuperAdmin = userrole.toLowerCase() === 'super_admin' || userrole.toLowerCase() === 'superadmin';
    this.Setaccess();
  }

  Setaccess() {
    let currentUrl = this.router.url;
    if (
      currentUrl === '/register' ||
      currentUrl === '/login' ||
      currentUrl === '/resetpassword' ||
      currentUrl === '/forgetpassword'
    ) {
      this.showmenu = false;
    } else {
      this.showmenu = this.authService.getAuthStatus();
    }
  }

  toggleDrawer() {
    this.drawer.toggle();
  }

  closeDrawerOnItemClick() {
    if (this.drawer.mode === 'over') {
      this.drawer.close();
    }
  }

  /**
   * Map menu code to actual route path
   * Routes match menu codes directly: ledger-dashboard, ledger-outstanding-ar, ledger-maintenance
   */
  getMenuRoute(menuCode: string): string {
    return `/${menuCode}`;
  }
}