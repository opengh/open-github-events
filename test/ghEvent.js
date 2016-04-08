'use strict'

const test = require('tap').test
const ghEvents = require('../lib/ghEvents')
const Client = require('github4')
const github = new Client({
  version: '3.0.0',
  headers: {
    'user-agent': 'open-github-teams'
  }
})
github.authenticate({
  type: 'oauth',
  token: require('../test_auth').token
})

test('events from google sheet', function (t) {
  ghEvents.getAllEvents(github, 'opengh', function (err, data) {
    t.equal(err, null)
    t.deepEqual(data, [])
    t.end()
  })
})
