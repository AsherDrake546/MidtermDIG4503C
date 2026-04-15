const movieSearchForm = document.getElementById("index-search-form");
const movieSearchInput = document.getElementById("index-movie-query");
const movieSuggestionList = document.getElementById("index-suggestion-list");

const userSearchForm = document.getElementById("index-user-search-form");
const userSearchInput = document.getElementById("index-user-query");
const userSuggestionList = document.getElementById("index-user-suggestion-list");

const recentReviewsRail = document.getElementById("recent-reviews-rail");
const highestRatedRail = document.getElementById("highest-rated-rail");

const imageBase = "https://image.tmdb.org/t/p/w92";

function getTmdbConfig() {
  const configBase = window.appConfig?.tmdb?.apiBaseUrl;
  const configKey = window.appConfig?.tmdb?.apiKey;
  const fallbackBase = typeof TMDB_API_BASE_URL === "string" ? TMDB_API_BASE_URL : "https://api.themoviedb.org/3";
  const fallbackKey = typeof TMDB_API_KEY === "string" ? TMDB_API_KEY.trim() : "";

  return {
    apiBaseUrl: typeof configBase === "string" && configBase.trim() ? configBase.trim() : fallbackBase,
    apiKey: typeof configKey === "string" && configKey.trim() ? configKey.trim() : fallbackKey,
  };
}

function goToSearchPage(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }
  window.location.href = `search.html?query=${encodeURIComponent(trimmed)}`;
}

function goToMoviePage(movieId) {
  if (!movieId) {
    return;
  }
  window.location.href = `movie.html?id=${encodeURIComponent(String(movieId))}`;
}

function goToUserPage(username) {
  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!trimmed) {
    return;
  }
  window.location.href = `user.html?username=${encodeURIComponent(trimmed)}`;
}

function createProfileAvatarElement(username, avatarUrl, className = "suggestion-avatar") {
  const cleanAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";

  if (cleanAvatarUrl) {
    const avatarImg = document.createElement("img");
    avatarImg.className = className;
    avatarImg.src = cleanAvatarUrl;
    avatarImg.alt = `${username || "User"} avatar`;
    avatarImg.loading = "lazy";
    return avatarImg;
  }

  const fallback = document.createElement("div");
  fallback.className = `${className} suggestion-avatar-fallback`;
  fallback.textContent = (username?.trim().charAt(0) || "?").toUpperCase();
  return fallback;
}

