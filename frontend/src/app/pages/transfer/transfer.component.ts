import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../../services/contract.service';

@Component({
  selector: 'app-transfer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './transfer.component.html',
  styleUrl: './transfer.component.scss',
})
export class TransferComponent {
  private contractService = inject(ContractService);

  propertyId = '';
  newOwner = '';
  busy = signal(false);
  status = signal<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  async submit() {
    if (!this.propertyId || !this.newOwner) {
      this.status.set({ kind: 'err', msg: 'Property ID and new owner address are required.' });
      return;
    }
    this.busy.set(true);
    this.status.set(null);
    try {
      const txHash = await this.contractService.transferOwnership(this.propertyId, this.newOwner);
      this.status.set({ kind: 'ok', msg: `Ownership transferred. Tx: ${txHash}` });
    } catch (e: any) {
      this.status.set({ kind: 'err', msg: e?.shortMessage ?? e?.message ?? 'Transaction failed' });
    } finally {
      this.busy.set(false);
    }
  }
}
