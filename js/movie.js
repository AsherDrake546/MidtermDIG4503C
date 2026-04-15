const movieStatus = document.getElementById("movie-status");
const movieDetailCard = document.getElementById("movie-detail-card");
const movieUserReviews = document.getElementById("movie-user-reviews");
const reviewModal = document.getElementById("review-modal");
const reviewModalClose = document.getElementById("review-modal-close");
const reviewModalPoster = document.getElementById("review-modal-poster");
const reviewModalSubtitle = document.getElementById("review-modal-subtitle");
const reviewForm = document.getElementById("review-form");
const reviewRatingInput = document.getElementById("review-rating");
const reviewTextInput = document.getElementById("review-text");
const reviewFormStatus = document.getElementById("review-form-status");
const favoriteFormStatus = document.getElementById("favorite-form-status");

const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

let currentMovie = null;
let currentSession = null;
let currentUsername = "Current User";
let isReviewSubmitting = false;
let isFavoriteSubmitting = false;
let isMovieFavorited = false;
let favoriteToggleButton = null;
let kinoRateUserRatingMeta = null;
const profileAvatarCache = new Map();

function setMovieStatus(message, kind = "info") {
  if (!movieStatus) {
    return;
  }
  movieStatus.textContent = message;
  movieStatus.classList.remove("success", "error", "info");
  movieStatus.classList.add(kind);
}

function setReviewFormStatus(message, kind = "info") {
  if (!reviewFormStatus) {
    return;
  }

  reviewFormStatus.hidden = false;
  reviewFormStatus.textContent = message;
  reviewFormStatus.classList.remove("success", "error", "info");
  reviewFormStatus.classList.add(kind);
}

function clearReviewFormStatus() {
  if (!reviewFormStatus) {
    return;
  }
  reviewFormStatus.hidden = true;
  reviewFormStatus.textContent = "";
  reviewFormStatus.classList.remove("success", "error", "info");
}

function setFavoriteStatus(message, kind = "info") {
  if (!favoriteFormStatus) {
    return;
  }
  favoriteFormStatus.hidden = false;
  favoriteFormStatus.textContent = message;
  favoriteFormStatus.classList.remove("success", "error", "info");
  favoriteFormStatus.classList.add(kind);
}

function clearFavoriteStatus() {
  if (!favoriteFormStatus) {
    return;
  }
  favoriteFormStatus.hidden = true;
  favoriteFormStatus.textContent = "";
  favoriteFormStatus.classList.remove("success", "error", "info");
}

function updateFavoriteToggleButton() {
  if (!favoriteToggleButton) {
    return;
  }
  favoriteToggleButton.textContent = isMovieFavorited ? "Remove from Top Five" : "Add to Top Five";
}

async function refreshFavoriteState(movieId) {
  if (!favoriteToggleButton || !currentSession?.user?.id || !movieId) {
    return;
  }

  favoriteToggleButton.disabled = true;

  const { data, error } = await window.supabaseClient
    .from("user_favorites")
    .select("id")
    .eq("user_id", currentSession.user.id)
    .eq("movie_id", movieId)
    .limit(1);

  favoriteToggleButton.disabled = false;

  if (error) {
    setFavoriteStatus(`Could not load favorite state: ${error.message}`, "error");
    return;
  }

  isMovieFavorited = Array.isArray(data) && data.length > 0;
  updateFavoriteToggleButton();
}

