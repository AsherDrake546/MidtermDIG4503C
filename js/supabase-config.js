const SUPABASE_URL = "https://jsweshvtzopsbrtffhuf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzd2VzaHZ0em9wc2JydGZmaHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM0MzksImV4cCI6MjA4OTk0OTQzOX0.ztZAH2pMZ_jSMHQhcB2qKWJAnGTrxN_4twOWqDIRAOM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
