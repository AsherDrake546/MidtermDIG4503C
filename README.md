# KinoRate - DIG4503C Midterm Project

**KinoRate** is a Letterboxd-style movie review web application built with vanilla JavaScript and Supabase. Users can create accounts, write and manage reviews, customize their profiles, and showcase their favorite films.

---

## Project Status

### Phase 1: 🔄 In Progress
**User Accounts** - Registration, login/logout, session persistence

### Phase 2: Planned
**Movie Reviews** - Search movies, write reviews, star ratings

### Phase 3: Planned
**Profile Customization** - Profile picture, bio, top 5 favorites

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Auth + Database | Supabase |
| Frontend | HTML5, CSS3, JavaScript |
| Deployment | GitHub Pages |

## Getting Started

### Running Locally

Simply open `index.html` in your browser or use any local file server:

```bash
# Option 1: Direct
open index.html

# Option 2: With Python
python -m http.server 8000

# Option 3: With Node.js
node -e "require('http').createServer((q,s)=>require('fs').readFile('.'+q.url,(e,d)=>s.end(d))).listen(8000)"
```

Then visit `http://localhost:8000/` or open `index.html` directly.

### Environment Setup

This project uses Supabase for auth and data storage. Before running locally, create a `js/supabase-config.js` file with your project credentials:

```js
const SUPABASE_URL = 'your-project-url'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

Your URL and anon key can be found in your Supabase project under Settings > API Keys.

## Project Structure

```
.
├── index.html              # Home / landing page
├── auth.html               # Login/signup form
├── style.css               # Styling
└── js/
    ├── supabase-config.js  # Supabase credentials (not committed)
    └── auth.js             # Auth logic and session management
```

## Features

### 🔄 Phase 1: User Accounts
- [ ] User registration with validation
- [ ] User login with password verification
- [ ] User logout with session clearing
- [ ] Session persistence (survives page refresh)

### Planned: Phase 2 - Movie Reviews
- [ ] Search movies via TMDB API
- [ ] Write reviews with star ratings
- [ ] Edit and delete reviews
- [ ] View all reviews on profile

### Planned: Phase 3 - Profile
- [ ] Profile picture upload
- [ ] Bio and display name
- [ ] Top 5 favorite films
- [ ] Public profile page

## Data Storage

All user data and reviews are stored in Supabase with row-level security so each user can only access their own data. Session tokens are managed automatically by the Supabase JS SDK via localStorage.
