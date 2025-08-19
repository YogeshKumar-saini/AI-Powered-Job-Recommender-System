Ah! Your `docker-compose.yml` currently maps container port **80** to host port **80**:

```yaml
ports:
  - "80:80"
```

But you said your host port is **8000**. You should change it to:

```yaml
ports:
  - "8000:80"
```

Here, `8000` is the host port (what you’ll use in the browser), and `80` is the container port your app listens on.

So the updated `docker-compose.yml` would be:

```yaml
version: '3'
services:
  app:
    image: yogesh1090/ai-powered-job-recommender:latest
    env_file:
      - .env
    ports:
      - "8000:80"
```

After that, run:

```bash
docker-compose up -d
```

Then access your app at: `http://localhost:8000` ✅

Do you want me to explain why the first number is host and the second is container?
