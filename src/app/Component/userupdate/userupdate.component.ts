import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Roles, UpdateUser, Users } from '../../_model/user.model';
import { UserService } from '../../_service/user.service';

@Component({
  selector: 'app-userupdate',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './userupdate.component.html',
  styleUrls: ['./userupdate.component.css']
})
export class UserupdateComponent implements OnInit {
  dialogdata: any;
  userdata!: Users;
  rolelist!: Roles[]
  type = '';
  _response: any;
  userform: any;
  constructor(private builder: FormBuilder, private toastr: ToastrService, @Inject(MAT_DIALOG_DATA) public data: any,
    private service: UserService, private ref: MatDialogRef<UserupdateComponent>) {

      this.userform = this.builder.group({
        username: ['', { disabled: true }],
        role: ['', Validators.required],
        status: [true]
      });

  }
  ngOnInit(): void {
    this.loadroles();
    this.dialogdata = this.data;
    this.type = this.dialogdata.type;
    if (this.dialogdata.username !== '') {
      this.service.getUserByCode(this.dialogdata.username).subscribe(item => {
        this.userdata = item;

        // Coerce status to boolean to satisfy form control type
        const rawStatus: any = (this.userdata as any).isactive;
        let boolStatus = false;
        if (typeof rawStatus === 'boolean') {
          boolStatus = rawStatus;
        } else if (typeof rawStatus === 'string') {
          const s = String(rawStatus).toLowerCase();
          boolStatus = (s === 'true' || s === '1' || s === 'active');
        } else if (typeof rawStatus === 'number') {
          boolStatus = rawStatus === 1;
        } else {
          boolStatus = Boolean(rawStatus);
        }

        this.userform.setValue({ username: this.userdata.username, role: this.userdata.role, status: boolStatus });
      })
    }

  }

  loadroles() {
    this.service.getAllRoles().subscribe(item => {
      this.rolelist = item;
    })
  }

 

  proceedchange() {
    if (this.userform.valid) {
      let _obj: UpdateUser = {
        username: this.dialogdata.username,
        role: this.userform.value.role as string,
        status:this.userform.value.status as boolean
      }
      if (this.type === 'role') {
        this.service.updateRole(_obj).subscribe(item => {
          this._response=item;
          if (this._response.result == 'pass') {
            this.toastr.success('Updated successfully', 'Role Update');
            this.closepopup();
          } else {
            this.toastr.error('Failed due to : ' + this._response.message, 'Role Update')
          }
        })
      }else{
        this.service.updateStatus(_obj).subscribe(item => {
          this._response=item;
          if (this._response.result == 'pass') {
            this.toastr.success('Updated successfully', 'Status Update');
            this.closepopup();
          } else {
            this.toastr.error('Failed due to : ' + this._response.message, 'Status Update')
          }
        })
      }
    }
  }

  closepopup() {
    this.ref.close();
  }

}
