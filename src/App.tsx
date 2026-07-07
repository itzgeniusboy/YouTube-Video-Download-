import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Play, 
  Square, 
  RefreshCw, 
  Key, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Terminal, 
  Download, 
  BookOpen, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Server, 
  Eye, 
  EyeOff, 
  Compass, 
  FileText 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LogEntry {
  id: string;
  timestamp: string;
  source: "System" | "Bot" | "Downloader" | "BotError";
  message: string;
}

interface BotStatusResponse {
  status: "idle" | "running" | "error" | "stopped";
  error: string | null;
  botInfo: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  } | null;
  currentToken: string;
  logs: LogEntry[];
  ytDlpExists: boolean;
}

export default function App() {
  // State variables
  const [status, setStatus] = useState<"idle" | "running" | "error" | "stopped">("idle");
  const [botError, setBotError] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<BotStatusResponse["botInfo"]>(null);
  const [currentToken, setCurrentToken] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ytDlpExists, setYtDlpExists] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Form states
  const [tokenInput, setTokenInput] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);

  // Test download states
  const [testUrl, setTestUrl] = useState("");
  const [isTestingDownload, setIsTestingDownload] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Control/UI states
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "guides">("dashboard");
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [copiedBotPy, setCopiedBotPy] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch current bot status and logs
  const fetchStatus = async (silent = false) => {
    if (!silent) setIsLoadingStatus(true);
    try {
      const response = await fetch("/api/status");
      if (response.ok) {
        const data: BotStatusResponse = await response.json();
        setStatus(data.status);
        setBotError(data.error);
        setBotInfo(data.botInfo);
        setCurrentToken(data.currentToken);
        setLogs(data.logs);
        setYtDlpExists(data.ytDlpExists);
        if (!isEditingToken) {
          setTokenInput(data.currentToken);
        }
      }
    } catch (err) {
      console.error("Failed to fetch bot status:", err);
    } finally {
      if (!silent) setIsLoadingStatus(false);
    }
  };

  // Poll status when auto-refresh is active
  useEffect(() => {
    fetchStatus();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchStatus(true);
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isEditingToken]);

  // Restart bot handler
  const handleRestart = async () => {
    try {
      const response = await fetch("/api/restart", { method: "POST" });
      if (response.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error("Error restarting bot:", err);
    }
  };

  // Save new Token handler
  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsSavingToken(true);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentToken(data.currentToken);
        setStatus(data.status);
        setBotError(data.error);
        setBotInfo(data.botInfo);
        setIsEditingToken(false);
        fetchStatus();
      }
    } catch (err) {
      console.error("Error saving token:", err);
    } finally {
      setIsSavingToken(false);
    }
  };

  // Direct test downloader handler
  const handleTestDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) return;

    setIsTestingDownload(true);
    setTestResult(null);
    setTestError(null);

    try {
      const response = await fetch("/api/test-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl.trim() }),
      });

      const data = await response.json();
      if (response.ok) {
        setTestResult(data);
      } else {
        setTestError(data.error || "Failed to download video. Ensure size is under 1GB.");
      }
    } catch (err: any) {
      setTestError(err.message || "An unexpected server error occurred during test.");
    } finally {
      setIsTestingDownload(false);
    }
  };

  // Code snippets for copier
  const botPyCode = `import os
import sys
import time
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import yt_dlp

TOKEN = "${currentToken || 'YOUR_TELEGRAM_BOT_TOKEN'}"
START_TIME = time.time()
TIMEOUT = 5 * 60 * 60 + 50 * 60  # 5 Hours 50 Minutes

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🤖 Bot active hai GitHub Actions par! Mujhe YouTube link bhejiye.")

async def download_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if time.time() - START_TIME > TIMEOUT:
        await update.message.reply_text("🔄 Bot abhi restart ho raha hai, kripya 2-3 minute baad dobara try karein.")
        return

    url = update.message.text
    if not ("youtube.com" in url or "youtu.be" in url):
        await update.message.reply_text("❌ Kripya valid YouTube link bhejein.")
        return

    status_msg = await update.message.reply_text("⏳ Video download ho rahi hai...")
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': 'video.mp4',
        'max_filesize': 1024 * 1024 * 1024, # Up to 1GB (Note: Standard Telegram bots have a 50MB upload limit)
        'quiet': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        await status_msg.edit_text("🚀 Uploading to Telegram...")
        with open('video.mp4', 'rb') as video_file:
            await update.message.reply_video(video=video_file, caption="🎬 Aapki Video!")
        os.remove('video.mp4')
        await status_msg.delete()
    except Exception as e:
        error_msg = str(e)
        if "Request Entity Too Large" in error_msg or "too large" in error_msg.lower():
            await status_msg.edit_text("❌ Error: Video size 50MB se badi hai. Standard Telegram bots sirf 50MB tak hi upload support karte hain.")
        else:
            await status_msg.edit_text(f"❌ Error: Video process karne me dikkat aayi.\\nDetails: {error_msg[:100]}")
        if os.path.exists('video.mp4'): os.remove('video.mp4')

async def check_timer(application):
    while True:
        await asyncio.sleep(60)
        if time.time() - START_TIME > TIMEOUT:
            print("Time up! Stopping bot for automatic restart...")
            application.stop_running()
            break

def main():
    application = Application.builder().token(TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, download_video))
    
    loop = asyncio.get_event_loop()
    loop.create_task(check_timer(application))
    
    print("Bot started on GitHub Actions...")
    application.run_polling()

if __name__ == '__main__':
    main()`;

  const workflowYaml = `name: 24x7 YT Bot Loop

on:
  workflow_dispatch:
  repository_dispatch:
    types: [restart_bot]

jobs:
  run-bot:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install Dependencies
        run: |
          pip install python-telegram-bot==20.8 yt-dlp

      - name: Run Bot (Will run for 5h 50m)
        run: |
          python bot.py

      - name: Trigger Next Loop (Self Restart)
        if: always()
        run: |
          curl -X POST \\
               -H "Authorization: token \${{ secrets.GH_PAT }}" \\
               -H "Accept: application/vnd.github.v3+json" \\
               -d '{"event_type": "restart_bot"}' \\
               https://api.github.com/repos/\${{ github.repository }}/dispatches`;

  const copyToClipboard = (text: string, type: "workflow" | "botpy") => {
    navigator.clipboard.writeText(text);
    if (type === "workflow") {
      setCopiedWorkflow(true);
      setTimeout(() => setCopiedWorkflow(false), 2000);
    } else {
      setCopiedBotPy(true);
      setTimeout(() => setCopiedBotPy(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-100" id="main_container">
      {/* Upper Brand Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 py-4 px-6 shadow-xs" id="app_header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-600/10">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-sans font-bold tracking-tight text-xl text-slate-900">
                YouTube Downloader Telegram Bot
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live Telegram Integration & yt-dlp High Performance Downloader
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "dashboard"
                  ? "bg-indigo-50 text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              id="tab_dashboard_btn"
            >
              <Server className="w-4 h-4" />
              Bot Console
            </button>
            <button
              onClick={() => setActiveTab("guides")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "guides"
                  ? "bg-indigo-50 text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              id="tab_guides_btn"
            >
              <BookOpen className="w-4 h-4" />
              Guides & Loop Code
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Body Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8" id="main_body">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              id="dashboard_view"
            >
              {/* Left Column: Bot Settings & Control Panel */}
              <div className="lg:col-span-1 flex flex-col gap-6" id="dashboard_left">
                {/* Connection Status Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Service State
                    </span>
                    <button
                      onClick={() => fetchStatus()}
                      disabled={isLoadingStatus}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                      title="Force Refresh"
                      id="force_refresh_btn"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {status === "running" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900">Bot Active</span>
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                          </div>
                          <p className="text-xs text-slate-500">Listening to Telegram API</p>
                        </div>
                      </>
                    ) : status === "error" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-lg font-bold text-rose-700">Startup Failed</span>
                          <p className="text-xs text-slate-500">Check token configuration</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                          <XCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-lg font-bold text-slate-700">Bot Idle</span>
                          <p className="text-xs text-slate-500">Awaiting credentials</p>
                        </div>
                      </>
                    )}
                  </div>

                  {botInfo && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Bot Handle:</span>
                        <a
                          href={`https://t.me/${botInfo.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          @{botInfo.username}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Bot Name:</span>
                        <span className="font-bold text-slate-800">{botInfo.first_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Bot ID:</span>
                        <span className="font-mono text-slate-600">{botInfo.id}</span>
                      </div>
                    </div>
                  )}

                  {botError && (
                    <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-700 font-medium select-text break-words w-full">
                        {botError}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleRestart}
                      disabled={isLoadingStatus}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      id="bot_restart_btn"
                    >
                      <Play className="w-4 h-4" />
                      Force Restart
                    </button>
                  </div>
                </div>

                {/* Token Configuration Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Telegram Credentials
                    </span>
                    <button
                      onClick={() => setIsEditingToken(!isEditingToken)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                      id="edit_token_toggle_btn"
                    >
                      {isEditingToken ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {!isEditingToken ? (
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono text-sm tracking-wide text-slate-600">
                          {showToken ? currentToken : "••••••••••••••••••••••••••••••"}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowToken(!showToken)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveToken} className="flex flex-col gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="Paste Telegram Token here..."
                          className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          required
                          id="token_input_field"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingToken}
                        className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        id="save_token_btn"
                      >
                        {isSavingToken ? "Applying Token..." : "Save & Reconnect Bot"}
                      </button>
                    </form>
                  )}

                  <div className="text-xs text-slate-500 bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100/40 flex items-start gap-2">
                    <Compass className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">
                      This bot token runs locally inside this Cloud Run workspace. The download engine supports files up to <strong className="text-indigo-900">1GB</strong>. Note that standard Telegram bots have an upload limit of 50MB.
                    </p>
                  </div>
                </div>

                {/* Downloader System Status Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Downloader State
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">yt-dlp Engine:</span>
                    {ytDlpExists ? (
                      <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                        Binary Ready
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200 animate-pulse">
                        Downloading on first use...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Platform Limit:</span>
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      1.0 GB Max
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Columns: Direct Web Tester & Logs */}
              <div className="lg:col-span-2 flex flex-col gap-6" id="dashboard_right">
                {/* Direct Web Tester Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Download className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-bold text-base">Direct Web Downloader Test</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Test the backend `yt-dlp` downloader directly from the web panel! Paste a video URL to confirm the download engine compiles, downloads correctly, and respects size limits.
                  </p>

                  <form onSubmit={handleTestDownload} className="flex gap-2.5 mt-2">
                    <input
                      type="url"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="Paste YouTube link here (e.g. https://www.youtube.com/watch?v=...)"
                      className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      id="test_url_input"
                    />
                    <button
                      type="submit"
                      disabled={isTestingDownload}
                      className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shrink-0 disabled:opacity-50 flex items-center gap-2"
                      id="test_download_btn"
                    >
                      <Download className="w-4 h-4" />
                      {isTestingDownload ? "Downloading..." : "Test Downloader"}
                    </button>
                  </form>

                  <AnimatePresence mode="wait">
                    {isTestingDownload && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 flex items-center justify-center py-8"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                          <p className="text-xs text-slate-500 font-medium">
                            Downloading video and checking metadata... (Usually takes 5-15s)
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-50 rounded-xl p-4 border border-emerald-150 flex flex-col gap-3"
                      >
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Download Engine fully functional!
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-emerald-950/80 bg-white/50 p-3 rounded-lg border border-emerald-100/40 font-medium">
                          <div>
                            <span className="text-emerald-800">Title:</span> {testResult.title}
                          </div>
                          <div>
                            <span className="text-emerald-800">Uploader:</span> {testResult.uploader}
                          </div>
                          <div>
                            <span className="text-emerald-800">Duration:</span> {testResult.duration}s
                          </div>
                          <div>
                            <span className="text-emerald-800">Downloaded File Size:</span> {testResult.fileSizeMB} MB
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {testError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-rose-50 rounded-xl p-4 border border-rose-150 flex items-start gap-2.5"
                      >
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-rose-800 font-bold text-sm">Download Test Failed</div>
                          <p className="text-xs text-rose-700/95 font-medium mt-1 select-text">
                            {testError}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Live Output Console / Logs */}
                <div className="bg-slate-900 text-slate-100 border border-slate-950 rounded-2xl p-5 shadow-lg flex flex-col gap-3.5 flex-1 min-h-[400px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Live Bot Activity Logs
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          className="rounded-sm border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>Auto-Refresh (3s)</span>
                      </label>
                      <button
                        onClick={() => fetchStatus()}
                        disabled={isLoadingStatus}
                        className="text-slate-400 hover:text-white flex items-center gap-1 font-bold disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
                        Refresh Logs
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex-1 overflow-y-auto font-mono text-xs max-h-[350px] flex flex-col gap-2 min-h-[250px] scrollbar-thin scrollbar-thumb-slate-800 select-text">
                    {logs.length === 0 ? (
                      <div className="text-slate-600 py-12 text-center">
                        No activity recorded yet. Activate the bot to see output.
                      </div>
                    ) : (
                      logs.map((log) => {
                        let sourceColor = "text-slate-400";
                        if (log.source === "Bot") sourceColor = "text-emerald-400 font-semibold";
                        if (log.source === "Downloader") sourceColor = "text-purple-400 font-semibold";
                        if (log.source === "BotError") sourceColor = "text-rose-400 font-semibold";

                        return (
                          <div key={log.id} className="border-b border-slate-900/60 pb-1.5 last:border-0 hover:bg-slate-900/40 px-1 rounded-sm">
                            <span className="text-slate-600 mr-2">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`mr-2 [${sourceColor}]`}>
                              [{log.source}]
                            </span>
                            <span className="text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                              {log.message}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="guides"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              id="guides_view"
            >
              {/* Left Column: Telegram Setup Instructions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex items-center gap-2.5 text-slate-900">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-lg">Telegram Bot Create Kaise Karein</h2>
                </div>

                <div className="flex flex-col gap-4 text-sm text-slate-600 leading-relaxed">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-800">Open Telegram</strong>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Apne Telegram app par search kijiye <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">@BotFather</a> aur chat start karein.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-800">Create New Bot</strong>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Send command <code className="bg-slate-100 px-1 py-0.5 rounded-sm font-bold text-slate-800">/newbot</code>. BotFather aap se bot ka Display Name aur unique Username (jo "bot" par end ho) puchhega.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-800">Copy API Token</strong>
                      <p className="text-xs text-slate-500 mt-0.5">
                        BotFather aapko ek API Token provide karega (e.g. <code className="bg-slate-100 text-slate-700 font-mono text-xs">8915773...</code>). Uss token ko copy karein.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      4
                    </span>
                    <div>
                      <strong className="text-slate-800">Configure Dashboard</strong>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dashboard console tab par jaakar <strong className="text-slate-700">"Edit"</strong> button press karein, apna Token paste karein, aur <strong className="text-slate-700">"Save & Reconnect Bot"</strong> par click karein.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      5
                    </span>
                    <div>
                      <strong className="text-slate-800">Start Downloading!</strong>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Apne bot username par click karke chat start karein, aur koi bhi YouTube Video URL send kijiye. Bot automatic convert aur send kar dega!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: GitHub Actions 24/7 Loop Code */}
              <div className="flex flex-col gap-6">
                {/* python code file */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span className="font-bold text-sm font-mono">bot.py</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(botPyCode, "botpy")}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {copiedBotPy ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    GitHub Actions execution script with 5 hours 50 minutes auto-timer restart capability built in Python.
                  </p>
                  <pre className="bg-slate-900 text-slate-300 font-mono text-xs rounded-xl p-4 overflow-x-auto max-h-[180px] select-all">
                    {botPyCode}
                  </pre>
                </div>

                {/* github actions workflow yaml */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      <span className="font-bold text-sm font-mono">.github/workflows/loop.yml</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(workflowYaml, "workflow")}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {copiedWorkflow ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Workflow
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Schedules a continuous continuous loop trigger using GitHub Repository Dispatches and a Personal Access Token (`secrets.GH_PAT`).
                  </p>
                  <pre className="bg-slate-900 text-slate-300 font-mono text-xs rounded-xl p-4 overflow-x-auto max-h-[180px] select-all">
                    {workflowYaml}
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer System Info */}
      <footer className="border-t border-slate-200 bg-white/70 backdrop-blur-sm py-4 px-6 mt-auto text-center" id="app_footer_nav">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Workspace Server running on Node.js v22</span>
            <span>•</span>
            <span>HMR Safe Mode</span>
          </div>
          <div className="text-xs font-semibold text-slate-400">
            Dedicated Telegram Bot Environment • Port 3000 Ingress
          </div>
        </div>
      </footer>
    </div>
  );
}
