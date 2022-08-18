module.exports = {
  apps: [{
    name: "DicomWeb-Websocket-Bridge",
    script: "./build/src/app.js",
    instances: 2,
    log_date_format: "YYYY-MM-DDTHH:mm:ssZ",
    wait_ready: true,
    exec_mode: "cluster",
    env_development: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }],

  deploy: {
    dev: {
      user: "root",
      host: "dev-pacs.vpop-pro.com",
      ref: "origin/main",
      repo: "git@github.com-bridge:wearemothership/dicomweb-websocket-bridge.git",
      path: "/root/dev/dicomweb-websocket-bridge",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production --update-env"
    },
    production: {
      user: "root",
      host: "pacs.vpop-pro.com",
      ref: "origin/main",
      repo: "git@github.com-bridge:wearemothership/dicomweb-websocket-bridge.git",
      path: "/root/dev/dicomweb-websocket-bridge",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production --update-env"
    }
  }
};
