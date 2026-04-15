const userPageStatus = document.getElementById("user-page-status");
const userProfileCard = document.getElementById("user-profile-card");
const userReviewsList = document.getElementById("user-reviews-list");
const userFavoritesGrid = document.getElementById("user-favorites-grid");
const userWatchlistsGrid = document.getElementById("user-watchlists-grid");

let currentSession = null;
let viewedProfile = null;
let isOwnerView = false;
let isFavoritesEditMode = false;
let currentFavorites = [];
let isFavoriteAddSubmitting = false;
let currentWatchlists = [];
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function getTmdbApiBaseUrl() {
  const configBase = window.appConfig?.tmdb?.apiBaseUrl;
  if (typeof configBase === "string" && configBase.trim()) {
    return configBase.trim();
  }
  if (typeof TMDB_API_BASE_URL === "string" && TMDB_API_BASE_URL.trim()) {
    return TMDB_API_BASE_URL.trim();
  }
  return "https://api.themoviedb.org/3";
}

function setStatus(message, kind = "info") {
  if (!userPageStatus) {
    return;
  }
  userPageStatus.textContent = message;
  userPageStatus.classList.remove("success", "error", "info");
  userPageStatus.classList.add(kind);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (typeof text === "string") {
    element.textContent = text;
  }
  return element;
}

function getProfileParam() {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username");
  const userId = params.get("id");

  if (username && username.trim()) {
    return { type: "username", value: username.trim() };
  }

  if (userId && userId.trim()) {
    return { type: "id", value: userId.trim() };
  }

  return null;
}

function deriveUsernameFromSession(session) {
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
    return email.split("@")[0].trim();
  }
  return "";
}

function resolveAvatarUrl(profile) {
  if (typeof profile.avatar_url === "string" && profile.avatar_url.trim()) {
    return profile.avatar_url.trim();
  }
  return "";
}

function sanitizeAvatarUrl(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) {
    return { ok: true, value: "" };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Avatar URL must start with http:// or https://." };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: "Avatar URL is invalid." };
  }
}

function renderProfileHeader(profile) {
  userProfileCard.replaceChildren();

  const wrap = makeElement("div", "user-profile-header");
  const avatarUrl = resolveAvatarUrl(profile);
  let avatar;

  if (avatarUrl) {
    avatar = makeElement("img", "user-profile-avatar");
    avatar.src = avatarUrl;
    avatar.alt = `${profile.username || "User"} avatar`;
    avatar.loading = "lazy";
  } else {
    avatar = makeElement("div", "user-profile-avatar user-profile-avatar-fallback", (profile.username?.charAt(0) || "?").toUpperCase());
  }

  const body = makeElement("div", "user-profile-body");
  const heading = makeElement("h1", "", profile.username || "Unknown User");
  const bio = makeElement("p", "user-profile-bio", profile.bio || "No bio yet.");

  body.appendChild(heading);
  body.appendChild(bio);

  wrap.appendChild(avatar);
  wrap.appendChild(body);

  userProfileCard.appendChild(wrap);
}

