/**
 * PM2 Ecosystem — SmartForest production
 * Usage: pm2 start ecosystem.config.js
 * Ensure .env and web/.env have FRONTEND_API_URL, NEXT_PUBLIC_API_URL (http://SERVER_IP:9000)
 */
module.exports = {
  apps: [
    {
      name: 'smart-forest-backend',
      cwd: __dirname,
      script: 'node',
      args: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env',
    },
    {
      name: 'smart-forest-frontend',
      cwd: __dirname + '/web',
      script: 'node',
      args: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 9002,
        HOST: '0.0.0.0',
      },
      env_file: '.env',
    },
  ],
};
