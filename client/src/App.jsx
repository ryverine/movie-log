import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// An error that carries the HTTP status, so callers can react to specific cases
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Every request to our API goes through here, so error handling lives in one place
async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API}${path}`, options);
  } catch {
    // fetch only rejects when the request never got an answer
    throw new ApiError("Can't reach the server. Is it running?", 0);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // not JSON, so fall back to a status-based message below
    }
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
  // Search side
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchErrorKind, setSearchErrorKind] = useState("error"); // "error" or "warning"



  // Saved movies side
  const [movies, setMovies] = useState([]);
  const [moviesLoaded, setMoviesLoaded] = useState(false);
  const [moviesError, setMoviesError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cardError, setCardError] = useState(null); // { id, message }

  // Editing
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function loadMovies() {
    setMoviesError("");
    try {
      const data = await request("/movies");
      setMovies(Array.isArray(data) ? data : []);
    } catch (err) {
      setMoviesError(err.message);
    } finally {
      setMoviesLoaded(true);
    }
  }

  useEffect(() => {
    loadMovies();
  }, []);

  async function handleSearch() {

    // Catch if search box is blank
    if (!query.trim()) {
      setSearchError("Enter a movie title to search.");
      setSearchErrorKind("warning");
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setSelectedId(null);
    setStatus("");
    setSearchError("");
    try {
      const params = new URLSearchParams({ title: query.trim() });
      if (year) params.set("year", year);
      const data = await request(`/search?${params}`);
      setResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
    } catch (err) {
      setSearchError(err.message);
      setSearchErrorKind("error");
      setResults([]);
      setHasSearched(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(imdbID) {
    setSelectedId(imdbID === selectedId ? null : imdbID);
    setStatus("");
  }

  function showStatus(message, isError) {
    setStatus(message);
    setStatusIsError(isError);
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
      showStatus(`Added "${movie.Title}"`, false);
      setSelectedId(null);
      await loadMovies();
    } catch (err) {
      if (err.status === 409) {
        showStatus(`"${movie.Title}" is already in your list`, false);
        await loadMovies(); // someone else added it, so refresh to show the badge
      } else {
        showStatus(err.message, true);
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
        // Already gone, so the goal is met either way
        await loadMovies();
        setConfirmingId(null);
      } else {
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
      setEditError(err.message); // keep the form open so the draft isn't lost
    } finally {
      setSaving(false);
    }
  }

  const savedIds = new Set(movies.map((m) => m.imdbID));

  return (
    <div className="app">
      <header className="search-bar">
        <h1>Movie Log</h1>
        <div className="search-row">
          <input
            value={query}
            //onChange={(e) => setQuery(e.target.value)}

            //if error message is present, clear it when user enters text into search box.
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
      </header>

      <main className="columns">
        <section className="column">
          <h2>My Movies</h2>

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
        </section>

        <section className="column">
          <h2>Search Results</h2>

          {status && (
            <p
              className={statusIsError ? "status status-error" : "status"}
              role="status"
            >
              {status}
            </p>
          )}

          {searchError && (
            <div
              className={`message message-${searchErrorKind === "warning" ? "warning" : "error"}`}
              role="alert"
            >
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
        </section>
      </main>
    </div>
  );
}