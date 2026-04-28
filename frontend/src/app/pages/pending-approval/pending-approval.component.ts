import { Component, OnInit, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  LawyerApplication,
  LawyerApplicationService,
} from '../../services/lawyer-application.service';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [RouterLink, UpperCasePipe],
  templateUrl: './pending-approval.component.html',
  styleUrl: './pending-approval.component.scss',
})
export class PendingApprovalComponent implements OnInit {
  private auth = inject(AuthService);
  private lawyerApps = inject(LawyerApplicationService);
  private router = inject(Router);

  app = signal<LawyerApplication | null>(null);
  busy = signal(true);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const addr = this.auth.address();
    if (!addr) {
      this.router.navigateByUrl('/login');
      return;
    }
    try {
      const apps = await this.lawyerApps.listByWallet(addr);
      const latest = apps.sort((a, b) =>
        b.submittedAt.localeCompare(a.submittedAt),
      )[0] ?? null;
      this.app.set(latest);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load application status.');
    } finally {
      this.busy.set(false);
    }
  }

  async refresh() {
    await this.auth.refreshRole();
    if (this.auth.role() === 'lawyer') {
      this.router.navigateByUrl('/lawyer');
      return;
    }
    await this.ngOnInit();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
