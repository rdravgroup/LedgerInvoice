import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaymentService, RunExpiryJobResponse } from '../../_service/payment.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-payment-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatProgressSpinnerModule],
  templateUrl: './payment-admin.component.html',
  styleUrls: ['./payment-admin.component.css']
})
export class PaymentAdminComponent {
  running = false;
  forceDeactivate = false;
  lastResult: RunExpiryJobResponse | null = null;
  lastRun: Date | null = null;

  constructor(private svc: PaymentService, private toastr: ToastrService) {}

  runJob(): void {
    this.running = true; this.lastResult = null;
    this.svc.runExpiryJob(this.forceDeactivate).subscribe({
      next: r => { this.running = false; this.lastResult = r; this.lastRun = new Date(); this.toastr.success(r.message, 'Job Complete'); },
      error: e => { this.running = false; this.toastr.error(e?.message ?? 'Job failed', 'Error'); }
    });
  }
}
