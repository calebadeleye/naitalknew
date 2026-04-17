import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

  app.use(express.json());

  // API Route for Contact Form
  app.post("/api/contact", async (req, res) => {
    const { name, email, service, details } = req.body;

    if (!name || !email || !service || !details) {
      return res.status(400).json({ error: "All fields are required" });
    }

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
    const localReviewsPath = path.join(process.cwd(), "public", "data", "reviews.json");

    if (fs.existsSync(localReviewsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(localReviewsPath, "utf-8"));
        return res.json(data);
      } catch (e) {
        console.error("Error reading local reviews:", e);
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // Default fallback if file is missing
    res.json({ 
      reviews: [
        {
          author_name: "Marcus Thorne",
          rating: 5,
          text: "NAITALK transformed our legacy architecture into a weapon. Their team doesn't just write code; they engineer business outcomes.",
          profile_photo_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCD1KNCXxHTac4Egv-dNz6nF65rSZb-19bXUWwKfhnn7v5YIQCJyhiaDyD-Qnn6DNFwYCnL2Q16RKHd6cM4y71I3YReXU0mBbnxeQlhJaeqa_GIbZNingdGsCi21UWC6BwyEmZKTIGysiry7gwxSoxGXjsUTxOo6MXG4v3_THZGdBBSzMklMRJcKfromN6lQ-G4Ahc5p7svh_UU6lf1kkNx7NXKchTP4b5DtCodqWkZs6kap3rhwTszUYTziLkWp_nvFag5pWxgQbE"
        }
      ]
    });
  });

  // API Route for Tech News (Live from NewsAPI.org)
  app.get("/api/news", async (req, res) => {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return res.json({ articles: [] });
    }

    try {
      const response = await axios.get(
        `https://newsapi.org/v2/everything?q=software%20engineering%20AI%20innovation&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`
      );
      res.json({ articles: response.data.articles || [] });
    } catch (error) {
      console.error("NewsAPI error:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
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
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
