import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import {
  FormArray, FormBuilder, FormControl, FormGroup,
  ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../_service/user.service';
import { MenuPermission, Menus, Roles, TblRolePermission } from '../../_model/user.model';

/** Icon map for known menu codes */
const MENU_ICONS: Record<string, string> = {
  customer:              'people',
  product:               'inventory_2',
  category:              'category',
  listinvoice:           'receipt_long',
  createinvoice:         'add_circle_outline',
  'quick-invoice':       'calculate',
  'ledger-dashboard':    'account_balance_wallet',
  'ledger-outstanding-ar': 'trending_up',
  'ledger-maintenance':  'build_circle',
  user:                  'manage_accounts',
  userrole:              'admin_panel_settings',
  profile:               'account_circle',
  home:                  'home',
};

@Component({
  selector: 'app-userrole',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './userrole.component.html',
  styleUrls: ['./userrole.component.css'],
})
export class UserroleComponent implements OnInit {
  rolelist: Roles[] = [];
  menulist: Menus[] = [];
  _response: any;
  loadingPerms = false;
  saving = false;

  /** Separate FormControl for the role selector so we don't need the full roleform.get('userrole') */
  roleSelectControl = new FormControl('');

  roleform: FormGroup;

  constructor(
    private builder: FormBuilder,
    private toastr: ToastrService,
    private service: UserService
  ) {
    this.roleform = this.builder.group({
      userrole: this.builder.control('', Validators.required),
      access:   this.builder.array([]),
    });
  }

  ngOnInit(): void {
    this.loadroles();
    this.loadmenus('');
  }

  /** Returns mat-icon name for a menucode */
  getMenuIcon(menucode: string): string {
    return MENU_ICONS[menucode] || 'folder_open';
  }

  get getrows(): FormArray {
    return this.roleform.get('access') as FormArray;
  }

  Generatemenurow(input: Menus, _access: MenuPermission, role: string): FormGroup {
    return this.builder.group({
      menucode:   this.builder.control(input.code),
      menuname:   this.builder.control(input.name || input.code),
      haveview:   this.builder.control(_access.haveview),
      haveadd:    this.builder.control(_access.haveadd),
      haveedit:   this.builder.control(_access.haveedit),
      havedelete: this.builder.control(_access.havedelete),
      userrole:   this.builder.control(role),
    });
  }

  Addnewrow(input: Menus, _access: MenuPermission, role: string): void {
    this.getrows.push(this.Generatemenurow(input, _access, role));
  }

  loadroles(): void {
    this.service.getRoles().subscribe({
      next: (items) => { this.rolelist = items; },
      error: () => { this.toastr.error('Failed to load roles', 'Error'); }
    });
  }

  loadmenus(selectedrole: string): void {
    this.service.getMenus().subscribe({
      next: (items) => {
        this.menulist = items;
        if (selectedrole) {
          this.loadRolePermissions(selectedrole);
        }
      },
      error: () => { this.toastr.error('Failed to load menus', 'Error'); }
    });
  }

  private loadRolePermissions(role: string): void {
    this.loadingPerms = true;
    this.getrows.clear();

    // Fetch permissions for each menu individually
    let permissionsLoaded = 0;
    const permissionMap = new Map<string, MenuPermission>();

    this.menulist.forEach(menu => {
      this.service.getMenuPermission(role, menu.code).subscribe({
        next: (perm) => {
          permissionMap.set(menu.code, perm);
          permissionsLoaded++;
          if (permissionsLoaded === this.menulist.length) {
            this.buildPermissionRows(role, permissionMap);
          }
        },
        error: () => {
          // Fallback: no permission found for this menu
          permissionMap.set(menu.code, {
            code: '', name: '', menucode: menu.code, userrole: role,
            haveview: false, haveadd: false, haveedit: false, havedelete: false
          });
          permissionsLoaded++;
          if (permissionsLoaded === this.menulist.length) {
            this.buildPermissionRows(role, permissionMap);
          }
        }
      });
    });
  }

  private buildPermissionRows(role: string, permissionMap: Map<string, MenuPermission>): void {
    this.menulist.forEach(menu => {
      const perm = permissionMap.get(menu.code) || {
        code: '', name: '', menucode: menu.code, userrole: role,
        haveview: false, haveadd: false, haveedit: false, havedelete: false
      };
      this.Addnewrow(menu, perm, role);
    });
    this.loadingPerms = false;
  }

  rolechange(event: any): void {
    const selectedRole = event.value;
    this.roleform.patchValue({ userrole: selectedRole });
    if (this.menulist.length > 0) {
      this.loadRolePermissions(selectedRole);
    } else {
      this.loadmenus(selectedRole);
    }
  }

  Saveroles(): void {
    if (this.roleform.invalid) {
      this.toastr.error('Please select a role first', 'Validation Error');
      return;
    }

    this.saving = true;
    const accessArray: TblRolePermission[] = this.getrows.value.map((row: any) => ({
      id:         0,
      userrole:   row.userrole,
      menucode:   row.menucode,
      haveview:   row.haveview,
      haveadd:    row.haveadd,
      haveedit:   row.haveedit,
      havedelete: row.havedelete,
    }));

    this.service.assignRolePermission(accessArray).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success('Permissions saved successfully', 'Success');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to save permissions', 'Error');
      }
    });
  }
}
