// src/app/Component/userrole/userrole.component.ts
// CHANGED:
//  - loadRolePermissions now calls getAllPermissionsByRole() — ONE API call (not N)
//  - Permissions grouped by parentcode for UI section headers
//  - Added parentGroups: { parent: MenuNode, children: FormGroup[] }[]
//  - Save logic unchanged — still posts flat TblRolePermission[]
//  - All existing form structure (FormArray, Saveroles) preserved

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import {
  FormArray, FormBuilder, FormControl, FormGroup,
  ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../_service/user.service';
import {
  MenuPermission, MenuPermissionBatch, MenuNode,
  Menus, Roles, TblRolePermission
} from '../../_model/user.model';

export interface PermGroup {
  parentCode:  string;
  parentName:  string;
  parentIcon:  string;
  indices:     number[];        // indices into getrows FormArray (children only)
  parentIndex: number | null;   // index of the parent menu's OWN row in getrows (if it exists)
}

@Component({
  selector: 'app-userrole',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './userrole.component.html',
  styleUrls: ['./userrole.component.css'],
})
export class UserroleComponent implements OnInit {
  rolelist:    Roles[] = [];
  loadingPerms = false;
  saving       = false;

  // Groups for display — each group = one parent menu section
  permGroups:  PermGroup[] = [];
  // Indices of rows that have no parent (shown at bottom)
  ungroupedIndices: number[] = [];

  roleSelectControl = new FormControl('');

  roleform: FormGroup;

  constructor(
    private builder: FormBuilder,
    private toastr:  ToastrService,
    private service: UserService
  ) {
    this.roleform = this.builder.group({
      userrole: this.builder.control('', Validators.required),
      access:   this.builder.array([]),
    });
  }

  ngOnInit(): void {
    this.loadroles();
  }

  get getrows(): FormArray {
    return this.roleform.get('access') as FormArray;
  }

  loadroles(): void {
    this.service.getRoles().subscribe({
      next:  items => { this.rolelist = items; },
      error: ()    => { this.toastr.error('Failed to load roles', 'Error'); }
    });
  }

  rolechange(event: any): void {
    const role = event.value;
    this.roleform.patchValue({ userrole: role });
    this.loadRolePermissions(role);
  }

  // ── FIXED: single API call instead of N+1 ─────────────────────────────
  private loadRolePermissions(role: string): void {
    this.loadingPerms = true;
    this.getrows.clear();
    this.permGroups       = [];
    this.ungroupedIndices = [];

    this.service.getAllPermissionsByRole(role).subscribe({
      next: (batch: MenuPermissionBatch) => {
        const perms = batch.permissions || [];

        // Build FormArray rows
        perms.forEach(p => {
          this.getrows.push(this.builder.group({
            menucode:    this.builder.control(p.menucode),
            menuname:    this.builder.control(p.menuname || p.menucode),
            menuIcon:    this.builder.control(p.menuIcon || 'folder_open'),
            parentcode:  this.builder.control(p.parentcode || ''),
            haveview:    this.builder.control(p.haveview),
            haveadd:     this.builder.control(p.haveadd),
            haveedit:    this.builder.control(p.haveedit),
            havedelete:  this.builder.control(p.havedelete),
            userrole:    this.builder.control(role),
          }));
        });

        // Build parent group metadata
        this.buildGroups(perms);
        this.loadingPerms = false;
      },
      error: () => {
        this.toastr.error('Failed to load permissions', 'Error');
        this.loadingPerms = false;
      }
    });
  }

  private buildGroups(perms: MenuPermission[]): void {
    // Collect unique parents in order
    const parentMap = new Map<string, { name: string; icon: string }>();

    perms.forEach(p => {
      if (p.parentcode) {
        if (!parentMap.has(p.parentcode)) {
          // Derive parent name from parentcode — backend sends parentcode only
          // We capitalise it as a fallback; real name comes from parent rows in the list
          const parentRow = perms.find(x => x.menucode === p.parentcode);
          parentMap.set(p.parentcode, {
            name: parentRow?.menuname || this.titleCase(p.parentcode),
            icon: parentRow?.menuIcon || 'folder'
          });
        }
      }
    });

    // Build groups
    const groups: PermGroup[] = [];
    parentMap.forEach((meta, parentCode) => {
      const indices = perms
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.parentcode === parentCode && p.menucode !== parentCode)
        .map(({ i }) => i);
      // FIX: locate the parent menu's own row (e.g. menucode === 'purchase') so its
      // haveview flag can be kept in sync with the group's children. Without this,
      // the parent's tbl_rolepermission row never gets haveview=true through this
      // screen, and the sidebar's GetMenuTree only shows the group automatically if
      // a separate DB fallback finds the tbl_menu row — which is not guaranteed.
      const parentRowIndex = perms.findIndex(p => p.menucode === parentCode);
      const parentIndex = parentRowIndex >= 0 ? parentRowIndex : null;
      if (indices.length > 0) {
        groups.push({
          parentCode,
          parentName: meta.name,
          parentIcon: meta.icon,
          indices,
          parentIndex
        });
      }
    });
    this.permGroups = groups;

    // Ungrouped = no parentcode AND not a parent themselves
    const groupedIndices = new Set(groups.flatMap(g => g.indices));
    const parentCodes    = new Set(parentMap.keys());
    this.ungroupedIndices = perms
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !groupedIndices.has(i) && !parentCodes.has(p.menucode))
      .map(({ i }) => i);
  }

  private titleCase(s: string): string {
    return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Collapsed state per group
  collapsedGroups = new Set<string>();
  toggleGroup(code: string): void {
    if (this.collapsedGroups.has(code)) this.collapsedGroups.delete(code);
    else this.collapsedGroups.add(code);
  }
  isGroupCollapsed(code: string): boolean {
    return this.collapsedGroups.has(code);
  }

  // Select/deselect all in a group.
  // FIX: for the 'haveview' field specifically, also keep the parent menu's OWN
  // row in sync. The sidebar (GetMenuTree) only shows a parent group automatically
  // when its tbl_menu row exists AND status=1 — if that lookup ever misses (row
  // missing, status null, etc.) the group simply won't render at all unless its
  // own haveview permission is also true. Setting it here removes that
  // dependency entirely so "View All" on a group reliably makes the whole
  // group (header + children) appear in the sidebar.
  toggleGroupAll(group: PermGroup, field: 'haveview'|'haveadd'|'haveedit'|'havedelete'): void {
    // FIX: "allOn" must use the exact same definition as groupAllChecked(), or the
    // checkbox's visual state and its click behavior disagree. Specifically: for
    // 'haveview', the group only counts as "fully on" once the parent's own row
    // is ALSO true — otherwise an indeterminate checkbox (children on, parent off)
    // would turn everything OFF on click instead of finishing the job and turning
    // the parent on too.
    const childrenAllOn = group.indices.every(i => this.getrows.at(i).get(field)?.value);
    const parentAlsoOn  = field !== 'haveview' || group.parentIndex === null
      ? true
      : !!this.getrows.at(group.parentIndex).get('haveview')?.value;
    const allOn = childrenAllOn && parentAlsoOn;
    const turningOn = !allOn;
    group.indices.forEach(i => this.getrows.at(i).get(field)?.setValue(turningOn));

    if (field === 'haveview' && group.parentIndex !== null) {
      // Turning view ON for the group -> parent must also be viewable, or the
      // sidebar tree-builder has no row to attach the children to.
      // Turning view OFF -> also turn the parent off, since a parent with no
      // visible children serves no purpose in the sidebar.
      this.getrows.at(group.parentIndex).get('haveview')?.setValue(turningOn);
    }
  }

  groupAllChecked(group: PermGroup, field: string): boolean {
    const childrenAllOn = group.indices.every(i => this.getrows.at(i).get(field)?.value);
    if (field !== 'haveview' || group.parentIndex === null) return childrenAllOn;
    // FIX: for 'haveview', "fully checked" must also mean the parent's own row
    // is haveview=true — otherwise the checkbox would show as fully ticked
    // while the parent (and therefore the whole sidebar group) is still
    // effectively hidden until Save's safety-net pass runs.
    const parentOn = !!this.getrows.at(group.parentIndex).get('haveview')?.value;
    return childrenAllOn && parentOn;
  }

  groupSomeChecked(group: PermGroup, field: string): boolean {
    const vals = group.indices.map(i => !!this.getrows.at(i).get(field)?.value);
    let someOn = vals.some(Boolean);
    let allOn  = vals.every(Boolean);
    if (field === 'haveview' && group.parentIndex !== null) {
      const parentOn = !!this.getrows.at(group.parentIndex).get('haveview')?.value;
      // If children are all on but parent isn't yet, that's a partial/indeterminate
      // state worth surfacing rather than silently showing as fully checked.
      someOn = someOn || parentOn;
      allOn  = allOn && parentOn;
    }
    return someOn && !allOn;
  }

  // Save — identical logic to original, plus a safety-net sync step.
  Saveroles(): void {
    if (this.roleform.invalid) {
      this.toastr.error('Please select a role first', 'Validation Error');
      return;
    }

    // SAFETY NET: an admin may tick individual child "View" boxes directly
    // (instead of using the group "All" toggle). Make sure each group's
    // parent row haveview reflects "at least one visible child" right before
    // saving, so the sidebar group always appears whenever any of its pages
    // are viewable — regardless of which checkbox the admin actually used.
    this.permGroups.forEach(group => {
      if (group.parentIndex === null) return;
      const anyChildVisible = group.indices.some(i => !!this.getrows.at(i).get('haveview')?.value);
      const parentCtrl = this.getrows.at(group.parentIndex).get('haveview');
      if (anyChildVisible && !parentCtrl?.value) {
        parentCtrl?.setValue(true);
      }
    });

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
