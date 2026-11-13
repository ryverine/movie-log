const Movie = require("../models/Movie");
const { fetchMovieDetails } = require("../omdb");

// GET /api/movies
exports.listMovies = async (req, res, next) => {
    try {
        const movies = await Movie.find().sort({ createdAt: -1 });
        res.json(movies);
    } catch (err) {
        next(err);
    }
};

// POST /api/movies
exports.addMovie = async (req, res, next) => {
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
            return res
                .status(502)
                .json({ error: "Could not get movie details from OMDb" });
        }
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

// PUT /api/movies/:id
exports.updateMovie = async (req, res, next) => {
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
        if (err.name === "ValidationError" || err.name === "CastError") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

// DELETE /api/movies/:id
exports.removeMovie = async (req, res, next) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }
        res.json({ message: "Removed" });
    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};