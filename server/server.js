const mongoose = require("mongoose");
const config = require("./config");
const app = require("./app");

mongoose
    .connect(config.mongoUri)
    .then(() => {
        console.log("MongoDB connected");
        app.listen(config.port, () =>
            console.log(`Server running on port ${config.port}`)
        );
    })
    .catch((err) => {
        console.error("Could not connect to MongoDB:", err.message);
        process.exit(1);
    });