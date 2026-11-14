//const path = require("path");
//require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const config = require("../config");

const mongoose = require("mongoose");
const Movie = require("../models/Movie");
const { fetchMovieDetails } = require("../omdb");

const MONGO_URI = "mongodb://127.0.0.1:27017/simpleapp";
const DRY_RUN = process.argv.includes("--dry-run");

// The only fields this script is allowed to write
const DETAIL_FIELDS = [
    "rated",
    "runtime",
    "genre",
    "director",
    "actors",
    "plot",
    "imdbRating",
    "rottenTomatoes",
    "metascore",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    //await mongoose.connect(MONGO_URI);
    await mongoose.connect(config.mongoUri);

    try {
        // Old documents lack these fields entirely. New ones always have them, even as "".
        const movies = await Movie.find({ director: { $exists: false } }).lean();
        console.log(
            `${movies.length} movie(s) need details${DRY_RUN ? " (dry run)" : ""}`
        );

        let updated = 0;
        let failed = 0;

        for (const movie of movies) {
            if (DRY_RUN) {
                console.log(`Would update: ${movie.title} (${movie.imdbID})`);
                continue;
            }

            try {
                const details = await fetchMovieDetails(movie.imdbID);
                const set = Object.fromEntries(
                    DETAIL_FIELDS.map((field) => [field, details[field]])
                );
                await Movie.updateOne({ _id: movie._id }, { $set: set });
                updated++;
                console.log(`Updated: ${movie.title}`);
            } catch (err) {
                failed++;
                console.error(`FAILED: ${movie.title} (${err.message})`);
            }

            await sleep(250); // be polite to OMDb
        }

        if (!DRY_RUN) {
            console.log(`Done. Updated ${updated}, failed ${failed}.`);
        }
        if (failed > 0) process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});