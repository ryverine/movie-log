require("dotenv").config();// npm install dotenv
//console.log("OMDb key loaded:", Boolean(process.env.OMDB_API_KEY));// prints true if there is an omdb api key

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Movie = require("./models/Movie");

const app = express();
app.use(cors());          // lets React talk to this server
app.use(express.json());  // lets the server read JSON

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

// GET: search OMDb for movies by title
app.get("/api/search", async (req, res) => {
    const title = (req.query.title || "").trim();
    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }

    try {
        const url =
            `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}` +
            `&type=movie&s=${encodeURIComponent(title)}`;

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
app.post("/api/movies", async (req, res) => {
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