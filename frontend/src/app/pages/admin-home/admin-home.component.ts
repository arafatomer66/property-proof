import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContractService, PendingSubmissionView } from '../../services/contract.service';
import {
  LawyerApplication,
  LawyerApplicationService,
} from '../../services/lawyer-application.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnInit {
  private contract = inject(ContractService);
  private lawyerApps = inject(LawyerApplicationService);

  pendingSubmissions = signal<PendingSubmissionView[]>([]);
  pendingApps = signal<LawyerApplication[]>([]);
  busy = signal(true);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const [subs, apps] = await Promise.all([
        this.contract.getPendingSubmissions(),
        this.lawyerApps.list(),
      ]);
      this.pendingSubmissions.set(subs.filter((s) => s.status === 'PENDING'));
      this.pendingApps.set(apps.filter((a) => a.status === 'pending'));
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load.');
    } finally {
      this.busy.set(false);
    }
  }
}
