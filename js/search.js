const tmdbStatus = document.getElementById("tmdb-status");
const searchForm = document.getElementById("movie-search-form");
const searchInput = document.getElementById("movie-query");
const suggestionList = document.getElementById("search-suggestion-list");
const resultsGrid = document.getElementById("search-results");

const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const SUGGESTION_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

function setTmdbStatus(message, kind = "info") {
  if (!tmdbStatus) {
    return;
  }

  tmdbStatus.textContent = message;
  tmdbStatus.classList.remove("success", "error", "info");
  tmdbStatus.classList.add(kind);
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
  return cast.slice(0, 4).map((member) => member.name).join(", ");
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

function createPoster(movie) {
  const posterPath = typeof movie.poster_path === "string" ? movie.poster_path : "";

  if (!posterPath.startsWith("/")) {
    return makeElement("div", "result-poster result-poster-fallback", "No Poster");
  }

  const img = makeElement("img", "result-poster");
  img.loading = "lazy";
  img.alt = `${movie.title || "Movie"} poster`;
  img.src = `${IMAGE_BASE}${posterPath}`;
  return img;
}

function createMetaLine(label, value) {
  const p = makeElement("p", "result-meta");
  if (!label) {
    p.textContent = value;
    return p;
  }

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  p.appendChild(strong);
  p.appendChild(document.createTextNode(value));
  return p;
}

function goToMoviePage(movieId) {
  if (!movieId) {
    return;
  }
  window.location.href = `movie.html?id=${encodeURIComponent(String(movieId))}`;
}

function createResultCard(movie) {
  const article = makeElement("article", "result-card");
  article.tabIndex = 0;
  article.setAttribute("role", "button");

  article.addEventListener("click", () => {
    goToMoviePage(movie.id);
  });

  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToMoviePage(movie.id);
    }
  });

  article.appendChild(createPoster(movie));

  const content = makeElement("div", "result-content");

  const titleRow = makeElement("h2");
  titleRow.appendChild(document.createTextNode(movie.title || "Untitled"));
  titleRow.appendChild(document.createTextNode(" "));
  const year = makeElement("span", "", `(${getYear(movie.release_date)})`);
  titleRow.appendChild(year);

  const vote = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "N/A";
  const runtime = movie.runtime ? `${movie.runtime} min` : "Runtime unavailable";
  const genres = Array.isArray(movie.genres) && movie.genres.length > 0
    ? movie.genres.map((g) => g.name).join(", ")
    : "Genres unavailable";

  content.appendChild(titleRow);
  content.appendChild(createMetaLine("", `⭐ ${vote} / 10 · ${runtime}`));
  content.appendChild(createMetaLine("Director", movie.director || "Unknown"));
  content.appendChild(createMetaLine("Cast", movie.cast || "Unknown"));
  content.appendChild(createMetaLine("Genres", genres));
  content.appendChild(makeElement("p", "result-overview", movie.overview || "No overview available."));

  article.appendChild(content);
  return article;
}

function setResultsMessage(className, text) {
  resultsGrid.replaceChildren(makeElement("p", className, text));
}

async function fetchMovieDetails(tmdbConfig, movieId) {
  const endpoint = `${tmdbConfig.apiBaseUrl}/movie/${movieId}?api_key=${encodeURIComponent(tmdbConfig.apiKey)}&append_to_response=credits`;
  const response = await fetch(endpoint);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.status_message || "Failed to load movie details.");
  }

  return {
    ...payload,
    director: getDirector(payload.credits),
    cast: getCast(payload.credits),
  };
}