function buildProfileEditForm(profile, onSaved) {
  const form = makeElement("form", "profile-edit-form");
  form.id = "profile-edit-form";

  const usernameLabel = makeElement("label", "", "Username");
  usernameLabel.htmlFor = "profile-username";
  const usernameInput = makeElement("input", "");
  usernameInput.id = "profile-username";
  usernameInput.name = "username";
  usernameInput.required = true;
  usernameInput.maxLength = 50;
  usernameInput.value = profile.username || "";

  const avatarLabel = makeElement("label", "", "Profile picture URL");
  avatarLabel.htmlFor = "profile-avatar-url";
  const avatarInput = makeElement("input", "");
  avatarInput.id = "profile-avatar-url";
  avatarInput.name = "avatarUrl";
  avatarInput.type = "url";
  avatarInput.placeholder = "https://...";
  avatarInput.value = profile.avatar_url || "";

  const bioLabel = makeElement("label", "", "Bio");
  bioLabel.htmlFor = "profile-bio";
  const bioInput = makeElement("textarea", "");
  bioInput.id = "profile-bio";
  bioInput.name = "bio";
  bioInput.rows = 4;
  bioInput.maxLength = 500;
  bioInput.value = profile.bio || "";

  const status = makeElement("p", "tmdb-status info", "");
  status.id = "profile-edit-status";
  status.hidden = true;

  const saveButton = makeElement("button", "auth-btn", "Save Profile");
  saveButton.type = "submit";

  form.appendChild(usernameLabel);
  form.appendChild(usernameInput);
  form.appendChild(avatarLabel);
  form.appendChild(avatarInput);
  form.appendChild(bioLabel);
  form.appendChild(bioInput);
  form.appendChild(status);
  form.appendChild(saveButton);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nextUsername = usernameInput.value.trim();
    const nextAvatar = avatarInput.value.trim();
    const nextBio = bioInput.value.trim();

    if (!nextUsername) {
      status.hidden = false;
      status.textContent = "Username is required.";
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    const avatarCheck = sanitizeAvatarUrl(nextAvatar);
    if (!avatarCheck.ok) {
      status.hidden = false;
      status.textContent = avatarCheck.error;
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    status.hidden = false;
    status.textContent = "Saving profile...";
    status.classList.remove("success", "error");
    status.classList.add("info");

    const oldUsername = profile.username;
    const { error } = await window.supabaseClient.rpc("update_profile_and_review_usernames", {
      p_user_id: profile.id,
      p_username: nextUsername,
      p_avatar_url: avatarCheck.value || null,
      p_bio: nextBio || null
    });

    if (error) {
      status.textContent = `Could not update profile: ${error.message}`;
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    profile.username = nextUsername;
    profile.avatar_url = avatarCheck.value || null;
    profile.bio = nextBio || null;

    status.textContent = "Profile updated.";
    status.classList.remove("error", "info");
    status.classList.add("success");

    if (typeof onSaved === "function") {
      await onSaved(oldUsername !== nextUsername);
    }
  });

  return form;
}

function renderOwnerControls(profile) {
  const actions = makeElement("div", "profile-owner-actions");
  const editToggleButton = makeElement("button", "btn btn-outline btn-sm", "Edit Profile");
  editToggleButton.type = "button";
  actions.appendChild(editToggleButton);
  userProfileCard.appendChild(actions);

  let editForm = null;

  editToggleButton.addEventListener("click", () => {
    if (editForm) {
      editForm.remove();
      editForm = null;
      editToggleButton.textContent = "Edit Profile";
      return;
    }

    editForm = buildProfileEditForm(profile, async (usernameChanged) => {
      renderProfileHeader(profile);
      renderOwnerControls(profile);
      if (usernameChanged) {
        window.history.replaceState({}, "", `user.html?username=${encodeURIComponent(profile.username)}`);
      }
      await loadUserReviews(profile.id);
      await loadUserFavorites(profile.id);
    });

    userProfileCard.appendChild(editForm);
    editToggleButton.textContent = "Hide Edit Profile";
  });
}

function createFavoritePoster(favorite) {
  const posterPath = typeof favorite.poster_path === "string" ? favorite.poster_path : "";
  if (!posterPath.startsWith("/")) {
    return makeElement("div", "favorite-movie-poster favorite-movie-poster-fallback", "No Poster");
  }

  const poster = makeElement("img", "favorite-movie-poster");
  poster.src = `https://image.tmdb.org/t/p/w342${posterPath}`;
  poster.alt = `${favorite.movie_title || "Movie"} poster`;
  poster.loading = "lazy";
  return poster;
}

function createAddFavoriteSlot() {
  const button = makeElement("button", "favorite-add-slot", "+");
  button.type = "button";
  button.setAttribute("aria-label", "Add movie to top five");
  const label = makeElement("span", "favorite-add-slot-label", "Add Movie");
  button.appendChild(label);
  return button;
}

function getTmdbApiKey() {
  const configKey = window.appConfig?.tmdb?.apiKey;
  if (typeof configKey === "string" && configKey.trim()) {
    return configKey.trim();
  }
  return typeof TMDB_API_KEY === "string" && TMDB_API_KEY.trim() ? TMDB_API_KEY.trim() : "";
}

async function searchMoviesByTitle(query) {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new Error("TMDB API key is missing.");
  }

  const endpoint = `${getTmdbApiBaseUrl()}/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
  const response = await fetch(endpoint);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.status_message || "Movie search failed.");
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.slice(0, 8).map((movie) => ({
    id: Number(movie.id),
    title: typeof movie.title === "string" ? movie.title : "Untitled",
    poster_path: typeof movie.poster_path === "string" ? movie.poster_path : null,
    release_date: typeof movie.release_date === "string" ? movie.release_date : ""
  })).filter((movie) => Number.isFinite(movie.id) && movie.id > 0);
}

async function addFavoriteFromMovieResult(movie, triggerButton) {
  if (!currentSession?.user?.id || !viewedProfile?.id || !movie?.id) {
    setStatus("Session or movie context missing.", "error");
    return false;
  }

  if (viewedProfile.id !== currentSession.user.id) {
    setStatus("You can only edit your own top five.", "error");
    return false;
  }

  if (isFavoriteAddSubmitting) {
    return false;
  }

  isFavoriteAddSubmitting = true;

  if (triggerButton) {
    triggerButton.disabled = true;
  }

  const { error } = await window.supabaseClient.rpc("add_user_favorite", {
    p_movie_id: movie.id,
    p_movie_title: movie.title || "Untitled",
    p_poster_path: movie.poster_path || null
  });

  isFavoriteAddSubmitting = false;

  if (triggerButton) {
    triggerButton.disabled = false;
  }

  if (error) {
    const message = typeof error.message === "string" ? error.message : "Could not add favorite.";
    if (message.toLowerCase().includes("already in your top five")) {
      setStatus("This movie is already in your top five.", "info");
      return false;
    }
    if (message.toLowerCase().includes("only have five")) {
      setStatus("You can only have five favorite movies.", "error");
      return false;
    }
    setStatus(`Could not add favorite: ${message}`, "error");
    return false;
  }

  setStatus(`Added "${movie.title}" to your top five.`, "success");
  await loadUserFavorites(viewedProfile.id);
  return true;
}

function openAddFavoriteModal() {
  isFavoriteAddSubmitting = false;
  const modal = makeElement("div", "favorite-add-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Add movie to top five");

  const backdrop = makeElement("div", "favorite-add-modal-backdrop");
  const panel = makeElement("div", "favorite-add-modal-panel");
  const header = makeElement("div", "favorite-add-modal-header");
  const title = makeElement("h3", "", "Add Movie to Top Five");
  const closeButton = makeElement("button", "review-modal-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close add movie popup");
  header.appendChild(title);
  header.appendChild(closeButton);

  const searchForm = makeElement("form", "favorite-add-search-form");
  const input = makeElement("input", "favorite-add-input");
  input.type = "search";
  input.placeholder = "Search movie title...";
  input.required = true;
  input.maxLength = 120;

  const submit = makeElement("button", "btn btn-outline btn-sm", "Search");
  submit.type = "submit";
  searchForm.appendChild(input);
  searchForm.appendChild(submit);

  const resultList = makeElement("ul", "favorite-add-results");

  function closeModal() {
    modal.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onEscape);
    isFavoriteAddSubmitting = false;
  }

  function onEscape(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  function renderResults(items) {
    resultList.replaceChildren();
    if (!items.length) {
      resultList.appendChild(makeElement("li", "favorite-add-result-info", "No movies found."));
      return;
    }

    for (const movie of items) {
      const item = makeElement("li", "favorite-add-result-item");
      const posterPath = typeof movie.poster_path === "string" ? movie.poster_path : "";
      let poster;
      if (posterPath.startsWith("/")) {
        poster = makeElement("img", "favorite-add-result-poster");
        poster.src = `${IMAGE_BASE}${posterPath}`;
        poster.alt = `${movie.title} poster`;
        poster.loading = "lazy";
      } else {
        poster = makeElement("div", "favorite-add-result-poster favorite-movie-poster-fallback", "No Poster");
      }

      const text = makeElement("div", "favorite-add-result-text");
      text.appendChild(makeElement("span", "favorite-add-result-title", movie.title));
      const year = movie.release_date ? movie.release_date.slice(0, 4) : "Unknown";
      text.appendChild(makeElement("span", "favorite-add-result-year", year));

      const addButton = makeElement("button", "btn btn-outline btn-sm", "Add");
      addButton.type = "button";
      addButton.addEventListener("click", async () => {
        const added = await addFavoriteFromMovieResult(movie, addButton);
        if (added) {
          closeModal();
        }
      });

      item.appendChild(poster);
      item.appendChild(text);
      item.appendChild(addButton);
      resultList.appendChild(item);
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      return;
    }

    submit.disabled = true;
    resultList.replaceChildren(makeElement("li", "favorite-add-result-info", "Searching..."));

    try {
      const results = await searchMoviesByTitle(query);
      renderResults(results);
    } catch (error) {
      resultList.replaceChildren(makeElement("li", "favorite-add-result-info", `Search failed: ${error.message}`));
    } finally {
      submit.disabled = false;
    }
  });

  backdrop.addEventListener("click", closeModal);
  closeButton.addEventListener("click", closeModal);
  document.addEventListener("keydown", onEscape);

  panel.appendChild(header);
  panel.appendChild(searchForm);
  panel.appendChild(resultList);
  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.body.classList.add("modal-open");
  document.body.appendChild(modal);
  input.focus();
}

function buildAddFavoriteCard() {
  const card = makeElement("article", "favorite-movie-card favorite-movie-card-add");
  const trigger = createAddFavoriteSlot();
  trigger.addEventListener("click", () => {
    openAddFavoriteModal();
  });

  card.appendChild(trigger);
  return card;
}

function renderFavorites(favorites) {
  if (!userFavoritesGrid) {
    return;
  }

  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  if (safeFavorites.length === 0 && !(isOwnerView && isFavoritesEditMode)) {
    userFavoritesGrid.replaceChildren(makeElement("div", "reviews-empty-box", "No favorites added yet."));
    return;
  }

  const cards = safeFavorites.map((favorite) => {
    const card = makeElement("article", "favorite-movie-card");

    const link = makeElement("a", "favorite-movie-link");
    link.href = `movie.html?id=${encodeURIComponent(String(favorite.movie_id))}`;
    link.appendChild(createFavoritePoster(favorite));
    link.appendChild(makeElement("p", "favorite-movie-title", favorite.movie_title || `Movie #${favorite.movie_id}`));
    card.appendChild(link);

    if (isOwnerView && isFavoritesEditMode && favorite.user_id === currentSession?.user?.id) {
      const removeButton = makeElement("button", "btn btn-outline btn-sm", "Remove");
      removeButton.type = "button";
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        const { error } = await window.supabaseClient
          .from("user_favorites")
          .delete()
          .eq("id", favorite.id)
          .eq("user_id", currentSession.user.id);

        if (error) {
          setStatus(`Could not remove favorite: ${error.message}`, "error");
          removeButton.disabled = false;
          return;
        }

        await loadUserFavorites(viewedProfile.id);
      });
      card.appendChild(removeButton);
    }

    return card;
  });

  if (isOwnerView && isFavoritesEditMode && safeFavorites.length < 5) {
    cards.push(buildAddFavoriteCard());
  }

  userFavoritesGrid.replaceChildren(...cards);
}

