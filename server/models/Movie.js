const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
    {
        imdbID: { type: String, required: true, unique: true },
        title: { type: String, required: true },
        year: { type: String, required: true },
        poster: { type: String, default: "" },

        // Details copied from OMDb when the movie is added
        rated: { type: String, default: "" },
        runtime: { type: String, default: "" },
        genre: { type: String, default: "" },
        director: { type: String, default: "" },
        actors: { type: String, default: "" },
        plot: { type: String, default: "" },
        imdbRating: { type: String, default: "" },
        rottenTomatoes: { type: String, default: "" },
        metascore: { type: String, default: "" },

        // My movie details
        rating: { type: Number, min: 1, max: 10, default: null },
        note: { type: String, maxlength: 100, trim: true, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Movie", movieSchema);