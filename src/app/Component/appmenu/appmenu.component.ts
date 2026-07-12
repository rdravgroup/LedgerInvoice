// src/app/Component/appmenu/appmenu.component.ts
// CHANGED:
//  - loadMenuItems() now calls getMenuTree() → builds parent/child tree
//  - menulist signal changed from Menu[] to MenuNode[]
//  - Added toggleGroup(), isGroupExpanded(), isRouteActive() helpers
//  - Added activeGroup tracking for auto-expand on route change
//  - All auth, company-select, role-flag, sidebar-toggle logic IDENTICAL to original

import { Component, OnInit, OnDestroy, effect, signal, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { MenuNode } from '../../_model/user.model';
import { Company } from '../../_model/company.model';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MatDrawer } from '@angular/material/sidenav';
import { MatSelect } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { AiChatComponent } from '../ai-chat/ai-chat.component';

function resolveRole(raw: string): 'super_duper_admin' | 'super_admin' | 'other' {
  const r = (raw || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'super_duper_admin' || r === 'superduper') return 'super_duper_admin';
  if (r === 'super_admin'       || r === 'superadmin') return 'super_admin';
  return 'other';
}

@Component({
  selector: 'app-appmenu',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterOutlet, RouterLink],
  templateUrl: './appmenu.component.html',
  styleUrls: ['./appmenu.component.css'],
})
export class AppmenuComponent implements OnInit, OnDestroy {
  @ViewChild('drawer')        drawer!: MatDrawer;
  @ViewChild('companySelect') companySelect?: MatSelect;

  // ── CHANGED: MenuNode[] (parent/child tree) instead of flat Menu[] ─────────
  menulist = signal<MenuNode[]>([]);

  Loginuser    = '';
  companyName  = '';
  showmenu     = false;

  isSuperAdmin      = false;
  isSuperDuperAdmin = false;

  headerHasPassword  = false;
  headerUserEmail    = '';
  activeCompanies: Company[] = [];
  selectedCompanyId: string | null = null;

  private loadedActiveCompanies = false;
  private destroy$ = new Subject<void>();

  isHandset$: Observable<boolean>;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private service: UserService,
    public  router: Router,
    private authService: AuthService,
    private selectedCompanyService: SelectedCompanyService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {
    this.isHandset$ = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
      map(r => r.matches),
      shareReplay()
    );

    // ── Role changes (identical to original) ────────────────────────────────
    this.authService.userRole$.pipe(takeUntil(this.destroy$)).subscribe(raw => {
      const role = resolveRole(raw || '');
      this.isSuperAdmin      = role === 'super_admin';
      this.isSuperDuperAdmin = role === 'super_duper_admin';
      this.Loginuser = this.authService.getUsername() || '';
      this.Setaccess();
    });

    // ── Auth state changes (identical to original) ───────────────────────────
    effect(() => {
      const isAuth = this.authService.isAuthenticated$();
      if (isAuth) {
        this.loadMenuItems();
        this.loadCompanyDetails();
        this.loadHeaderPasswordState();
        this.loadActiveCompanies();
        this.Loginuser = this.authService.getUsername() || '';
      } else {
        this.menulist.set([]);
        this.companyName       = '';
        this.Loginuser         = '';
        this.isSuperAdmin      = false;
        this.isSuperDuperAdmin = false;
        this.loadedActiveCompanies = false;
        this.activeCompanies   = [];
      }
    });

