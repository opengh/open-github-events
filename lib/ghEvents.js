'use strict'
const ls = require('github-ls')
const openEvent = require('open-event')
const async = require('async')
const hyperquest = require('hyperquest')
const toString = require('stream-to-string')
const getGithubList = require('open-github-teams/lib/getGithubList')

function eventsFromFiles (files, repo, branch, callback) {
	callback(null, files.filter(function (file) {
		return file.charAt(0) !== '.'
	}).map(function (file) {
		var url = 'https://raw.githubusercontent.com/' + repo + '/' + branch + '/events/' + file
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
			file: file,
			url: url,
			error: err
		}
	}))
}

function eventFilesInRepoWithAPI (github, repo, branch, callback) {
	getGithubList(github.repos.getContent, {
		user: repo.split('/')[0],
		repo: repo.split('/')[1],
		path: 'events',
		ref: 'refs/heads/' + branch
	}, function (err, files) {
		if (err) {
		  return callback(err)
		}
		eventsFromFiles(files.map(function (file) {
			return file.name
		}), repo, branch, callback)
	})
}

function eventFilesInRepo (repo, branch, callback) {
	var pth = repo + '/tree/' + branch + '/events'
	ls(pth, function (err, list) {
		if (err) {
			return callback(err)
		}
		eventsFromFiles(files, repo, branch, callback)
	})	
}

function loadEvents (fileInfoList, limit, callback) {
	async.mapLimit(fileInfoList, limit, function (fileInfo, callback) {
		if (fileInfo.error) {
			return setImmediate(callback.bind(null, null, fileInfo))
		}
		toString(hyperquest.get(fileInfo.url)).then(function (data) {
			try {
		 		fileInfo.event = openEvent.validate(fileInfo.file, data)
			} catch(e) {
				fileInfo.error = e
			}
		 	callback(null, fileInfo)
		})
	}, callback)
}

function eventsOfRepo (repo, branch, limit, callback) {
	eventFilesInRepo(repo, branch, function (err, fileInfoList) {
		if (err) {
			return callback(err)
		}
		loadEvents(fileInfoList, limit, callback)
	})
}

function eventsOfRepos(github, repos, branch, limit, callback) {
	async.mapLimit(repos, limit, function (repo, callback) {
		eventFilesInRepoWithAPI(github, repo, branch, function (err, fileInfoList) {
			if (err) {
				// eat the error
				return callback(null)
			}
			callback(null, fileInfoList)
		})
	}, function (err, listOfFileInfoList) {
		const allFiles = listOfFileInfoList.reduce(function (allFiles, fileInfoList) {
			if (fileInfoList == null) {
				return allFiles
			}
			return allFiles.concat(fileInfoList)
		}, [])
		loadEvents(allFiles, limit, callback)
	})
}

exports.getAllEvents = function (github, userOrOrg, callback) {
	getGithubList(github.repos.getFromOrg, {
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
