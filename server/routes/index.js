const express = require("express");
const movies = require("../controllers/movieController");
const search = require("../controllers/searchController");
const auth = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Public
router.post("/auth/register", auth.register);
router.post("/auth/login", auth.login);

// Everything below requires a valid token
router.use(requireAuth);

router.get("/auth/me", auth.me);

router.get("/search", search.searchMovies);

router.get("/movies", movies.listMovies);
router.post("/movies", movies.addMovie);
router.put("/movies/:id", movies.updateMovie);
router.delete("/movies/:id", movies.removeMovie);

// Any unmatched /api route answers with JSON, not Express's HTML error page
router.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

module.exports = router;