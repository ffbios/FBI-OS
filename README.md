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

## FBI digital ecosystem

The ecosystem foundation work is isolated on the `ecosystem-foundation` branch. Start with:

- `docs/ECOSYSTEM_ARCHITECTURE.md` for system boundaries, data ownership and integration rules.
- `docs/ECOSYSTEM_INVENTORY.md` for the current repositories, domains and observed deployment evidence.
- `docs/ECOSYSTEM_ROADMAP.md` for phased implementation and release gates.
- `ecosystem/registry.json` for the public system directory used by Digital HQ.

The foundation branch adds a read-only registry endpoint, server-side Admin Hub authentication, role checks, protected service-health reporting, and tests. Invoice/file snapshot proxies remain disabled until their upstream contracts are implemented. See `docs/ADMIN_HUB_AUTH.md` for required Railway configuration. These changes do not affect production unless the branch is reviewed, merged and deployed.
