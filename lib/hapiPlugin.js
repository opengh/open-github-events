'use strict'

var Path = require('path')

function registerHapiPlugin (server, options, next) {
  server.register([require('inert'), require('vision')], function (err) {
    try {
      if (err) return callback(err)
      var getAllEvents = require('./ghEvents').getAllEvents
      var hasWebhook = false
      var nextAutoUpdate = null
      var organization = options.githubOrganization
      var token = options.githubApiToken
      var github
      var lastWebhook = null
      var expiresIn = 1000 * 60 * 60 * 24 * 20 // Cache the data for 20 days (note: hapi max: 2147483647)

      server.method('githubAllEvents', function (organization, next) {
        if (!github) {
          github = require('open-github-teams/lib/githubApiForToken')(token)
        }
        getAllEvents(github, organization, function (err, data) {
          nextAutoUpdate = new Date(Date.now() + expiresIn)
          next(err, data)
        })
      }, {
        cache: {
          generateTimeout: 1000 * 60 * 10, // Wait 10 minutes for github to return all data
          expiresIn: expiresIn
        }
      })

      var hbs = require('handlebars')

      server.views({
        engines: {
          hbs: hbs
        },
        isCached: false,
        relativeTo: Path.join(__dirname, '..', 'web', 'views'),
        helpersPath: 'helpers'
      })
      hbs.registerHelper('path', function (prefix, child) {
        return prefix + child
      }.bind(null, server.realm.modifiers.route.prefix))

      server.route({
        method: 'GET',
        path: '/static/{param*}',
        handler: {
          directory: {
            path: Path.join(__dirname, '..', 'web', 'static'),
            redirectToSlash: true,
            index: true
          }
        }
      })


          console.log('hi')
      if (!organization) {
        server.route({
          method: 'GET',
          path: '/',
          handler: function (request, reply) {
            reply.view('index')
          }
        })
        next()
        return
      }
          console.log('hi')

      if (!token) {
        server.route({
          method: 'GET',
          path: '/',
          handler: function (request, reply) {
            reply.view('index', {
              org: organization,
              noAuthToken: true,
              totalMembers: '?'
            })
          }
        })
        next()
        return
      }
          console.log('hi')

      if (options.webhookSecret) {
        hasWebhook = true

        var crypto = require('crypto')
        var hashes = crypto.getHashes()
        server.route({
          method: 'POST',
          path: '/webhook',
          config: {
            payload: {
              parse: false
            }
          },
          handler: function (request, reply) {
            var sigHeader = request.headers['x-hub-signature']
            if (!sigHeader) {
              return reply({error: 'missing-signature'})
            }
            var sigParts = /^([^=]+)\=(.*)$/.exec(sigHeader)
            if (!sigParts) {
              return reply({error: 'mal-formatted-signature'})
            }
            var type = sigParts[1]
            if (hashes.indexOf(type) === -1) {
              return reply({error: 'unknown-signature-hash'})
            }
            var signature = sigParts[2]
            var hmac = crypto.createHmac(type, options.webhookSecret)
            hmac.update(request.payload)
            var check = hmac.digest('hex')
            if (signature !== check) {
              return reply({error: 'wrong-signature'})
            }
            lastWebhook = new Date()
            server.methods.githubFullTeam.cache.drop(organization, function (err) {
              if (err) {
                console.log(err)
                return reply({error: 'internal-error'})
              }
              reply({success: true})
            })
          }
        })
      }

      server.route({
        method: 'GET',
        path: '/events.json',
        config: {
          cors: {
            origin: ['*']
          }
        },
        handler: function (req, reply) {
          server.methods.githubAllEvents(organization, function (err, data) {
            if (err) {
              console.log(err)
              return reply({error: 'internal-error'})
            }
            reply(data)
          })
        }
      })

      server.route({
        method: 'GET',
        path: '/',
        handler: function (req, reply) {
          server.methods.githubAllEvents(organization, function (err, events) {
            var repos = '?'
            if (events) {
              repos = Object.keys(events.reduce(function (all, event) {
                if (event.repo) {
                  all[event.repo] = 1
                }
                return all
              }, {})).length
            }
            reply.view('index', {
              org: organization,
              error: err,
              events: events,
              repos: repos,
              hasWebhook: hasWebhook,
              nextAutoUpdate: nextAutoUpdate,
              lastWebhook: lastWebhook
            })
          })
        }
      })
    } catch(e) {
      console.log(e)
    }
    next()
  })
}

registerHapiPlugin.attributes = {
  pkg: require('../package.json')
}

exports.register = registerHapiPlugin
