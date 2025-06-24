# Sakura

A decentralized media manager using [Nostr](https://nostr.com/) for authentication and [Blossom](https://github.com/hzrd149/blossom) for file storage.

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

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The webapp will be available on port 3000. Configure your reverse proxy to forward requests to `localhost:3000`.

## License

[MIT License](https://opensource.org/licenses/MIT) - Use at your own risk. No warranties or guarantees provided.
