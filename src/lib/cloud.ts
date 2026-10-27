// Followset cloud (Supabase). Off until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
// at build time (GitHub repo variables → the Pages workflow). Everything works locally without it.
export const CLOUD = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "",
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  get configured(): boolean {
    return !!(this.url && this.anonKey);
  },
  fn(name: string): string {
    return `${this.url}/functions/v1/${name}`;
  },
};
