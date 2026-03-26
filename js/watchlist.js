const watchlistPageStatus = document.getElementById("watchlist-page-status");
const watchlistDetailCard = document.getElementById("watchlist-detail-card");
const watchlistItemsRail = document.getElementById("watchlist-items-rail");

const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const TMDB_SEARCH_BASE = `${window.appConfig?.tmdb?.apiBaseUrl || "https://api.themoviedb.org/3"}/search/movie`;

let currentSession = null;
let currentWatchlist = null;
let isOwnerView = false;
let isAddingItem = false;

function setStatus(message, kind = "info") {
  if (!watchlistPageStatus) {
    return;
  }
  watchlistPageStatus.textContent = message;
  watchlistPageStatus.classList.remove("success", "error", "info");
  watchlistPageStatus.classList.add(kind);
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

function getWatchlistIdParam() {
  const raw = new URLSearchParams(window.location.search).get("id");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function searchMoviesByTitle(query) {
  const apiKey = window.appConfig?.tmdb?.apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("TMDB API key is missing.");
  }

  const endpoint = `${TMDB_SEARCH_BASE}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
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

function createPosterNode(posterPath, title) {
  if (typeof posterPath === "string" && posterPath.startsWith("/")) {
    const poster = makeElement("img", "watchlist-item-poster");
    poster.src = `${IMAGE_BASE}${posterPath}`;
    poster.alt = `${title || "Movie"} poster`;
    poster.loading = "lazy";
    return poster;
  }
  return makeElement("div", "watchlist-item-poster watchlist-item-poster-fallback", "No Poster");
}

async function openAddMovieModal() {
  if (!isOwnerView || !currentWatchlist?.id) {
    return;
  }

  const modal = makeElement("div", "favorite-add-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Add movie to watch list");

  const backdrop = makeElement("div", "favorite-add-modal-backdrop");
  const panel = makeElement("div", "favorite-add-modal-panel");
  const header = makeElement("div", "favorite-add-modal-header");
  const title = makeElement("h3", "", "Add Movie to List");
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

  const submit = makeElement("button", "btn btn-outline btn-sm", "Search");
  submit.type = "submit";
  searchForm.appendChild(input);
  searchForm.appendChild(submit);

  const resultList = makeElement("ul", "favorite-add-results");

  function closeModal() {
    modal.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onEscape);
    isAddingItem = false;
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
      const poster = createPosterNode(movie.poster_path, movie.title);
      poster.className = "favorite-add-result-poster";

      const text = makeElement("div", "favorite-add-result-text");
      text.appendChild(makeElement("span", "favorite-add-result-title", movie.title));
      text.appendChild(makeElement("span", "favorite-add-result-year", movie.release_date ? movie.release_date.slice(0, 4) : "Unknown"));

      const addButton = makeElement("button", "btn btn-outline btn-sm", "Add");
      addButton.type = "button";
      addButton.addEventListener("click", async () => {
        if (isAddingItem) {
          return;
        }
        isAddingItem = true;
        addButton.disabled = true;
        const { error } = await window.supabaseClient
          .from("watch_list_items")
          .insert({
            watch_list_id: currentWatchlist.id,
            movie_id: movie.id,
            movie_title: movie.title || "Untitled",
            poster_path: movie.poster_path || null,
            watched: false
          });

        isAddingItem = false;
        addButton.disabled = false;

        if (error) {
          setStatus(`Could not add movie: ${error.message}`, "error");
          return;
        }

        setStatus(`Added "${movie.title}" to this list.`, "success");
        closeModal();
        await loadWatchlistItems(currentWatchlist.id);
        await renderWatchlistHeader();
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
      renderResults(await searchMoviesByTitle(query));
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

async function renderWatchlistHeader() {
  if (!watchlistDetailCard || !currentWatchlist) {
    return;
  }

  const { data: firstItem } = await window.supabaseClient
    .from("watch_list_items")
    .select("poster_path")
    .eq("watch_list_id", currentWatchlist.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const iconPath = typeof firstItem?.poster_path === "string" ? firstItem.poster_path : "";

  const icon = iconPath.startsWith("/")
    ? createPosterNode(iconPath, currentWatchlist.name)
    : makeElement("div", "watchlist-icon watchlist-icon-fallback", (currentWatchlist.name?.charAt(0) || "?").toUpperCase());

  if (icon.tagName === "IMG") {
    icon.className = "watchlist-icon";
  }

  const body = makeElement("div", "watchlist-detail-body");
  body.appendChild(makeElement("h1", "", currentWatchlist.name || "Watch List"));
  const ownerLink = makeElement("a", "", currentWatchlist.owner_username || "User");
  ownerLink.href = `user.html?username=${encodeURIComponent(currentWatchlist.owner_username || "")}`;
  const subtitle = makeElement("p", "watchlist-detail-subtitle");
  subtitle.append("By ", ownerLink);
  body.appendChild(subtitle);

  watchlistDetailCard.replaceChildren();
  watchlistDetailCard.appendChild(icon);
  watchlistDetailCard.appendChild(body);

  if (isOwnerView) {
    const controls = makeElement("div", "watchlist-detail-actions");
    const addButton = makeElement("button", "btn btn-outline btn-sm", "Add Movie");
    addButton.type = "button";
    addButton.addEventListener("click", () => {
      openAddMovieModal();
    });
    controls.appendChild(addButton);
    watchlistDetailCard.appendChild(controls);
  }
}

async function loadWatchlistItems(watchListId) {
  if (!watchlistItemsRail) {
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("watch_list_items")
    .select("id, watch_list_id, movie_id, movie_title, poster_path, watched, created_at")
    .eq("watch_list_id", watchListId)
    .order("created_at", { ascending: true });

  if (error) {
    setStatus(`Could not load watch list items: ${error.message}`, "error");
    return;
  }

  const items = data || [];
  if (items.length === 0) {
    watchlistItemsRail.replaceChildren(makeElement("div", "reviews-empty-box", "No movies in this list yet."));
    return;
  }

  const cards = items.map((item) => {
    const card = makeElement("article", "watchlist-item-card");
    const link = makeElement("a", "watchlist-item-link");
    link.href = `movie.html?id=${encodeURIComponent(String(item.movie_id))}`;
    link.appendChild(createPosterNode(item.poster_path, item.movie_title));
    card.appendChild(link);

    const title = makeElement("h3", "watchlist-item-title", item.movie_title || `Movie #${item.movie_id}`);
    card.appendChild(title);

    if (isOwnerView) {
      const controls = makeElement("div", "watchlist-item-controls");
      const checkboxWrap = makeElement("label", "watchlist-item-checkbox-wrap");
      const checkbox = makeElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.watched);
      checkbox.addEventListener("change", async () => {
        if (!isOwnerView || !currentWatchlist?.id || currentWatchlist.id !== watchListId) {
          checkbox.checked = !checkbox.checked;
          setStatus("You can only edit your own watch lists.", "error");
          return;
        }
        const { error: updateError } = await window.supabaseClient
          .from("watch_list_items")
          .update({ watched: checkbox.checked })
          .eq("id", item.id)
          .eq("watch_list_id", watchListId);

        if (updateError) {
          setStatus(`Could not update watched state: ${updateError.message}`, "error");
          checkbox.checked = !checkbox.checked;
          return;
        }
      });
      checkboxWrap.appendChild(checkbox);
      checkboxWrap.appendChild(document.createTextNode(" Watched"));

      const removeButton = makeElement("button", "btn btn-outline btn-sm", "Remove");
      removeButton.type = "button";
      removeButton.addEventListener("click", async () => {
        if (!isOwnerView || !currentWatchlist?.id || currentWatchlist.id !== watchListId) {
          setStatus("You can only edit your own watch lists.", "error");
          return;
        }
        removeButton.disabled = true;
        const { error: removeError } = await window.supabaseClient
          .from("watch_list_items")
          .delete()
          .eq("id", item.id)
          .eq("watch_list_id", watchListId);

        if (removeError) {
          setStatus(`Could not remove movie: ${removeError.message}`, "error");
          removeButton.disabled = false;
          return;
        }

        await loadWatchlistItems(watchListId);
        await renderWatchlistHeader();
      });

      controls.appendChild(checkboxWrap);
      controls.appendChild(removeButton);
      card.appendChild(controls);
    } else {
      card.appendChild(makeElement("p", "watchlist-item-meta", item.watched ? "Watched" : "Not watched"));
    }

    return card;
  });

  watchlistItemsRail.replaceChildren(...cards);
}

async function loadWatchlistPage() {
  const watchlistId = getWatchlistIdParam();
  if (!watchlistId) {
    setStatus("Invalid watch list id.", "error");
    return;
  }

  const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
  if (sessionError || !sessionData?.session?.user?.id) {
    setStatus("You must be signed in.", "error");
    return;
  }
  currentSession = sessionData.session;

  const { data: watchlist, error } = await window.supabaseClient
    .from("watch_lists")
    .select("id, user_id, name, owner_username, created_at")
    .eq("id", watchlistId)
    .maybeSingle();

  if (error) {
    setStatus(`Could not load watch list: ${error.message}`, "error");
    return;
  }

  if (!watchlist?.id) {
    setStatus("Watch list not found.", "error");
    return;
  }

  currentWatchlist = watchlist;
  isOwnerView = watchlist.user_id === currentSession.user.id;

  await renderWatchlistHeader();
  await loadWatchlistItems(watchlist.id);
  setStatus("Watch list loaded.", "success");
}

loadWatchlistPage();
