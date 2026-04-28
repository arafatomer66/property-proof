import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HashService } from '../../services/hash.service';
import { ContractService } from '../../services/contract.service';

@Component({
  selector: 'app-amend',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './amend.component.html',
  styleUrl: './amend.component.scss',
})
export class AmendComponent {
  private hashService = inject(HashService);
  private contractService = inject(ContractService);

  propertyId = '';
  note = '';
  fileName = signal<string | null>(null);
  hash = signal<string | null>(null);
  busy = signal(false);
  status = signal<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  async onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.hash.set(null);
    this.busy.set(true);
    try {
      this.hash.set(await this.hashService.sha256OfFile(file));
    } finally {
      this.busy.set(false);
    }
  }

  async submit() {
    if (!this.propertyId || !this.hash()) {
      this.status.set({ kind: 'err', msg: 'Pick a file and enter the property ID.' });
      return;
    }
    this.busy.set(true);
    this.status.set(null);
    try {
      const txHash = await this.contractService.amendProperty(this.propertyId, this.hash()!, this.note);
      this.status.set({ kind: 'ok', msg: `Amendment recorded. Tx: ${txHash}` });
    } catch (e: any) {
      this.status.set({ kind: 'err', msg: e?.shortMessage ?? e?.message ?? 'Transaction failed' });
    } finally {
      this.busy.set(false);
    }
  }
}
