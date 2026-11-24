const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../config");

const BCRYPT_COST = 12;
// A real bcrypt hash of a random value, used so failed logins take the same
// time whether or not the username exists
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST);

// POST /api/auth/register
exports.register = async (req, res, next) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (password.length > 72) {
        return res.status(400).json({ error: "Password must be 72 characters or fewer" });
    }

    try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
        const user = await User.create({ username, passwordHash });

        res.status(201).json({
            token: signToken(user),
            user: { id: user._id, username: user.username, role: user.role },
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "That username is taken" });
        }
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

function signToken(user) {
    return jwt.sign(
        { sub: user._id.toString(), username: user.username, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
}

// POST /api/auth/login
exports.login = async (req, res, next) => {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    try {
        // select("+passwordHash") overrides the schema's select: false
        const user = await User.findOne({ username }).select("+passwordHash");

        // Always run a comparison, so a missing user and a wrong password take
        // the same time. Otherwise the response time reveals which usernames exist.
        const hash = user ? user.passwordHash : DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);

        if (!user || !ok) {
            return res.status(401).json({ error: "Incorrect username or password" });
        }

        res.json({
            token: signToken(user),
            user: { id: user._id, username: user.username, role: user.role },
        });
    } catch (err) {
        next(err);
    }
};


// GET /api/auth/me
exports.me = (req, res) => {
    res.json({ user: req.user });
};