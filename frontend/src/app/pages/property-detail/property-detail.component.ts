import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContractService, RevisionView } from '../../services/contract.service';

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './property-detail.component.html',
  styleUrl: './property-detail.component.scss',
})
export class PropertyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private contract = inject(ContractService);

  propertyId = signal<string>('');
  history = signal<RevisionView[]>([]);
  currentOwner = signal<string | null>(null);
  busy = signal(true);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.propertyId.set(id);
    if (!id) {
      this.busy.set(false);
      this.error.set('No property ID supplied.');
      return;
    }

    try {
      const [history, owner] = await Promise.all([
        this.contract.getHistory(id),
        this.contract.getCurrentOwner(id),
      ]);
      this.history.set(history);
      this.currentOwner.set(owner);
      if (history.length === 0) {
        this.error.set('No record found for that property ID.');
      }
    } catch (e: any) {
      this.error.set(e?.shortMessage ?? e?.message ?? 'Failed to load property.');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
  }

  isZeroAddress(addr: string | null): boolean {
    return !addr || addr === '0x0000000000000000000000000000000000000000';
  }
}
