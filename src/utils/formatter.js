function groupByAssignee(tasks) {
    const result = {};

    tasks.forEach((task) => {
        const name = task.assignee?.name || "Unassigned";
        result[name] = (result[name] || 0) + 1;
    });

    return result;
}

function formatStats(name, count) {
    const date = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
    });

    return `${name} ->
tasks: ${count}
date: ${date}`;
}

module.exports = {
    groupByAssignee,
    formatStats,
};