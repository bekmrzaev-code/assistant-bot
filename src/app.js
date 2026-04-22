require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const botController = require("./controllers/botController");
const { refreshData } = require("./services/asanaService");

const app = express();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
});

botController(bot);

// 🔥 INITIAL LOAD (MUHIM)
(async () => {
    console.log("⏳ Loading data...");
    await refreshData();
    console.log("✅ Data ready");
})();

// 🔄 AUTO REFRESH
setInterval(() => {
    refreshData();
}, 30000);

app.get("/", (req, res) => {
    res.send("Bot is running...");
});

module.exports = app;