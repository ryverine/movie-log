import { useState, useEffect } from "react";
import "./App.css";
import AuthForm from "./AuthForm";
import { request, getToken, clearToken, setUnauthorizedHandler } from "./api";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Poster({ src, title }) {
  const [failed, setFailed] = useState(false);

  if (!src || src === "N/A" || failed) {
    return <div className="no-poster">No poster</div>;
  }

  return (
    <img src={src} alt={`${title} poster`} onError={() => setFailed(true)} />
  );
}

export default function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signedOutMessage, setSignedOutMessage] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState("library");

  // Search side
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState("success");
  const [searchError, setSearchError] = useState("");
  const [isSlow, setIsSlow] = useState(false);

  // Saved movies side
  const [movies, setMovies] = useState([]);
  const [moviesLoaded, setMoviesLoaded] = useState(false);
  const [moviesError, setMoviesError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cardError, setCardError] = useState(null);

  // Editing
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Any expired token anywhere in the app lands here
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      setUser(null);
      setSignedOutMessage(message);
    });
  }, []);

  // On startup, check whether the stored token is still valid
  useEffect(() => {
    async function checkSession() {
      if (!getToken()) {
        setCheckingAuth(false);
        return;
      }
      try {
        const data = await request("/auth/me");
        setUser(data.user);
      } catch {
        clearToken();
      } finally {
        setCheckingAuth(false);
      }
    }
    checkSession();
  }, []);

  // Load the library whenever someone signs in
  useEffect(() => {
    if (!user) return;
    loadMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function startSlowNotice() {
    const timer = setTimeout(() => setIsSlow(true), 3000);
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }

  function handleSignOut() {
    clearToken();
    setUser(null);
    setSignedOutMessage("");
    // Clear anything belonging to the previous session
    setMovies([]);
    setMoviesLoaded(false);
    setResults([]);
    setHasSearched(false);
    setQuery("");
    setYear("");
    setStatus("");
    setEditingId(null);
    setActiveTab("library");
  }

  function handleSignedIn(newUser) {
    setSignedOutMessage("");
    setUser(newUser);
  }

  async function loadMovies() {
    setMoviesError("");
    const stopNotice = startSlowNotice();
    try {
      const data = await request("/movies");
      setMovies(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status !== 401) setMoviesError(err.message);
    } finally {
      stopNotice();
      setMoviesLoaded(true);
    }
  }

  async function handleSearch() {
    if (!query.trim()) {
      setSearchError("Enter a movie title to search.");
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setSelectedId(null);
    setStatus("");
    setSearchError("");
    const stopNotice = startSlowNotice();
    try {
      const params = new URLSearchParams({ title: query.trim() });
      if (year) params.set("year", year);
      const data = await request(`/search?${params}`);
      setResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
    } catch (err) {
      if (err.status !== 401) setSearchError(err.message);
      setResults([]);
      setHasSearched(false);
    } finally {
      stopNotice();
      setLoading(false);
    }
  }

  function handleSelect(imdbID) {
    setSelectedId(imdbID === selectedId ? null : imdbID);
    setStatus("");
  }

  function showStatus(message, kind) {
    setStatus(message);
    setStatusKind(kind);
  }

  async function handleAdd(movie) {
    setAdding(true);
    setStatus("");
    try {
      await request("/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imdbID: movie.imdbID }),
      });
      showStatus(`Added "${movie.Title}"`, "success");
      setSelectedId(null);
      await loadMovies();
    } catch (err) {
      if (err.status === 409) {
        showStatus(`"${movie.Title}" is already in your list`, "warning");
        await loadMovies();
      } else if (err.status !== 401) {
        showStatus(err.message, "error");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(movie) {
    setRemovingId(movie._id);
    setCardError(null);
    try {
      await request(`/movies/${movie._id}`, { method: "DELETE" });
      await loadMovies();
      setConfirmingId(null);
    } catch (err) {
      if (err.status === 404) {
        await loadMovies();
        setConfirmingId(null);
      } else if (err.status !== 401) {
        setCardError({ id: movie._id, message: err.message });
      }
    } finally {
      setRemovingId(null);
    }
  }

  function handleEditStart(movie) {
    setEditingId(movie._id);
    setEditRating(movie.rating == null ? "" : String(movie.rating));
    setEditNote(movie.note || "");
    setEditError("");
    setCardError(null);
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditError("");
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setEditError("");
    try {
      await request(`/movies/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: editRating === "" ? null : Number(editRating),
          note: editNote.trim(),
        }),
      });
      setEditingId(null);
      await loadMovies();
    } catch (err) {
      if (err.status !== 401) setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleTabKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = activeTab === "library" ? "search" : "library";
    setActiveTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const savedIds = new Set(movies.map((m) => m.imdbID));

  // Don't flash the login screen while the stored token is being checked
  if (checkingAuth) {
    return (
      <div className="auth-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {signedOutMessage && (
          <div className="signed-out-banner" role="alert">
            {signedOutMessage}
          </div>
        )}
        <AuthForm onSignedIn={handleSignedIn} />
      </>
    );
  }

  return (
    <div className="app">
      <header className="title-bar">
        <h1>Movie Log</h1>
        <div className="user-area">
          <span className="username">{user.username}</span>
          <button type="button" className="link-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="tab-list" role="tablist" aria-label="Views">
        <button
          type="button"
          className="tab"
          role="tab"
          id="tab-library"
          aria-selected={activeTab === "library"}
          aria-controls="panel-library"
          tabIndex={activeTab === "library" ? 0 : -1}
          onClick={() => setActiveTab("library")}
          onKeyDown={handleTabKeyDown}
        >
          Library <span className="tab-count">({movies.length})</span>
        </button>
        <button
          type="button"
          className="tab"
          role="tab"
          id="tab-search"
          aria-selected={activeTab === "search"}
          aria-controls="panel-search"
          tabIndex={activeTab === "search" ? 0 : -1}
          onClick={() => setActiveTab("search")}
          onKeyDown={handleTabKeyDown}
        >
          Search
        </button>
      </div>

      <main>
        {activeTab === "library" && (
          <section
            className="tab-panel"
            role="tabpanel"
            id="panel-library"
            aria-labelledby="tab-library"
            tabIndex={-1}
          >
            <div className="panel-inner">
              {isSlow && (
                <div className="message message-info" role="status">
                  <span>Waking up the server. This can take up to a minute on the free tier.</span>
                </div>
              )}

              {moviesError && (
                <div className="message message-error" role="alert">
                  <span>{moviesError}</span>
                  <button type="button" onClick={loadMovies}>
                    Retry
                  </button>
                </div>
              )}

              {!moviesError && moviesLoaded && movies.length === 0 && (
                <div className="message message-info" role="status">
                  <span>No movies yet. Search for one and add it!</span>
                </div>
              )}

              <ul className="results">
                {movies.map((movie) => {
                  const isEditing = movie._id === editingId;
                  const facts = [movie.rated, movie.runtime, movie.genre]
                    .filter(Boolean)
                    .join(" · ");
                  const hasDetails = movie.director || movie.actors || movie.plot;

                  return (
                    <li key={movie._id} className="movie-card">
                      {isEditing ? (
                        <>
                          <div className="card-body editing">
                            <Poster src={movie.poster} title={movie.title} />
                            <div className="movie-info">
                              <strong>{movie.title}</strong>
                              <span>{movie.year}</span>

                              <form
                                className="edit-form"
                                onSubmit={handleEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") handleEditCancel();
                                }}
                              >
                                <label>
                                  Your rating
                                  <select
                                    value={editRating}
                                    onChange={(e) => setEditRating(e.target.value)}
                                  >
                                    <option value="">Not rated</option>
                                    {RATINGS.map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  Note
                                  <input
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    maxLength={100}
                                    placeholder="What did you think?"
                                    autoFocus
                                  />
                                </label>
                                <span className="char-count">
                                  {editNote.length}/100
                                </span>

                                {editError && (
                                  <p className="inline-error" role="alert">
                                    {editError}
                                  </p>
                                )}

                                <div className="edit-buttons">
                                  <button type="submit" disabled={saving}>
                                    {saving ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleEditCancel}
                                    disabled={saving}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="close-btn"
                            onClick={handleEditCancel}
                            disabled={saving}
                          >
                            Close
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="card-body">
                            <Poster src={movie.poster} title={movie.title} />
                            <div className="movie-info">
                              <strong>{movie.title}</strong>
                              <span>{movie.year}</span>
                              {facts && <span className="facts">{facts}</span>}

                              {(movie.imdbRating ||
                                movie.rottenTomatoes ||
                                movie.metascore) && (
                                  <div className="scores">
                                    {movie.imdbRating && (
                                      <span className="score">
                                        IMDb {movie.imdbRating}/10
                                      </span>
                                    )}
                                    {movie.rottenTomatoes && (
                                      <span className="score">
                                        Rotten Tomatoes {movie.rottenTomatoes}
                                      </span>
                                    )}
                                    {movie.metascore && (
                                      <span className="score">
                                        Metacritic {movie.metascore}/100
                                      </span>
                                    )}
                                  </div>
                                )}

                              <span className="rating">
                                {movie.rating != null
                                  ? `Your rating: ${movie.rating}/10`
                                  : "Not rated"}
                              </span>
                              {movie.note && (
                                <span className="note">{movie.note}</span>
                              )}

                              {hasDetails && (
                                <details className="more-info">
                                  <summary>More info</summary>
                                  {movie.director && (
                                    <p>
                                      <strong>Director:</strong> {movie.director}
                                    </p>
                                  )}
                                  {movie.actors && (
                                    <p>
                                      <strong>Starring:</strong> {movie.actors}
                                    </p>
                                  )}
                                  {movie.plot && <p>{movie.plot}</p>}
                                </details>
                              )}

                              <a
                                className="imdb-link"
                                href={`https://www.imdb.com/title/${movie.imdbID}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on IMDb
                              </a>

                              {cardError?.id === movie._id && (
                                <p className="inline-error" role="alert">
                                  {cardError.message}
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className="card-actions"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setConfirmingId(null);
                            }}
                          >
                            {confirmingId === movie._id ? (
                              <>
                                <span className="confirm-text">Remove?</span>
                                <button
                                  type="button"
                                  aria-label={`Yes, remove ${movie.title}`}
                                  onClick={() => handleRemove(movie)}
                                  disabled={removingId === movie._id}
                                >
                                  {removingId === movie._id ? "Removing..." : "Yes"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmingId(null);
                                    setCardError(null);
                                  }}
                                  disabled={removingId === movie._id}
                                  autoFocus
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditStart(movie)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(movie._id)}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "search" && (
          <section
            className="tab-panel"
            role="tabpanel"
            id="panel-search"
            aria-labelledby="tab-search"
            tabIndex={-1}
          >
            <div className="panel-inner">
              <div className="search-row">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (searchError) setSearchError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  maxLength={100}
                  placeholder="Search for a movie title..."
                  aria-label="Movie title"
                />
                <input
                  className="year-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="Year"
                  aria-label="Release year (optional)"
                />
                <button onClick={handleSearch} disabled={loading}>
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>

              {isSlow && (
                <div className="message message-info" role="status">
                  <span>Waking up the server. This can take up to a minute on the free tier.</span>
                </div>
              )}

              {status && (
                <div
                  className={`message message-${statusKind}`}
                  role={statusKind === "error" ? "alert" : "status"}
                >
                  <span>{status}</span>
                </div>
              )}

              {searchError && (
                <div className="message message-error" role="alert">
                  <span>{searchError}</span>
                  {query.trim() && (
                    <button type="button" onClick={handleSearch}>
                      Retry
                    </button>
                  )}
                </div>
              )}

              {loading && <p>Searching...</p>}

              {!loading && !searchError && hasSearched && results.length === 0 && (
                <div className="message message-info" role="status">
                  <span>No movies found. Try a different title or year.</span>
                </div>
              )}

              <ul className="results">
                {results.map((movie) => {
                  const isSaved = savedIds.has(movie.imdbID);
                  const isSelected = !isSaved && movie.imdbID === selectedId;
                  const cardClass = [
                    "movie-card",
                    isSelected ? "selected" : "",
                    isSaved ? "saved" : "",
                  ]
                    .join(" ")
                    .trim();

                  return (
                    <li key={movie.imdbID} className={cardClass}>
                      <button
                        type="button"
                        className="card-select"
                        aria-pressed={isSelected}
                        disabled={isSaved}
                        onClick={() => handleSelect(movie.imdbID)}
                      >
                        <Poster src={movie.Poster} title={movie.Title} />
                        <div className="movie-info">
                          <strong>{movie.Title}</strong>
                          <span>{movie.Year}</span>
                        </div>
                      </button>

                      {isSaved && <span className="saved-badge">✓ Saved</span>}

                      {isSelected && (
                        <button
                          type="button"
                          className="add-btn"
                          onClick={() => handleAdd(movie)}
                          disabled={adding}
                        >
                          {adding ? "Adding..." : "Add"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}