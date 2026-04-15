# KinoRate

KinoRate is a movie review web app built with vanilla JavaScript and Supabase Auth.

## APIs Used

| API | Purpose in KinoRate |
|---|---|
| TMDB API | Movie search, movie details, posters, release data, cast, and director info |
| YouTube Data API v3 | Finds and embeds official trailers on each movie detail page |
| Watchmode API | Shows a **Where to Watch** section with streaming/rent/buy provider links |
| Supabase | Authentication, profiles, reviews, favorites, and watchlists |

## How the new API integrations work

### YouTube trailer integration
- On `movie.html`, the app searches YouTube Data API v3 for an official trailer using movie title + year (+ director when available).
- It embeds the best result in an iframe in the movie info area.

### Watchmode “Where to Watch” integration
- On `movie.html`, the app attempts to resolve a Watchmode title from the TMDB movie id.
- If needed, it falls back to title/year search in Watchmode.
- It then loads provider sources and renders compact provider links in the **Where to Watch** section.

## Configuration

Create `js/supabase-config.js` from `js/supabase-config.example.js` and fill in:

```js
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "your-tmdb-api-key";

const YOUTUBE_API_KEY = "your-youtube-api-key";

const WATCHMODE_API_BASE_URL = "https://api.watchmode.com/v1";
const WATCHMODE_API_KEY = "your-watchmode-api-key";
```

The app prefers `window.appConfig` values and only uses constant fallbacks when config values are missing.

## Run locally

Serve the project as a static site (recommended over `file://`):

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500/auth.html
```

## Deploying to GitHub Pages

1. Push to GitHub.
2. Enable **Pages** (`Deploy from a branch`, root folder).
3. Open the deployed URL and hard refresh after updates (`Ctrl+F5`) to avoid stale cached JS.

