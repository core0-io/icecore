import { icebergQuery } from 'icebird'
import { connect, tableSources } from './connection.js'
import { measureFetches } from './timing.js'

const $ = id => document.getElementById(id)
const storageKey = 'icecore.settings'
const maxRows = 1000
let connection

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? {}
  } catch {
    return {}
  }
}

function saveSettings({ clientSecret, ...rest }) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(rest))
  } catch { /* storage unavailable */ }
}

function setStatus(id, text, kind = '') {
  const element = $(id)
  element.textContent = text
  element.className = kind
}

function showTab(name) {
  for (const tab of ['config', 'query']) $(tab).hidden = tab !== name
  for (const button of document.querySelectorAll('nav button')) {
    button.classList.toggle('active', button.dataset.tab === name)
  }
}

for (const button of document.querySelectorAll('nav button')) {
  button.addEventListener('click', () => showTab(button.dataset.tab))
}

const form = $('config-form')
for (const [name, value] of Object.entries(loadSettings())) {
  if (form.elements[name]) form.elements[name].value = value
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const settings = Object.fromEntries(new FormData(form))
  setStatus('config-status', 'Connecting…')
  try {
    connection = await connect(settings)
    saveSettings(settings)
    setStatus('config-status', 'Connected', 'ok')
    showTab('query')
  } catch (error) {
    connection = undefined
    setStatus('config-status', `Failed: ${error.message}`, 'error')
  }
})

function renderTable(columns, rows) {
  const table = document.createElement('table')
  const head = table.createTHead().insertRow()
  for (const column of columns) head.appendChild(document.createElement('th')).textContent = column
  const body = table.createTBody()
  for (const values of rows) {
    const tr = body.insertRow()
    for (const value of values) tr.insertCell().textContent = format(value)
  }
  $('results').replaceChildren(table)
}

// cells are lazy async getters, so they have to be awaited to get the values
function resolveRow(columns, row) {
  return Promise.all(columns.map(column => row.cells[column]?.()))
}

function format(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)
  return String(value)
}

let controller

$('cancel').addEventListener('click', () => controller?.abort())

$('run').addEventListener('click', async () => {
  if (!connection) {
    setStatus('query-status', 'Configure the destination first', 'error')
    return showTab('config')
  }
  const query = $('sql').value
  controller = new AbortController()
  $('run').disabled = true
  $('cancel').hidden = false
  setStatus('query-status', 'Running…')
  const started = performance.now()
  const stopMeasuring = measureFetches()
  try {
    const tables = await tableSources(connection, query)
    const result = await icebergQuery({ tables, query, signal: controller.signal })
    const rows = []
    for await (const row of result.rows()) {
      if (rows.length === maxRows) break
      rows.push(await resolveRow(result.columns, row))
    }
    const truncated = rows.length === maxRows
    renderTable(result.columns, rows)
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    setStatus('query-status', `${rows.length}${truncated ? '+' : ''} rows in ${seconds}s (${stopMeasuring()})`, 'ok')
  } catch (error) {
    $('results').replaceChildren()
    setStatus('query-status', error.name === 'AbortError' ? 'Cancelled' : `Failed: ${error.message}`, error.name === 'AbortError' ? '' : 'error')
  } finally {
    stopMeasuring()
    $('run').disabled = false
    $('cancel').hidden = true
  }
})
