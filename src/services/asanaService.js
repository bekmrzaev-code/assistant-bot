const axios = require("axios");

// ⚠️ FIX: /1/ emas, to‘g‘ri base URL
const BASE_URL = "https://app.asana.com/api/1.0";

const headers = {
    Authorization: `Bearer ${process.env.ASANA_PAT}`,
};

// in-memory cache
let cache = {
    sections: [],
    tasksBySection: {},
};

const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
};

// 🔥 MAIN REFRESH FUNCTION
async function refreshData() {
    try {
        const projectIds = process.env.ASANA_PROJECT_IDS.split(",");

        cache.sections = [];
        cache.tasksBySection = {};

        for (const projectId of projectIds) {
            // -------------------------
            // 1. GET SECTIONS
            // -------------------------
            const sectionsRes = await axios.get(
                `${BASE_URL}/projects/${projectId}/sections`,
                { headers }
            );

            const sections = sectionsRes.data.data;
            cache.sections.push(...sections);

            // -------------------------
            // 2. GET TASKS (WORKING WAY)
            // -------------------------
            const tasksRes = await axios.get(`${BASE_URL}/tasks`, {
                headers,
                params: {
                    project: projectId,
                    opt_fields:
                        "name,completed,assignee.name,completed_at,memberships.section",
                },
            });

            const today = todayStart();

            const tasks = tasksRes.data.data.filter((t) => {
                return (
                    t.completed &&
                    t.completed_at &&
                    t.completed_at >= today
                );
            });

            // -------------------------
            // 3. GROUP BY SECTION
            // -------------------------
            for (const task of tasks) {
                const sectionId =
                    task.memberships?.[0]?.section?.gid;

                if (!sectionId) continue;

                if (!cache.tasksBySection[sectionId]) {
                    cache.tasksBySection[sectionId] = [];
                }

                cache.tasksBySection[sectionId].push(task);
            }
        }

        console.log("✅ Asana refresh success");
    } catch (err) {
        console.error(
            "❌ Refresh error:",
            err.response?.status,
            err.response?.data || err.message
        );
    }
}

// -------------------------
// GETTERS
// -------------------------
function getSections() {
    return cache.sections;
}

function getTasks(sectionId) {
    return cache.tasksBySection[sectionId] || [];
}

module.exports = {
    refreshData,
    getSections,
    getTasks,
};