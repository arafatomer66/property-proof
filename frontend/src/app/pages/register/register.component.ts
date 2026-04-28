import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HashService } from '../../services/hash.service';
import { ContractService } from '../../services/contract.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private hashService = inject(HashService);
  private contractService = inject(ContractService);
  private auth = inject(AuthService);

  propertyId = '';
  note = '';
  recordedOwner = '';
  fileName = signal<string | null>(null);
  hash = signal<string | null>(null);
  busy = signal(false);
  status = signal<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useMyAddress() {
    const acc = this.auth.address();
    if (acc) this.recordedOwner = acc;
  }

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
    if (!this.propertyId || !this.hash() || !this.recordedOwner) {
      this.status.set({ kind: 'err', msg: 'Property ID, document, and recorded owner address are required.' });
      return;
    }
    this.busy.set(true);
    this.status.set(null);
    try {
      const txHash = await this.contractService.registerProperty(
        this.propertyId,
        this.hash()!,
        this.note,
        this.recordedOwner,
      );
      this.status.set({ kind: 'ok', msg: `Registered. Tx: ${txHash}` });
      this.propertyId = '';
      this.note = '';
      this.recordedOwner = '';
      this.fileName.set(null);
      this.hash.set(null);
    } catch (e: any) {
      this.status.set({ kind: 'err', msg: e?.shortMessage ?? e?.message ?? 'Transaction failed' });
    } finally {
      this.busy.set(false);
    }
  }
}
