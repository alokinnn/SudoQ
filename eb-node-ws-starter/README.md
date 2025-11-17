# Elastic Beanstalk Node.js WebSocket Starter

This is a minimal, production-leaning WebSocket starter for AWS Elastic Beanstalk (Amazon Linux 2, Node.js platform).
It uses Express + `ws`, includes a `/health` endpoint, and ships Nginx config to support WebSockets.

## Run locally

```bash
npm install
npm start
# open http://localhost:8080
```

## Deploy to Elastic Beanstalk

1. Make sure you have EB CLI:
   ```bash
   pipx install awsebcli  # or: pip install awsebcli
   ```
2. Initialize (choose Node.js on Amazon Linux 2):
   ```bash
   eb init
   ```
3. Create an environment (recommend Application Load Balancer):
   ```bash
   eb create my-ws-env --elb-type application
   ```
4. Deploy:
   ```bash
   eb deploy
   ```

Once deployed, hit the environment URL in a browser and check the console for WebSocket messages.

### Notes

- The app listens on `process.env.PORT` (default 8080). EB will set `PORT` for you.
- The Nginx files in `.platform/nginx/conf.d` and `.platform/nginx/conf.d/elasticbeanstalk` ensure
  `Upgrade`/`Connection` headers and HTTP/1.1 are used, which are required for WebSockets.
- Health check is at `/health`. You can point the environment health check to `/health`.
- Consider increasing your ALB idle timeout (e.g., 120s+) to avoid closing idle WS connections.
- Set your own ping/pong intervals based on traffic patterns.
- Scaling: WebSockets are connection-oriented. Prefer ALB. For sticky-session requirements, consider
  keeping pure WebSocket (no long-poll fallbacks) or using a shared pub/sub (e.g., Redis) for fanout.