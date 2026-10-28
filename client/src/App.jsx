import { useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // which card shows its Add button
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

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
    // clicking the selected card again un-selects it
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
      } else if (res.status === 409) {
        setStatus(`"${movie.Title}" is already in your list`);
      } else {
        setStatus("Something went wrong");
      }
    } finally {
      setAdding(false);
    }
  }

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
          <p>Your saved movies will appear here.</p>
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
              const isSelected = movie.imdbID === selectedId;
              return (
                <li
                  key={movie.imdbID}
                  className={isSelected ? "movie-card selected" : "movie-card"}
                >
                  <button
                    type="button"
                    className="card-select"
                    aria-pressed={isSelected}
                    onClick={() => handleSelect(movie.imdbID)}
                  >
                    <Poster src={movie.Poster} title={movie.Title} />
                    <div className="movie-info">
                      <strong>{movie.Title}</strong>
                      <span>{movie.Year}</span>
                    </div>
                  </button>

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