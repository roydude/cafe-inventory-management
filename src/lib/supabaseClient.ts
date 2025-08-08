import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as ReturnType<typeof createClient>);

export async function ensureSession(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: initial } = await supabase.auth.getSession();
  if (initial.session) return;

  // Try anonymous sign-in (if enabled)
  let signedIn = false;
  try {
    const anyAuth: any = supabase.auth as any;
    if (typeof anyAuth.signInAnonymously === "function") {
      const { data, error } = await anyAuth.signInAnonymously();
      if (error) throw error;
      signedIn = Boolean(data?.user);
    }
  } catch {
    // ignore; fall through to session re-check and throw a clearer error
  }

  const { data: after } = await supabase.auth.getSession();
  if (!after.session && !signedIn) {
    throw new Error(
      "Supabase 익명 로그인이 비활성화되어 있습니다. Anonymous Provider를 활성화하거나 로그인 방식을 구현하세요."
    );
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<void> {
  if (!isSupabaseConfigured)
    throw new Error("Supabase가 구성되어 있지 않습니다.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}
