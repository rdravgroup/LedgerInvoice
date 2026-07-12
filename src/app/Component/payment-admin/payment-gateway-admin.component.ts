import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { PaymentService, PaymentGateway } from '../../_service/payment.service';

@Component({
  selector: 'app-payment-gateway-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './payment-gateway-admin.component.html',
  styleUrls: []
})
export class PaymentGatewayAdminComponent implements OnInit {
  gateways: PaymentGateway[] = [];
  loading = false;
  error?: string;

  constructor(private paymentSvc: PaymentService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = undefined;
    this.paymentSvc.getGateways().subscribe({
      next: g => { this.gateways = g; this.loading = false; },
      error: e => { this.error = 'Failed to load gateways'; this.loading = false; }
    });
  }

  toggle(gw: PaymentGateway): void {
    const newVal = !gw.isEnabled;
    this.paymentSvc.updateGateway(gw.recId, newVal).subscribe({
      next: _ => { gw.isEnabled = newVal; },
      error: _ => { this.error = 'Failed to update gateway'; }
    });
  }
}
