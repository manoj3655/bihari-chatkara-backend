import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middlewares
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Fix __dirname in ES module
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// Serve frontend (if needed)
// --------------------
const clientDistPath = path.join(__dirname, "dist");
app.use(express.static(clientDistPath));

// --------------------
// HEALTH CHECK
// --------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Bihari Chatkara RMS",
    time: new Date().toISOString()
  });
});

// --------------------
// SAMPLE API (test)
// --------------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@test.com" && password === "1234") {
    return res.json({ success: true, message: "Login successful" });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// --------------------
// SPA CATCH-ALL (ALWAYS LAST)
// --------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
