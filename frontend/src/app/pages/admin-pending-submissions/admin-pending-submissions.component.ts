import { Component, OnInit, inject, signal } from '@angular/core';
import { ContractService, PendingSubmissionView } from '../../services/contract.service';

@Component({
  selector: 'app-admin-pending-submissions',
  standalone: true,
  imports: [],
  templateUrl: './admin-pending-submissions.component.html',
  styleUrl: './admin-pending-submissions.component.scss',
})
export class AdminPendingSubmissionsComponent implements OnInit {
  private contract = inject(ContractService);

  submissions = signal<PendingSubmissionView[]>([]);
  busy = signal(true);
  error = signal<string | null>(null);
  workingId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load() {
    this.busy.set(true);
    try {
      const all = await this.contract.getPendingSubmissions();
      this.submissions.set(all.slice().reverse());
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load submissions.');
    } finally {
      this.busy.set(false);
    }
  }

  async approve(s: PendingSubmissionView) {
    this.error.set(null);
    this.workingId.set(s.id);
    try {
      await this.contract.approvePending(s.id);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.shortMessage ?? e?.message ?? 'Approval failed.');
    } finally {
      this.workingId.set(null);
    }
  }

  async reject(s: PendingSubmissionView) {
    const reason = window.prompt('Reason for rejection?', '') ?? '';
    if (!reason) return;
    this.workingId.set(s.id);
    try {
      await this.contract.rejectPending(s.id, reason);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.shortMessage ?? e?.message ?? 'Rejection failed.');
    } finally {
      this.workingId.set(null);
    }
  }

  formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
  }

  short(addr: string): string {
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }
}
