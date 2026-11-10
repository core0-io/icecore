import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitRef } from '../src/connection.js'

test('splitRef separates the namespace from the table', () => {
  assert.deepEqual(splitRef('default.logs'), { namespace: ['default'], table: 'logs' })
  assert.deepEqual(splitRef('a.b.logs'), { namespace: ['a', 'b'], table: 'logs' })
})
