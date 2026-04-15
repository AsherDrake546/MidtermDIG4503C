const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const authMessage = document.getElementById("auth-message");
const navUser = document.getElementById("nav-user");
const currentPage = document.body.dataset.page;
const appShell = document.getElementById("app-shell");
const protectedPages = new Set(["index", "search", "movie", "user", "watchlist"]);
let isRedirecting = false;
let navRenderVersion = 0;

function redirectTo(path) {
  if (isRedirecting || window.location.pathname.endsWith(path)) {
    return;
  }
  isRedirecting = true;
  window.location.replace(path);
}

function setMessage(message, isError = false) {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.classList.remove("success", "error");
  authMessage.classList.add(isError ? "error" : "success");
}

function showApp() {
  if (appShell) {
    appShell.hidden = false;
  }
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

async function getProfileUsername(userId) {
  if (!userId) {
    return "";
  }
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    return "";
  }
  return typeof data?.username === "string" ? data.username.trim() : "";
}

async function ensureProfileRow(session) {
  const userId = session?.user?.id;
  if (!userId) {
    return;
  }

  const username = deriveUsernameFromSession(session);
  if (!username) {
    return;
  }

  const { data: existingProfile, error: existingProfileError } = await window.supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfileError) {
    return;
  }

  if (existingProfile?.id) {
    return;
  }

  await window.supabaseClient
    .from("profiles")
    .insert({
      id: userId,
      username,
    });
}

function goToOwnUserPage(session) {
  const username = deriveUsernameFromSession(session);
  if (!username) {
    return;
  }
  window.location.href = `user.html?username=${encodeURIComponent(username)}`;
}

async function setNavUser(session) {
  if (!navUser) {
    return;
  }

  const renderVersion = ++navRenderVersion;
  navUser.replaceChildren();

  if (!session?.user?.id) {
    navUser.textContent = "";
    return;
  }

  const profileUsername = await getProfileUsername(session.user.id);
  if (renderVersion !== navRenderVersion) {
    return;
  }
  const displayValue = profileUsername || session.user.email || "";
  const isEmailFallback = !profileUsername && typeof session.user.email === "string" && displayValue === session.user.email;

  const profileLink = document.createElement("a");
  profileLink.href = `user.html?username=${encodeURIComponent(displayValue)}`;
  profileLink.textContent = displayValue;
  profileLink.addEventListener("click", (event) => {
    if (!isEmailFallback) {
      return;
    }
    event.preventDefault();
    goToOwnUserPage(session);
  });

  if (renderVersion !== navRenderVersion) {
    return;
  }
  navUser.replaceChildren();
  navUser.appendChild(profileLink);
}

function showFatalAuthError(message) {
  if (protectedPages.has(currentPage)) {
    redirectTo("auth.html?error=auth_unavailable");
    return;
  }

  if (appShell) {
    appShell.hidden = false;
  }

  if (authMessage) {
    setMessage(message, true);
    return;
  }

  window.alert(message);
}

if (!window.supabaseClient) {
  showFatalAuthError("Authentication SDK failed to initialize. Refresh and try again.");
  throw new Error("Supabase client is unavailable.");
}

async function getSession() {
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

async function enforceRouteGuard() {
  const session = await getSession();

  if (protectedPages.has(currentPage) && !session) {
    redirectTo("auth.html");
    return null;
  }

  if (currentPage === "auth" && session) {
    redirectTo("index.html");
    return session;
  }

  if (session?.user?.id) {
    await ensureProfileRow(session);
  }

  await setNavUser(session);

  showApp();
  return session;
}

window.supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session?.user?.id) {
    ensureProfileRow(session);
  }

  setNavUser(session);

  if (event === "SIGNED_OUT" && protectedPages.has(currentPage)) {
    redirectTo("auth.html");
  }

  if (event === "SIGNED_IN" && currentPage === "auth") {
    redirectTo("index.html");
  }
});

enforceRouteGuard().catch((error) => {
  showApp();
  if (protectedPages.has(currentPage)) {
    redirectTo("auth.html");
    return;
  }

  setMessage(`Session check failed: ${error.message}`, true);
});

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = signupForm.email.value.trim();
    const password = signupForm.password.value;

    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Sign up failed: ${error.message}`, true);
      return;
    }

    if (data.user && !data.session) {
      setMessage("Sign up successful. Check your email to confirm your account.");
      return;
    }

    setMessage("Sign up successful. You are now logged in.");
    signupForm.reset();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    const { error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Login failed: ${error.message}`, true);
      return;
    }

    setMessage("Login successful.");
    loginForm.reset();
    redirectTo("index.html");
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    const { error } = await window.supabaseClient.auth.signOut();

    if (error) {
      if (authMessage) {
        setMessage(`Logout failed: ${error.message}`, true);
      } else {
        window.alert(`Logout failed: ${error.message}`);
      }
      return;
    }

    redirectTo("auth.html");
  });
}
