'use strict'
const ls = require('github-ls')
const openEvent = require('open-event')
const async = require('async')
const hyperquest = require('hyperquest')
const toString = require('stream-to-string')

function createEventStubsFromFiles (files, repo, branch, callback) {
  callback(null, files.filter(function (file) {
    return file.charAt(0) !== '.'
  }).map(function (file) {
    var sha = /(.*)#([^#]+)$/.exec(file)
    if (sha) {
      file = sha[1]
      sha = sha[2]
    }
    var err
    try {
      openEvent.validate.path(file)
    } catch (e) {
      e.type = e.message
      err = e
    }
    return {
      repo: repo,
      branch: branch,
      sha: sha,
      file: 'events/' + file,
      error: err
    }
  }))
}

function eventFilesInRepo (repo, branch, github, callback) {
  const pth = repo + '/tree/' + branch + '/events'
  ls(pth, github, function (err, files) {
    if (err) {
      return callback(err)
    }
    createEventStubsFromFiles(files, repo, branch, callback)
  })
}

function getGithubBlob (github, fileInfo, callback) {
  const repoParts = fileInfo.repo.split('/')
  return github.gitdata.getBlob({
    user: repoParts[0],
    repo: repoParts[1],
    sha: fileInfo.sha
  }, function (err, data) {
    if (err) {
      return callback(err)
    }
    return callback(null, new Buffer(data.content, 'base64'))
  })
}

function getCachedGithubBlob (fileInfo, callback) {
  const url = 'https://raw.githubusercontent.com/' + fileInfo.repo + '/' + fileInfo.branch + '/events/' + fileInfo.file
  toString(hyperquest.get(url))
    .then(callback.bind(null, null))
    .on('error', callback)
}

function loadEvents (github, fileInfoList, limit, callback) {
  async.mapLimit(fileInfoList, limit, function (fileInfo, callback) {
    if (fileInfo.error) {
      return setImmediate(callback.bind(null, null, fileInfo))
    }
    var getBlob
    if (github && fileInfo.sha) {
      getBlob = getGithubBlob.bind(null, github)
    } else {
      getBlob = getCachedGithubBlob
    }
    getBlob(fileInfo, function (err, data) {
      if (err) {
        fileInfo.error = err
      } else {
        try {
          fileInfo.event = openEvent.validate(fileInfo.file, data)
        } catch (e) {
          fileInfo.error = e
        }
      }
      callback(null, fileInfo)
    })
  }, callback)
}

function eventsOfRepos (github, repos, branch, limit, callback) {

  async.mapLimit(repos, limit, function (repo, callback) {
    eventFilesInRepo(repo, branch, github, function (err, fileInfoList) {
      if (err) {
        // eat the error
        return callback(null)
      }
      callback(null, fileInfoList)
    })
  }, function (err, listOfFileInfoList) {
    if (err) {
      callback(err)
    }
    const allFiles = listOfFileInfoList.reduce(function (allFiles, fileInfoList) {
      if (fileInfoList == null) {
        return allFiles
      }
      return allFiles.concat(fileInfoList)
    }, [])
    loadEvents(github, allFiles, limit, callback)
  })
}

exports.eventsOfRepo = function (github, repo, branch, limit, callback) {
  eventFilesInRepo(github, repo, branch, function (err, fileInfoList) {
    if (err) {
      return callback(err)
    }
    loadEvents(github, fileInfoList, limit, callback)
  })
}
exports.events = function (github, userOrOrg, callback) {
  github.getAllPages(github.repos.getForOrg, {
    org: userOrOrg
  }, function (err, list) {
    if (err) {
      return callback(err)
    }
    eventsOfRepos(github, list.map(function (repo) {
      return repo.full_name
    }), 'gh-pages', 20, function (err, events) {
      if (err) {
        return callback(err)
      }
      callback(null, events)
    })
  })
}
