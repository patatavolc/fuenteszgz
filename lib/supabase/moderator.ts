import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getModeratorEmails } from "./server";

export async function isAuthorizedModerator(authorization: string | null): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  const email = data.user?.email?.trim().toLocaleLowerCase("en-US");
  return !error && Boolean(email && getModeratorEmails().has(email));
}
