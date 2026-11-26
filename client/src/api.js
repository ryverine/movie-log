const API = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "movielog_token";

// An error that carries the HTTP status, so callers can react to specific cases
export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

// localStorage can throw in private mode or with site data blocked,
// so every access is guarded.
export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        // Not fatal: the session just won't survive a refresh
    }
}

export function clearToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        // Nothing to do
    }
}

// App registers a callback here so an expired token can sign the user out
// from anywhere, without every caller having to check for it.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
    onUnauthorized = fn;
}

export async function request(path, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API}${path}`, { ...options, headers });
    } catch {
        throw new ApiError("Can't reach the server. Is it running?", 0);
    }

    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    // A 401 while we were holding a token means it expired or was revoked
    if (res.status === 401 && token) {
        clearToken();
        const message = data?.error || "Your session expired. Sign in again.";
        onUnauthorized?.(message);
        throw new ApiError(message, 401);
    }

    if (!res.ok) {
        const fallback =
            res.status === 502
                ? "Movie service is unavailable. Please try again."
                : res.status >= 500
                    ? "Something went wrong on the server."
                    : `Request failed (${res.status})`;
        throw new ApiError(data?.error || fallback, res.status);
    }

    return data;
}