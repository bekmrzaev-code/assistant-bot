require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const botController = require("./controllers/botController");
const { refreshData, isDataReady } = require("./services/asanaService");

const app = express();
app.use(express.json());

// 🔐 ENV VALIDATION
if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
}

if (!process.env.BASE_URL) {
    throw new Error("❌ BASE_URL is missing in .env");
}

if (!process.env.ASANA_PAT) {
    throw new Error("❌ ASANA_PAT is missing in .env");
}

if (!process.env.ASANA_PROJECT_IDS) {
    throw new Error("❌ ASANA_PROJECT_IDS is missing in .env");
}

// 🤖 BOT INIT
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true  // 🟢 LOCAL DEV-DA POLLING
});

// Controller ulash
botController(bot);

// 🔥 WEBHOOK ENDPOINT (polling rejimida ishlatilmaydi)
// app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
//     try {
//         const updateType = req.body?.message?.text || req.body?.callback_query?.data || "unknown";
//         console.log("\n📨 [WEBHOOK] Update received at", new Date().toISOString());
//         console.log("📨 [WEBHOOK] Type:", updateType);
//         console.log("📨 [WEBHOOK] Full body:", JSON.stringify(req.body, null, 2));
//         
//         bot.processUpdate(req.body);
//         res.sendStatus(200);
//     } catch (error) {
//         console.error("❌ [WEBHOOK] Error processing update:", error.message);
//         console.error("❌ [WEBHOOK] Stack:", error.stack);
//         res.sendStatus(500);
//     }
// });

// 🔥 INIT FUNCTION
(async () => {
    try {
        console.log("⏳ Loading data...");
        await refreshData();
        console.log("✅ Data ready");

        // Telegram webhook-ni old instances uchun delete qilamiz
        try {
            console.log("🔄 Clearing old webhooks from Telegram...");
            await bot.deleteWebHook();
            console.log("✅ Old webhooks cleared");
        } catch (error) {
            console.warn("⚠️ Webhook cleanup warning:", error.message);
        }

        console.log("🤖 Bot polling rejimida ishlayapti - webhook o'chirilgan");
    } catch (error) {
        console.error("❌ INIT ERROR:", error.message);
    }
})();

// 🔄 AUTO REFRESH
setInterval(async () => {
    try {
        await refreshData();
        console.log("🔄 Data refreshed");
    } catch (error) {
        console.error("❌ Refresh error:", error.message);
    }
}, 30000);

// 🧪 HEALTH CHECK
app.get("/", (req, res) => {
    const status = {
        status: "🤖 Bot is running",
        webhook: `${process.env.BASE_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        dataReady: isDataReady(),
        timestamp: new Date().toISOString()
    };
    console.log("✅ [HEALTH CHECK] GET /", status);
    res.json(status);
});

module.exports = app;