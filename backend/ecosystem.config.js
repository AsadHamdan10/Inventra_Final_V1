// PM2 process-manager config for the Inventra backend on the VPS.
//
// Usage on the VPS (after `npm ci --omit=dev` and `npm run build` in backend/):
//   npm install -g pm2                    (one-time, on the VPS)
//   cd backend
//   pm2 start ecosystem.config.js --env production
//   pm2 save                              (persist the process list)
//   pm2 startup                           (prints a command to run once, so PM2
//                                          + this app auto-start on server reboot)
//
// Common ops:
//   pm2 logs inventra-backend             (tail logs)
//   pm2 restart inventra-backend          (after deploying new code)
//   pm2 monit                             (live CPU/memory dashboard)
//
// This file expects to live at backend/ecosystem.config.js (same folder as
// package.json), so relative paths below resolve correctly.

module.exports = {
  apps: [
    {
      name: 'inventra-backend',
      script: 'dist/index.js',
      cwd: __dirname,

      // Single instance by default. Node apps that hold in-memory state
      // (rate limiter buckets, etc.) should NOT be scaled with PM2 cluster
      // mode unless that state is moved to Redis/shared storage first —
      // flagging this rather than silently enabling cluster mode.
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart on crash, but don't loop forever on a fatal boot error
      // (e.g. bad DATABASE_URL) — cap restarts within a short window.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,

      // Restart if memory grows unbounded (safety net against a leak),
      // adjust to your VPS's actual RAM.
      max_memory_restart: '500M',

      // PM2 loads env vars from its own config, but this app also reads a
      // real .env file via dotenv at startup — make sure backend/.env exists
      // on the VPS with production values before starting this.
      env_production: {
        NODE_ENV: 'production',
      },

      // Logs — PM2's default log location works, but pinning paths makes
      // log rotation / shipping easier to set up later.
      output: './logs/pm2-out.log',
      error: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
