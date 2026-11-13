const config = require("../config");

// GET /api/search
exports.searchMovies = async (req, res, next) => {
    const title = (req.query.title || "").trim();
    const year = (req.query.year || "").trim();

    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }
    if (year && !/^\d{4}$/.test(year)) {
        return res.status(400).json({ error: "Year must be 4 digits" });
    }

    try {
        const url =
            `https://www.omdbapi.com/?apikey=${config.omdbApiKey}` +
            `&type=movie&s=${encodeURIComponent(title)}` +
            (year ? `&y=${year}` : "");

        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await response.json();

        if (data.Response === "False") {
            // No matches is normal, not an error
            if (
                data.Error === "Movie not found!" ||
                data.Error === "Too many results."
            ) {
                return res.json([]);
            }
            return res.status(502).json({ error: data.Error });
        }

        res.json(data.Search);
    } catch (err) {
        res.status(502).json({ error: "Could not reach OMDb" });
    }
};