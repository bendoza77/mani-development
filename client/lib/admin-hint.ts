"use client";

// A plain "this browser has an admin session" hint, so public pages ask the API about the session
// only in browsers where an admin has signed in. It grants nothing: the session cookie is HttpOnly
// on the API, which still answers every request. The admin session store keeps it up to date.
const KEY = "mani:admin-hint";

export function setAdminHint(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: public pages then simply don't show the edit button */
  }
}

export function hasAdminHint(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
