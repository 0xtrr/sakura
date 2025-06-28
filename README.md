# Sakura

A decentralized media manager using [Nostr](https://github.com/nostr-protocol/nostr) for authentication and [Blossom](https://github.com/hzrd149/blossom) for file storage.

## Features

- Authenticate with Nostr browser extensions or private keys
- Upload files to multiple Blossom servers with redundancy
- Automatic EXIF removal for image privacy
- Modern React 19 + TypeScript interface

## Development

```bash
npm install
npm run dev
```

## Docker Deployment

### Using Published Images

```bash
# Pull and run the latest image from GitHub Container Registry
docker pull ghcr.io/0xtrr/sakura:main
docker run -p 3000:3000 ghcr.io/0xtrr/sakura:main

# Or use a specific version tag
docker pull ghcr.io/0xtrr/sakura:v1.0.0
docker run -p 3000:3000 ghcr.io/0xtrr/sakura:v1.0.0
```

### Using Docker Compose

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The webapp will be available on port 3000. Configure your reverse proxy to forward requests to `localhost:3000`.

### Publishing Docker Images

Docker images are automatically built and published to GitHub Container Registry using GitHub Actions. To publish a new image:

1. Go to the **Actions** tab in the GitHub repository
2. Select **"Build and Publish Docker Image"** workflow
3. Click **"Run workflow"** 
4. Configure the image tag:
   - **Default**: `main` (builds from main branch)
   - **Version tags**: `v1.0.0`, `v2.1.3`, etc. (for releases)
   - **Additional tags**: Comma-separated list of extra tags (optional)

Available image tags:
- `ghcr.io/0xtrr/sakura:main` - Latest build from main branch
- `ghcr.io/0xtrr/sakura:latest` - Same as main (auto-tagged)
- `ghcr.io/0xtrr/sakura:v1.0.0` - Specific version releases
- `ghcr.io/0xtrr/sakura:main-<commit-sha>` - Branch + commit SHA

## License

[MIT License](https://opensource.org/licenses/MIT) - Use at your own risk. No warranties or guarantees provided.
