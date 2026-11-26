import { useState } from "react";
import { request, setToken } from "./api";

export default function AuthForm({ onSignedIn }) {
    const [mode, setMode] = useState("login"); // "login" or "register"
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const isRegister = mode === "register";

    async function handleSubmit(e) {
        e.preventDefault();
        if (busy) return;

        if (!username.trim() || !password) {
            setError("Enter a username and password.");
            return;
        }

        setBusy(true);
        setError("");
        try {
            const data = await request(
                isRegister ? "/auth/register" : "/auth/login",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: username.trim(), password }),
                }
            );
            setToken(data.token);
            onSignedIn(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function switchMode() {
        setMode(isRegister ? "login" : "register");
        setError("");
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1>Movie Log</h1>
                <p className="auth-subtitle">
                    {isRegister ? "Create an account to start your library." : "Sign in to your library."}
                </p>

                <form onSubmit={handleSubmit}>
                    <label>
                        Username
                        <input
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (error) setError("");
                            }}
                            autoComplete="username"
                            maxLength={20}
                            autoFocus
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError("");
                            }}
                            autoComplete={isRegister ? "new-password" : "current-password"}
                        />
                    </label>

                    {isRegister && (
                        <p className="hint">
                            3–20 characters, letters, numbers and underscores. Password at least 8 characters.
                        </p>
                    )}

                    {error && (
                        <div className="message message-error" role="alert">
                            <span>{error}</span>
                        </div>
                    )}

                    <button type="submit" className="auth-submit" disabled={busy}>
                        {busy
                            ? isRegister
                                ? "Creating account..."
                                : "Signing in..."
                            : isRegister
                                ? "Create account"
                                : "Sign in"}
                    </button>
                </form>

                <button type="button" className="link-button" onClick={switchMode}>
                    {isRegister
                        ? "Already have an account? Sign in"
                        : "Need an account? Create one"}
                </button>
            </div>
        </div>
    );
}