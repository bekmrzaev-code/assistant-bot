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

module.exports = (bot) => {

    console.log("🤖 [botController] Initializing bot handlers...");

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        
        console.log("\n🟢 [START] /start command received from", chatId);
        console.log("🟢 [START] Message object:", JSON.stringify(msg, null, 2).substring(0, 200));

        try {
            // =========================
            // LOADING (REAL PROGRESS)
            // =========================
            if (!isDataReady()) {

                console.log("🟡 [START] Data not ready, showing loading...");

                const loadingMsg = await bot.sendMessage(
                    chatId,
                    "⏳ Server yuklanmoqda...\n\n⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%"
                );
                
                console.log("✅ [START] Loading message sent");

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
                    } catch (e) { 
                        console.log("📊 [START] Progress update error (normal):", e.message);
                    }

                    // ✅ READY BO'LGANDA STOP + UI
                    if (isDataReady()) {
                        clearInterval(interval);
                        
                        console.log("✅ [START] Data is ready!");

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
            console.log("🟢 [START] Data ready, showing projects directly");
            const message = await showProjects(bot, chatId);

            session[chatId] = {
                messageId: message.message_id,
                stack: ["projects"],
                view: "projects",
            };
        } catch (error) {
            console.error("❌ [START] ERROR:", error.message);
            console.error("❌ [START] Stack:", error.stack);
            try {
                await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko'ring.");
            } catch (sendError) {
                console.error("❌ [START] Could not send error message:", sendError.message);
            }
        }
    });

    // =========================
    // ROUTER
    // =========================
    bot.on("callback_query", async (query) => {

        const chatId = query.message.chat.id;
        const data = query.data;
        const messageId = query.message.message_id;

        console.log("\n🔘 [CALLBACK] Received from", chatId, "data:", data);

        const state = session[chatId];
        if (!state) {
            console.warn("⚠️ [CALLBACK] No session found for chatId:", chatId);
            return;
        }

        try {

            console.log("🔘 [CALLBACK] Current view:", state.view, "Stack:", state.stack);

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

    try {
        console.log("\n📊 [showProjects] Starting, chatId:", chatId);
        
        const projects = getProjects();
        console.log("📊 [showProjects] Projects count:", projects.length);

        if (projects.length === 0) {
            console.warn("⚠️ [showProjects] No projects found!");
        }

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

        console.log("📊 [showProjects] Sending message to", chatId);

        if (edit && messageId) {
            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: keyboard },
            });
        }

        const result = await bot.sendMessage(chatId, text, {
            reply_markup: { inline_keyboard: keyboard },
        });
        
        console.log("✅ [showProjects] Message sent successfully, message_id:", result.message_id);
        return result;
    } catch (error) {
        console.error("❌ [showProjects] Error:", error.message);
        console.error("❌ [showProjects] Stack:", error.stack);
        throw error;
    }
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