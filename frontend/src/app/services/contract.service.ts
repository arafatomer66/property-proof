import { Injectable, inject } from '@angular/core';
import { Contract } from 'ethers';
import { AuthService } from './auth.service';
import contractMeta from '../../assets/PropertyProof.json';

export interface RevisionView {
  docHash: string;
  recordedOwner: string;
  timestamp: number;
  note: string;
  submitter: string;
  fileURL: string;
}

export interface VerifyResult {
  exists: boolean;
  isCurrent: boolean;
  revisionIndex: number;
}

export type SubmissionKind = 'REGISTER' | 'AMEND';
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PendingSubmissionView {
  id: number;
  kind: SubmissionKind;
  propertyId: string;
  docHash: string;
  note: string;
  recordedOwner: string;
  fileURL: string;
  submittedBy: string;
  submittedAt: number;
  status: SubmissionStatus;
  rejectReason: string;
}

const KIND_LABELS: SubmissionKind[] = ['REGISTER', 'AMEND'];
const STATUS_LABELS: SubmissionStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly address: string = (contractMeta as any).address;
  private readonly abi: any[] = (contractMeta as any).abi;
  private auth = inject(AuthService);

  private writeContract(): Contract {
    const signer = this.auth.getSigner();
    return new Contract(this.address, this.abi, signer);
  }

  private readContract(): Contract {
    return new Contract(this.address, this.abi, this.auth.getProvider());
  }

  async getSuperAdmin(): Promise<string> {
    return await this.readContract()['superAdmin']();
  }

  async isLawyer(address: string): Promise<boolean> {
    return await this.readContract()['isLawyer'](address);
  }

  async grantLawyerRole(address: string): Promise<string> {
    const tx = await this.writeContract()['grantLawyerRole'](address);
    await tx.wait();
    return tx.hash;
  }

  async revokeLawyerRole(address: string): Promise<string> {
    const tx = await this.writeContract()['revokeLawyerRole'](address);
    await tx.wait();
    return tx.hash;
  }

  async registerProperty(
    propertyId: string,
    docHash: string,
    note: string,
    recordedOwner: string,
    fileURL: string,
  ): Promise<string> {
    const tx = await this.writeContract()['registerProperty'](
      propertyId,
      docHash,
      note,
      recordedOwner,
      fileURL,
    );
    await tx.wait();
    return tx.hash;
  }

  async amendProperty(
    propertyId: string,
    docHash: string,
    note: string,
    fileURL: string,
  ): Promise<string> {
    const tx = await this.writeContract()['amendProperty'](
      propertyId,
      docHash,
      note,
      fileURL,
    );
    await tx.wait();
    return tx.hash;
  }

  async transferOwnership(propertyId: string, newOwner: string): Promise<string> {
    const tx = await this.writeContract()['transferOwnership'](propertyId, newOwner);
    await tx.wait();
    return tx.hash;
  }

  async transferAdmin(newAdmin: string): Promise<string> {
    const tx = await this.writeContract()['transferAdmin'](newAdmin);
    await tx.wait();
    return tx.hash;
  }

  async submitRegistration(
    propertyId: string,
    docHash: string,
    note: string,
    recordedOwner: string,
    fileURL: string,
  ): Promise<string> {
    const tx = await this.writeContract()['submitRegistration'](
      propertyId,
      docHash,
      note,
      recordedOwner,
      fileURL,
    );
    await tx.wait();
    return tx.hash;
  }

  async submitAmendment(
    propertyId: string,
    docHash: string,
    note: string,
    fileURL: string,
  ): Promise<string> {
    const tx = await this.writeContract()['submitAmendment'](
      propertyId,
      docHash,
      note,
      fileURL,
    );
    await tx.wait();
    return tx.hash;
  }

  async approvePending(id: number): Promise<string> {
    const tx = await this.writeContract()['approvePending'](id);
    await tx.wait();
    return tx.hash;
  }

  async rejectPending(id: number, reason: string): Promise<string> {
    const tx = await this.writeContract()['rejectPending'](id, reason);
    await tx.wait();
    return tx.hash;
  }

  async getPendingSubmissions(): Promise<PendingSubmissionView[]> {
    const raw: any[] = await this.readContract()['getPendingSubmissions']();
    return raw.map((r, idx) => this.mapPending(r, idx));
  }

  async getCurrentOwner(propertyId: string): Promise<string> {
    return await this.readContract()['currentOwner'](propertyId);
  }

  async getHistory(propertyId: string): Promise<RevisionView[]> {
    const raw: any[] = await this.readContract()['getHistory'](propertyId);
    return raw.map((r) => ({
      docHash: r.docHash,
      recordedOwner: r.recordedOwner,
      timestamp: Number(r.timestamp),
      note: r.note,
      submitter: r.submitter,
      fileURL: r.fileURL,
    }));
  }

  async verify(propertyId: string, docHash: string): Promise<VerifyResult> {
    const r = await this.readContract()['verify'](propertyId, docHash);
    return {
      exists: r.exists,
      isCurrent: r.isCurrent,
      revisionIndex: Number(r.revisionIndex),
    };
  }

  getContractAddress(): string {
    return this.address;
  }

  private mapPending(r: any, id: number): PendingSubmissionView {
    return {
      id,
      kind: KIND_LABELS[Number(r.kind)] ?? 'REGISTER',
      propertyId: r.propertyId,
      docHash: r.docHash,
      note: r.note,
      recordedOwner: r.recordedOwner,
      fileURL: r.fileURL,
      submittedBy: r.submittedBy,
      submittedAt: Number(r.submittedAt),
      status: STATUS_LABELS[Number(r.status)] ?? 'PENDING',
      rejectReason: r.rejectReason,
    };
  }
}
