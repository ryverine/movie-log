const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 20,
            match: [/^[a-z0-9_]+$/, "Username can use letters, numbers and underscores only"],
        },
        // Never the password itself. select: false keeps it out of query results.
        passwordHash: { type: String, required: true, select: false },
        role: { type: String, enum: ["user", "admin"], default: "user" },
    },
    { timestamps: true }
);

// Belt and braces: strip the hash from anything serialized to JSON
userSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.passwordHash;
        return ret;
    },
});

module.exports = mongoose.model("User", userSchema);