function renderFavoritesOwnerControls() {
  const topFiveSection = document.getElementById("user-top-five");
  if (!topFiveSection || !isOwnerView) {
    return;
  }

  const existing = topFiveSection.querySelector(".favorites-owner-actions");
  if (existing) {
    existing.remove();
  }

  const actions = makeElement("div", "favorites-owner-actions");
  const editToggleButton = makeElement("button", "btn btn-outline btn-sm", isFavoritesEditMode ? "Done Editing Favorites" : "Edit Favorites");
  editToggleButton.type = "button";
  editToggleButton.addEventListener("click", async () => {
    isFavoritesEditMode = !isFavoritesEditMode;
    await loadUserFavorites(viewedProfile.id);
  });

  actions.appendChild(editToggleButton);
  topFiveSection.appendChild(actions);
}

function createWatchlistIconElement(item) {
  const posterPath = typeof item.first_poster_path === "string" ? item.first_poster_path : "";
  if (posterPath.startsWith("/")) {
    const icon = makeElement("img", "watchlist-icon");
    icon.src = `https://image.tmdb.org/t/p/w342${posterPath}`;
    icon.alt = `${item.name || "Watch list"} icon`;
    icon.loading = "lazy";
    return icon;
  }
  return makeElement("div", "watchlist-icon watchlist-icon-fallback", (item.name?.charAt(0) || "?").toUpperCase());
}

