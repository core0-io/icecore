# Icecore

## Prerequisites

- **Node.js 22.12+** or above. Check with `node --version`.
- **npm** (bundled with Node).
- **git**: `icebird` is installed straight from GitHub, so `npm install` clones it.
- A destination created in the ffwd portal, plus its details from the portal's "Other" tab: catalog URI,
  warehouse, token server and agent key.
- Admin access to the destination's bucket, to set CORS (see below).

## Running

```
npm install
npm run dev
```

Open the URL Vite prints (by default <http://localhost:5173>).

1. **Destination** tab: enter the catalog URI, warehouse, token server, agent key and client secret.
   The client secret is kept in memory only, so re-enter it after a reload.
2. **Query** tab: run free-form SQL, e.g. `SELECT * FROM "namespace.table"`. Results are capped at 1000 rows.

Other commands: `npm test` runs the tests, `npm run build` writes a static build to `dist/`.

## Bucket CORS

The browser reads data files directly from the bucket, so the bucket must allow cross-origin `GET`/`HEAD`
with `Range`, `Authorization` and `x-amz-*` request headers from the origin serving this app
(`http://localhost:5173` for local development).

For an S3-compatible bucket (AWS S3, Sakura Storage, MinIO, …), [`cors-localhost.json`](cors-localhost.json)
holds a suitable configuration. Apply it with the AWS CLI, adding `--endpoint-url` for non-AWS providers:

```
aws s3api put-bucket-cors \
  --bucket <bucket> \
  --cors-configuration file://cors-localhost.json \
  --endpoint-url https://<storage-endpoint>
```

Check it with `aws s3api get-bucket-cors --bucket <bucket> --endpoint-url https://<storage-endpoint>`.
If the provider has a console CORS editor, enter the same values there. Add the deployed origin
(e.g. `https://core0-io.github.io`) to `AllowedOrigins` when using the published site.

If queries fail with a CORS error in the browser console, the origin (scheme, host and port) does not match
`AllowedOrigins` exactly, or a request header is missing from `AllowedHeaders`.

## Publishing

Pushes to `master` deploy to GitHub Pages (`.github/workflows/pages.yml`) once Pages is enabled under
Settings → Pages → Source: GitHub Actions. A Pages site is public even when the repository is private.
