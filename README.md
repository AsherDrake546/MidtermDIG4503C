# KinoRate - DIG4503C Midterm Project

**KinoRate** is a Letterboxd-style movie review web application built with vanilla JavaScript and Supabase Auth.

## Current Status

### Phase 1: In Progress
- User account signup/login via Supabase Auth
- Client-side session guards for protected page routing
- Logout from the home page when signed in

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Auth + Session | Supabase Auth (JS SDK) |
| Frontend | HTML5, CSS3, JavaScript |
| Hosting | GitHub Pages |

## Running Locally

You can run this as a static site:

1. Ensure `js/supabase-config.js` exists with valid credentials:

```js
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-key";
```

2. Open `auth.html` directly, or run a local static server.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, open **Pages**.
3. Set source to **Deploy from a branch**.
4. Choose branch (usually `main`) and folder `/ (root)`.
5. Save and wait for deployment.
6. Visit the generated Pages URL and open `auth.html`.

## Project Structure

```
.
├── index.html              # Protected home page (client-side session check)
├── auth.html               # Signup/login page
├── style.css               # Shared styling
└── js/
    ├── supabase-config.js  # Supabase credentials
    └── auth.js             # Auth logic and route guards
```
