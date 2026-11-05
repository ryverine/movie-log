import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Poster({ src, title }) {
  const [failed, setFailed] = useState(false);

  if (!src || src === "N/A" || failed) {
    return <div className="no-poster">No poster</div>;
  }

  return (
    <img
      src={src}
      alt={`${title} poster`}
      onError={() => setFailed(true)}
    />
  );
}

export default function App() {
  // Search side
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  // Saved movies side
  const [movies, setMovies] = useState([]);
  const [moviesLoaded, setMoviesLoaded] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Editing: which saved movie is open, plus the draft values in the form
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadMovies() {
    const res = await fetch(`${API}/movies`);
    const data = await res.json();
    setMovies(Array.isArray(data) ? data : []);
    setMoviesLoaded(true);
  }

  useEffect(() => {
    loadMovies();
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setSelectedId(null);
    setStatus("");
    const res = await fetch(
      `${API}/search?title=${encodeURIComponent(query.trim())}`
    );
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setHasSearched(true);
    setLoading(false);
  }

  function handleSelect(imdbID) {
    setSelectedId(imdbID === selectedId ? null : imdbID);
    setStatus("");
  }

  async function handleAdd(movie) {
    setAdding(true);
    try {
      const res = await fetch(`${API}/movies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbID: movie.imdbID,
          title: movie.Title,
          year: movie.Year,
          poster: movie.Poster === "N/A" ? "" : movie.Poster,
        }),
      });

      if (res.status === 201) {
        setStatus(`Added "${movie.Title}"`);
        setSelectedId(null);
        await loadMovies();
      } else if (res.status === 409) {
        setStatus(`"${movie.Title}" is already in your list`);
      } else {
        setStatus("Something went wrong");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(movie) {
    setRemovingId(movie._id);
    try {
      await fetch(`${API}/movies/${movie._id}`, { method: "DELETE" });
      await loadMovies();
    } finally {
      setRemovingId(null);
    }
  }

  function handleEditStart(movie) {
    setEditingId(movie._id);
    setEditRating(movie.rating == null ? "" : String(movie.rating));
    setEditNote(movie.note || "");
  }

  function handleEditCancel() {
    setEditingId(null);
  }

  async function handleEditSave(e) {
    e.preventDefault(); // stop the browser from reloading the page
    setSaving(true);
    try {
      const res = await fetch(`${API}/movies/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: editRating === "" ? null : Number(editRating),
          note: editNote.trim(),
        }),
      });

      if (res.ok) {
        setEditingId(null);
        await loadMovies();
      }
    } finally {
      setSaving(false);
    }
  }

  // Derived state: the imdbID of every movie already saved
  const savedIds = new Set(movies.map((m) => m.imdbID));

  return (
    <div className="app">
      <header className="search-bar">
        <h1>Movie Log</h1>
        <div className="search-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            maxLength={100}
            placeholder="Search for a movie title..."
          />
          <button onClick={handleSearch}>Search</button>
        </div>
      </header>

      <main className="columns">
        <section className="column">
          <h2>My Movies</h2>

          {moviesLoaded && movies.length === 0 && (
            <p>No movies yet. Search for one and add it!</p>
          )}

          <ul className="results">
            {movies.map((movie) => {
              const isEditing = movie._id === editingId;

              return (
                <li key={movie._id} className="movie-card">
                  {isEditing ? (
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
                  ) : (
                    <>
                      <div className="card-body">
                        <Poster src={movie.poster} title={movie.title} />
                        <div className="movie-info">
                          <strong>{movie.title}</strong>
                          <span>{movie.year}</span>
                          <span className="rating">
                            {movie.rating != null
                              ? `Your rating: ${movie.rating}/10`
                              : "Not rated"}
                          </span>
                          {movie.note && (
                            <span className="note">{movie.note}</span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          onClick={() => handleEditStart(movie)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(movie)}
                          disabled={removingId === movie._id}
                        >
                          {removingId === movie._id ? "Removing..." : "Remove"}
                        </button>
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

          {status && <p className="status">{status}</p>}

          {loading && <p>Searching...</p>}

          {!loading && hasSearched && results.length === 0 && (
            <p>No movies found.</p>
          )}

          <ul className="results">
            {results.map((movie) => {
              const isSaved = savedIds.has(movie.imdbID);
              const isSelected = !isSaved && movie.imdbID === selectedId;
              const cardClass = ["movie-card", isSelected ? "selected" : "", isSaved ? "saved" : ""]
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