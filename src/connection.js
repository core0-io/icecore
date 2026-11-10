import { icebergDataSource, remoteSigningResolver, restCatalogConnect, restCatalogLoadTable } from 'icebird'
import { extractTables, parseSql } from 'squirreling'

export async function fetchToken({ tokenServer, clientId, clientSecret }) {
  const res = await fetch(tokenServer, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  })
  if (!res.ok) throw new Error(`token request failed: ${res.status}`)
  return (await res.json()).access_token
}

export async function connect(settings) {
  const requestInit = { headers: { Authorization: `Bearer ${await fetchToken(settings)}` } }
  const catalog = await restCatalogConnect({ url: settings.catalogUri, warehouse: settings.warehouse, requestInit })
  return { catalog, requestInit }
}

export function splitRef(ref) {
  const parts = ref.split('.')
  return { namespace: parts.slice(0, -1), table: parts.at(-1) }
}

// each table has its own signer endpoint, so a data source is built per table
export async function tableSources({ catalog, requestInit }, query) {
  const refs = extractTables(parseSql({ query }))
  const entries = await Promise.all(refs.map(async ref => {
    const { namespace, table } = splitRef(ref)
    const { metadata, config } = await restCatalogLoadTable(catalog, { namespace, table })
    const resolver = remoteSigningResolver({ config, requestInit })
    return [ref, await icebergDataSource({ tableUrl: metadata.location, metadata, resolver })]
  }))
  return Object.fromEntries(entries)
}
