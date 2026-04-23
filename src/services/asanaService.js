const axios = require("axios");

const BASE_URL = "https://app.asana.com/api/1.0";

const headers = {
    Authorization: `Bearer ${process.env.ASANA_PAT}`,
};

// ⏱️ Axios timeout configuratsiyasi
const axiosInstance = axios.create({
    timeout: 10000,  // 10 sekund timeout
});

// -------------------------
// CACHE
// -------------------------
let cache = {
    projects: [],
    sections: [],
    tasksBySection: {},
};

let isReady = false;

// -------------------------
// PROGRESS STATE 🔥
// -------------------------
let progress = {
    total: 0,
    current: 0,
};

// -------------------------
function getProgressPercent() {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
}

// -------------------------
async function getProjectInfo(projectId) {
    const res = await axiosInstance.get(
        `${BASE_URL}/projects/${projectId}`,
        { headers }
    );

    return res.data.data;
}

// -------------------------
async function refreshData() {
    try {
        console.log("🚀 refreshData START at", new Date().toISOString());

        isReady = false;

        const projectIds = process.env.ASANA_PROJECT_IDS
            .split(",")
            .map(id => id.trim());

        console.log("📁 Projects to load:", projectIds.length);

        // ✅ progress step calculation
        progress.total = projectIds.length * 3; // project + sections + tasks
        progress.current = 0;

        cache.projects = [];
        cache.sections = [];
        cache.tasksBySection = {};

        for (const projectId of projectIds) {

            // =====================
            // PROJECT
            // =====================
            console.log(`📡 Fetching project ${projectId}...`);
            const project = await getProjectInfo(projectId);
            cache.projects.push(project);

            progress.current++; // 🔥 STEP UPDATE
            console.log(`✅ PROJECT: ${project.name} (${progress.current}/${progress.total})`);

            // =====================
            // SECTIONS
            // =====================
            console.log(`📡 Fetching sections for ${project.name}...`);
            const sectionsRes = await axiosInstance.get(
                `${BASE_URL}/projects/${projectId}/sections`,
                { headers }
            );

            const sections = sectionsRes.data.data;
            cache.sections.push(...sections);

            progress.current++; // 🔥 STEP UPDATE
            console.log(`✅ SECTIONS: ${sections.length} (${progress.current}/${progress.total})`);

            // =====================
            // TASKS
            // =====================
            console.log(`📡 Fetching tasks for ${project.name}...`);
            const tasksRes = await axiosInstance.get(`${BASE_URL}/tasks`, {
                headers,
                params: {
                    project: projectId,
                    opt_fields:
                        "gid,name,completed,assignee.name,completed_at,memberships.section,custom_fields.name,custom_fields.display_value"
                },
            });

            const tasksData = tasksRes.data.data;

            console.log(`✅ TASKS: ${tasksData.length} (${progress.current}/${progress.total})`);

            progress.current++; // 🔥 STEP UPDATE

            // =====================
            // PROCESS TASKS
            // =====================
            for (const task of tasksData) {

                const responsible =
                    task.custom_fields?.find(
                        (f) => f.name === "Responsible"
                    )?.display_value
                    || task.assignee?.name
                    || "Unassigned";

                if (!task.memberships || task.memberships.length === 0) continue;

                task.memberships.forEach((m) => {

                    const sectionId = m.section?.gid;
                    if (!sectionId) return;

                    if (!cache.tasksBySection[sectionId]) {
                        cache.tasksBySection[sectionId] = [];
                    }

                    // ❗ duplicate protection
                    const exists = cache.tasksBySection[sectionId].some(
                        t => t.gid === task.gid
                    );

                    if (!exists) {
                        cache.tasksBySection[sectionId].push({
                            ...task,
                            responsible,
                            project: {
                                id: project.gid,
                                name: project.name,
                            },
                        });
                    }
                });
            }
        }

        isReady = true;

        console.log("✅ REFRESH COMPLETE");

    } catch (err) {
        console.error("❌ REFRESH ERROR");
        console.error("Error message:", err.message);
        console.error("Error code:", err.code);
        console.error("Status:", err.response?.status);
        console.error("Data:", err.response?.data);
        console.error("Full error:", err);
        isReady = false;
    }
}

// -------------------------
function getSections() {
    return cache.sections;
}

function getTasks(sectionId) {
    return cache.tasksBySection[sectionId] || [];
}

function getProjects() {
    return cache.projects;
}

function isDataReady() {
    return isReady;
}

// -------------------------
module.exports = {
    refreshData,
    getSections,
    getTasks,
    getProjects,
    isDataReady,
    getProgressPercent, // 🔥 NEW EXPORT
};