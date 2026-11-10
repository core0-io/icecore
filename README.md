# Icecore

Browser client for querying an Iceberg destination through the ffwd catalog. It uses the
[core0-io/icebird](https://github.com/core0-io/icebird) fork, which reads catalogs that sign storage requests
(Sakura Storage and other destinations without STS).

- **Destination** tab: catalog URI, warehouse, token server and agent key, as shown in the portal's "Other" tab.
  The client secret is kept in memory only.
- **Query** tab: free-form SQL (`SELECT … FROM "namespace.table"`), results capped at 1000 rows.

```
npm install
npm run dev
```

The bucket must allow cross-origin `GET`/`HEAD` with `Range`, `Authorization` and `x-amz-*` request headers
from wherever this app is served.

## Publishing

Pushes to `master` deploy to GitHub Pages (`.github/workflows/pages.yml`) once Pages is enabled under
Settings → Pages → Source: GitHub Actions. A Pages site is public even when the repository is private.
