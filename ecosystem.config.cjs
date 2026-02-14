module.exports = {
    apps: [
        {
            name: "web-print",
            script: "npm",
            args: "run dev",
            env: {
                NODE_ENV: "development",
            },
        },
    ],
};
