/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The project URL, e.g. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** The project's publishable (anon) key. Safe in the browser; row-level security does the guarding. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** "true" runs the offline demo with seed data instead of Supabase. */
  readonly VITE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
