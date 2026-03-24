const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const authMessage = document.getElementById("auth-message");

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#e63946" : "#94a1b2";
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;

  const { data, error } = await window.supabaseClient.auth.signUp({
    email,
    password
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  const { error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMessage(`Login failed: ${error.message}`, true);
    return;
  }

  setMessage("Login successful.");
  loginForm.reset();
});

logoutButton.addEventListener("click", async () => {
  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    setMessage(`Logout failed: ${error.message}`, true);
    return;
  }

  setMessage("Logged out.");
});
