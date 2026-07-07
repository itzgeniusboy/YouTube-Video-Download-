import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import YTDlpWrap from "yt-dlp-wrap";
import { Telegraf } from "telegraf";

const app = express();
const PORT = 3000;

// Configuration persistence path
const CONFIG_PATH = path.join(process.cwd(), "bot-config.json");
const BIN_DIR = path.join(process.cwd(), "bin");
const YT_DLP_PATH = path.join(BIN_DIR, "yt-dlp");

// In-memory application state
interface LogEntry {
  id: string;
  timestamp: string;
  source: "System" | "Bot" | "Downloader" | "BotError";
  message: string;
}

let logs: LogEntry[] = [];
let bot: Telegraf | null = null;
let botStatus: "idle" | "running" | "error" | "stopped" = "idle";
let botError: string | null = null;
let botInfo: any = null;
let currentToken = "8915773306:AAGoZFbLmQSda42D9kMCj5q7OKCruseYgQQ"; // Default provided by user

// Add log helper
function addLog(source: LogEntry["source"], message: string) {
  const log: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    source,
    message,
  };
  logs.unshift(log);
  if (logs.length > 200) {
    logs.pop();
  }
  console.log(`[${source}] ${message}`);
}

// Ensure logs has startup entries
addLog("System", "Web server initialized. Preparing Telegram Bot backend...");

// Load persisted config if it exists
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (data.token) {
      currentToken = data.token;
      addLog("System", "Restored Telegram bot token from disk configuration.");
    }
  }
} catch (err: any) {
  addLog("System", `Failed to read bot-config.json: ${err.message}`);
}

// Ensure yt-dlp binary is present
let isDownloadingBin = false;

// Helper to resolve YTDlpWrap class for ESM / CommonJS bundler compatibility
function getYTDlp() {
  // @ts-ignore
  return YTDlpWrap.default || YTDlpWrap;
}

async function ensureYTDlp(): Promise<string> {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  if (!fs.existsSync(YT_DLP_PATH)) {
    if (isDownloadingBin) {
      throw new Error("yt-dlp binary is currently downloading. Please wait.");
    }
    isDownloadingBin = true;
    try {
      addLog("System", "yt-dlp binary not found. Initiating automated download from GitHub releases...");
      await getYTDlp().downloadFromGithub(YT_DLP_PATH);
      if (process.platform !== "win32") {
        fs.chmodSync(YT_DLP_PATH, "755");
      }
      addLog("System", "yt-dlp binary downloaded successfully and made executable.");
    } catch (err: any) {
      addLog("System", `Failed to download yt-dlp binary: ${err.message}`);
      throw err;
    } finally {
      isDownloadingBin = false;
    }
  }
  return YT_DLP_PATH;
}

// Telegram Bot lifecycle management
async function startTelegramBot(token: string) {
  try {
    if (bot) {
      await stopTelegramBot();
    }

    if (!token) {
      botStatus = "idle";
      addLog("Bot", "No Telegram bot token active. Waiting for token configuration.");
      return;
    }

    addLog("Bot", "Starting Telegram Bot server...");
    bot = new Telegraf(token);

    // Command: /start
    bot.start((ctx) => {
      const userStr = ctx.from.username ? `@${ctx.from.username}` : `User ${ctx.from.id}`;
      addLog("Bot", `Command /start triggered by ${userStr}`);
      ctx.reply("🤖 YouTube Video Downloader Bot active hai! Mujhe YouTube video link bhejiye.");
    });

    // Handle messages
    bot.on("text", async (ctx) => {
      const text = ctx.message.text || "";
      const userStr = ctx.from.username ? `@${ctx.from.username}` : `User ${ctx.from.id}`;

      if (text.startsWith("/")) return; // Skip commands

      if (!text.includes("youtube.com") && !text.includes("youtu.be")) {
        await ctx.reply("❌ Kripya valid YouTube link bhejein.");
        return;
      }

      addLog("Bot", `Received YouTube URL from ${userStr}: ${text}`);
      
      let statusMsg;
      try {
        statusMsg = await ctx.reply("⏳ Video download ho rahi hai...");
      } catch (err: any) {
        addLog("BotError", `Failed to send download status to Telegram: ${err.message}`);
        return;
      }

      const downloadsDir = path.join(process.cwd(), "downloads");
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const fileId = `${Date.now()}_video.mp4`;
      const outputPath = path.join(downloadsDir, fileId);

      try {
        const binPath = await ensureYTDlp();
        const ytDlp = new (getYTDlp())(binPath);

        addLog("Downloader", `Downloading URL: ${text}`);
        
        await ytDlp.execPromise([
          text,
          "-f", "best[ext=mp4]/best",
          "--max-filesize", "2048M",
          "--concurrent-fragments", "5",
          "--buffersize", "16K",
          "--extractor-args", "youtube:player-client=tvhtml5,web_embedded,ios,mweb",
          "--no-warnings",
          "-o", outputPath
        ]);

        if (!fs.existsSync(outputPath)) {
          throw new Error("Downloaded file not found. It may have exceeded the 2GB size limit.");
        }

        const stats = fs.statSync(outputPath);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > 2048) {
          fs.unlinkSync(outputPath);
          throw new Error(`Video size (${fileSizeMB.toFixed(1)}MB) exceeds the 2GB download limit.`);
        }

        addLog("Bot", `Uploading video file (${fileSizeMB.toFixed(1)}MB) to Telegram chat...`);
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            "🚀 Uploading to Telegram..."
          );
        } catch (e) {}

        await ctx.replyWithVideo(
          { source: outputPath },
          {
            caption: "🎬 Aapki Video!",
            reply_to_message_id: ctx.message.message_id,
          } as any
        );

        addLog("Bot", `Video successfully processed and sent to ${userStr}`);
        
        // Clean up
        fs.unlinkSync(outputPath);
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch (e) {}

      } catch (err: any) {
        addLog("BotError", `Bot processing error: ${err.message}`);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            `❌ Error: Video 50MB se badi ho sakti hai ya koi temporary issue hai.\n\nDetails: ${err.message}`
          );
        } catch (e) {}
      }
    });

    botStatus = "running";
    botError = null;

    botInfo = await bot.telegram.getMe();
    addLog("Bot", `Bot initialized successfully as @${botInfo.username}`);

    bot.launch().catch((err: any) => {
      botStatus = "error";
      botError = err.message;
      addLog("BotError", `Bot crash on polling: ${err.message}`);
    });

  } catch (err: any) {
    botStatus = "error";
    botError = err.message;
    addLog("BotError", `Failed to initialize Telegram Bot: ${err.message}`);
  }
}

