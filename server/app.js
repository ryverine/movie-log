const express = require("express");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.use("/api", routes);

// Last resort: catch anything a route passes to next(err)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Unexpected server error" });
});

module.exports = app;