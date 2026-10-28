const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
    {
        imdbID: { type: String, required: true, unique: true },
        title: { type: String, required: true },
        year: { type: String, required: true },
        poster: { type: String, default: "" },
        rating: { type: Number, min: 1, max: 10, default: null },
        note: { type: String, maxlength: 100, trim: true, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Movie", movieSchema);