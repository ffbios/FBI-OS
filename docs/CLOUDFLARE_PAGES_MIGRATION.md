# FBI GH public website: Cloudflare Pages migration

**Status:** Preparation only. Production DNS and Railway services have not been changed.
**Repository:** `ffbios/FBI-OS`
**Prepared branch:** `cloudflare-pages-migration`
**Static output directory:** `public/`

## Objective

Serve the public, static company website through Cloudflare Pages so ordinary HTML, CSS, JavaScript, and repository-hosted assets do not need to be served by the Railway website process.

This is a staged hosting migration, not a backend rewrite. The public pages are static HTML. However, the Admin Hub, health endpoint, media-bucket routes, and media-upload endpoint are still implemented by the Railway `fbi-gh-website` service. The website's current slideshow assets also include URLs on the Railway service domain.

## What this branch adds

- `public/_headers`: conservative security headers and revalidation/cache headers for static content.
- `public/_redirects`: sends `/admin`, `/admin/*`, and `/health` to the existing Railway service domain.
- This migration guide.

The legacy GitHub Pages workflow is removed from the branch because it published a `CNAME` for `fbigh.com`. Cloudflare Pages must be the single intended static publisher once cutover is approved. A pull request is provided for review; the branch does not change production by itself.

## Cloudflare Pages preview setup

Create a Pages project from this repository and select this branch for the first preview:

- **Production branch:** leave as `main` until review and cutover are approved.
- **Framework preset:** None.
- **Build command:** leave blank.
- **Build output directory:** `public`.
- **Root directory:** repository root (do not set `public` as root and output `public` again).
- **Environment variables:** none required for the static public pages.

Cloudflare Pages should publish the files inside `public/`. The `_redirects` and `_headers` files must be present in that output directory.

## Required preview tests before production cutover

Test the Cloudflare-generated preview URL first:

1. Load `/`, `/about.html`, `/services.html`, `/portfolio.html`, `/technology.html`, `/contact.html`, `/live.html`, `/team.html`, `/insights.html`, `/connect.html`, `/book-project.html`, and `/guess-who.html`.
2. Check desktop and mobile layouts, navigation, CSS, JavaScript, logos, and local images.
3. Submit the project enquiry form and confirm it opens WhatsApp with the expected prefilled message. Do not send a live enquiry just to test it.
4. Check the portfolio filters and any image/video features that load assets from `fbi-gh-website-production.up.railway.app`.
5. Open `/admin` and confirm it redirects to `https://fbi-gh-website-production.up.railway.app/admin/`. Confirm login and protected API requests still work on that Railway origin.
6. Open `/health` and confirm the redirect reaches the Railway health endpoint.
7. Check browser console/network errors and inspect canonical URLs, sitemap, and robots.txt.
8. Confirm no database writes, invoice operations, media-upload operations, or administrative APIs are being served by the static Pages deployment.

## Production cutover

Do not change DNS until every preview test passes and Cloudflare Pages confirms the project is ready for the custom domains.

1. Add `fbigh.com` and `www.fbigh.com` as custom domains in the Cloudflare Pages project.
2. Follow the Pages custom-domain wizard and review existing DNS records before replacing them. Railway currently reports the root domain routed to `s64hxp9a.up.railway.app`; `www` has also been configured for Railway and should be reviewed during cutover. Do not copy this record blindly: use the exact values Cloudflare Pages shows for the project.
3. Keep the Railway `fbi-gh-website` service online during and after cutover. It remains the backend for Admin Hub authentication/APIs and the media-bucket routes.
4. Check both domains over HTTPS, then retest Admin Hub, health, and media URLs.
5. Keep the Railway service and its storage credentials until the new front end is proven stable and a rollback window has passed. Rollback is to restore the previous Railway DNS target if necessary.

## What this does and does not save

Cloudflare Pages states that static asset requests are free and unlimited on its Free and paid plans. Hosting the frontend this way should reduce Railway's responsibility for delivering the static site.

It does **not** remove the need for the Railway backend while it still serves `/admin`, `/health`, `/media/*`, and `/api/media-upload/*`. Some slideshow media URLs also deliberately point to the Railway service domain. This migration alone is therefore not expected to eliminate all website-related Railway cost.

Do not migrate original client uploads or the media bucket into GitHub. Git is for source code, not production databases, credentials, invoices, or bulk video storage. The next cost phase should investigate Cloudflare R2 or another object store for appropriate media and a consolidated, properly backed-up host for small Node.js/database workloads. Live ingest and playout need their own capacity test before moving.

## Rollback

- Keep Railway deployment and domain configuration available during the change window.
- If the public site, assets, forms, or redirects fail, restore the old DNS routing to Railway and retest the original site.
- Do not remove buckets, databases, environment variables, or Railway services as part of this phase.

## References

- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages static asset pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages redirects: https://developers.cloudflare.com/pages/configuration/redirects/
- Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