    // ── Company selection changes (identical to original) ────────────────────
    this.selectedCompanyService.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: string | null) => {
        this.selectedCompanyId = id;
        this.loadCompanyDetails();
      });

    // ── Route changes — auto-expand active group (NEW logic) ─────────────────
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(evt => {
      if (evt instanceof NavigationEnd) {
        this.Setaccess();
        this.autoExpandActiveGroup(evt.urlAfterRedirects);
        if (this.authService.getAuthStatus()) {
          this.loadHeaderPasswordState();
          this.Loginuser = this.authService.getUsername() || '';
        }
      }
    });
  }

  ngOnInit(): void {
    const rawRole = this.authService.getUserRole() || '';
    const role    = resolveRole(rawRole);
    this.isSuperAdmin      = role === 'super_admin';
    this.isSuperDuperAdmin = role === 'super_duper_admin';
    this.Loginuser = this.authService.getUsername() || '';
    this.Setaccess();

    if (this.authService.getAuthStatus()) {
      this.loadMenuItems();
      this.loadCompanyDetails();
      this.loadHeaderPasswordState();
      this.loadActiveCompanies();
    }
  }

  ngOnDestroy(): void {
    try { this.destroy$.next(); this.destroy$.complete(); } catch { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: loadMenuItems uses getMenuTree → parent/child structure
  // FALLBACK: if getMenuTree fails (backend not updated yet), falls back to
  //           loadMenuByRole and wraps items in a flat tree with no parents
  // ═══════════════════════════════════════════════════════════════════════════
  private loadMenuItems(): void {
    const userrole = this.authService.getUserRole();
    if (!userrole) return;

    this.service.getMenuTree(userrole).pipe(takeUntil(this.destroy$)).subscribe({
      next: (resp: any) => {
        // Backend returns: { role: string, tree: MenuNode[] }
        const tree: MenuNode[] = resp?.tree || resp || [];
        // DIAGNOSTIC: log to confirm the API is returning a nested tree.
        // If "Root nodes WITH children" is 0, the tree is genuinely flat from
        // the backend (check tbl_menu.parentcode values and UserRoleService).
        const withChildren = tree.filter(n => (n.children?.length ?? 0) > 0).length;
        console.log(`[menu] GetMenuTree OK — roots: ${tree.length}, roots with children: ${withChildren}`);
        if (tree.length > 0 && withChildren === 0) {
          console.warn('[menu] Tree is flat — every root node has 0 children. ' +
            'Check tbl_menu.parentcode vs code casing/whitespace (run menu_casing_diagnostic.sql).');
        }
        // Auto-expand the group that contains the active route
        this.autoExpandActiveGroup(this.router.url, tree);
        this.menulist.set(tree);
      },
      error: (err: any) => {
        // Log the real HTTP error so it's visible in DevTools instead of
        // silently disappearing into the flat fallback.
        console.error(`[menu] GetMenuTree FAILED (status ${err?.status}) — falling back to flat menu.`, err);
        // Fallback: old flat menu endpoint
        this.service.loadMenuByRole(userrole).pipe(takeUntil(this.destroy$)).subscribe({
          next: items => {
            // Wrap flat items as tree — no parent grouping (old behaviour)
            const flat: MenuNode[] = (items || []).map(i => ({
              code:     i.menucode,
              name:     i.menuname,
              menuIcon: i.menuIcon,
              parentcode: i.parentcode,
              haveview: true,
              children: []
            }));
            this.menulist.set(flat);
          },
          error: () => this.menulist.set([])
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: toggle collapse/expand of a parent group
  // ═══════════════════════════════════════════════════════════════════════════
  toggleGroup(node: MenuNode): void {
    node.expanded = !node.expanded;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: returns true if a route is currently active (for highlighting)
  // ═══════════════════════════════════════════════════════════════════════════
  isRouteActive(code: string): boolean {
    const route = this.getMenuRoute(code);
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: auto-expands the parent group containing the active route on navigation
  // ═══════════════════════════════════════════════════════════════════════════
  private autoExpandActiveGroup(url: string, tree?: MenuNode[]): void {
    const nodes = tree ?? this.menulist();
    let changed = false;
    for (const parent of nodes) {
      if (parent.children && parent.children.length > 0) {
        const hasActiveChild = parent.children.some(child => {
          const route = this.getMenuRoute(child.code);
          return url === route || url.startsWith(route + '/');
        });
        if (hasActiveChild && !parent.expanded) {
          parent.expanded = true;
          changed = true;
        }
      }
    }
    // Always notify the signal with a fresh array reference when anything
    // changed (or when this is the initial load, which always needs to
    // render the tree for the first time regardless of 'changed'). Mutating
    // node.expanded in place is NOT enough on its own — Angular signals only
    // trigger change detection on .set()/.update(), not on mutating a
    // property of an object already inside the signal's current value. The
    // previous version only called .set() when 'tree' was explicitly passed
    // in (i.e. only on the very first load), so auto-expanding the active
    // group silently stopped working on every subsequent route navigation.
    if (tree || changed) this.menulist.set([...nodes]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Returns true when any child of a group node matches the current route.
  // Used to keep the group header highlighted when it's collapsed but the
  // current page lives inside it. Extracted from the template because Angular
  // does not allow arrow functions (=>) inside binding expressions (NG5002).
  hasActiveChild(node: MenuNode): boolean {
    return (node.children ?? []).some(c => this.isRouteActive(c.code));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // getMenuRoute — IDENTICAL to original
  // ═══════════════════════════════════════════════════════════════════════════
  getMenuRoute(menuCode: string): string {
    return this.getMenuRouteNormalized(menuCode);
  }

  getMenuRouteNormalized(menuCode: string): string {
    if (!menuCode) return '/';
    try {
      let code = String(menuCode || '');
      if (code.includes('/')) return `/${code.replace(/^\//, '')}`;
      if (code.startsWith('purchase')) {
        const normalized = code.replace(/^purchase[._-]?/, 'purchase/');
        return `/${normalized}`;
      }
      if (code.startsWith('sales-')) return `/${code}`;
      return `/${code}`;
    } catch {
      return `/${menuCode}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // All methods below are IDENTICAL to original
  // ═══════════════════════════════════════════════════════════════════════════

  private isAuthenticated(): boolean {
    return this.authService.getAuthStatus() && !!this.authService.getToken();
  }

  private loadHeaderPasswordState(): void {
    const username = this.authService.getUsername() || localStorage.getItem('username') || '';
    this.headerUserEmail = username;
    if (!username || !this.isAuthenticated()) { this.headerHasPassword = false; return; }
    this.service.getUserByCode(username).pipe(takeUntil(this.destroy$)).subscribe({
      next: (u: any) => {
        const detect = (obj: any): boolean => {
          if (!obj) return false;
          for (const k of ['hasPassword','isPasswordCreated','passwordCreated','isPasswordSet','haspassword']) {
            if (obj[k] === true) return true;
            if (typeof obj[k] === 'string' && obj[k].toLowerCase() === 'true') return true;
          }
          if (obj.password && typeof obj.password === 'string') {
            const pw = obj.password.trim().toUpperCase();
            return pw.length > 0 && pw !== 'EMAIL_AUTH_ONLY';
          }
          return false;
        };
        this.headerHasPassword = detect(u);
      },
      error: () => { this.headerHasPassword = false; }
    });
  }

  private loadCompanyDetails(): void {
    if (!this.isAuthenticated()) { this.companyName = ''; return; }
    const effectiveId = this.selectedCompanyId || this.authService.getCompanyId();
    if (!effectiveId) { this.companyName = ''; return; }
    this.service.getCompanyById(effectiveId).pipe(takeUntil(this.destroy$)).subscribe({
      next:  (c: Company) => { this.companyName = c.name || effectiveId; },
      error: ()           => { this.companyName = effectiveId; }
    });
  }

  private loadActiveCompanies(): void {
    if (this.loadedActiveCompanies || !this.isAuthenticated()) return;
    this.service.getActiveCompanies().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list: Company[]) => {
        this.activeCompanies = list || [];
        this.loadedActiveCompanies = true;
        const currentSel = this.selectedCompanyService.getSelectedCompanyId();
        if (!this.isSuperAdmin && !this.isSuperDuperAdmin && !currentSel) {
          const tokenCid = this.authService.getCompanyId();
          if (tokenCid) {
            this.selectedCompanyService.setSelectedCompanyId(tokenCid);
            const found = this.activeCompanies.find(c => c.companyId === tokenCid);
            this.toastr.success(`Company: ${found?.name || tokenCid}`, 'Ready');
          }
          return;
        }
        if (this.isSuperAdmin && !currentSel) {
          if (this.activeCompanies.length === 1) {
            const only = this.activeCompanies[0];
            if (only?.companyId) {
              this.selectedCompanyService.setSelectedCompanyId(only.companyId);
              this.toastr.success(`Acting as: ${only.name || only.companyId}`, 'Company');
              this.persistCompanySelection(only.companyId, only.name || only.companyId);
            }
          } else {
            setTimeout(() => { try { this.companySelect?.open(); } catch { /* ignore */ } }, 300);
          }
        }
      },
      error: () => { this.activeCompanies = []; }
    });
  }

  onCompanySelect(companyId: string | null): void {
    this.selectedCompanyService.setSelectedCompanyId(companyId);
    const found = this.activeCompanies.find(c => c.companyId === companyId);
    const name  = found?.name || companyId || 'company';
    if (this.isSuperAdmin) { this.toastr.info(`Now acting as: ${name}`, 'Company switched'); }
    else                   { this.toastr.success(`Company: ${name}`, 'Selected'); }
    if (companyId && this.isAuthenticated()) this.persistCompanySelection(companyId, name);
  }

  private persistCompanySelection(companyId: string, name: string): void {
    this.service.mapCompanyCode({ companyId, username: '' }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { /* silently saved */ },
      error: () => this.toastr.warning(`Selection saved locally only (${name})`, 'Company')
    });
  }

  Setaccess(): void {
    const url = this.router.url;
    const publicRoutes = ['/register','/login','/resetpassword','/forgetpassword'];
    this.showmenu = publicRoutes.includes(url) ? false : this.authService.getAuthStatus();
  }

  openAiChatDialog(): void {
    this.dialog.open(AiChatComponent, {
      width: 'min(760px, calc(100vw - 32px))',
      height: 'min(760px, calc(100vh - 32px))',
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'ai-chat-dialog-panel',
      autoFocus: false,
      restoreFocus: false,
      disableClose: true
    });
  }

  toggleDrawer():          void { this.drawer.toggle(); }
  closeDrawerOnItemClick(): void { if (this.drawer.mode === 'over') this.drawer.close(); }
  onMenuClick(item: MenuNode): void { /* kept for template compatibility */ }
}