async function saveFavoriteMovie(movie) {
  if (!currentSession?.user?.id || !movie?.id) {
    setFavoriteStatus("Session or movie context missing.", "error");
    return false;
  }

  if (isFavoriteSubmitting) {
    return false;
  }

  isFavoriteSubmitting = true;
  if (favoriteToggleButton) {
    favoriteToggleButton.disabled = true;
  }
  setFavoriteStatus("Saving favorite...", "info");

  try {
    const { error: addError } = await window.supabaseClient.rpc("add_user_favorite", {
      p_movie_id: movie.id,
      p_movie_title: movie.title || "Untitled",
      p_poster_path: typeof movie.poster_path === "string" ? movie.poster_path : null
    });

    if (addError) {
      const errorMessage = typeof addError.message === "string" ? addError.message : "Could not save favorite.";
      if (errorMessage.toLowerCase().includes("already in your top five")) {
        setFavoriteStatus("This movie is already in your top five.", "info");
        return false;
      }
      if (errorMessage.toLowerCase().includes("only have five")) {
        setFavoriteStatus("You can only have five favorite movies.", "error");
        return false;
      }
      setFavoriteStatus(`Could not save favorite: ${errorMessage}`, "error");
      return false;
    }

    setFavoriteStatus("Added to your top five favorites.", "success");
    return true;
  } finally {
    isFavoriteSubmitting = false;
    if (favoriteToggleButton) {
      favoriteToggleButton.disabled = false;
    }
  }
}

async function removeFavoriteMovie(movie) {
  if (!currentSession?.user?.id || !movie?.id) {
    setFavoriteStatus("Session or movie context missing.", "error");
    return false;
  }

  if (isFavoriteSubmitting) {
    return false;
  }

  isFavoriteSubmitting = true;
  if (favoriteToggleButton) {
    favoriteToggleButton.disabled = true;
  }
  setFavoriteStatus("Removing favorite...", "info");

  try {
    const { error } = await window.supabaseClient
      .from("user_favorites")
      .delete()
      .eq("user_id", currentSession.user.id)
      .eq("movie_id", movie.id);

    if (error) {
      setFavoriteStatus(`Could not remove favorite: ${error.message}`, "error");
      return false;
    }

    setFavoriteStatus("Removed from your top five favorites.", "success");
    return true;
  } finally {
    isFavoriteSubmitting = false;
    if (favoriteToggleButton) {
      favoriteToggleButton.disabled = false;
    }
  }
}

async function toggleFavoriteMovie(movie) {
  const success = isMovieFavorited
    ? await removeFavoriteMovie(movie)
    : await saveFavoriteMovie(movie);

  if (!success) {
    await refreshFavoriteState(movie.id);
    return;
  }

  isMovieFavorited = !isMovieFavorited;
  updateFavoriteToggleButton();
}

function makeElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (typeof text === "string") {
    el.textContent = text;
  }
  return el;
}

function getYear(dateString) {
  return dateString ? dateString.slice(0, 4) : "Unknown";
}

function getDirector(credits) {
  const crew = Array.isArray(credits?.crew) ? credits.crew : [];
  const director = crew.find((member) => member.job === "Director");
  return director?.name || "Unknown";
}

function getCast(credits) {
  const cast = Array.isArray(credits?.cast) ? credits.cast : [];
  if (cast.length === 0) {
    return "Unknown";
  }
  return cast.slice(0, 6).map((member) => member.name).join(", ");
}

function createMetaLine(label, value) {
  const p = makeElement("p", "result-meta");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  p.appendChild(strong);
  p.appendChild(document.createTextNode(value));
  return p;
}

function createTrailerSection() {
  const section = makeElement("section", "movie-trailer-section");
  const heading = makeElement("h2", "movie-trailer-heading", "Trailer");
  const frame = makeElement("div", "movie-trailer-frame");
  frame.appendChild(makeElement("p", "movie-trailer-status", "Loading trailer..."));
  section.appendChild(heading);
  section.appendChild(frame);
  return { section, frame };
}

function setTrailerFrameMessage(frame, message) {
  frame.replaceChildren(makeElement("p", "movie-trailer-status", message));
}

