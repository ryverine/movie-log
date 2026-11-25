const Movie = require("../models/Movie");
const { fetchMovieDetails } = require("../omdb");

// GET /api/movies
exports.listMovies = async (req, res, next) => {
    try {
        const movies = await Movie.find({ owner: req.user.id }).sort({ createdAt: -1 });
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
        if (await Movie.exists({ owner: req.user.id, imdbID })) {
            return res.status(409).json({ error: "Movie already saved" });
        }

        const details = await fetchMovieDetails(imdbID);
        const movie = await Movie.create({ ...details, owner: req.user.id });
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
        next(err);
    }
};

// PUT /api/movies/:id
exports.updateMovie = async (req, res, next) => {
    try {
        const { rating, note } = req.body;
        // The owner is part of the filter, so one user cannot edit another's movie
        const movie = await Movie.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.id },
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
        const movie = await Movie.findOneAndDelete({
            _id: req.params.id,
            owner: req.user.id,
        });
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