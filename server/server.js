require("dotenv").config();// npm install dotenv
//console.log("OMDb key loaded:", Boolean(process.env.OMDB_API_KEY));// prints true if there is an omdb api key

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Movie = require("./models/Movie");

const app = express();
app.use(cors());          // lets React talk to this server
app.use(express.json());  // lets the server read JSON

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
        `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}` +
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
        //err.notFound = data.Error === "Incorrect IMDb ID.";
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

// Connect to MongoDB
mongoose
    .connect("mongodb://127.0.0.1:27017/simpleapp")
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error(err));

//Movie.init().then(() => console.log("Movie model ready"));
//imdbID is unique: true. Every movie has a unique IMDb ID, so this tells MongoDB to refuse a second copy of the same movie. This is enforced by the database itself, which is stronger than checking in your code. Two requests arriving at the same instant can both pass a code check, but they can’t both pass a unique index. (Mongoose builds this index in the background, which is what Movie.init() waits for.)


// A "model" describes what one saved item looks like
const Entry = mongoose.model(
    "Entry",
    new mongoose.Schema(
        { text: { type: String, required: true, maxlength: 100 } },
        { timestamps: true }
    )
);

// GET: search OMDb for movies by title and year
app.get("/api/search", async (req, res) => {
    const title = (req.query.title || "").trim();
    const year = (req.query.year || "").trim();
    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }

    if (year && !/^\d{4}$/.test(year)) {
        return res.status(400).json({ error: "Year must be 4 digits" });
    }

    try {
        /*const url =
            `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}` +
            `&type=movie&s=${encodeURIComponent(title)}`;*/

        const url =
            `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}` +
            `&type=movie&s=${encodeURIComponent(title)}` +
            (year ? `&y=${year}` : "");

        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === "False") {
            // No matches is normal, not an error
            if (data.Error === "Movie not found!" || data.Error === "Too many results.") {
                return res.json([]);
            }
            return res.status(502).json({ error: data.Error });
        }

        res.json(data.Search);
    } catch (err) {
        res.status(502).json({ error: "Could not reach OMDb" });
    }
});


// GET: all saved movies, newest first
app.get("/api/movies", async (req, res) => {
    try {
        const movies = await Movie.find().sort({ createdAt: -1 });
        res.json(movies);
    } catch (err) {
        res.status(500).json({ error: "Could not load movies" });
    }
});

// POST: save a movie
/*app.post("/api/movies", async (req, res) => {
    try {
        const { imdbID, title, year, poster } = req.body;
        const movie = await Movie.create({ imdbID, title, year, poster });
        res.status(201).json(movie);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Movie already saved" });
        }
        res.status(400).json({ error: err.message });
    }
});*/

// POST: save a movie. The client sends only the imdbID; the server looks up the rest.
app.post("/api/movies", async (req, res) => {
    const imdbID = String(req.body?.imdbID || "").trim();

    if (!/^tt\d{7,8}$/.test(imdbID)) {
        return res.status(400).json({ error: "A valid imdbID is required" });
    }

    try {
        // Skip the OMDb call entirely if we already have this movie
        if (await Movie.exists({ imdbID })) {
            return res.status(409).json({ error: "Movie already saved" });
        }

        const details = await fetchMovieDetails(imdbID);
        const movie = await Movie.create(details);
        res.status(201).json(movie);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Movie already saved" });
        }
        if (err.notFound) {
            return res.status(404).json({ error: "Movie not found on OMDb" });
        }
        if (err.upstream) {
            return res.status(502).json({ error: "Could not get movie details from OMDb" });
        }
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Could not save movie" });
    }
});


// PUT: update your rating and note
app.put("/api/movies/:id", async (req, res) => {
    try {
        const { rating, note } = req.body;
        const movie = await Movie.findByIdAndUpdate(
            req.params.id,
            { rating, note },
            { new: true, runValidators: true }
        );
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }
        res.json(movie);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE: remove a movie
app.delete("/api/movies/:id", async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }
        res.json({ message: "Removed" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));