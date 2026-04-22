function groupByResponsibles(tasks) {
    const result = {};

    tasks.forEach((task) => {

        // if (!task.completed) return;

        const name = task.responsible || "Unassigned";

        if (!result[name]) {
            result[name] = [];
        }

        result[name].push(task);
    });

    return result;
}

// =========================
// FINAL REPORT (NEW)
// =========================
function formatStats(name, tasks) {

    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const pending = total - done;

    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const date = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    return `
📊 RESPONSIBLE REPORT

👤 Name: ${name}

━━━━━━━━━━━━━━
📌 Tasks: ${total}
✅ Done: ${done}
⏳ Pending: ${pending}
📈 Progress: ${percent}%

━━━━━━━━━━━━━━
📅 Date: ${date}

💡 Status: ${percent >= 80 ? "🔥 Excellent" :
            percent >= 50 ? "⚡ Good" :
                "⚠️ Needs attention"
        }
`;
}
module.exports = {
    groupByResponsibles,
    formatStats,
};