import { Injectable, computed, signal } from '@angular/core';
import { ethers } from 'ethers';

const RPC_URL = 'http://127.0.0.1:8545';

const ADMIN_EMAILS = ['admin@propertyproof.local'];

const HARDHAT_ACCOUNT_0_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const FAUCET_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const STORAGE_KEY = 'propertyproof.accounts';
const SESSION_KEY = 'propertyproof.session';

interface StoredAccount {
  email: string;
  address: string;
  encryptedJson: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _email = signal<string | null>(null);
  private _wallet = signal<ethers.Wallet | null>(null);
  private _error = signal<string | null>(null);
  private _busy = signal<boolean>(false);

  readonly email = this._email.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly address = computed(() => this._wallet()?.address ?? null);
  readonly isLoggedIn = computed(() => this._wallet() !== null);
  readonly isAdmin = computed(() => {
    const e = this._email();
    return e !== null && ADMIN_EMAILS.includes(e);
  });

  readonly provider = new ethers.JsonRpcProvider(RPC_URL);

  constructor() {
    this.tryRestoreSession();
  }

  isAdminEmail(email: string): boolean {
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
  }

  emailIsRegistered(email: string): boolean {
    return this.loadAccounts().some((a) => a.email === email.trim().toLowerCase());
  }

  async signup(rawEmail: string, password: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !password) throw new Error('Email and password are required.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    const accounts = this.loadAccounts();
    if (accounts.find((a) => a.email === email)) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }

    this._busy.set(true);
    this._error.set(null);
    try {
      const wallet = ADMIN_EMAILS.includes(email)
        ? new ethers.Wallet(HARDHAT_ACCOUNT_0_KEY)
        : ethers.Wallet.createRandom();

      const encryptedJson = await wallet.encrypt(password);

      const stored: StoredAccount = {
        email,
        address: wallet.address,
        encryptedJson,
      };
      accounts.push(stored);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));

      // Auto-fund non-admin accounts so they can pay gas
      if (!ADMIN_EMAILS.includes(email)) {
        await this.fundAccount(wallet.address);
      }

      const connected = wallet.connect(this.provider) as ethers.Wallet;
      this._wallet.set(connected);
      this._email.set(email);
      this.persistSession(email, password);
    } finally {
      this._busy.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  async login(rawEmail: string, password: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !password) throw new Error('Email and password are required.');

    const accounts = this.loadAccounts();
    const account = accounts.find((a) => a.email === email);
    if (!account) {
      throw new Error('No account with that email. Sign up first.');
    }

    this._busy.set(true);
    this._error.set(null);
    try {
      const decrypted = await ethers.Wallet.fromEncryptedJson(
        account.encryptedJson,
        password,
      );
      const wallet = new ethers.Wallet(decrypted.privateKey, this.provider);
      this._wallet.set(wallet);
      this._email.set(email);
      this.persistSession(email, password);
    } catch (e: any) {
      if (e?.message?.includes('invalid password')) {
        throw new Error('Incorrect password.');
      }
      throw e;
    } finally {
      this._busy.set(false);
    }
  }

  logout(): void {
    this._wallet.set(null);
    this._email.set(null);
    this._error.set(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  getSigner(): ethers.Wallet {
    const w = this._wallet();
    if (!w) throw new Error('Not logged in.');
    return w;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  private loadAccounts(): StoredAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
    } catch {
      return [];
    }
  }

  private persistSession(email: string, password: string): void {
    // Stored only in sessionStorage (cleared on tab close).
    // For a learning project / local dev only — do not ship as-is.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, password }));
  }

  private async tryRestoreSession(): Promise<void> {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const { email, password } = JSON.parse(raw);
      if (!email || !password) return;
      await this.login(email, password);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  private async fundAccount(toAddress: string): Promise<void> {
    try {
      const faucet = new ethers.Wallet(FAUCET_KEY, this.provider);
      const tx = await faucet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther('1.0'),
      });
      await tx.wait();
    } catch (e: any) {
      // Faucet failure shouldn't block signup — user can still log in,
      // they just won't be able to pay gas. Surface it as a soft error.
      this._error.set(
        'Account created, but auto-funding failed. Is the Hardhat node running?',
      );
    }
  }
}
