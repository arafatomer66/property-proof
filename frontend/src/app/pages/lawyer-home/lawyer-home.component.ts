import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContractService, PendingSubmissionView } from '../../services/contract.service';

@Component({
  selector: 'app-lawyer-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './lawyer-home.component.html',
  styleUrl: './lawyer-home.component.scss',
})
export class LawyerHomeComponent implements OnInit {
  private contract = inject(ContractService);
  private auth = inject(AuthService);

  all = signal<PendingSubmissionView[]>([]);
  busy = signal(true);
  error = signal<string | null>(null);

  mine = computed(() => {
    const me = this.auth.address()?.toLowerCase();
    if (!me) return [];
    return this.all()
      .filter((s) => s.submittedBy.toLowerCase() === me)
      .reverse();
  });

  async ngOnInit(): Promise<void> {
    try {
      const subs = await this.contract.getPendingSubmissions();
      this.all.set(subs);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load submissions.');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
  }
}
