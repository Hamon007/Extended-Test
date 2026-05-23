import { supabase, isSupabaseReady } from '../lib/supabase';
import type { User, AuthError } from '@supabase/supabase-js';

type AuthListener = (user: User | null) => void;

class AuthServiceClass {
  private _user: User | null = null;
  private _listeners = new Set<AuthListener>();

  async init(): Promise<void> {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    this._user = session?.user ?? null;
    supabase.auth.onAuthStateChange((_event, session) => {
      this._user = session?.user ?? null;
      this._notify();
    });
  }

  private _notify(): void {
    this._listeners.forEach(fn => fn(this._user));
  }

  get user(): User | null   { return this._user; }
  get isLoggedIn(): boolean { return this._user !== null; }
  get isAvailable(): boolean { return isSupabaseReady; }

  subscribe(fn: AuthListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  async login(email: string, password: string): Promise<string | null> {
    if (!supabase) return 'Supabase nicht konfiguriert.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? mapAuthError(error) : null;
  }

  async register(email: string, password: string): Promise<string | null> {
    if (!supabase) return 'Supabase nicht konfiguriert.';
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? mapAuthError(error) : null;
  }

  async logout(): Promise<void> {
    await supabase?.auth.signOut();
  }
}

function mapAuthError(e: AuthError): string {
  if (e.message.includes('Invalid login credentials')) return 'E-Mail oder Passwort falsch.';
  if (e.message.includes('User already registered'))   return 'Diese E-Mail ist bereits registriert.';
  if (e.message.includes('Password should be'))        return 'Passwort muss mindestens 6 Zeichen haben.';
  return e.message;
}

export const AuthService = new AuthServiceClass();
