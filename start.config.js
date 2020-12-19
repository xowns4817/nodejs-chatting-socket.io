module.exports = {
    apps : [
        {
          name: "chattingServer",
          script: "./server.js",
          watch: true,
          out_file: "/dev/null",
          error_file: "/dev/null",
          env: {
              "PORT": 3000,
              "NODE_ENV": "development"
          },
          env_production: {
            "NODE_ENV": "production"
          }
        }
    ]
  }