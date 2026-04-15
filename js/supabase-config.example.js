const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "your-tmdb-api-key";
const YOUTUBE_API_KEY = "your-youtube-api-key";
const WATCHMODE_API_BASE_URL = "https://api.watchmode.com/v1";
const WATCHMODE_API_KEY = "your-watchmode-api-key";

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
