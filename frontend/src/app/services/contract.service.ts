import { Injectable, inject } from '@angular/core';
import { Contract } from 'ethers';
import { AuthService } from './auth.service';
import contractMeta from '../../assets/PropertyProof.json';

export interface RevisionView {
  docHash: string;
  owner: string;
  timestamp: number;
  note: string;
}

export interface VerifyResult {
  exists: boolean;
  isCurrent: boolean;
  revisionIndex: number;
}

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
    const c = this.readContract();
    return await c['superAdmin']();
  }

  async registerProperty(
    propertyId: string,
    docHash: string,
    note: string,
    recordedOwner: string,
  ): Promise<string> {
    const c = this.writeContract();
    const tx = await c['registerProperty'](propertyId, docHash, note, recordedOwner);
    await tx.wait();
    return tx.hash;
  }

  async amendProperty(propertyId: string, docHash: string, note: string): Promise<string> {
    const c = this.writeContract();
    const tx = await c['amendProperty'](propertyId, docHash, note);
    await tx.wait();
    return tx.hash;
  }

  async transferOwnership(propertyId: string, newOwner: string): Promise<string> {
    const c = this.writeContract();
    const tx = await c['transferOwnership'](propertyId, newOwner);
    await tx.wait();
    return tx.hash;
  }

  async transferAdmin(newAdmin: string): Promise<string> {
    const c = this.writeContract();
    const tx = await c['transferAdmin'](newAdmin);
    await tx.wait();
    return tx.hash;
  }

  async getCurrentOwner(propertyId: string): Promise<string> {
    const c = this.readContract();
    return await c['currentOwner'](propertyId);
  }

  async getHistory(propertyId: string): Promise<RevisionView[]> {
    const c = this.readContract();
    const raw: any[] = await c['getHistory'](propertyId);
    return raw.map((r) => ({
      docHash: r.docHash,
      owner: r.owner,
      timestamp: Number(r.timestamp),
      note: r.note,
    }));
  }

  async verify(propertyId: string, docHash: string): Promise<VerifyResult> {
    const c = this.readContract();
    const r = await c['verify'](propertyId, docHash);
    return {
      exists: r.exists,
      isCurrent: r.isCurrent,
      revisionIndex: Number(r.revisionIndex),
    };
  }

  getContractAddress(): string {
    return this.address;
  }
}
