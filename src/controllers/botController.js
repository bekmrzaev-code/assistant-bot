const {
    getSections,
    getTasks,
} = require("../services/asanaService");

const {
    groupByAssignee,
    formatStats,
} = require("../utils/formatter");

module.exports = (bot) => {
    // /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;

        const sections = getSections();

        if (!sections.length) {
            return bot.sendMessage(chatId, "Data hali yuklanmagan...");
        }

        const keyboard = sections.map((s) => [
            {
                text: s.name,
                callback_data: `section_${s.gid}`,
            },
        ]);

        bot.sendMessage(
            chatId,
            "Bugungi updatelarni ko'rishingiz mumkin",
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        );
    });

    // callback handler
    bot.on("callback_query", (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        // SECTION
        if (data.startsWith("section_")) {
            const sectionId = data.split("_")[1];

            const tasks = getTasks(sectionId);

            if (!tasks.length) {
                return bot.sendMessage(chatId, "Bugun task yo'q");
            }

            const grouped = groupByAssignee(tasks);

            const keyboard = Object.entries(grouped)
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => [
                    {
                        text: name,
                        callback_data: `user_${name}`,
                    },
                ]);

            bot.session = bot.session || {};
            bot.session[chatId] = grouped;

            bot.sendMessage(chatId, "Responsible tanlang:", {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            });
        }

        // USER
        if (data.startsWith("user_")) {
            const name = data.replace("user_", "");
            const stats = bot.session?.[chatId];

            if (!stats || !stats[name]) {
                return bot.sendMessage(chatId, "Topilmadi");
            }

            bot.sendMessage(
                chatId,
                formatStats(name, stats[name])
            );
        }
    });
};