import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Dropbox Token Exchange
  app.post("/api/auth/dropbox/token", async (req, res) => {
    const { code, clientId, clientSecret, redirectUri } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const params = new URLSearchParams();
      params.append("code", code);
      params.append("grant_type", "authorization_code");
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("redirect_uri", redirectUri);

      const response = await axios.post("https://api.dropbox.com/oauth2/token", params);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("Dropbox token exchange error:", errorData || error.message);
      
      let errorMessage = "Failed to exchange token";
      if (errorData?.error_description) {
        errorMessage = errorData.error_description;
      } else if (errorData?.error) {
        errorMessage = `Dropbox error: ${errorData.error}`;
      }

      res.status(500).json({ 
        error: errorMessage, 
        details: errorData 
      });
    }
  });

  // Auth Callback Page (Simple HTML to postMessage back to opener)
  app.get("/auth/dropbox/callback", (req, res) => {
    res.send(`
      <html>
        <body style="background: #12121a; color: #e8e8f0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h2 style="color: #0061ff;">Autenticazione in corso...</h2>
            <p>Questa finestra si chiuderà automaticamente.</p>
            <script>
              const urlParams = new URLSearchParams(window.location.search);
              const code = urlParams.get('code');
              const error = urlParams.get('error');
              
              if (window.opener) {
                if (code) {
                  window.opener.postMessage({ type: 'DROPBOX_AUTH_CODE', code }, '*');
                } else if (error) {
                  window.opener.postMessage({ type: 'DROPBOX_AUTH_ERROR', error }, '*');
                }
                window.close();
              } else {
                document.body.innerHTML = '<h2>Errore: Finestra principale non trovata.</h2>';
              }
            </script>
          </div>
        </body>
      </html>
    `);
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
