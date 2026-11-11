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

function toast(message, duration = 5000) {
  const element = document.createElement('div')
  element.className = 'toast'
  element.setAttribute('role', 'status')
  element.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9Z"/></svg>'
  const text = document.createElement('span')
  text.textContent = message
  const close = document.createElement('button')
  close.setAttribute('aria-label', 'Close')
  close.textContent = '×'
  close.addEventListener('click', () => element.remove())
  element.append(text, close)
  document.body.append(element)
  setTimeout(() => element.remove(), duration)
}

// browsers hide the cause of a blocked cross-origin request, so a TypeError can only hint at CORS
function describe(error) {
  return error instanceof TypeError
    ? `${error.message} (network error: if the browser console mentions CORS, check the bucket's CORS configuration)`
    : error.message
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
    toast('Connection succeeded')
    showTab('query')
  } catch (error) {
    connection = undefined
    setStatus('config-status', `Failed: ${describe(error)}`, 'error')
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
    setStatus('query-status', error.name === 'AbortError' ? 'Cancelled' : `Failed: ${describe(error)}`, error.name === 'AbortError' ? '' : 'error')
  } finally {
    stopMeasuring()
    $('run').disabled = false
    $('cancel').hidden = true
  }
})
