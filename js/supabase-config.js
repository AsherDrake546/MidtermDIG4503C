const SUPABASE_URL = "https://jsweshvtzopsbrtffhuf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzd2VzaHZ0em9wc2JydGZmaHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM0MzksImV4cCI6MjA4OTk0OTQzOX0.ztZAH2pMZ_jSMHQhcB2qKWJAnGTrxN_4twOWqDIRAOM";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase SDK failed to load.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase configuration is missing.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
