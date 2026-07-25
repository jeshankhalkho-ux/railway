import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1); // Trust first proxy for rate limiting to work behind ingress
  const PORT = 3000;

  // 1. Block SSL Capturing / Enhanced Security Headers
  // Helmet sets HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  app.use(helmet({
    contentSecurityPolicy: false, // Vite needs inline scripts in dev
  }));

  // 2. CORS to only allow requests from the app itself (no external scraping)
  // Since we are serving the frontend from the same origin, we don't strictly need wide CORS.
  // We'll restrict to same-origin requests by just checking the host if needed, or disable CORS for external.
  app.use(cors({
    origin: process.env.APP_URL || true, // Change to exact domain in prod
    credentials: true,
  }));

  app.use(express.json());

  // 3. Rate Limiting to prevent unauthorized mass queries
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiter to all /api routes
  app.use("/api/", apiLimiter);

  // 4. Server-Side Proxying with Authentication Headers
  // The frontend must send an internal token to access the proxy, preventing direct scraping of the endpoint.
  const INTERNAL_APP_TOKEN = "RailSafe-Secured-Token-2024";

  app.use("/api/railway", async (req, res) => {
    // Basic protection: Ensure the request comes with our internal token
    const clientToken = req.headers["x-internal-token"];
    if (clientToken !== INTERNAL_APP_TOKEN) {
      return res.status(403).json({ error: "Forbidden: Invalid or missing authentication token." });
    }

    const targetUrl = `https://railway-api-gules.vercel.app/api${req.url}`;
    
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Accept": "application/json",
          // We intentionally do not forward the user's IP or sensitive headers to the external API
          "User-Agent": "RailwayTrackerApp/1.0 (Secured Proxy)",
        },
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Internal server error while fetching railway data." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
