'use strict'

const Tabletop = require('tabletop')
const tzLookup = require('tz-lookup')
const moment = require('moment-timezone')

function prefix (amount, value) {
  if (!value) {
    value = ''
  }
  if (typeof value !== 'string') {
    value = value.toString()
  }
  while (value.length < amount) {
    value = '0' + value
  }
  return value
}

function parseDate (input, timeZone) {
  if (!input) {
    return undefined
  }
  var parts = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})\s+([0-9]{1,2})\:([0-9]{1,2})\:([0-9]{1,2})$/.exec(input)
  var year
  var month
  var date
  var hour
  var minute
  var second
  if (parts) {
    year = parts[3]
    month = parts[1]
    date = parts[2]
    hour = parts[4]
    minute = parts[5]
    second = parts[6]
  } else {
    parts = /^([0-9]{4})\/([0-9]{1,2})\/([0-9]{1,2})\s+([0-9]{1,2})\:([0-9]{1,2})\:([0-9]{1,2})$/.exec(input)
    if (parts) {
      year = parts[1]
      month = parts[2]
      date = parts[3]
      hour = parts[4]
      minute = parts[5]
      second = parts[6]
    } else {
      parts = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/.exec(input)
      year = parts[3]
      month = parts[1]
      date = parts[2]
      hour = '00'
      minute = '00'
      second = '00'
    }
  }
  const m = moment.tz(prefix(4, year) + '/' + prefix(2, month) + '/' + prefix(2, date) + ' ' + prefix(2, hour) + ':' + prefix(2, minute) + ':' + prefix(2, second), 'YYYY/MM/DD hh:mm:ss', timeZone)
  if (m) {
    return m.toString()
  }
  return undefined
}

module.exports = function (id, defaultContact, callback) {
  Tabletop.init({
    key: id,
    callback: function (data, doc) {
      callback(null, data.map(function (line) {
        var lat = parseFloat(line.latitude, 10)
        var lng = parseFloat(line.longitude, 10)
        var timeZone = null
        if (!isNaN(lat) && !isNaN(lng)) {
          try {
            timeZone = tzLookup(lat, lng)
          } catch (e) {
            timeZone = 'UTC'
          }
        } else {
          timeZone = 'UTC'
        }
        return {
          name: line.name,
          location: {
            place: line.location,
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng
          },
          timestamp: parseDate(line.timestamp, 'UTC'),
          contact: line['email'] || defaultContact,
          start: parseDate(line.startdate, timeZone),
          end: parseDate(line.enddate, timeZone),
          url: line.website
        }
      }), doc)
    },
    orderby: 'timestamp',
    prettyColumnNames: false,
    simpleSheet: true,
    simple_url: true
  })
}
