# KinoRate — DIG4503C Midterm Project

**KinoRate** is a movie review web application built on the XAMPP stack (Apache, MySQL/MariaDB, PHP). Users can create accounts, write and manage reviews, customize their profiles, and showcase their all-time top-5 favorite films.

---

## Project Plan

### 1. Tech Stack
| Layer | Technology |
|-------|-----------|
| Web Server | Apache (via XAMPP) |
| Database | MySQL / MariaDB (via phpMyAdmin) |
| Back-end | PHP |
| Front-end | HTML5, CSS3, JavaScript |
| Local Dev | XAMPP |

### 2. Planned Features

#### 2.1 User Accounts
- User registration (username, email, password with hashed storage)
- User login / logout with session management
- Account settings page

#### 2.2 Profile Customisation
- Upload and change profile picture (stored server-side, path saved in DB)
- Public profile page displaying username, avatar, bio, and pinned favorites

#### 2.3 Reviews
- **Create** a review: movie title, score (1–10), written review body, date
- **Edit** an existing review (author-only)
- **Delete** a review (author-only)
- Review listing page with pagination

#### 2.4 Top-5 Favorites Pin
- Each user can pin up to 5 favorite movies on their profile
- Pinned films are displayed prominently on the public profile
- Users can add, reorder, or remove pinned entries at any time

### 3. Database Schema (Draft)

```
users
  id          INT PK AUTO_INCREMENT
  username    VARCHAR(50) UNIQUE NOT NULL
  email       VARCHAR(100) UNIQUE NOT NULL
  password    VARCHAR(255) NOT NULL   -- bcrypt hash
  avatar_path VARCHAR(255)
  bio         TEXT
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP

reviews
  id          INT PK AUTO_INCREMENT
  user_id     INT FK → users.id
  movie_title VARCHAR(200) NOT NULL
  score       TINYINT (1–10)
  body        TEXT
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at  TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

favorites
  id          INT PK AUTO_INCREMENT
  user_id     INT FK → users.id
  movie_title VARCHAR(200) NOT NULL
  position    TINYINT (1–5)
```

### 4. Page Map

| Page | Description |
|------|-------------|
| `index.html` | Public landing page |
| `register.php` | New user registration form |
| `login.php` | Login form |
| `logout.php` | Session destroy + redirect |
| `profile.php?user=<id>` | Public profile (avatar, bio, top-5, reviews) |
| `settings.php` | Edit avatar, bio, password |
| `reviews/create.php` | Write a new review |
| `reviews/edit.php?id=<id>` | Edit an existing review |
| `reviews/delete.php?id=<id>` | Delete confirmation + action |

### 5. Development Milestones

- [ ] **M1** — Repo setup: landing page, README, `.gitignore`
- [ ] **M2** — Database schema, XAMPP local environment configured
- [ ] **M3** — User registration, login, logout
- [ ] **M4** — Profile page + avatar upload
- [ ] **M5** — Review CRUD (create, read, edit, delete)
- [ ] **M6** — Top-5 favorites feature
- [ ] **M7** — UI polish (dark theme, responsive layout)
- [ ] **M8** — Testing, bug fixes, final submission

---

## Getting Started (Local Dev)

1. Install [XAMPP](https://www.apachefriends.org/) and start Apache + MySQL.
2. Clone this repository into `htdocs/KinoRate/`.
3. Import the SQL schema from `db/schema.sql` into phpMyAdmin.
4. Copy `config/db.example.php` to `config/db.php` and fill in your credentials.
5. Visit `http://localhost/KinoRate/` in your browser.

---

## License

This project is created for academic purposes as part of **DIG4503C**.