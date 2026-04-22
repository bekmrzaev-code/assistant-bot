const {
    getProjects,
    getTasks,
    getSections,
    isDataReady,
    getProgressPercent, // 🔥 NEW
} = require("../services/asanaService");

const {
    groupByResponsibles,
} = require("../utils/formatter");

const session = {};

// =========================
// MAIN
// =========================
module.exports = (bot) => {

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;

        // =========================
        // LOADING (REAL PROGRESS)
        // =========================
        if (!isDataReady()) {

            const loadingMsg = await bot.sendMessage(
                chatId,
                "⏳ Server yuklanmoqda...\n\n⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%"
            );

            const interval = setInterval(async () => {

                const percent = getProgressPercent();
                const bar = buildProgress(percent);

                try {
                    await bot.editMessageText(
                        `⏳ Server yuklanmoqda...\n\n${bar} ${percent}%`,
                        {
                            chat_id: chatId,
                            message_id: loadingMsg.message_id,
                        }
                    );
                } catch (e) { }

                // ✅ READY BO'LGANDA STOP + UI
                if (isDataReady()) {
                    clearInterval(interval);

                    await bot.editMessageText(
                        `✅ Yuklandi!\n\n${buildProgress(100)} 100%`,
                        {
                            chat_id: chatId,
                            message_id: loadingMsg.message_id,
                        }
                    );

                    const message = await showProjects(bot, chatId);

                    session[chatId] = {
                        messageId: message.message_id,
                        stack: ["projects"],
                        view: "projects",
                    };
                }

            }, 500);

            return;
        }

        // =========================
        // READY DIRECT LOAD
        // =========================
        const message = await showProjects(bot, chatId);

        session[chatId] = {
            messageId: message.message_id,
            stack: ["projects"],
            view: "projects",
        };
    });

    // =========================
    // ROUTER
    // =========================
    bot.on("callback_query", async (query) => {

        const chatId = query.message.chat.id;
        const data = query.data;
        const messageId = query.message.message_id;

        const state = session[chatId];
        if (!state) return;

        try {

            // =====================
            // BACK
            // =====================
            if (data === "back") {

                state.stack.pop();
                const prev = state.stack[state.stack.length - 1];

                state.view = prev;

                if (prev === "projects") {
                    return showProjects(bot, chatId, messageId, true);
                }

                if (prev === "responsibles") {
                    return renderResponsibles(bot, chatId, state, messageId);
                }

                return;
            }

            // =====================
            // PROJECT CLICK
            // =====================
            if (data.startsWith("project_")) {

                const projectId = data.split("_")[1];

                const allTasks = getAllTasksByProject(projectId);
                const grouped = groupByResponsibles(allTasks);

                const projects = getProjects();
                const project = projects.find(p => p.gid === projectId);

                const total = allTasks.length;
                const done = allTasks.filter(t => t.completed).length;
                const percent = total ? Math.round((done / total) * 100) : 0;

                const text =
                    `📁 DASHBOARD

🏷 Name: ${project?.name}

━━━━━━━━━━━━━━
📊 Total: ${total}
✅ Done: ${done}
📈 Progress: ${percent}%

👤 Responsibles: ${Object.keys(grouped).length}

━━━━━━━━━━━━━━
📅 Updated: ${new Date().toLocaleString()}`;

                state.project = project;
                state.grouped = grouped;
                state.allTasks = allTasks;

                state.view = "responsibles";
                state.stack = ["projects", "responsibles"];

                return bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: buildResponsiblesKeyboard(grouped),
                    },
                });
            }

            // =====================
            // USER CLICK
            // =====================
            if (data.startsWith("user_")) {

                const name = decodeURIComponent(data.replace("user_", ""));

                state.view = "tasks";
                state.stack.push("tasks");

                const tasks = state.grouped[name] || [];

                const done = tasks.filter(t => t.completed).length;
                const total = tasks.length;
                const pending = total - done;
                const percent = total ? Math.round((done / total) * 100) : 0;

                const text =
                    `👤 RESPONSIBLE REPORT

Name: ${name}

━━━━━━━━━━━━━━
📌 Tasks: ${total}
✅ Done: ${done}
⏳ Pending: ${pending}
📈 Progress: ${percent}%

📁 Working On: ${state.project?.name}

━━━━━━━━━━━━━━
📅 Date: ${new Date().toLocaleString()}`;

                return bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "⬅️ Back", callback_data: "back" }]
                        ],
                    },
                });
            }

        } catch (err) {
            console.error("❌ BOT ERROR:", err);
        }
    });
};

// =========================
// PROJECTS UI
// =========================
async function showProjects(bot, chatId, messageId = null, edit = false) {

    const projects = getProjects();

    const text =
        `🏠 DASHBOARD

📊 Total Boards: ${projects.length}

👇 Select Board`;

    const keyboard = projects.map(p => [
        {
            text: `📁 ${p.name}`,
            callback_data: `project_${p.gid}`,
        },
    ]);

    if (edit && messageId) {
        return bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    return bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard },
    });
}

// =========================
// RESPONSIBLES UI
// =========================
function renderResponsibles(bot, chatId, state, messageId) {

    const text =
        `📊 RESPONSIBLES

Name: ${state.project?.name}

Select user`;

    return bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
            inline_keyboard: buildResponsiblesKeyboard(state.grouped),
        },
    });
}

// =========================
// KEYBOARD BUILDER
// =========================
function buildResponsiblesKeyboard(grouped) {

    return Object.entries(grouped)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name, tasks]) => [
            {
                text: `👤 ${name} (${tasks.length})`,
                callback_data: `user_${encodeURIComponent(name)}`,
            },
        ])
        .concat([
            [{ text: "⬅️ Back", callback_data: "back" }]
        ]);
}

// =========================
// HELPERS
// =========================
function getAllTasksByProject(projectId) {

    const sections = getSections();
    let tasks = [];

    for (const section of sections) {

        const sectionTasks = getTasks(section.gid);

        const filtered = sectionTasks.filter(
            t => t.project?.id === projectId
        );

        tasks = tasks.concat(filtered);
    }

    return tasks;
}

// =========================
// PROGRESS BAR
// =========================
function buildProgress(percent) {
    const total = 10;
    const filled = Math.round((percent / 100) * total);
    const empty = total - filled;

    return "🟩".repeat(filled) + "⬜".repeat(empty);
}