async function performSearch(rawQuery) {
  const tmdbConfig = window.appConfig?.tmdb;
  const query = rawQuery.trim();

  if (!tmdbConfig?.apiKey) {
    setTmdbStatus("TMDB API key is missing. Set TMDB_API_KEY in js/supabase-config.js.", "error");
    resultsGrid.replaceChildren();
    return;
  }

  if (!query) {
    setTmdbStatus("Enter a movie title to search.", "info");
    resultsGrid.replaceChildren();
    return;
  }

  setTmdbStatus("Searching TMDB...", "info");
  setResultsMessage("results-loading", "Loading results...");

  try {
    const searchEndpoint = `${tmdbConfig.apiBaseUrl}/search/movie?api_key=${encodeURIComponent(tmdbConfig.apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
    const searchResponse = await fetch(searchEndpoint);
    const searchPayload = await searchResponse.json();

    if (!searchResponse.ok) {
      throw new Error(searchPayload.status_message || "TMDB search failed.");
    }

    const baseResults = Array.isArray(searchPayload.results) ? searchPayload.results.slice(0, 8) : [];

    if (baseResults.length === 0) {
      setTmdbStatus("No movies matched your search.", "info");
      setResultsMessage("results-empty", "No results found.");
      return;
    }

    const detailedResults = await Promise.all(
      baseResults.map((movie) =>
        fetchMovieDetails(tmdbConfig, movie.id).catch(() => ({ ...movie, director: "Unknown", cast: "Unknown" }))
      )
    );

    const cards = detailedResults.map(createResultCard);
    resultsGrid.replaceChildren(...cards);
    setTmdbStatus(`Showing ${detailedResults.length} result(s) for "${query}".`, "success");
  } catch (error) {
    setTmdbStatus(`TMDB request failed: ${error.message}`, "error");
    setResultsMessage("results-empty", "Unable to load results right now.");
  }
}

if (searchForm && searchInput && suggestionList) {
  const tmdbConfig = window.appConfig?.tmdb;
  let debounceHandle;
  let requestCounter = 0;
  let activeIndex = -1;
  let currentSuggestions = [];

  function clearSuggestions() {
    suggestionList.replaceChildren();
  }

  function openSuggestions() {
    suggestionList.classList.add("open");
    searchInput.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggestionList.classList.remove("open");
    searchInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function syncActiveSuggestion() {
    const items = suggestionList.querySelectorAll(".suggestion-item[data-index]");
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  }

  function renderSuggestionInfo(message, state = "info") {
    currentSuggestions = [];
    activeIndex = -1;
    clearSuggestions();

    const li = makeElement("li", `suggestion-item suggestion-${state}`, message);
    li.setAttribute("role", "option");
    suggestionList.appendChild(li);
    openSuggestions();
  }

  function createSuggestionPoster(movie) {
    const posterPath = typeof movie.poster_path === "string" ? movie.poster_path : "";

    if (!posterPath.startsWith("/")) {
      return makeElement("div", "suggestion-poster suggestion-poster-fallback", "No image");
    }

    const img = makeElement("img", "suggestion-poster");
    img.loading = "lazy";
    img.alt = `${movie.title || "Movie"} poster`;
    img.src = `${SUGGESTION_IMAGE_BASE}${posterPath}`;
    return img;
  }

  function renderSuggestionItems(items) {
    currentSuggestions = items;
    activeIndex = -1;
    clearSuggestions();

    items.forEach((movie, index) => {
      const li = makeElement("li", "suggestion-item");
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(index));
      li.tabIndex = -1;

      li.appendChild(createSuggestionPoster(movie));

      const textWrap = makeElement("div", "suggestion-text");
      textWrap.appendChild(makeElement("span", "suggestion-title", movie.title || "Untitled"));
      textWrap.appendChild(makeElement("span", "suggestion-year", getYear(movie.release_date)));
      li.appendChild(textWrap);

      li.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      li.addEventListener("mouseenter", () => {
        activeIndex = index;
        syncActiveSuggestion();
      });

      li.addEventListener("click", () => {
        goToMoviePage(movie.id);
      });

      suggestionList.appendChild(li);
    });

    openSuggestions();
  }

  async function fetchSuggestions(query, localRequestId) {
    if (!tmdbConfig?.apiKey) {
      renderSuggestionInfo("TMDB API key is missing in js/supabase-config.js", "error");
      return;
    }

    const endpoint = `${tmdbConfig.apiBaseUrl}/search/movie?api_key=${encodeURIComponent(tmdbConfig.apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
    renderSuggestionInfo("Searching...", "loading");

    try {
      const response = await fetch(endpoint);
      const payload = await response.json();

      if (localRequestId !== requestCounter) {
        return;
      }

      if (!response.ok) {
        const errorMessage = payload.status_message || "Search failed.";
        renderSuggestionInfo(`TMDB error: ${errorMessage}`, "error");
        return;
      }

      const results = Array.isArray(payload.results) ? payload.results.slice(0, 10) : [];

      if (results.length === 0) {
        renderSuggestionInfo("No matches yet.", "info");
        return;
      }

      renderSuggestionItems(results);
    } catch (error) {
      if (localRequestId !== requestCounter) {
        return;
      }
      renderSuggestionInfo(`Connection error: ${error.message}`, "error");
    }
  }

  function submitQuery(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    searchInput.value = trimmed;
    const params = new URLSearchParams(window.location.search);
    params.set("query", trimmed);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
    closeSuggestions();
    performSearch(trimmed);
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearTimeout(debounceHandle);

    if (!query) {
      closeSuggestions();
      clearSuggestions();
      currentSuggestions = [];
      return;
    }

    debounceHandle = setTimeout(() => {
      requestCounter += 1;
      fetchSuggestions(query, requestCounter);
    }, 300);
  });

  searchInput.addEventListener("keydown", (event) => {
    const hasSelectable = currentSuggestions.length > 0;

    if (event.key === "ArrowDown" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex < currentSuggestions.length - 1 ? activeIndex + 1 : 0;
      syncActiveSuggestion();
      openSuggestions();
      return;
    }

    if (event.key === "ArrowUp" && hasSelectable) {
      event.preventDefault();
      activeIndex = activeIndex > 0 ? activeIndex - 1 : currentSuggestions.length - 1;
      syncActiveSuggestion();
      openSuggestions();
      return;
    }

    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && currentSuggestions[activeIndex]) {
        goToMoviePage(currentSuggestions[activeIndex].id);
        return;
      }
      submitQuery(searchInput.value);
    }
  });

  searchInput.addEventListener("focus", () => {
    if (suggestionList.children.length > 0) {
      openSuggestions();
    }
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(closeSuggestions, 120);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeIndex >= 0 && currentSuggestions[activeIndex]) {
      goToMoviePage(currentSuggestions[activeIndex].id);
      return;
    }
    submitQuery(searchInput.value);
  });

  const urlQuery = new URLSearchParams(window.location.search).get("query") || "";
  if (urlQuery) {
    searchInput.value = urlQuery;
    performSearch(urlQuery);
  }
}
