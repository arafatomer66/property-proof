import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContractService, RevisionView } from '../../services/contract.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private contractService = inject(ContractService);

  propertyId = '';
  busy = signal(false);
  history = signal<RevisionView[]>([]);
  currentOwner = signal<string | null>(null);
  error = signal<string | null>(null);

  async load() {
    if (!this.propertyId) {
      this.error.set('Enter a property ID first.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.history.set([]);
    try {
      const [history, owner] = await Promise.all([
        this.contractService.getHistory(this.propertyId),
        this.contractService.getCurrentOwner(this.propertyId),
      ]);
      this.history.set(history);
      this.currentOwner.set(owner);
      if (history.length === 0) {
        this.error.set('No revisions found for that property ID.');
      }
    } catch (e: any) {
      this.error.set(e?.shortMessage ?? e?.message ?? 'Failed to load history');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
  }
}
