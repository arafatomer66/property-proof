import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HashService } from '../../services/hash.service';
import { ContractService } from '../../services/contract.service';

type Verdict =
  | { kind: 'ok'; msg: string; fileURL?: string }
  | { kind: 'warn'; msg: string; fileURL?: string }
  | { kind: 'err'; msg: string };

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.scss',
})
export class VerifyComponent {
  private hashService = inject(HashService);
  private contractService = inject(ContractService);

  propertyId = '';
  fileName = signal<string | null>(null);
  hash = signal<string | null>(null);
  busy = signal(false);
  verdict = signal<Verdict | null>(null);

  async onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.hash.set(null);
    this.verdict.set(null);
    this.busy.set(true);
    try {
      this.hash.set(await this.hashService.sha256OfFile(file));
    } finally {
      this.busy.set(false);
    }
  }

  async runVerify() {
    if (!this.propertyId || !this.hash()) {
      this.verdict.set({ kind: 'err', msg: 'Pick a file and enter the property ID first.' });
      return;
    }
    this.busy.set(true);
    this.verdict.set(null);
    try {
      const r = await this.contractService.verify(this.propertyId, this.hash()!);
      if (!r.exists) {
        this.verdict.set({ kind: 'err', msg: 'NOT FOUND — this hash is not registered for that property. Either tampered, wrong file, or unregistered.' });
      } else {
        const history = await this.contractService.getHistory(this.propertyId);
        const fileURL = history[r.revisionIndex]?.fileURL;
        if (r.isCurrent) {
          this.verdict.set({ kind: 'ok', msg: `AUTHENTIC & CURRENT — matches revision #${r.revisionIndex}, the latest.`, fileURL });
        } else {
          this.verdict.set({ kind: 'warn', msg: `OUTDATED — matches revision #${r.revisionIndex}, but a newer revision exists. Get the latest version.`, fileURL });
        }
      }
    } catch (e: any) {
      this.verdict.set({ kind: 'err', msg: e?.shortMessage ?? e?.message ?? 'Verification failed' });
    } finally {
      this.busy.set(false);
    }
  }
}
