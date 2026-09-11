import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';
import { CreateManagedUserRequest, UpdateManagedUserRequest, UserDetailed, Roles } from '../../_model/user.model';
import { CompanyService } from '../../_service/company.service';
import { Company } from '../../_model/company.model';

@Component({
  selector: 'app-create-managed-user-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <div class="cmu-head">
      <div><h2 mat-dialog-title>{{ data.user ? 'Edit User' : 'Add User' }}</h2><p>{{ data.user ? 'Update the user profile and access assignment.' : 'A secure temporary password will be emailed to the user.' }}</p></div>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content>
      <form [formGroup]="form" class="cmu-form">
        <mat-form-field appearance="outline"><mat-label>Full name</mat-label><input matInput formControlName="name" autocomplete="name"><mat-error>Name is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Email / login email</mat-label><input matInput type="email" formControlName="email" autocomplete="email" [readonly]="!!data.user"><mat-hint *ngIf="data.user">Email is the login identifier and cannot be changed here.</mat-hint><mat-error>Valid email is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline" *ngIf="data?.user"><mat-label>Username</mat-label><input matInput formControlName="newUsername" autocomplete="username"><mat-error>Username is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput formControlName="phone" inputmode="tel"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Company</mat-label><mat-select formControlName="companyId"><mat-option [value]="''">No company</mat-option><mat-option *ngFor="let company of companies" [value]="company.companyId">{{ company.name }} ({{ company.companyId }})</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline" class="cmu-wide"><mat-label>Role</mat-label><mat-select formControlName="role"><mat-option *ngFor="let role of roles" [value]="role.code">{{ role.displayName || role.name || role.code }}</mat-option></mat-select></mat-form-field>
        <mat-checkbox *ngIf="data?.user" formControlName="isActive" class="cmu-wide">Active user</mat-checkbox>
      </form>
      <p class="cmu-note" *ngIf="!data?.user"><mat-icon>lock_reset</mat-icon> The user will be required to change the generated password after the first login.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid || saving"><mat-icon>person_add</mat-icon>{{ saving ? 'Creating...' : 'Create User' }}</button></mat-dialog-actions>
  `,
  styles: [`
    :host{display:block}.cmu-head{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px 4px}h2{margin:0;font-size:22px;font-weight:700}.cmu-head p{margin:5px 0 0;color:#64748b;font-size:13px}mat-dialog-content{padding:12px 24px 4px;min-width:min(600px,90vw)}.cmu-form{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}.cmu-wide{grid-column:1/-1}mat-form-field{width:100%}.cmu-note{display:flex;align-items:center;gap:8px;margin:12px 0 4px;padding:10px 12px;background:#eef2ff;border-radius:8px;color:#3730a3;font-size:12px}.cmu-note mat-icon{font-size:18px;width:18px;height:18px}mat-dialog-actions{padding:12px 24px 20px;gap:8px}@media(max-width:600px){mat-dialog-content{min-width:auto}.cmu-form{grid-template-columns:1fr}.cmu-wide{grid-column:auto}}
  `]
})
export class CreateManagedUserDialogComponent implements OnInit {
  saving = false;
  companies: Company[] = [];
  roles: Roles[] = [];
  form;

  constructor(private fb: FormBuilder, private userService: UserService, private companyService: CompanyService, private ref: MatDialogRef<CreateManagedUserDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: { companyId?: string; user?: UserDetailed }) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      companyId: [''],
      role: ['', Validators.required],
      newUsername: [''],
      isActive: [true]
    });
    if (data?.companyId) this.form.patchValue({ companyId: data.companyId });
    if (data?.user) this.form.patchValue({ name: data.user.name, email: data.user.email, phone: data.user.phone, companyId: data.user.companyId || '', role: data.user.role, newUsername: data.user.username, isActive: data.user.isactive });
  }

  ngOnInit(): void {
    this.companyService.getActiveCompanies().subscribe(companies => this.companies = companies);
    this.userService.getAssignableRoles().subscribe(roles => {
      this.roles = roles;
      if (!this.data?.user && roles.length) this.form.patchValue({ role: roles[roles.length - 1].code });
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const value = this.form.getRawValue();
    const request = this.data?.user
      ? { username: this.data.user.username, name: value.name, newUsername: value.newUsername, phone: value.phone, companyId: value.companyId, role: value.role, isActive: value.isActive } as UpdateManagedUserRequest
      : { name: value.name, email: value.email, phone: value.phone, companyId: value.companyId, role: value.role } as CreateManagedUserRequest;
    const operation = this.data?.user ? this.userService.updateManagedUser(request as UpdateManagedUserRequest) : this.userService.createManagedUser(request as CreateManagedUserRequest);
    operation.subscribe({
      next: result => { this.saving = false; this.ref.close(result); },
      error: () => { this.saving = false; }
    });
  }
}
