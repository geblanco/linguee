#!/usr/bin/env node

'use strict'

const linguee = require('./linguee')
const readline = require('readline')
const clc = require('cli-color')
const { red, blue, green, magenta, white, underline } = require('cli-color')
const langs = ['es', 'en']

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function parseLangResult(resp) {
  let str = ''
  const pos = Object.keys(resp.pos)
  if (pos.length) {
    for (let key of pos) {
      str += ` > ${blue.bold(key || 'dict')}: ${resp.pos[key].join(', ')}\n`
    }
  }
  return str
}

function translate(word, callback) {
  const [from, to] = langs
  linguee.translate(word, { from, to }, (err, resp, fromDB) => {
    if (err) {
      return callback(red.bold(err))
    }

    const firstExtras = resp[`extras-${from}`] ? white.bold(resp[`extras-${from}`]) : ''
    const secondExtras = resp[`extras-${to}`] ? white.bold(resp[`extras-${to}`]) : ''
    const firstTitle = `${underline(from)}  ${firstExtras}`
    const secondTitle = `${underline(to)}  ${secondExtras}`
    const str = `${firstTitle}\n${parseLangResult(resp[from])}\n${secondTitle}\n${parseLangResult(resp[to])}`
    callback(str, fromDB)
  })
}

function changeLanguage(fromLang, callback) {
  rl.question(`Change from\n[${fromLang}] -> `, (input) => {
    if (input !== 'q' && !(input in linguee.getLocales())) {
      console.log(red.bold('Language not found.'))
      console.log(`Available languages: ${Object.keys(linguee.getLocales())}`)
      return changeLanguage(fromLang, callback)
    }
    callback(input === 'q' ? fromLang : input)
  })
}

function changeTranslation(input, callback) {
  let [prevFrom, prevTo] = langs
  const cancelStr = red.bold('Cancelled')

  changeLanguage(prevFrom, (newFrom) => {
    if (newFrom === prevFrom) {
      callback(cancelStr)
    } else {
      langs[0] = newFrom
      changeLanguage(prevTo, (newTo) => {
        langs[1] = newTo
        let okStr = `${green.bold('Done')}, new values: ${langs[0]} -> ${langs[1]}`
        callback(okStr)
      })
    }
  })
}

function printTranslationOrigin(lineText, fromDB) {
  process.stdout.write(clc.move.up(1))
  process.stdout.write(clc.move.right(lineText.length + 1))
  console.log(clc.white(`(from ${fromDB ? "DB" : "Linguee"})\n`))
}

function searchPrompt() {
  let headPrompt = 'translate := '
  rl.question(magenta.bold(headPrompt), (input) => {
    if (input === 'exit' || input === 'quit') {
      rl.close()
    } else {
      let fn = input === 'lang' ? changeTranslation : translate
      let headLineText = `${headPrompt}${input}`
      fn(input, (res, fromDB) => {
        printTranslationOrigin(headLineText, fromDB)
        console.log(res)
        searchPrompt()
      })
    }
  })
}

function translateWords(words) {
  if (words.length > 0) {
    let current = words.pop()
    translate(current, (res) => {
      console.log(green.bold(current))
      console.log(res)
      translateWords(words)
    })
  } else {
    process.exit(0)
  }
}

if (process.argv.length > 2) {
  return translateWords(process.argv.splice(2))
}

searchPrompt()
