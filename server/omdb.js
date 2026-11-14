// Everything about talking to OMDb for one movie's details lives here.

const config = require("./config");


// Convert OMDb's "N/A" placeholder into an empty string
const clean = (value) => (value && value !== "N/A" ? value : "");

// OMDb's messages for an ID that doesn't match a movie. Anything not listed here
// (bad API key, daily limit reached, ...) stays a 502.
const NOT_FOUND_MESSAGES = new Set([
    "Error getting data.",
    "Incorrect IMDb ID.",
    "Movie not found!",
]);

// Look up one movie on OMDb and return it in the shape our database uses
async function fetchMovieDetails(imdbID) {
    const url =
        `https://www.omdbapi.com/?apikey=${config.omdbApiKey}` +
        `&i=${encodeURIComponent(imdbID)}&plot=short`;

    let data;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        data = await response.json();
    } catch {
        const err = new Error("Could not reach OMDb");
        err.upstream = true;
        throw err;
    }

    if (data.Response === "False") {
        const err = new Error(data.Error);
        err.upstream = true;
        err.notFound = NOT_FOUND_MESSAGES.has(data.Error);
        throw err;
    }

    return {
        imdbID: data.imdbID,
        title: data.Title,
        year: data.Year,
        poster: clean(data.Poster),
        rated: clean(data.Rated),
        runtime: clean(data.Runtime),
        genre: clean(data.Genre),
        director: clean(data.Director),
        actors: clean(data.Actors),
        plot: clean(data.Plot),
        imdbRating: clean(data.imdbRating),
        rottenTomatoes: clean(
            data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value
        ),
        metascore: clean(data.Metascore),
    };
}

module.exports = { fetchMovieDetails };