# KinoRate - DIG4503C Midterm Project

**KinoRate** is a Letterboxd-style movie review web application built with vanilla JavaScript and Supabase Auth.

## Current Status

### Phase 1: Completed
- User account signup/login via Supabase Auth
- Client-side session guards for protected page routing
- Logout from protected pages

### Phase 2: In Progress
**Movie Search and Reviews**

- [x] Connect to TMDB API for movie search (connection test page)
- [ ] Display movie results with poster, title, and year
- [ ] Write a review with star rating and text
- [ ] Save reviews to Supabase database
- [ ] Edit and delete your own reviews

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Auth + Session | Supabase Auth (JS SDK) |
| Movie Data | TMDB API |
| Frontend | HTML5, CSS3, JavaScript |
| Hosting | GitHub Pages |

## Running Locally

You can run this as a static site.

1. Create `js/supabase-config.js` from `js/supabase-config.example.js`, then fill in your credentials and API key:

```js
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "your-tmdb-api-key";
```

2. Open `auth.html` and sign in.
3. Navigate to `search.html` to verify TMDB connectivity.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, open **Pages**.
3. Set source to **Deploy from a branch**.
4. Choose branch (usually `main`) and folder `/ (root)`.
5. Save and wait for deployment.
6. Visit the generated Pages URL and open `auth.html`.

## Supabase Profiles Setup (for public user pages)

Run this once in Supabase SQL Editor:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
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

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

```

The app now reads usernames from `profiles` for user search and nav display, with fallback to email prefix.

## Project Structure

```
.
├── index.html              # Protected home page
├── auth.html               # Signup/login page
├── search.html             # Phase 2 movie search scaffold + TMDB health check
├── style.css               # Shared styling
└── js/
    ├── supabase-config.example.js  # Template config (safe to commit)
    ├── supabase-config.js          # Local secrets (gitignored)
    ├── auth.js                     # Auth logic and route guards
    ├── index-search.js             # Index typeahead search
    └── search.js                   # TMDB connection test logic
```

