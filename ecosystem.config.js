/** PM2: pm2 start ecosystem.config.js */
module.exports = {
  apps: [
    {
      name: "my-first-web",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
