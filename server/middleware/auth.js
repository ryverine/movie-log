const jwt = require("jsonwebtoken");
const config = require("../config");

// Verifies the token and attaches the caller to req.user.
// Rejects the request if the token is missing, invalid or expired.
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Sign in to continue" });
    }

    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.user = {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
        };
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Your session expired. Sign in again." });
        }
        return res.status(401).json({ error: "Sign in to continue" });
    }
}

// Use after requireAuth. Rejects anyone without the named role.
function requireRole(role) {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ error: "You don't have access to that" });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };