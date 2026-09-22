"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente Supabase para Client Components (singleton por pestaña). */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
