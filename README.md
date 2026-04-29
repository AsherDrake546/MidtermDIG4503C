# KinoRate

KinoRate is a Letterboxd-style movie web app where authenticated users can search movies, write reviews, manage a top-five favorites list, and build watch lists.

## Features

- Email/password auth with Supabase and protected routes
- Movie search with typeahead suggestions (TMDB)
- Movie detail pages with cast, director, trailer (YouTube), and streaming availability (Watchmode)
- Per-movie reviews with 1-10 ratings and review text
- User profiles with editable username, avatar URL, and bio
- User search, public profile pages, and profile-linked reviews
- Top five favorite movies per user
- Custom watch lists with add/remove and watched toggles
- Home feed for recent reviews and highest-rated movies

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Auth + DB | Supabase Auth + Postgres |
| Movie Metadata | TMDB API |
| Trailers | YouTube Data API |
| Streaming Sources | Watchmode API |
| Hosting | GitHub Pages (or any static host) |

## Project Structure

```text
.
├── auth.html
├── index.html
├── search.html
├── movie.html
├── user.html
├── watchlist.html
├── style.css
└── js/
    ├── auth.js
    ├── index-search.js
    ├── movie.js
    ├── search.js
    ├── user.js
    ├── watchlist.js
    ├── supabase-config.example.js
    └── supabase-config.js
```

## Local Setup

1. Copy the config template:

```bash
# PowerShell
Copy-Item js\supabase-config.example.js js\supabase-config.js

# macOS/Linux
cp js/supabase-config.example.js js/supabase-config.js
```

2. Fill in your keys in `js/supabase-config.js`:

```js
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "your-tmdb-api-key";
const YOUTUBE_API_KEY = "your-youtube-api-key";
const WATCHMODE_API_BASE_URL = "https://api.watchmode.com/v1";
const WATCHMODE_API_KEY = "your-watchmode-api-key";
```

3. Open `auth.html` through a local static server (or deploy and open that URL).
4. Sign up, log in, and start from `index.html`.

## Required Supabase Schema

This app expects these tables:

- `profiles`
- `movie_reviews`
- `user_favorites`
- `watch_lists`
- `watch_list_items`

And these RPC functions:

- `add_user_favorite(p_movie_id, p_movie_title, p_poster_path)`  
  Adds a favorite for the authenticated user and enforces top-five rules.
- `update_profile_and_review_usernames(p_user_id, p_username, p_avatar_url, p_bio)`  
  Updates profile fields and keeps review usernames in sync.

### Profiles setup (minimum required)

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1),
    'user'
  );

  insert into public.profiles (id, username)
  values (new.id, base_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
```

## Deployment

For GitHub Pages:

1. Push the project to GitHub.
2. Enable **Settings → Pages**.
3. Deploy from your main branch root.
4. Open the deployed `auth.html` page.