function renderWatchlistsOwnerControls() {
  const section = document.getElementById("user-watchlists-section");
  if (!section) {
    return;
  }

  const existing = section.querySelector(".watchlists-owner-actions");
  if (existing) {
    existing.remove();
  }

  if (!isOwnerView) {
    return;
  }

  const actions = makeElement("div", "watchlists-owner-actions");
  const createButton = makeElement("button", "btn btn-outline btn-sm", "Create List");
  createButton.type = "button";
  createButton.addEventListener("click", () => {
    openCreateWatchlistModal();
  });
  actions.appendChild(createButton);
  section.appendChild(actions);
}

function renderWatchlists(lists) {
  if (!userWatchlistsGrid) {
    return;
  }

  const safeLists = Array.isArray(lists) ? lists : [];
  if (safeLists.length === 0) {
    userWatchlistsGrid.replaceChildren(makeElement("div", "reviews-empty-box", "No watch lists yet."));
    return;
  }

  const cards = safeLists.map((list) => {
    const card = makeElement("article", "watchlist-card");
    const link = makeElement("a", "watchlist-card-link");
    link.href = `watchlist.html?id=${encodeURIComponent(String(list.id))}`;
    link.appendChild(createWatchlistIconElement(list));

    const textWrap = makeElement("div", "watchlist-card-body");
    textWrap.appendChild(makeElement("h3", "watchlist-card-title", list.name || "Untitled List"));
    textWrap.appendChild(makeElement("p", "watchlist-card-meta", `${list.item_count || 0} movie${(list.item_count || 0) === 1 ? "" : "s"}`));
    link.appendChild(textWrap);

    card.appendChild(link);
    return card;
  });

  userWatchlistsGrid.replaceChildren(...cards);
}

