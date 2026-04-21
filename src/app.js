require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const botController = require("./controllers/botController");
const { refreshData } = require("./services/asanaService");

const app = express();

// Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
});

// controllers attach
botController(bot);

// 🔄 real-time cache
setInterval(() => {
    refreshData();
}, 30000);

// initial load
refreshData();

app.get("/", (req, res) => {
    res.send("Bot is running...");
});

module.exports = app;