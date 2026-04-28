import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HashService } from '../../services/hash.service';
import { ContractService } from '../../services/contract.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-lawyer-submit-registration',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lawyer-submit-registration.component.html',
  styleUrl: './lawyer-submit-registration.component.scss',
})
export class LawyerSubmitRegistrationComponent {
  private hashService = inject(HashService);
  private contractService = inject(ContractService);
  private fileService = inject(FileService);
  private router = inject(Router);

  propertyId = '';
  note = '';
  recordedOwner = '';
  selectedFile = signal<File | null>(null);
  fileName = signal<string | null>(null);
  hash = signal<string | null>(null);
  busy = signal(false);
  status = signal<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  async onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);
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
    const file = this.selectedFile();
    if (!this.propertyId || !this.hash() || !this.recordedOwner || !file) {
      this.status.set({ kind: 'err', msg: 'Property ID, document, and recorded owner address are required.' });
      return;
    }
    this.busy.set(true);
    this.status.set(null);
    try {
      const upload = await this.fileService.upload(file);
      if (upload.hash.toLowerCase() !== this.hash()!.toLowerCase()) {
        throw new Error('Upload hash mismatch — backend stored a different file.');
      }
      const txHash = await this.contractService.submitRegistration(
        this.propertyId,
        this.hash()!,
        this.note,
        this.recordedOwner,
        upload.url,
      );
      this.status.set({ kind: 'ok', msg: `Submitted for review. Tx: ${txHash}` });
      setTimeout(() => this.router.navigateByUrl('/lawyer'), 1200);
    } catch (e: any) {
      this.status.set({ kind: 'err', msg: e?.shortMessage ?? e?.message ?? 'Submission failed' });
    } finally {
      this.busy.set(false);
    }
  }
}
