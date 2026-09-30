# FBI GH Website

Corporate website for FBI GH / FutureBridge Intelligence.

## Platform architecture

- GitHub: source control
- Railway: cloud hosting
- Future business domain: main website
- Future subdomains:
  - invoice.<domain> -> FBI Invoice Studio
  - files.<domain> -> FBI Client File Studio
  - it.<domain> -> FBI IT Command Center

The current Hercules site remains the reference source until its content and media assets are exported and imported.

## Run locally

```bash
npm start
```

Health endpoint: `/health`
