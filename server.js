import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";
import { getPageSeo } from "./src/seo/pageSeoConfig.mjs";

dotenv.config();

/**
 * Real crawlers and social-preview scrapers (Google, Facebook, Twitter,
 * LinkedIn, WhatsApp) read the raw HTML response — they don't run this app's
 * client-side JS. Since this is a client-rendered SPA, that HTML would
 * otherwise be identical for every route. This swaps in the right
 * title/description/canonical/OG tags for the requested path before the
 * response is sent, so each page still gets correct SEO metadata without a
 * full server-rendering rewrite.
 */
function injectSeoTags(html, pathname) {
  const seo = getPageSeo(pathname);
  const escape = (value) => String(value).replace(/"/g, "&quot;");

  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escape(seo.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/s, `$1${escape(seo.description)}$2`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/s, `$1${escape(seo.canonical)}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/s, `$1${escape(seo.canonical)}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/s, `$1${escape(seo.title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/s, `$1${escape(seo.description)}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/s, `$1${escape(seo.ogImage)}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/s, `$1${escape(seo.title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/s, `$1${escape(seo.description)}$2`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/s, `$1${escape(seo.ogImage)}$2`);
}

const dataDir = path.join(process.cwd(), "storage");
const uploadsDir = path.join(process.cwd(), "public", "uploads", "admin");
const siteContentPath = path.join(dataDir, "site-content.json");
const portfolioPath = path.join(process.cwd(), "public", "data", "portfolio.json");
const reviewsPath = path.join(process.cwd(), "public", "data", "reviews.json");
const adminCookieName = "naitalk_admin";
const maxUploadBytes = 5 * 1024 * 1024;
const laravelApiBaseUrl = (process.env.LARAVEL_API_URL || process.env.VITE_LARAVEL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const defaultClientLogos = ["UTME", "Skinologist", "Luminary", "Naibank", "ScholarJoint", "RHM"].map((name) => ({
  name,
  alt: name,
  src: "",
}));

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function getDefaultSiteContent() {
  const portfolio = readJsonFile(portfolioPath, { projects: [] });
  const reviews = readJsonFile(reviewsPath, { reviews: [] });

  return {
    brand: {
      logo: {
        src: "/logo.png",
        alt: "NAITALK",
        width: null,
        height: null,
      },
    },
    clientLogos: defaultClientLogos,
    projects: Array.isArray(portfolio.projects) ? portfolio.projects : [],
    reviews: Array.isArray(reviews.reviews) ? reviews.reviews : [],
  };
}

function cleanText(value, fallback = "", maxLength = 2000) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function cleanImage(value) {
  const src = cleanText(value?.src, "", 700);
  return {
    src,
    alt: cleanText(value?.alt, "Image", 180),
    width: Number.isFinite(value?.width) ? Number(value.width) : null,
    height: Number.isFinite(value?.height) ? Number(value.height) : null,
  };
}

function sanitizeSiteContent(input) {
  const fallback = getDefaultSiteContent();
  const brandLogo = cleanImage(input?.brand?.logo || fallback.brand.logo);
  const clientLogos = Array.isArray(input?.clientLogos) ? input.clientLogos : fallback.clientLogos;
  const projects = Array.isArray(input?.projects) ? input.projects : fallback.projects;
  const reviews = Array.isArray(input?.reviews) ? input.reviews : fallback.reviews;

  return {
    brand: {
      logo: {
        ...brandLogo,
        src: brandLogo.src || "/logo.png",
        alt: brandLogo.alt || "NAITALK",
      },
    },
    clientLogos: clientLogos
      .map((logo) => {
        const image = cleanImage(logo);
        return {
          name: cleanText(logo?.name, image.alt || "Client logo", 120),
          alt: image.alt,
          src: image.src,
          width: image.width,
          height: image.height,
        };
      })
      .filter((logo) => logo.name || logo.src),
    projects: projects
      .map((project) => ({
        title: cleanText(project?.title, "Untitled project", 160),
        category: cleanText(project?.category, "Project", 220),
        img: cleanText(project?.img, "", 700),
        details: {
          challenge: cleanText(project?.details?.challenge, "", 2000),
          solution: cleanText(project?.details?.solution, "", 2000),
          roi: cleanText(project?.details?.roi, "", 2000),
        },
      }))
      .filter((project) => project.title),
    reviews: reviews
      .map((review) => ({
        author_name: cleanText(review?.author_name, "Client", 160),
        rating: Math.min(5, Math.max(1, Number.parseInt(review?.rating, 10) || 5)),
        text: cleanText(review?.text, "", 3000),
        profile_photo_url: cleanText(review?.profile_photo_url, "", 700),
        relative_time_description: cleanText(review?.relative_time_description, "", 120),
      }))
      .filter((review) => review.author_name && review.text),
  };
}

function readSiteContent() {
  const content = readJsonFile(siteContentPath, getDefaultSiteContent());
  return sanitizeSiteContent(content);
}

function saveSiteContent(content) {
  const sanitized = sanitizeSiteContent(content);
  writeJsonFile(siteContentPath, sanitized);
  return sanitized;
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      }),
  );
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "naitalk-local-admin-secret";
}

function signSessionPayload(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function createSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 1000 * 60 * 60 * 8,
    }),
  ).toString("base64url");
  return `${payload}.${signSessionPayload(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expectedSignature = signSessionPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function timingSafeStringEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || "");
  const session = verifySessionToken(cookies[adminCookieName]);

  if (session) {
    req.admin = session;
    return next();
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (token) {
    try {
      const response = await axios.get(`${laravelApiBaseUrl}/api/v1/auth/me`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const user = response.data?.user;

      if (["super_admin", "admin_staff"].includes(user?.role)) {
        req.admin = { username: user.email, role: user.role };
        return next();
      }
    } catch (error) {
      console.error("Laravel admin token verification failed:", error?.response?.data || error.message);
    }
  }

  return res.status(401).json({ error: "Admin login required" });
}

function getImageSize(buffer, mimeType) {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && buffer.length > 4) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  if (mimeType === "image/gif" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (mimeType === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }

  return { width: null, height: null };
}

function extensionForMimeType(mimeType) {
  return {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  }[mimeType];
}

function safeUploadName(fileName, extension) {
  const baseName = path
    .basename(fileName || "upload")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return `${Date.now()}-${baseName || "image"}.${extension}`;
}

async function startServer() {
  ensureStorage();

  const app = express();
  const PORT = process.env.PORT || 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

  app.use(express.json({ limit: "8mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads"), { maxAge: "1d" }));

  // Public content managed from the admin backend.
  app.get("/api/site-content", (req, res) => {
    res.json(readSiteContent());
  });

  app.post("/api/admin/login", (req, res) => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
      return res.status(503).json({ error: "Admin password is not configured on the server" });
    }

    if (!timingSafeStringEqual(req.body?.username || "", username) || !timingSafeStringEqual(req.body?.password || "", password)) {
      return res.status(401).json({ error: "Invalid login details" });
    }

    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie(adminCookieName, createSessionToken(username), {
      httpOnly: true,
      sameSite: "strict",
      secure,
      maxAge: 1000 * 60 * 60 * 8,
      path: "/",
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", requireAdmin, (req, res) => {
    res.clearCookie(adminCookieName, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/admin/session", requireAdmin, (req, res) => {
    res.json({ ok: true, username: req.admin.username });
  });

  app.get("/api/admin/content", requireAdmin, (req, res) => {
    res.json(readSiteContent());
  });

  app.put("/api/admin/content", requireAdmin, (req, res) => {
    try {
      res.json(saveSiteContent(req.body));
    } catch (error) {
      console.error("Error saving site content:", error);
      res.status(500).json({ error: "Content could not be saved" });
    }
  });

  app.post("/api/admin/upload", requireAdmin, (req, res) => {
    try {
      const { dataUrl, fileName } = req.body || {};
      const match = typeof dataUrl === "string" ? dataUrl.match(/^data:([^;]+);base64,(.+)$/) : null;

      if (!match) {
        return res.status(400).json({ error: "A valid image upload is required" });
      }

      const mimeType = match[1].toLowerCase();
      const extension = extensionForMimeType(mimeType);

      if (!extension) {
        return res.status(400).json({ error: "Only PNG, JPG, WEBP, GIF or SVG images are allowed" });
      }

      const buffer = Buffer.from(match[2], "base64");
      if (!buffer.length || buffer.length > maxUploadBytes) {
        return res.status(400).json({ error: "Image must be smaller than 5MB" });
      }

      const savedName = safeUploadName(fileName, extension);
      const savedPath = path.join(uploadsDir, savedName);
      fs.writeFileSync(savedPath, buffer);

      res.json({
        src: `/uploads/admin/${savedName}`,
        alt: cleanText(fileName, "Uploaded image", 180),
        mimeType,
        size: buffer.length,
        ...getImageSize(buffer, mimeType),
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Image could not be uploaded" });
    }
  });

  // API Route for Contact Form
  app.post("/api/contact", async (req, res) => {
    const { name, email, service, details } = req.body;

    if (!name || !email || !service || !details) {
      return res.status(400).json({ error: "All fields are required" });
    }

    console.log(`Processing contact form for ${email}. SMTP Host: ${process.env.SMTP_HOST}`);

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.verify();

      const mailOptions = {
        from: `"NAITALK Contact" <${process.env.SMTP_USER}>`,
        to: "info@naitalk.com",
        replyTo: email,
        subject: `New Contact Form Submission: ${service}`,
        text: `Name: ${name}\nEmail: ${email}\nService: ${service}\nDetails: ${details}`,
        html: `
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Details:</strong></p>
          <p>${details.replace(/\n/g, "<br>")}</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Message sent successfully" });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
    }
  });

  // API Route for Reviews (Local JSON datasource)
  app.get("/api/reviews", (req, res) => {
    res.json({ reviews: readSiteContent().reviews });
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Vite / Static Serving logic
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");
  
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // SPA fallback for development
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), "index.html"),
          "utf-8"
        );
        template = await vite.transformIndexHtml(url, template);
        template = injectSeoTags(template, req.path);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(injectSeoTags(template, req.path));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
