require("dotenv").config();

const required = ["OMDB_API_KEY", "MONGO_URI", "JWT_SECRET"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(", ")}`);
    console.error("Copy .env.example to .env and fill in the values.");
    process.exit(1);
}

module.exports = {
    omdbApiKey: process.env.OMDB_API_KEY,
    mongoUri: process.env.MONGO_URI,
    port: Number(process.env.PORT) || 5000,
    clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};