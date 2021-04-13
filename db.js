'use strict'

const { joinSafe } = require('upath')
const { outputJsonSync, readJsonSync } = require('fs-extra')
const appData = process.env.APPDATA || (
  process.platform == 'darwin' ?
    process.env.HOME + '/Library/Preferences' :
    process.env.HOME + '/.local/share'
)

let database = null

function initDatabase(name) {
  if (database === null || database['name'] !== name) {
    loadDatabase(name)
  }
}

function loadDatabase(name) {
  const databasePath = joinSafe(appData, 'linguee', `${name}.json`)
  database = readJsonSync(databasePath, { throws: false }) || {
    name: name,
    path: databasePath,
    data: {}
  }
}

function updateDatabase(name, entryName, entry) {
  initDatabase(name)
  database['data'][entryName] = entry
  outputJsonSync(database['path'], database)
}

function queryDatabase(name, queryText) {
  initDatabase(name)
  return queryText in database['data'] ? database['data'][queryText] : null
}

module.exports = {
  queryDatabase,
  updateDatabase
}