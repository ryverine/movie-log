const config = require("../config");
const mongoose = require("mongoose");
const Movie = require("../models/Movie");
const User = require("../models/User");

const DRY_RUN = process.argv.includes("--dry-run");
const username = process.argv.find((a) => a.startsWith("--user="))?.split("=")[1];

async function main() {
    if (!username) {
        console.error("Usage: node scripts/assign-owner.js --user=<username> [--dry-run]");
        process.exit(1);
    }

    await mongoose.connect(config.mongoUri);

    try {
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            console.error(`No user named "${username}". Register that account first.`);
            process.exitCode = 1;
            return;
        }

        // 1. Give orphaned movies an owner
        const orphans = await Movie.countDocuments({ owner: { $exists: false } });
        console.log(`${orphans} movie(s) without an owner${DRY_RUN ? " (dry run)" : ""}`);

        if (!DRY_RUN && orphans > 0) {
            const result = await Movie.updateMany(
                { owner: { $exists: false } },
                { $set: { owner: user._id } }
            );
            console.log(`Assigned ${result.modifiedCount} movie(s) to ${user.username}`);
        }

        // 2. Drop the old global unique index, which would stop two users
        //    from saving the same movie
        const indexes = await Movie.collection.indexes();
        const old = indexes.find((i) => i.name === "imdbID_1");

        if (!old) {
            console.log("Old imdbID index already gone");
        } else if (DRY_RUN) {
            console.log("Would drop index imdbID_1");
        } else {
            await Movie.collection.dropIndex("imdbID_1");
            console.log("Dropped index imdbID_1");
        }

        // 3. Build the compound index
        if (!DRY_RUN) {
            await Movie.syncIndexes();
            console.log("Indexes now:", (await Movie.collection.indexes()).map((i) => i.name).join(", "));
        }
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});