// ============================================
// StudyBot AI Chatbot - Backend Server
// ============================================

const path = require("path");

// Load .env from the project folder
require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_MODEL =
    (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();

const GEMINI_API_KEY =
    (process.env.GEMINI_API_KEY || "").trim();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ============================================
// MONGODB CONNECTION
// ============================================

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
        console.error(
            "MongoDB connection error:",
            error.message
        );
    });

// ============================================
// GEMINI AI FUNCTION
// ============================================

async function askGemini(prompt) {
    if (!GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is missing in the .env file."
        );
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(
                `Gemini request: attempt ${attempt}/${maxAttempts}`
            );

            const response = await fetch(url, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY
                },

                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                }),

                signal: AbortSignal.timeout(90000)
            });

            const data = await response.json();

            if (!response.ok) {
                const error = new Error(
                    data?.error?.message ||
                    `Gemini API error: HTTP ${response.status}`
                );

                error.status = response.status;

                console.error(
                    "Gemini API error:",
                    response.status,
                    error.message
                );

                // Invalid key or request errors should not retry.
                const retryableStatuses = [
                    429, 500, 502, 503, 504
                ];

                if (
                    !retryableStatuses.includes(response.status) ||
                    attempt === maxAttempts
                ) {
                    throw error;
                }

                await new Promise(resolve =>
                    setTimeout(resolve, attempt * 2000)
                );

                continue;
            }

            const answer = data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

            if (!answer) {
                throw new Error(
                    "Gemini returned an empty response."
                );
            }

            return answer;

        } catch (error) {
            console.error(
                `Gemini attempt ${attempt} failed:`,
                error.message
            );

            const retryable =
                [429, 500, 502, 503, 504].includes(error.status) ||
                error.name === "TimeoutError" ||
                error.name === "AbortError";

            if (!retryable || attempt === maxAttempts) {
                throw error;
            }

            await new Promise(resolve =>
                setTimeout(resolve, attempt * 2000)
            );
        }
    }

    throw new Error("Gemini request failed after retries.");
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (
        !authHeader ||
        !authHeader.startsWith("Bearer ")
    ) {
        return res.status(401).json({
            success: false,
            error: "Please login first."
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            error: "JWT_SECRET is missing in .env."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token. Please login again."
        });
    }
}

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        server: "running",

        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected",

        geminiModel: GEMINI_MODEL,

        geminiKeyLoaded: Boolean(GEMINI_API_KEY)
    });
});

// ============================================
// REGISTER API
// ============================================

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: "Name, email and password are required."
            });
        }

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid input."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: "Password must contain at least 6 characters."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        return res.status(201).json({
            success: true,
            message: "Registration successful. Please login.",

            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error(
            "Registration error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            error: "Registration failed. Please try again."
        });
    }
});

// ============================================
// LOGIN API
// ============================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password are required."
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET is missing in .env."
            );
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "7d"
            }
        );

        return res.json({
            success: true,
            message: "Login successful.",
            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error(
            "Login error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            error: "Login failed. Please try again."
        });
    }
});

// ============================================
// GET CURRENT USER
// ============================================

app.get(
    "/api/auth/me",
    authenticateToken,
    async (req, res) => {
        try {
            const user = await User.findById(
                req.user.id
            ).select("-password");

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "User not found."
                });
            }

            return res.json({
                success: true,

                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            });

        } catch (error) {
            console.error(
                "Current user error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                error: "Unable to retrieve user information."
            });
        }
    }
);

// ============================================
// AI CHAT API
// ============================================

app.post("/api/chat", async (req, res) => {
    try {
        const { message, history } = req.body;

        if (
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "Please enter a message."
            });
        }

        let conversation = "";

        if (Array.isArray(history)) {
            conversation = history
                .slice(-10)
                .map(item => {
                    const role =
                        item.role === "assistant" ||
                        item.role === "bot"
                            ? "Assistant"
                            : "User";

                    const content =
                        item.content || item.text || "";

                    return (
                        `${role}: ${String(content).slice(0, 4000)}`
                    );
                })
                .join("\n");
        }

        const prompt = `
You are StudyBot, a helpful and friendly AI study assistant.

Instructions:
- Explain concepts in simple, student-friendly language.
- Use headings and bullet points where useful.
- Explain programming logic step by step.
- Provide correct code when requested.
- Ask a short clarification if the question is unclear.
- Do not invent facts when unsure.
- Keep answers relevant to the question.

${conversation
    ? `Previous conversation:\n${conversation}\n`
    : ""}

Current user question:
${message.trim()}
`;

        const reply = await askGemini(prompt);

        return res.json({
            success: true,
            reply,
            response: reply,
            message: reply
        });

    } catch (error) {
        console.error(
            "Chat API error:",
            error.message
        );

        const isTimeout =
            error.name === "TimeoutError" ||
            error.name === "AbortError";

        return res.status(
            isTimeout ? 504 : 502
        ).json({
            success: false,
            error: isTimeout
                ? "Gemini request timed out. Please try again."
                : error.message
        });
    }
});

