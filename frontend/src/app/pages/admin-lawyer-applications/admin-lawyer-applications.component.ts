import { Component, OnInit, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { ContractService } from '../../services/contract.service';
import {
  LawyerApplication,
  LawyerApplicationService,
} from '../../services/lawyer-application.service';

@Component({
  selector: 'app-admin-lawyer-applications',
  standalone: true,
  imports: [UpperCasePipe],
  templateUrl: './admin-lawyer-applications.component.html',
  styleUrl: './admin-lawyer-applications.component.scss',
})
export class AdminLawyerApplicationsComponent implements OnInit {
  private lawyerApps = inject(LawyerApplicationService);
  private contract = inject(ContractService);

  apps = signal<LawyerApplication[]>([]);
  busy = signal(true);
  error = signal<string | null>(null);
  workingId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load() {
    this.busy.set(true);
    try {
      const apps = await this.lawyerApps.list();
      this.apps.set(apps.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load applications.');
    } finally {
      this.busy.set(false);
    }
  }

  async approve(app: LawyerApplication) {
    this.error.set(null);
    this.workingId.set(app.id);
    try {
      await this.contract.grantLawyerRole(app.walletAddress);
      await this.lawyerApps.markApproved(app.id);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.shortMessage ?? e?.message ?? 'Approval failed.');
    } finally {
      this.workingId.set(null);
    }
  }

  async reject(app: LawyerApplication) {
    const reason = window.prompt('Reason for rejection?', 'Insufficient verification') ?? '';
    if (!reason) return;
    this.workingId.set(app.id);
    try {
      await this.lawyerApps.markRejected(app.id, reason);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Rejection failed.');
    } finally {
      this.workingId.set(null);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