function openCreateWatchlistModal() {
  if (!isOwnerView || !viewedProfile?.id) {
    return;
  }

  const modal = makeElement("div", "favorite-add-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Create watch list");

  const backdrop = makeElement("div", "favorite-add-modal-backdrop");
  const panel = makeElement("div", "favorite-add-modal-panel");
  const header = makeElement("div", "favorite-add-modal-header");
  const title = makeElement("h3", "", "Create Watch List");
  const closeButton = makeElement("button", "review-modal-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close create watch list popup");
  header.appendChild(title);
  header.appendChild(closeButton);

  const form = makeElement("form", "favorite-add-search-form");
  const input = makeElement("input", "favorite-add-input");
  input.type = "text";
  input.placeholder = "List name...";
  input.required = true;
  input.maxLength = 80;
  const submit = makeElement("button", "btn btn-outline btn-sm", "Create");
  submit.type = "submit";
  form.appendChild(input);
  form.appendChild(submit);

  const status = makeElement("p", "tmdb-status info", "");
  status.hidden = true;

  function closeModal() {
    modal.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onEscape);
  }

  function onEscape(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      return;
    }

    submit.disabled = true;
    status.hidden = false;
    status.textContent = "Creating list...";
    status.classList.remove("success", "error");
    status.classList.add("info");

    const { error } = await window.supabaseClient
      .from("watch_lists")
      .insert({
        user_id: viewedProfile.id,
        owner_username: viewedProfile.username || deriveUsernameFromSession(currentSession) || "User",
        name
      });

    submit.disabled = false;

    if (error) {
      status.textContent = `Could not create list: ${error.message}`;
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    closeModal();
    await loadUserWatchlists(viewedProfile.id);
    setStatus("Watch list created.", "success");
  });

  backdrop.addEventListener("click", closeModal);
  closeButton.addEventListener("click", closeModal);
  document.addEventListener("keydown", onEscape);

  panel.appendChild(header);
  panel.appendChild(form);
  panel.appendChild(status);
  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.body.classList.add("modal-open");
  document.body.appendChild(modal);
  input.focus();
}

