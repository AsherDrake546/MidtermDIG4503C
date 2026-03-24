const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const authMessage = document.getElementById("auth-message");
const navUser = document.getElementById("nav-user");
const currentPage = document.body.dataset.page;
const appShell = document.getElementById("app-shell");
let isRedirecting = false;

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

function showFatalAuthError(message) {
  if (currentPage === "index") {
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

  if (currentPage === "index" && !session) {
    redirectTo("auth.html");
    return null;
  }

  if (currentPage === "auth" && session) {
    redirectTo("index.html");
    return session;
  }

  if (navUser && session?.user?.email) {
    navUser.textContent = session.user.email;
  }

  showApp();
  return session;
}

window.supabaseClient.auth.onAuthStateChange((event, session) => {
  if (navUser) {
    navUser.textContent = session?.user?.email ?? "";
  }

  if (event === "SIGNED_OUT" && currentPage === "index") {
    redirectTo("auth.html");
  }

  if (event === "SIGNED_IN" && currentPage === "auth") {
    redirectTo("index.html");
  }
});

enforceRouteGuard().catch((error) => {
  showApp();
  if (currentPage === "index") {
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
