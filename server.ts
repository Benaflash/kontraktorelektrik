import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Setup Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_PORT === "465", 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // API routes
  app.post("/api/send-email", async (req, res) => {
    try {
      const { subject, html, to } = req.body;
      const adminEmail = process.env.NOTIFICATION_EMAIL || "admin@bfgplt.com";
      const targetEmail = to || adminEmail;
      const user = process.env.SMTP_USER;

      if (!user || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured. Skipping email.");
        return res.json({ success: false, message: "SMTP not configured" });
      }

      await transporter.sendMail({
        from: `"Sistem Notifikasi BFG" <${user}>`,
        to: targetEmail,
        subject: subject,
        html: html,
      });

      console.log(`Email sent successfully to ${targetEmail} with subject: ${subject}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: "Failed to send email" });
    }
  });

  app.post("/api/telegram-notify", async (req, res) => {
    try {
      const { namaPelanggan, jenisKemaskini } = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        console.warn("Telegram credentials not configured. Skipping notification.");
        return res.json({ success: false, message: "Telegram not configured" });
      }

      const teksMesej = `🔔 *NOTIFIKASI PORTAL BFG PLT* \n\n` +
                        `👤 *Pelanggan:* ${namaPelanggan}\n` +
                        `🛠️ *Tindakan:* ${jenisKemaskini}\n` +
                        `📅 *Masa:* ${new Date().toLocaleString('ms-MY')}\n\n` +
                        `Sila semak portal admin untuk tindakan susulan.`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: teksMesej,
          parse_mode: 'Markdown'
        })
      });

      const data = await response.json();
      if (!data.ok) {
        console.error("Telegram error:", data);
        return res.status(500).json({ success: false, error: "Telegram API error" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      res.status(500).json({ success: false, error: "Failed to send Telegram message" });
    }
  });

  app.get("/api/google-reviews", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      let placeId = process.env.GOOGLE_PLACE_ID;
      
      if (!apiKey) {
        return res.json({ 
          success: false, 
          message: "API Key not configured",
          reviews: [] 
        });
      }

      // If placeId is not hardcoded, let's find it using findplacefromtext
      if (!placeId) {
        const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Bena%20Flash%20Global&inputtype=textquery&fields=place_id&key=${apiKey}`;
        const findResp = await fetch(findPlaceUrl);
        const findData = await findResp.json();
        
        if (findData.status === "OK" && findData.candidates && findData.candidates.length > 0) {
          placeId = findData.candidates[0].place_id;
        } else {
          return res.json({ success: false, message: "Could not auto-detect Place ID", reviews: [] });
        }
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&language=ms&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.result) {
        res.json({
          success: true,
          rating: data.result.rating,
          totalReviews: data.result.user_ratings_total,
          reviews: data.result.reviews || []
        });
      } else {
        res.json({ success: false, message: data.error_message || "Failed to fetch" });
      }
    } catch (e) {
      console.error("Error fetching Google Reviews:", e);
      res.status(500).json({ success: false });
    }
  });

  app.post("/api/quote", (req, res) => {
    const { name, phone, location, skop } = req.body;
    if (!name || !phone || !location || !skop) {
      return res.status(400).json({ error: "Maklumat tidak lengkap" });
    }
    console.log("Permohonan Sebut Harga:", { name, phone, location, skop });
    res.json({ message: "Permohonan berjaya diterima dan dalam proses.", success: true });
  });

  // Dynamically generate sitemap.xml for SEO indexing
  app.get("/sitemap.xml", (req, res) => {
    try {
      const baseUrl = process.env.BASE_URL || "https://kontraktorelektrik.bfgplt.com";
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=projek</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (e) {
      res.status(500).end();
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
