'use strict'

const test = require('tap').test
const fromSheet = require('../lib/eventsFromSheet')
test('events from google sheet', function (t) {
  fromSheet('1sjfr5O0YA8k8yVR9-64xGC_exWfW3uxCScX2IluDCK0', 'test@example.com', function (err, data, doc) {
    var events = data.slice(0, 2)
    t.equal(err, null)
    t.equal(events.length, 2)
    t.deepEqual(events[0], {
      name: 'Event A',
      location: { place: 'Amsterdam', lat: 12.34, lng: 45.67 },
      contact: 'test@example.com',
      timestamp: 'Mon Apr 04 2016 22:49:41 GMT+0000',
      start: 'Thu Apr 21 2016 10:00:00 GMT+0300',
      end: 'Fri Apr 29 2016 00:00:00 GMT+0300',
      url: 'http://google.com'
    })
    t.deepEqual(events[1], {
      name: 'Event B',
      location: { place: '東京', lat: 45.67, lng: 89.10 },
      timestamp: 'Mon Apr 04 2016 22:50:55 GMT+0000',
      contact: 'test@example.com',
      start: 'Tue May 03 2016 00:00:00 GMT+0600',
      end: 'Tue May 03 2016 15:00:00 GMT+0600',
      url: 'http://yahoo.co.jp'
    })
    t.end()
  })
})