function setupMovieTypeahead() {
  if (!movieSearchForm || !movieSearchInput || !movieSuggestionList) {
    return;
  }

  let debounceHandle;
  let requestCounter = 0;
  let activeIndex = -1;
  let currentResults = [];

  function getMovieYear(item) {
    return item.release_date ? item.release_date.slice(0, 4) : "Unknown";
  }

  function clearSuggestions() {
    movieSuggestionList.replaceChildren();
  }

  function openSuggestions() {
    movieSuggestionList.classList.add("open");
    movieSearchInput.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    movieSuggestionList.classList.remove("open");
    movieSearchInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function syncActiveItem() {
    const items = movieSuggestionList.querySelectorAll(".suggestion-item[data-index]");
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  }

  function createPosterElement(item) {
    const posterPath = typeof item.poster_path === "string" ? item.poster_path : "";

    if (!posterPath.startsWith("/")) {
      const fallback = document.createElement("div");
      fallback.className = "suggestion-poster suggestion-poster-fallback";
      fallback.textContent = "No image";
      return fallback;
    }

    const poster = document.createElement("img");
    poster.className = "suggestion-poster";
    poster.loading = "lazy";
    poster.alt = `${item.title || "Movie"} poster`;
    poster.src = `${imageBase}${posterPath}`;
    return poster;
  }

  function renderSuggestionItems(items) {
    currentResults = items;
    clearSuggestions();
    activeIndex = -1;

    for (const [index, item] of items.entries()) {
      const li = document.createElement("li");
      li.className = "suggestion-item";
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(index));
      li.tabIndex = -1;

      li.appendChild(createPosterElement(item));

      const textWrap = document.createElement("div");
      textWrap.className = "suggestion-text";

      const title = document.createElement("span");
      title.className = "suggestion-title";
      title.textContent = item.title || "Untitled";

      const year = document.createElement("span");
      year.className = "suggestion-year";
      year.textContent = getMovieYear(item);

      textWrap.appendChild(title);
      textWrap.appendChild(year);
      li.appendChild(textWrap);

      li.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      li.addEventListener("mouseenter", () => {
        activeIndex = index;
        syncActiveItem();
      });

      li.addEventListener("click", () => {
        goToMoviePage(item.id);
      });

      movieSuggestionList.appendChild(li);
    }

    openSuggestions();
  }

  function renderInfo(message, state = "info") {
    currentResults = [];
    activeIndex = -1;
    clearSuggestions();

    const li = document.createElement("li");
    li.className = `suggestion-item suggestion-${state}`;
    li.setAttribute("role", "option");
    li.textContent = message;
    movieSuggestionList.appendChild(li);

    openSuggestions();
  }

  async function fetchSuggestions(query, localRequestId) {
    const tmdbConfig = getTmdbConfig();
    if (!tmdbConfig?.apiKey) {
      renderInfo("TMDB API key is missing in js/supabase-config.js", "error");
      return;
    }

    const endpoint = `${tmdbConfig.apiBaseUrl}/search/movie?api_key=${encodeURIComponent(tmdbConfig.apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
    renderInfo("Searching...", "loading");

    try {
      const response = await fetch(endpoint);
      const payload = await response.json();

      if (localRequestId !== requestCounter) {
        return;
      }

      if (!response.ok) {
        const errorMessage = payload.status_message || "Search failed.";
        renderInfo(`TMDB error: ${errorMessage}`, "error");
        return;
      }

      const results = Array.isArray(payload.results) ? payload.results.slice(0, 10) : [];

      if (results.length === 0) {
        renderInfo("No matches yet.", "info");
        return;
      }

      renderSuggestionItems(results);
    } catch (error) {
      if (localRequestId !== requestCounter) {
        return;
      }
      renderInfo(`Connection error: ${error.message}`, "error");
    }
  }

  movieSearchInput.addEventListener("input", () => {
    const query = movieSearchInput.value.trim();
    clearTimeout(debounceHandle);

    if (!query) {
      closeSuggestions();
      clearSuggestions();
      currentResults = [];
      return;
    }

    debounceHandle = setTimeout(() => {
      requestCounter += 1;
      fetchSuggestions(query, requestCounter);
    }, 300);
  });

  movieSearchInput.addEventListener("keydown", (event) => {
    const hasSelectable = currentResults.length > 0;

    if (event.key === "ArrowDown" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex < currentResults.length - 1 ? activeIndex + 1 : 0;
      syncActiveItem();
      openSuggestions();
      return;
    }

    if (event.key === "ArrowUp" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex > 0 ? activeIndex - 1 : currentResults.length - 1;
      syncActiveItem();
      openSuggestions();
      return;
    }

    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        goToMoviePage(currentResults[activeIndex].id);
        return;
      }
      goToSearchPage(movieSearchInput.value);
    }
  });

  movieSearchInput.addEventListener("focus", () => {
    if (movieSuggestionList.children.length > 0) {
      openSuggestions();
    }
  });

  movieSearchInput.addEventListener("blur", () => {
    setTimeout(closeSuggestions, 120);
  });

  movieSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeIndex >= 0 && currentResults[activeIndex]) {
      goToMoviePage(currentResults[activeIndex].id);
      return;
    }
    goToSearchPage(movieSearchInput.value);
  });
}

function setupUserTypeahead() {
  if (!userSearchForm || !userSearchInput || !userSuggestionList) {
    return;
  }

  let debounceHandle;
  let requestCounter = 0;
  let activeIndex = -1;
  let currentResults = [];

  function clearSuggestions() {
    userSuggestionList.replaceChildren();
  }

  function openSuggestions() {
    userSuggestionList.classList.add("open");
    userSearchInput.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    userSuggestionList.classList.remove("open");
    userSearchInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function syncActiveItem() {
    const items = userSuggestionList.querySelectorAll(".suggestion-item[data-index]");
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  }

  function renderInfo(message, state = "info") {
    currentResults = [];
    activeIndex = -1;
    clearSuggestions();

    const li = document.createElement("li");
    li.className = `suggestion-item suggestion-${state}`;
    li.setAttribute("role", "option");
    li.textContent = message;
    userSuggestionList.appendChild(li);

    openSuggestions();
  }

  function renderSuggestionItems(items) {
    currentResults = items;
    clearSuggestions();
    activeIndex = -1;

    for (const [index, item] of items.entries()) {
      const username = item.username;
      const li = document.createElement("li");
      li.className = "suggestion-item";
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(index));
      li.tabIndex = -1;

      li.appendChild(createProfileAvatarElement(username, item.avatar_url));

      const textWrap = document.createElement("div");
      textWrap.className = "suggestion-text";

      const name = document.createElement("span");
      name.className = "suggestion-title";
      name.textContent = username;

      const subtitle = document.createElement("span");
      subtitle.className = "suggestion-year";
      subtitle.textContent = "User";

      textWrap.appendChild(name);
      textWrap.appendChild(subtitle);
      li.appendChild(textWrap);

      li.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      li.addEventListener("mouseenter", () => {
        activeIndex = index;
        syncActiveItem();
      });

      li.addEventListener("click", () => {
        goToUserPage(username);
      });

      userSuggestionList.appendChild(li);
    }

    openSuggestions();
  }

  async function getCurrentUserUsername() {
    const { data, error } = await window.supabaseClient.auth.getUser();
    if (error) {
      return "";
    }

    const user = data?.user;
    if (!user) {
      return "";
    }

    const metadataUsername = typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username.trim()
      : "";

    if (metadataUsername) {
      return metadataUsername;
    }

    if (typeof user.email === "string" && user.email.includes("@")) {
      return user.email.split("@")[0].trim();
    }

    return "";
  }

  async function fetchSuggestions(query, localRequestId) {
    renderInfo("Searching users...", "loading");

    const [{ data, error }, currentUsername] = await Promise.all([
      window.supabaseClient
        .from("profiles")
        .select("username, avatar_url")
        .ilike("username", `%${query}%`)
        .not("username", "is", null)
        .order("username", { ascending: true })
        .limit(25),
      getCurrentUserUsername()
    ]);

    if (localRequestId !== requestCounter) {
      return;
    }

    if (error) {
      renderInfo(`User search error: ${error.message}`, "error");
      return;
    }

    const profileRows = (data || [])
      .map((row) => ({
        username: typeof row.username === "string" ? row.username.trim() : "",
        avatar_url: typeof row.avatar_url === "string" ? row.avatar_url.trim() : ""
      }))
      .filter((row) => row.username.length > 0);

    const queryLower = query.toLowerCase();
    const localMatches = currentUsername && currentUsername.toLowerCase().includes(queryLower)
      ? [{ username: currentUsername, avatar_url: "" }]
      : [];

    const uniqueUsernamesByKey = new Map();
    for (const row of [...localMatches, ...profileRows]) {
      const key = row.username.toLowerCase();
      const existing = uniqueUsernamesByKey.get(key);
      if (!existing) {
        uniqueUsernamesByKey.set(key, row);
        continue;
      }
      const existingAvatar = typeof existing.avatar_url === "string" ? existing.avatar_url.trim() : "";
      const candidateAvatar = typeof row.avatar_url === "string" ? row.avatar_url.trim() : "";
      if (!existingAvatar && candidateAvatar) {
        uniqueUsernamesByKey.set(key, row);
      }
    }
    const uniqueUsernames = [...uniqueUsernamesByKey.values()].slice(0, 10);

    if (uniqueUsernames.length === 0) {
      renderInfo("No users found.", "info");
      return;
    }

    renderSuggestionItems(uniqueUsernames);
  }

  userSearchInput.addEventListener("input", () => {
    const query = userSearchInput.value.trim();
    clearTimeout(debounceHandle);

    if (!query) {
      closeSuggestions();
      clearSuggestions();
      currentResults = [];
      return;
    }

    debounceHandle = setTimeout(() => {
      requestCounter += 1;
      fetchSuggestions(query, requestCounter);
    }, 300);
  });

  userSearchInput.addEventListener("keydown", (event) => {
    const hasSelectable = currentResults.length > 0;

    if (event.key === "ArrowDown" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex < currentResults.length - 1 ? activeIndex + 1 : 0;
      syncActiveItem();
      openSuggestions();
      return;
    }

    if (event.key === "ArrowUp" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex > 0 ? activeIndex - 1 : currentResults.length - 1;
      syncActiveItem();
      openSuggestions();
      return;
    }

    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        goToUserPage(currentResults[activeIndex].username);
      }
    }
  });

  userSearchInput.addEventListener("focus", () => {
    if (userSuggestionList.children.length > 0) {
      openSuggestions();
    }
  });

  userSearchInput.addEventListener("blur", () => {
    setTimeout(closeSuggestions, 120);
  });

  userSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeIndex >= 0 && currentResults[activeIndex]) {
      goToUserPage(currentResults[activeIndex].username);
      return;
    }
    goToUserPage(userSearchInput.value);
  });
}

async function loadRecentReviews() {
  if (!recentReviewsRail) {
    return;
  }

  recentReviewsRail.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "recent-review-card recent-review-card-info";
  loading.textContent = "Loading recent reviews...";
  recentReviewsRail.appendChild(loading);

  const { data, error } = await window.supabaseClient
    .from("movie_reviews")
    .select("id, username, movie_id, movie_title, rating, review_text, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  recentReviewsRail.replaceChildren();

  if (error) {
    const failure = document.createElement("div");
    failure.className = "recent-review-card recent-review-card-info";
    failure.textContent = `Could not load reviews: ${error.message}`;
    recentReviewsRail.appendChild(failure);
    return;
  }

  if (!data || data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "recent-review-card recent-review-card-info";
    empty.textContent = "No reviews yet.";
    recentReviewsRail.appendChild(empty);
    return;
  }

  const usernames = [...new Set(
    data
      .map((review) => (typeof review.username === "string" ? review.username.trim() : ""))
      .filter((username) => username.length > 0 && username.toLowerCase() !== "unknown")
  )];

  const avatarByUsername = new Map();
  if (usernames.length > 0) {
    const { data: profileRows } = await window.supabaseClient
      .from("profiles")
      .select("username, avatar_url")
      .in("username", usernames);

    for (const row of profileRows || []) {
      const key = typeof row.username === "string" ? row.username.trim().toLowerCase() : "";
      if (!key) {
        continue;
      }
      avatarByUsername.set(key, typeof row.avatar_url === "string" ? row.avatar_url.trim() : "");
    }
  }

  const cards = data.map((review) => {
    const card = document.createElement("article");
    card.className = "recent-review-card";
    card.tabIndex = 0;

    const title = document.createElement("h3");
    title.textContent = review.movie_title || `Movie #${review.movie_id}`;

    const byline = document.createElement("p");
    byline.className = "recent-review-byline";
    const bylineWrap = document.createElement("div");
    bylineWrap.className = "recent-review-byline-wrap";
    const reviewUsername = typeof review.username === "string" ? review.username.trim() : "";
    const avatar = createProfileAvatarElement(
      reviewUsername || "Unknown",
      avatarByUsername.get(reviewUsername.toLowerCase()) || "",
      "review-avatar"
    );
    const bylineLink = document.createElement("a");
    bylineLink.href = "#";
    bylineLink.textContent = reviewUsername || "Unknown";
    bylineLink.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      goToUserPage(reviewUsername || "");
    });
    byline.append("By ", bylineLink);
    bylineWrap.appendChild(avatar);
    bylineWrap.appendChild(byline);

    const rating = document.createElement("p");
    rating.className = "recent-review-rating";
    rating.textContent = `⭐ ${Number(review.rating).toFixed(1)} / 10`;

    const snippet = document.createElement("p");
    snippet.className = "recent-review-snippet";
    snippet.textContent = review.review_text || "";

    const timestamp = document.createElement("p");
    timestamp.className = "recent-review-time";
    timestamp.textContent = review.created_at ? new Date(review.created_at).toLocaleString() : "";

    card.appendChild(title);
    card.appendChild(bylineWrap);
    card.appendChild(rating);
    card.appendChild(snippet);
    card.appendChild(timestamp);

    const openMovie = () => {
      if (!review.movie_id) {
        return;
      }
      goToMoviePage(review.movie_id);
    };

    card.addEventListener("click", openMovie);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMovie();
      }
    });

    return card;
  });

  recentReviewsRail.replaceChildren(...cards);
}

