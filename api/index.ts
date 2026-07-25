import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL || true, credentials: true }));
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests" }, standardHeaders: true, legacyHeaders: false });
app.use("/api/", apiLimiter);

const INTERNAL_APP_TOKEN = "RailSafe-Secured-Token-2024";

app.use("/api/railway", async (req, res) => {
  const clientToken = req.headers["x-internal-token"];
  if (clientToken !== INTERNAL_APP_TOKEN) {
    return res.status(403).json({ error: "Forbidden: Invalid or missing authentication token." });
  }
  const targetUrl = `https://railway-api-gules.vercel.app/api${req.url}`;
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { "Accept": "application/json", "User-Agent": "RailwayTrackerApp/1.0 (Secured Proxy)" },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(500).json({ error: "Internal server error while fetching railway data." });
  }
});

export default app;
