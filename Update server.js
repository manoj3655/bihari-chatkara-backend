const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send("🚀 Bihari Chatkara Backend is running!");
});

// test API
app.get("/api/test", (req, res) => {
  res.json({ message: "API working fine" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