function renderHighestRatedInfo(message) {
  if (!highestRatedRail) {
    return;
  }
  highestRatedRail.replaceChildren();
  const info = document.createElement("div");
  info.className = "highest-rated-card highest-rated-card-info";
  info.textContent = message;
  highestRatedRail.appendChild(info);
}

async function loadHighestRatedMovies() {
  if (!highestRatedRail) {
    return;
  }

  renderHighestRatedInfo("Loading highest rated movies...");

  const { data, error } = await window.supabaseClient
    .from("movie_reviews")
    .select("movie_id, movie_title, rating");

  if (error) {
    renderHighestRatedInfo(`Could not load highest rated movies: ${error.message}`);
    return;
  }

  const byMovie = new Map();
  for (const review of data || []) {
    const movieId = Number(review.movie_id);
    const rating = Number(review.rating);
    if (!Number.isFinite(movieId) || movieId <= 0 || !Number.isFinite(rating)) {
      continue;
    }

    const existing = byMovie.get(movieId) || {
      movie_id: movieId,
      movie_title: typeof review.movie_title === "string" && review.movie_title.trim()
        ? review.movie_title.trim()
        : `Movie #${movieId}`,
      sum: 0,
      count: 0
    };

    existing.sum += rating;
    existing.count += 1;
    byMovie.set(movieId, existing);
  }

  const ranked = [...byMovie.values()]
    .filter((movie) => movie.count >= 2)
    .map((movie) => ({
      movie_id: movie.movie_id,
      movie_title: movie.movie_title,
      average: movie.sum / movie.count,
      count: movie.count
    }))
    .sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average;
      }
      return b.count - a.count;
    })
    .slice(0, 10);

  if (ranked.length === 0) {
    renderHighestRatedInfo("Not enough ratings yet (need at least 2 ratings per movie).");
    return;
  }

  const cards = ranked.map((movie, index) => {
    const card = document.createElement("article");
    card.className = "highest-rated-card";
    card.tabIndex = 0;

    const rank = document.createElement("p");
    rank.className = "highest-rated-rank";
    rank.textContent = `#${index + 1}`;

    const title = document.createElement("h4");
    title.textContent = movie.movie_title;

    const rating = document.createElement("p");
    rating.className = "highest-rated-score";
    rating.textContent = `⭐ ${movie.average.toFixed(1)} / 10`;

    const meta = document.createElement("p");
    meta.className = "highest-rated-meta";
    meta.textContent = `${movie.count} rating${movie.count === 1 ? "" : "s"}`;

    card.appendChild(rank);
    card.appendChild(title);
    card.appendChild(rating);
    card.appendChild(meta);

    const openMovie = () => {
      goToMoviePage(movie.movie_id);
    };

    card.addEventListener("click", openMovie);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMovie();
      }
    });

    return card;
  });

  highestRatedRail.replaceChildren(...cards);
}

setupMovieTypeahead();
setupUserTypeahead();
loadRecentReviews();
loadHighestRatedMovies();