async function stopTelegramBot() {
  if (bot) {
    addLog("Bot", "Shutting down active Telegram Bot connection...");
    try {
      await bot.stop();
    } catch (err: any) {
      console.error("Telegraf stop error:", err);
    }
    bot = null;
    botInfo = null;
    botStatus = "stopped";
  }
}

// Start the bot on service launch if token is provided
if (currentToken) {
  startTelegramBot(currentToken);
}

// JSON parsing middleware
app.use(express.json());

// API Endpoints
app.get("/api/status", async (req, res) => {
  res.json({
    status: botStatus,
    error: botError,
    botInfo,
    currentToken,
    logs,
    ytDlpExists: fs.existsSync(YT_DLP_PATH),
  });
});

app.post("/api/config", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  currentToken = token.trim();
  addLog("System", `Updating Telegram Bot Token to: ${currentToken.substring(0, 8)}...`);

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token: currentToken }), "utf-8");
  } catch (err: any) {
    addLog("System", `Failed to persist token to disk: ${err.message}`);
  }

  // Restart bot with new token
  await startTelegramBot(currentToken);

  res.json({
    status: botStatus,
    error: botError,
    botInfo,
    currentToken,
  });
});

app.post("/api/restart", async (req, res) => {
  addLog("System", "Manual bot restart triggered.");
  await startTelegramBot(currentToken);
  res.json({
    status: botStatus,
    error: botError,
    botInfo,
  });
});

// A test downloader route to download video directly on the server to verify it works!
app.post("/api/test-download", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  addLog("Downloader", `Direct Web Test Download initiated for URL: ${url}`);
  
  const downloadsDir = path.join(process.cwd(), "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const fileId = `${Date.now()}_test.mp4`;
  const outputPath = path.join(downloadsDir, fileId);

  try {
    const binPath = await ensureYTDlp();
    const ytDlp = new (getYTDlp())(binPath);

    // Fetch video info first
    addLog("Downloader", `Fetching video metadata for: ${url}`);
    let metadata: any = {};
    try {
      metadata = await ytDlp.getVideoInfo(url);
    } catch (e) {
      addLog("Downloader", "Could not fetch detailed metadata. Proceeding with download test directly.");
    }

    addLog("Downloader", `Downloading file content...`);
    await ytDlp.execPromise([
      url,
      "-f", "best[ext=mp4]/best",
      "--max-filesize", "2048M",
      "--concurrent-fragments", "5",
      "--buffersize", "16K",
      "--extractor-args", "youtube:player-client=tvhtml5,web_embedded,ios,mweb",
      "--no-warnings",
      "-o", outputPath
    ]);

    if (!fs.existsSync(outputPath)) {
      throw new Error("File not written. Video might be too large (>2GB).");
    }

    const stats = fs.statSync(outputPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    addLog("Downloader", `Direct Web Test Download completed: ${fileSizeMB.toFixed(2)}MB`);
    
    // Cleanup immediately
    fs.unlinkSync(outputPath);

    res.json({
      success: true,
      title: metadata.title || "YouTube Video",
      duration: metadata.duration || "Unknown",
      uploader: metadata.uploader || "Unknown",
      fileSizeMB: fileSizeMB.toFixed(2),
    });

  } catch (err: any) {
    addLog("Downloader", `Direct Web Test Download failed: ${err.message}`);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite development middleware or production static assets
async function startServer() {
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
    console.log(`Server running on port ${PORT}`);
    addLog("System", `Web dashboard ready on port ${PORT}`);
  });
}

startServer();
