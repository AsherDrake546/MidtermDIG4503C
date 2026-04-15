const SUPABASE_URL = "https://jsweshvtzopsbrtffhuf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzd2VzaHZ0em9wc2JydGZmaHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM0MzksImV4cCI6MjA4OTk0OTQzOX0.ztZAH2pMZ_jSMHQhcB2qKWJAnGTrxN_4twOWqDIRAOM";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "0b615fd08549b8b6e1416543024f6940";
const YOUTUBE_API_KEY = "AIzaSyDtH8MJh9nPluR7ehCVp43OyyZGPX2Kn8M";
const WATCHMODE_API_BASE_URL = "https://api.watchmode.com/v1";
const WATCHMODE_API_KEY = "coU9wUGIsvYNQXnAtFhhrxAx1zVd532ICmDt7fM6";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase SDK failed to load.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase configuration is missing.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.appConfig = {
  tmdb: {
    apiBaseUrl: TMDB_API_BASE_URL,
    apiKey: TMDB_API_KEY,
  },
  youtube: {
    apiKey: YOUTUBE_API_KEY,
  },
  watchmode: {
    apiBaseUrl: WATCHMODE_API_BASE_URL,
    apiKey: WATCHMODE_API_KEY,
  },
};

window.supabaseClient = supabaseClient;
