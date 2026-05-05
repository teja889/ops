const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || "rzp_live_SfgmYpvpywG10z";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "Qz3rmpn3vqoAct7LKWwefvV7";
const WEBHOOK_SECRET      = process.env.WEBHOOK_SECRET      || "9490655953";
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || "8739190401:AAEYLj3eAddOxOpWXPdynOHQjBIPjNmWdWQ";
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID    || "2103157568";
const DASHBOARD_PASSWORD  = process.env.DASHBOARD_PASSWORD  || "2026";
const DB_FILE             = path.join(__dirname, "data.json");

// ─── SIMPLE JSON DB ──────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ events: [] }, null, 2));
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { events: [] }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function saveEvent(event) {
  const db = readDB();
  db.events.unshift({ id: Date.now() + Math.random().toString(36).slice(2), ...event, timestamp: new Date().toISOString() });
  writeDB(db);
  return db.events[0];
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }),
    });
  } catch (e) { console.error("Telegram error:", e.message); }
}

function istTime() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function telegramMessages(type, data) {
  const time = istTime();
  const couponStr = data.coupon ? `\n🏷 <b>Coupon:</b> ${data.coupon}` : "";
  const base = `👤 <b>Name:</b> ${data.name || "—"}
📱 <b>Phone:</b> ${data.phone || "—"}
📧 <b>Email:</b> ${data.email || "—"}`;

  switch (type) {
    case "lead":
      return `🎯 <b>NEW LEAD CAPTURED</b>\n${"─".repeat(28)}\n${base}\n💰 <b>Amount:</b> ₹${data.amount || "999"}${couponStr}\n⏰ <b>Time:</b> ${time}\n${"─".repeat(28)}`;
    case "initiated":
      return `💳 <b>PAYMENT INITIATED</b>\n${"─".repeat(28)}\n${base}\n💰 <b>Amount:</b> ₹${data.amount}${couponStr}\n🆔 <b>Order ID:</b> ${data.orderId || "—"}\n⏰ <b>Time:</b> ${time}\n${"─".repeat(28)}`;
    case "success":
      return `✅ <b>PAYMENT SUCCESS 🎉</b>\n${"─".repeat(28)}\n${base}\n💰 <b>Amount Paid:</b> ₹${data.amount}${couponStr}\n🆔 <b>Payment ID:</b> ${data.paymentId || "—"}\n⏰ <b>Time:</b> ${time}\n${"─".repeat(28)}`;
    case "failed":
      return `❌ <b>PAYMENT FAILED</b>\n${"─".repeat(28)}\n${base}\n💰 <b>Amount:</b> ₹${data.amount || "—"}\n⚠️ <b>Reason:</b> ${data.reason || "Unknown"}\n⏰ <b>Time:</b> ${time}\n${"─".repeat(28)}`;
    case "abandoned":
      return `🚪 <b>PAYMENT ABANDONED</b>\n${"─".repeat(28)}\n${base}\n💰 <b>Amount:</b> ₹${data.amount || "—"}${couponStr}\n💡 User closed Razorpay without paying\n⏰ <b>Time:</b> ${time}\n${"─".repeat(28)}`;
    default:
      return `📌 <b>EVENT: ${type}</b>\n${JSON.stringify(data, null, 2)}`;
  }
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use("/webhook/razorpay", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── TRACK ENDPOINT (called from payment page) ────────────────────────────────
app.post("/track", async (req, res) => {
  const { type, name, phone, email, amount, coupon, orderId, paymentId, reason } = req.body;
  if (!type) return res.status(400).json({ error: "type required" });

  const event = saveEvent({ type, name, phone, email, amount, coupon, orderId, paymentId, reason });
  const msg = telegramMessages(type, { name, phone, email, amount, coupon, orderId, paymentId, reason });
  await sendTelegram(msg);

  res.json({ ok: true, id: event.id });
});

// ─── RAZORPAY WEBHOOK ─────────────────────────────────────────────────────────
app.post("/webhook/razorpay", async (req, res) => {
  const sig = req.headers["x-razorpay-signature"];
  const body = req.body;

  // Verify signature
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(body);
  const digest = hmac.digest("hex");

  if (sig !== digest) {
    console.log("Webhook signature mismatch");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let payload;
  try { payload = JSON.parse(body.toString()); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  const event = payload.event;
  const payment = payload.payload?.payment?.entity;

  if (!payment) return res.json({ ok: true });

  const notes = payment.notes || {};
  const data = {
    name: notes.name || "—",
    phone: notes.phone || payment.contact || "—",
    email: notes.email || payment.email || "—",
    amount: (payment.amount / 100).toFixed(0),
    coupon: notes.coupon || null,
    paymentId: payment.id,
    orderId: payment.order_id,
    reason: payment.error_description || null,
  };

  if (event === "payment.captured") {
    saveEvent({ type: "success", ...data, source: "webhook" });
    await sendTelegram(telegramMessages("success", data));
  } else if (event === "payment.failed") {
    saveEvent({ type: "failed", ...data, source: "webhook" });
    await sendTelegram(telegramMessages("failed", data));
  }

  res.json({ ok: true });
});

// ─── DASHBOARD API ────────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  if (req.body.password === DASHBOARD_PASSWORD) {
    res.json({ ok: true, token: Buffer.from(DASHBOARD_PASSWORD + ":astrafxpro").toString("base64") });
  } else {
    res.status(401).json({ error: "Wrong password" });
  }
});

function authMiddleware(req, res, next) {
  const token = req.headers["x-auth-token"];
  const expected = Buffer.from(DASHBOARD_PASSWORD + ":astrafxpro").toString("base64");
  if (token !== expected) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/api/stats", authMiddleware, (req, res) => {
  const db = readDB();
  const events = db.events;

  // Deduplicate leads by phone/email — keep latest
  const leads = events.filter(e => e.type === "lead");
  const initiated = events.filter(e => e.type === "initiated");
  const success = events.filter(e => e.type === "success");
  const failed = events.filter(e => e.type === "failed");
  const abandoned = events.filter(e => e.type === "abandoned");

  const revenue = success.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  // Build unified user list
  const userMap = {};
  events.forEach(e => {
    const key = e.phone || e.email || e.id;
    if (!userMap[key]) {
      userMap[key] = { name: e.name, phone: e.phone, email: e.email, coupon: e.coupon, amount: e.amount, status: e.type, lastSeen: e.timestamp, events: [] };
    }
    userMap[key].events.push(e.type);
    userMap[key].lastSeen = e.timestamp;
    // Upgrade status
    const priority = { lead: 1, initiated: 2, abandoned: 3, failed: 4, success: 5 };
    if ((priority[e.type] || 0) > (priority[userMap[key].status] || 0)) {
      userMap[key].status = e.type;
      userMap[key].amount = e.amount || userMap[key].amount;
      userMap[key].coupon = e.coupon || userMap[key].coupon;
    }
  });

  const users = Object.values(userMap).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  res.json({
    summary: { leads: leads.length, initiated: initiated.length, success: success.length, failed: failed.length, abandoned: abandoned.length, revenue: revenue.toFixed(0) },
    users,
    recentEvents: events.slice(0, 50),
  });
});

app.listen(PORT, () => console.log(`✅ AstraFXPro Tracker running on port ${PORT}`));