function buildReviewEditForm(review, onSaved) {
  const form = makeElement("form", "review-inline-edit-form");

  const ratingLabel = makeElement("label", "", "Rating (1-10)");
  const ratingInput = makeElement("input", "");
  ratingInput.type = "number";
  ratingInput.min = "1";
  ratingInput.max = "10";
  ratingInput.step = "1";
  ratingInput.required = true;
  ratingInput.value = String(Math.round(Number(review.rating) || 1));

  const textLabel = makeElement("label", "", "Review text");
  const textInput = makeElement("textarea", "");
  textInput.rows = 4;
  textInput.maxLength = 3000;
  textInput.required = true;
  textInput.value = review.review_text || "";

  const controls = makeElement("div", "review-inline-edit-controls");
  const saveButton = makeElement("button", "auth-btn", "Save Review");
  saveButton.type = "submit";
  const cancelButton = makeElement("button", "btn btn-outline btn-sm", "Cancel");
  cancelButton.type = "button";

  controls.appendChild(saveButton);
  controls.appendChild(cancelButton);

  const status = makeElement("p", "tmdb-status info", "");
  status.hidden = true;

  cancelButton.addEventListener("click", () => {
    onSaved(false);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nextRating = Number(ratingInput.value);
    const nextText = textInput.value.trim();

    if (!currentSession?.user?.id) {
      status.hidden = false;
      status.textContent = "Your session expired. Refresh and sign in again.";
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    if (!Number.isFinite(nextRating) || nextRating < 1 || nextRating > 10) {
      status.hidden = false;
      status.textContent = "Rating must be between 1 and 10.";
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    if (nextText.length < 5) {
      status.hidden = false;
      status.textContent = "Review text must be at least 5 characters.";
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    status.hidden = false;
    status.textContent = "Saving review...";
    status.classList.remove("success", "error");
    status.classList.add("info");

    const { error } = await window.supabaseClient
      .from("movie_reviews")
      .update({
        rating: nextRating,
        review_text: nextText,
      })
      .eq("id", review.id)
      .eq("user_id", currentSession.user.id);

    if (error) {
      status.textContent = `Could not update review: ${error.message}`;
      status.classList.remove("success", "info");
      status.classList.add("error");
      return;
    }

    onSaved(true);
  });

  form.appendChild(ratingLabel);
  form.appendChild(ratingInput);
  form.appendChild(textLabel);
  form.appendChild(textInput);
  form.appendChild(status);
  form.appendChild(controls);

  return form;
}

function renderReviewCards(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    userReviewsList.replaceChildren(makeElement("div", "reviews-empty-box", "No reviews yet."));
    return;
  }

  const cards = reviews.map((review) => {
    const card = makeElement("article", "user-review-card");

    const title = makeElement("h3", "user-review-movie-title", review.movie_title || `Movie #${review.movie_id}`);
    const titleLink = makeElement("a", "", review.movie_title || `Movie #${review.movie_id}`);
    titleLink.href = `movie.html?id=${encodeURIComponent(String(review.movie_id || ""))}`;
    title.replaceChildren(titleLink);

    const rating = makeElement("p", "user-review-rating", `⭐ ${Number(review.rating).toFixed(1)} / 10`);
    const text = makeElement("p", "user-review-text", review.review_text || "");
    const date = makeElement("p", "user-review-date", review.created_at ? `Saved: ${new Date(review.created_at).toLocaleString()}` : "");

    card.appendChild(title);
    card.appendChild(rating);
    card.appendChild(text);
    card.appendChild(date);

    if (isOwnerView && review.user_id === currentSession?.user?.id) {
      const editButton = makeElement("button", "btn btn-outline btn-sm", "Edit Review");
      editButton.type = "button";

      editButton.addEventListener("click", () => {
        const editForm = buildReviewEditForm(review, async (saved) => {
          if (saved) {
            await loadUserReviews(viewedProfile.id);
          } else {
            await loadUserReviews(viewedProfile.id);
          }
        });

        card.appendChild(editForm);
        editButton.disabled = true;
      });

      card.appendChild(editButton);
    }

    return card;
  });

  userReviewsList.replaceChildren(...cards);
}

async function loadUserReviews(profileId) {
  const { data, error } = await window.supabaseClient
    .from("movie_reviews")
    .select("id, user_id, movie_id, movie_title, rating, review_text, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Could not load user reviews: ${error.message}`, "error");
    return;
  }

  renderReviewCards(data || []);
}

async function loadUserFavorites(profileId) {
  if (!userFavoritesGrid) {
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("user_favorites")
    .select("id, user_id, movie_id, movie_title, poster_path, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    setStatus(`Could not load favorites: ${error.message}`, "error");
    return;
  }

  currentFavorites = data || [];
  renderFavoritesOwnerControls();
  renderFavorites(currentFavorites);
}

async function loadUserWatchlists(profileId) {
  if (!userWatchlistsGrid) {
    return;
  }

  const { data: lists, error } = await window.supabaseClient
    .from("watch_lists")
    .select("id, user_id, owner_username, name, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Could not load watch lists: ${error.message}`, "error");
    return;
  }

  const safeLists = lists || [];
  const ids = safeLists.map((list) => list.id);
  const posterByListId = new Map();
  const countByListId = new Map();

  if (ids.length > 0) {
    const { data: items, error: itemsError } = await window.supabaseClient
      .from("watch_list_items")
      .select("watch_list_id, poster_path, created_at")
      .in("watch_list_id", ids)
      .order("created_at", { ascending: true });

    if (itemsError) {
      setStatus(`Could not load watch list items: ${itemsError.message}`, "error");
      return;
    }

    for (const item of items || []) {
      const id = Number(item.watch_list_id);
      if (!Number.isFinite(id)) {
        continue;
      }
      if (!posterByListId.has(id) && typeof item.poster_path === "string" && item.poster_path.startsWith("/")) {
        posterByListId.set(id, item.poster_path);
      }
      countByListId.set(id, (countByListId.get(id) || 0) + 1);
    }
  }

  currentWatchlists = safeLists.map((list) => ({
    ...list,
    first_poster_path: posterByListId.get(Number(list.id)) || "",
    item_count: countByListId.get(Number(list.id)) || 0
  }));

  renderWatchlistsOwnerControls();
  renderWatchlists(currentWatchlists);
}

async function loadProfile() {
  const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
  if (sessionError || !sessionData?.session?.user?.id) {
    setStatus("You must be signed in.", "error");
    return;
  }

  currentSession = sessionData.session;

  const profileQuery = getProfileParam();
  let profile;
  let profileError;

  if (!profileQuery) {
    const fallbackUsername = deriveUsernameFromSession(currentSession);
    if (!fallbackUsername) {
      setStatus("No user specified.", "error");
      return;
    }

    ({ data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("id, username, avatar_url, bio")
      .eq("username", fallbackUsername)
      .maybeSingle());
  } else if (profileQuery.type === "username") {
    ({ data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("id, username, avatar_url, bio")
      .eq("username", profileQuery.value)
      .maybeSingle());
  } else {
    ({ data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("id, username, avatar_url, bio")
      .eq("id", profileQuery.value)
      .maybeSingle());
  }

  if (profileError) {
    setStatus(`Could not load user profile: ${profileError.message}`, "error");
    return;
  }

  if (!profile?.id) {
    setStatus("User profile not found.", "error");
    userProfileCard.replaceChildren(makeElement("div", "reviews-empty-box", "This user does not exist yet."));
    return;
  }

  viewedProfile = profile;
  isOwnerView = profile.id === currentSession.user.id;

  renderProfileHeader(profile);

  if (isOwnerView) {
    renderOwnerControls(profile);
  }

  await loadUserReviews(profile.id);
  await loadUserFavorites(profile.id);
  await loadUserWatchlists(profile.id);
  setStatus("User profile loaded.", "success");
}

loadProfile();
