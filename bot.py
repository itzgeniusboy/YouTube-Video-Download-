import os
import sys
import time
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import yt_dlp

# Bot token from environment variable or hardcoded fallback
TOKEN = os.environ.get("TELEGRAM_TOKEN", "8915773306:AAGoZFbLmQSda42D9kMCj5q7OKCruseYgQQ")

START_TIME = time.time()
TIMEOUT = 5 * 60 * 60 + 50 * 60  # 5 Hours 50 Minutes (Keeps 10 min buffer before GitHub Actions 6h timeout)

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
        'max_filesize': 1024 * 1024 * 1024, # Up to 1GB
        'quiet': True,
        'no_warnings': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'tvhtml5']
            }
        }
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
            await status_msg.edit_text(f"❌ Error: Video process karne me dikkat aayi.\nDetails: {error_msg[:100]}")
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
    main()