async function loadTrailerForMovie(movie, frame) {
  const youtubeApiKey = window.appConfig?.youtube?.apiKey;
  if (!youtubeApiKey) {
    setTrailerFrameMessage(frame, "Trailer unavailable. Add YOUTUBE_API_KEY in js/supabase-config.js.");
    return;
  }

  const year = getYear(movie.release_date);
  const director = getDirector(movie.credits);
  const searchParts = [
    movie.title || "",
    year !== "Unknown" ? year : "",
    director !== "Unknown" ? director : "",
    "official trailer",
  ].filter(Boolean);

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("maxResults", "1");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("videoEmbeddable", "true");
  endpoint.searchParams.set("videoSyndicated", "true");
  endpoint.searchParams.set("q", searchParts.join(" "));
  endpoint.searchParams.set("key", youtubeApiKey);

  try {
    const response = await fetch(endpoint.toString());
    const payload = await response.json();

    if (!response.ok) {
      const errorMessage = payload?.error?.message || "Failed to load trailer.";
      throw new Error(errorMessage);
    }

    const videoId = payload?.items?.[0]?.id?.videoId;
    if (!videoId) {
      setTrailerFrameMessage(frame, "No trailer found.");
      return;
    }

    const iframe = makeElement("iframe", "movie-trailer-embed");
    const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`);
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("modestbranding", "1");
    embedUrl.searchParams.set("playsinline", "1");
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      embedUrl.searchParams.set("origin", window.location.origin);
    }
    iframe.src = embedUrl.toString();
    iframe.title = `${movie.title || "Movie"} trailer`;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
  } catch (error) {
    setTrailerFrameMessage(frame, `Could not load trailer: ${error.message}`);
  }
}

function resolveUsername(session) {
  const metadata = session?.user?.user_metadata || {};
  if (typeof metadata.username === "string" && metadata.username.trim()) {
    return metadata.username.trim();
  }
  if (typeof metadata.display_name === "string" && metadata.display_name.trim()) {
    return metadata.display_name.trim();
  }
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }
  const email = session?.user?.email || "";
  if (email.includes("@")) {
    return email.split("@")[0];
  }
  return "Current User";
}

function renderEmptyUserReviews() {
  movieUserReviews.replaceChildren(makeElement("div", "reviews-empty-box", "No reviews yet for this movie."));
}

function renderUserReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    renderEmptyUserReviews();
    return;
  }

  const cards = reviews.map((review) => {
    const card = makeElement("article", "user-review-card");
    const storedUsername = typeof review.username === "string" ? review.username.trim() : "";
    const reviewUsername = storedUsername && storedUsername.toLowerCase() !== "unknown"
      ? storedUsername
      : "Unknown User";
    const ownReview = review.user_id === currentSession?.user?.id;
    const avatarWrap = makeElement("div", "user-review-header");
    let avatar = makeElement("img", "review-avatar");
    const avatarKey = reviewUsername.toLowerCase();
    const cachedAvatarUrl = profileAvatarCache.get(avatarKey) || "";

    if (cachedAvatarUrl) {
      avatar.src = cachedAvatarUrl;
      avatar.alt = `${reviewUsername} avatar`;
      avatar.loading = "lazy";
    } else {
      avatar = makeElement("div", "review-avatar review-avatar-fallback", reviewUsername.charAt(0).toUpperCase());
    }

    const byline = makeElement("p", "user-review-byline");
    const userLink = makeElement("a", "", reviewUsername);
    userLink.href = `user.html?username=${encodeURIComponent(reviewUsername)}`;
    byline.append("By ", userLink, ownReview ? " (You)" : "");
    const heading = makeElement("p", "user-review-rating", `⭐ ${Number(review.rating).toFixed(1)} / 10`);
    const body = makeElement("p", "user-review-text", review.review_text || "");
    const createdAt = review.created_at ? new Date(review.created_at).toLocaleString() : "";
    const stamp = makeElement("p", "user-review-date", createdAt ? `Saved: ${createdAt}` : "");

    avatarWrap.appendChild(avatar);
    avatarWrap.appendChild(byline);
    card.appendChild(avatarWrap);
    card.appendChild(heading);
    card.appendChild(body);
    card.appendChild(stamp);
    return card;
  });

  movieUserReviews.replaceChildren(...cards);
}

function updateKinoRateUserRating(reviews) {
  if (!kinoRateUserRatingMeta) {
    return;
  }

  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const numericRatings = safeReviews
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 10);

  const value = numericRatings.length > 0
    ? `⭐ ${(numericRatings.reduce((sum, rating) => sum + rating, 0) / numericRatings.length).toFixed(1)} / 10 (${numericRatings.length} rating${numericRatings.length === 1 ? "" : "s"})`
    : "No user ratings yet.";

  const strong = kinoRateUserRatingMeta.querySelector("strong");
  kinoRateUserRatingMeta.replaceChildren();
  if (strong) {
    kinoRateUserRatingMeta.appendChild(strong);
  } else {
    const label = document.createElement("strong");
    label.textContent = "KinoRate User Rating: ";
    kinoRateUserRatingMeta.appendChild(label);
  }
  kinoRateUserRatingMeta.appendChild(document.createTextNode(value));
}

async function loadUserReviews(movieId) {
  renderEmptyUserReviews();

  const { data, error } = await window.supabaseClient
    .from("movie_reviews")
    .select("id, user_id, username, rating, review_text, created_at")
    .eq("movie_id", movieId)
    .order("created_at", { ascending: false });

  if (error) {
    setMovieStatus(`Could not load movie reviews: ${error.message}`, "error");
    return;
  }

  updateKinoRateUserRating(data || []);

  const usernames = [...new Set(
    (data || [])
      .map((review) => (typeof review.username === "string" ? review.username.trim() : ""))
      .filter((username) => username.length > 0 && username.toLowerCase() !== "unknown")
  )];

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
      profileAvatarCache.set(key, typeof row.avatar_url === "string" ? row.avatar_url.trim() : "");
    }
  }

  renderUserReviews(data || []);
}

function openReviewModal() {
  if (!currentMovie || !reviewModal) {
    return;
  }

  const posterPath = typeof currentMovie.poster_path === "string" ? currentMovie.poster_path : "";
  reviewModalPoster.src = posterPath.startsWith("/") ? `${IMAGE_BASE}${posterPath}` : "";
  reviewModalPoster.alt = `${currentMovie.title || "Movie"} poster`;
  reviewModalPoster.hidden = !posterPath.startsWith("/");
  reviewModalSubtitle.textContent = `${currentMovie.title || "Untitled"} (${getYear(currentMovie.release_date)})`;

  clearReviewFormStatus();
  reviewModal.hidden = false;
}

function closeReviewModal() {
  if (!reviewModal) {
    return;
  }
  reviewModal.hidden = true;
  clearReviewFormStatus();
}

function renderMovieDetail(movie) {
  movieDetailCard.replaceChildren();
  currentMovie = movie;

  const posterPath = typeof movie.poster_path === "string" ? movie.poster_path : "";
  const poster = posterPath.startsWith("/")
    ? makeElement("img", "movie-poster")
    : makeElement("div", "movie-poster movie-poster-fallback", "No Poster");

  if (poster.tagName === "IMG") {
    poster.src = `${IMAGE_BASE}${posterPath}`;
    poster.alt = `${movie.title || "Movie"} poster`;
    poster.loading = "lazy";
  }

  const content = makeElement("div", "movie-detail-content");
  const heading = makeElement("h1", "", movie.title || "Untitled");
  const year = makeElement("span", "", ` (${getYear(movie.release_date)})`);
  heading.appendChild(year);

  const vote = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "N/A";
  const runtime = movie.runtime ? `${movie.runtime} min` : "Runtime unavailable";
  const genres = Array.isArray(movie.genres) && movie.genres.length > 0
    ? movie.genres.map((g) => g.name).join(", ")
    : "Genres unavailable";

  content.appendChild(heading);
  content.appendChild(createMetaLine("Rating", `⭐ ${vote} / 10`));
  content.appendChild(createMetaLine("Runtime", runtime));
  content.appendChild(createMetaLine("Release Date", movie.release_date || "Unknown"));
  content.appendChild(createMetaLine("Director", getDirector(movie.credits)));
  content.appendChild(createMetaLine("Cast", getCast(movie.credits)));
  content.appendChild(createMetaLine("Genres", genres));
  const trailer = createTrailerSection();
  content.appendChild(trailer.section);
  void loadTrailerForMovie(movie, trailer.frame);
  kinoRateUserRatingMeta = createMetaLine("KinoRate User Rating", "Loading...");
  content.appendChild(kinoRateUserRatingMeta);
  content.appendChild(makeElement("p", "result-overview", movie.overview || "No overview available."));

  const reviewButton = makeElement("button", "auth-btn write-review-btn", "Write Review");
  reviewButton.type = "button";
  reviewButton.addEventListener("click", openReviewModal);
  content.appendChild(reviewButton);

  favoriteToggleButton = makeElement("button", "btn btn-outline write-review-btn", "Add to Top Five");
  favoriteToggleButton.type = "button";
  favoriteToggleButton.addEventListener("click", () => {
    toggleFavoriteMovie(movie);
  });
  content.appendChild(favoriteToggleButton);

  movieDetailCard.appendChild(poster);
  movieDetailCard.appendChild(content);
  clearFavoriteStatus();
  void refreshFavoriteState(movie.id);
}

async function loadMoviePage() {
  const movieIdRaw = new URLSearchParams(window.location.search).get("id");
  const tmdbConfig = window.appConfig?.tmdb;

  if (!movieIdRaw) {
    setMovieStatus("No movie id provided.", "error");
    return;
  }

  if (!/^[0-9]+$/.test(movieIdRaw) || Number(movieIdRaw) <= 0) {
    setMovieStatus("Invalid movie id in URL.", "error");
    return;
  }

  if (!tmdbConfig?.apiKey) {
    setMovieStatus("TMDB API key is missing. Set TMDB_API_KEY in js/supabase-config.js.", "error");
    return;
  }

  const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
  if (sessionError || !sessionData?.session?.user?.id) {
    setMovieStatus("You must be signed in to view and write reviews.", "error");
    return;
  }

  currentSession = sessionData.session;
  currentUsername = resolveUsername(currentSession);
  const movieId = Number(movieIdRaw);

  setMovieStatus("Loading movie details...", "info");

  try {
    const endpoint = `${tmdbConfig.apiBaseUrl}/movie/${encodeURIComponent(String(movieId))}?api_key=${encodeURIComponent(tmdbConfig.apiKey)}&append_to_response=credits`;
    const response = await fetch(endpoint);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.status_message || "Failed to load movie details.");
    }

    renderMovieDetail(payload);
    await loadUserReviews(movieId);
    setMovieStatus("Movie details loaded.", "success");
  } catch (error) {
    setMovieStatus(`Failed to load movie: ${error.message}`, "error");
  }
}

if (reviewModalClose) {
  reviewModalClose.addEventListener("click", closeReviewModal);
}

if (reviewModal) {
  reviewModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeReviewModal === "true") {
      closeReviewModal();
    }
  });
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isReviewSubmitting) {
      return;
    }

    const submitButton = reviewForm.querySelector("button[type='submit']");

    if (!currentMovie?.id || !currentSession?.user?.id) {
      setReviewFormStatus("Movie or session context is missing.", "error");
      return;
    }

    const ratingValue = Number(reviewRatingInput.value);
    const reviewTextValue = reviewTextInput.value.trim();

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 10) {
      setReviewFormStatus("Rating must be between 1 and 10.", "error");
      return;
    }

    if (reviewTextValue.length < 5) {
      setReviewFormStatus("Review text must be at least 5 characters.", "error");
      return;
    }

    setReviewFormStatus("Saving review...", "info");
    isReviewSubmitting = true;
    if (submitButton) {
      submitButton.disabled = true;
    }

    const payload = {
      user_id: currentSession.user.id,
      username: currentUsername,
      movie_id: currentMovie.id,
      movie_title: currentMovie.title || "Untitled",
      rating: ratingValue,
      review_text: reviewTextValue,
    };

    try {
      const { error } = await window.supabaseClient
        .from("movie_reviews")
        .insert(payload);

      if (error) {
        setReviewFormStatus(`Could not save review: ${error.message}`, "error");
        return;
      }

      setReviewFormStatus("Review saved.", "success");
      await loadUserReviews(currentMovie.id);
      reviewForm.reset();
      setTimeout(closeReviewModal, 450);
    } finally {
      isReviewSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

loadMoviePage();
