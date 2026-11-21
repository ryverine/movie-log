const bcrypt = require("bcryptjs");
const User = require("../models/User");

const BCRYPT_COST = 12;

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
            id: user._id,
            username: user.username,
            role: user.role,
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