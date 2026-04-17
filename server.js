import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use(express.json());

  // API Route for Contact Form
  app.post("/api/contact", async (req, res) => {
    const { name, email, service, details } = req.body;

    if (!name || !email || !service || !details) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      // Configure SMTP transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
        port: Number(process.env.SMTP_PORT) || 2525,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "b3940928804095",
          pass: process.env.SMTP_PASS || "1097c500947c8b",
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      await transporter.verify();

      const mailOptions = {
        from: `"NAITALK Contact" <${process.env.SMTP_USER || "b3940928804095@mailtrap.io"}>`,
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

  // API Route for Google Reviews (Simplified - Local fallback only)
  app.get("/api/reviews", (req, res) => {
    const localReviewsPath = path.join(process.cwd(), "public", "data", "reviews.json");

    if (fs.existsSync(localReviewsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(localReviewsPath, "utf-8"));
        return res.json(data);
      } catch (e) {
        console.error("Error reading local reviews:", e);
      }
    }

    // Default fallback
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

  // API Route for Tech News (Simplified - Local only)
  app.get("/api/news", (req, res) => {
    res.json({
      articles: [
        {
          title: "The Future of Quantum Computing in Enterprise",
          description: "How quantum algorithms are revolutionizing supply chain optimization and cryptography.",
          url: "#",
          urlToImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800",
          publishedAt: new Date().toISOString(),
          source: { name: "Tech Frontier" }
        },
        {
          title: "AI-Driven Cybersecurity: A New Paradigm",
          description: "Autonomous threat detection systems are now capable of neutralizing zero-day exploits in milliseconds.",
          url: "#",
          urlToImage: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800",
          publishedAt: new Date().toISOString(),
          source: { name: "Cyber Intelligence" }
        },
        {
          title: "Scalable Microservices with Rust and Go",
          description: "Why leading fintech firms are migrating their core infrastructure to memory-safe languages.",
          url: "#",
          urlToImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc51?auto=format&fit=crop&q=80&w=800",
          publishedAt: new Date().toISOString(),
          source: { name: "Engineering Weekly" }
        }
      ]
    });
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production" && fs.existsSync(path.join(process.cwd(), "dist"));
  
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