// ============================================
// GENERATE NOTES API
// ============================================

app.post("/api/notes", async (req, res) => {
    try {
        const { topic } = req.body;

        if (
            typeof topic !== "string" ||
            !topic.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "Please enter a topic."
            });
        }

        const prompt = `
Create useful study notes about: ${topic.trim()}

Requirements:
- Include a clear title.
- Use headings and bullet points.
- Explain concepts in simple language.
- Include definitions and examples where useful.
- Include a short summary.
- Return readable Markdown.
`;

        const notes = await askGemini(prompt);

        return res.json({
            success: true,
            notes
        });

    } catch (error) {
        console.error(
            "Notes API error:",
            error.message
        );

        return res.status(502).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// GENERATE FLASHCARDS API
// ============================================

app.post("/api/flashcards", async (req, res) => {
    try {
        const { topic, count } = req.body;

        if (
            typeof topic !== "string" ||
            !topic.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "Please enter a topic."
            });
        }

        const numberOfCards = Math.min(
            Math.max(parseInt(count, 10) || 5, 1),
            20
        );

        const prompt = `
Create exactly ${numberOfCards} flashcards about "${topic.trim()}".

Return ONLY a valid JSON array.
Do not use Markdown code fences.

Each array item must have this format:
{
    "term": "short question or key term",
    "definition": "clear and concise answer"
}
`;

        const output = await askGemini(prompt);

        const cleaned = output
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");

        if (start === -1 || end === -1) {
            throw new Error(
                "AI did not return a valid flashcard array."
            );
        }

        const cards = JSON.parse(
            cleaned.slice(start, end + 1)
        );

        return res.json({
            success: true,
            cards
        });

    } catch (error) {
        console.error(
            "Flashcards API error:",
            error.message
        );

        return res.status(502).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// GENERATE QUIZ API
// ============================================

app.post("/api/quiz", async (req, res) => {
    try {
        const {
            topic,
            count,
            numQuestions,
            difficulty
        } = req.body;

        if (
            typeof topic !== "string" ||
            !topic.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "Please enter a quiz topic."
            });
        }

        const numberOfQuestions = Math.min(
            Math.max(
                parseInt(count || numQuestions, 10) || 5,
                1
            ),
            20
        );

        const selectedDifficulty = [
            "easy",
            "medium",
            "hard"
        ].includes(
            String(difficulty || "").toLowerCase()
        )
            ? String(difficulty).toLowerCase()
            : "medium";

        const prompt = `
Create exactly ${numberOfQuestions} multiple-choice quiz questions
about "${topic.trim()}".

Difficulty: ${selectedDifficulty}

Return ONLY a valid JSON array.
Do not use Markdown code fences.

Each question must follow this format:
{
    "question": "Question text",
    "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
    ],
    "correctIndex": 0,
    "explanation": "Short explanation"
}

correctIndex must be a zero-based number from 0 to 3.
Every question must have exactly four options.
`;

        const output = await askGemini(prompt);

        const cleaned = output
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");

        if (start === -1 || end === -1) {
            throw new Error(
                "AI did not return a valid quiz array."
            );
        }

        const questions = JSON.parse(
            cleaned.slice(start, end + 1)
        );

        const normalizedQuestions = questions.map(item => {
            const correctIndex = Number(
                item.correctIndex ?? item.answer
            );

            if (
                !Array.isArray(item.options) ||
                item.options.length !== 4 ||
                !Number.isInteger(correctIndex) ||
                correctIndex < 0 ||
                correctIndex > 3
            ) {
                throw new Error(
                    "AI returned an invalid quiz question."
                );
            }

            return {
                question: item.question,
                options: item.options,
                answer: correctIndex,
                correctIndex,
                explanation: item.explanation || ""
            };
        });

        return res.json({
            success: true,
            questions: normalizedQuestions
        });

    } catch (error) {
        console.error(
            "Quiz API error:",
            error.message
        );

        return res.status(502).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// FRONTEND ROUTE
// ============================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );

    console.log(
        `Gemini model configured: ${GEMINI_MODEL}`
    );

    console.log(
        `Gemini API key loaded: ${Boolean(GEMINI_API_KEY)}`
    );
});