import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =====================
// HEALTH
// =====================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Bihari Chatkara RMS",
    time: new Date().toISOString()
  });
});

// =====================
// AUTH
// =====================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@biharichatkara.com" && password === "admin123") {
    return res.json({
      success: true,
      user: { id: 1, name: "Admin", role: "admin" }
    });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// =====================
// DUMMY DATA
// =====================
const orders = [];
const menuItems = [];
const ingredients = [];
const users = [];
const expenses = [];
const requisitions = [];
const customers = [];

// =====================
// ORDERS
// =====================
app.get("/api/orders", (req, res) => res.json(orders));
app.post("/api/orders", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  orders.push(item);
  res.json(item);
});

// =====================
// MENU ITEMS
// =====================
app.get("/api/menu-items", (req, res) => res.json(menuItems));
app.post("/api/menu-items", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  menuItems.push(item);
  res.json(item);
});

// =====================
// INGREDIENTS
// =====================
app.get("/api/ingredients", (req, res) => res.json(ingredients));
app.post("/api/ingredients", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  ingredients.push(item);
  res.json(item);
});

// =====================
// USERS
// =====================
app.get("/api/users", (req, res) => res.json(users));
app.post("/api/users", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  users.push(item);
  res.json(item);
});

// =====================
// EXPENSES
// =====================
app.get("/api/expenses", (req, res) => res.json(expenses));
app.post("/api/expenses", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  expenses.push(item);
  res.json(item);
});

// =====================
// REQUISITIONS
// =====================
app.get("/api/requisitions", (req, res) => res.json(requisitions));
app.post("/api/requisitions", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  requisitions.push(item);
  res.json(item);
});

// =====================
// CUSTOMERS
// =====================
app.get("/api/customers", (req, res) => res.json(customers));
app.post("/api/customers", (req, res) => {
  const item = { id: Date.now(), ...req.body };
  customers.push(item);
  res.json(item);
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
