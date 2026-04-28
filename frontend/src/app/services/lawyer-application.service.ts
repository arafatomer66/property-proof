import { Injectable } from '@angular/core';

const BACKEND_URL = 'http://localhost:4500';

export type LawyerAppStatus = 'pending' | 'approved' | 'rejected';

export interface LawyerApplication {
  id: string;
  fullName: string;
  email: string;
  walletAddress: string;
  barLicenseNumber: string;
  jurisdiction: string;
  reason: string;
  status: LawyerAppStatus;
  rejectReason?: string;
  submittedAt: string;
  resolvedAt?: string;
}

export interface SubmitLawyerApplicationInput {
  fullName: string;
  email: string;
  walletAddress: string;
  barLicenseNumber: string;
  jurisdiction: string;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class LawyerApplicationService {
  async list(): Promise<LawyerApplication[]> {
    const res = await fetch(`${BACKEND_URL}/api/lawyer-applications`);
    if (!res.ok) throw new Error(`Failed to load applications: ${res.status}`);
    return await res.json();
  }

  async listByWallet(address: string): Promise<LawyerApplication[]> {
    const res = await fetch(
      `${BACKEND_URL}/api/lawyer-applications/by-wallet/${address}`,
    );
    if (!res.ok) throw new Error(`Failed to load applications: ${res.status}`);
    return await res.json();
  }

  async submit(input: SubmitLawyerApplicationInput): Promise<LawyerApplication> {
    const res = await fetch(`${BACKEND_URL}/api/lawyer-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body?.error ?? `Submission failed (${res.status})`);
    }
    return await res.json();
  }

  async markApproved(id: string): Promise<LawyerApplication> {
    const res = await fetch(
      `${BACKEND_URL}/api/lawyer-applications/${id}/mark-approved`,
      { method: 'POST' },
    );
    if (!res.ok) throw new Error(`Failed to mark approved: ${res.status}`);
    return await res.json();
  }

  async markRejected(id: string, reason: string): Promise<LawyerApplication> {
    const res = await fetch(
      `${BACKEND_URL}/api/lawyer-applications/${id}/mark-rejected`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) throw new Error(`Failed to mark rejected: ${res.status}`);
    return await res.json();
  }
}
