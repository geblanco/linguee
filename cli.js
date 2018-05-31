#!/usr/bin/env node

'use strict'

const linguee = require('./linguee')
const readline = require('readline')
const { bold, red, blue, green, magenta, underline } = require('cli-colors')
const langs = ['spa', 'eng']

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function parseLangResult(resp) {
  let str = ''
  const pos = Object.keys(resp.pos)
  if( pos.length ){
    for(let key of pos){
      str += ` > ${bold(blue(key || 'dict'))}: ${resp.pos[key].join(', ')}\n`
    }
  }
  return str
}

function translate(word, callback) {
  const [from, to] = langs
  linguee.translate(word, { from, to }, (err, resp) => {
    if( err ){
      return callback(bold(red(err)))
    }

    const str = `${underline(from)}\n${parseLangResult(resp[from])}\n${underline(to)}\n${parseLangResult(resp[to])}`
    callback(str)
  })
}

function changeLanguage(fromLang, callback) {
  rl.question(`change from\n[${fromLang}] -> `, (input) => {
    callback( input === 'q' ? fromLang : input )
  })
}

function changeTranslation(input, callback) {
  let [prevFrom, prevTo] = langs
  const cancelStr = bold(red('Cancelled'))

  changeLanguage(prevFrom, (newFrom) => {
    if( newFrom === prevFrom ){
      callback(cancelStr)
    }else{
      langs[0] = newFrom
      changeLanguage(prevTo, (newTo) => {
        langs[1] = newTo
        let okStr = `${bold(green('Done'))}, new values: ${langs[0]} -> ${langs[1]}`
        callback(okStr)
      })
    }
  })
}

function searchPrompt() {
  rl.question(bold(magenta('translate := ')), (input) => {
    if( input === 'exit' ){
      rl.close()
    }else{
      let fn = input === 'lang' ? changeTranslation : translate
      fn(input, res => {
        console.log(res)
        searchPrompt()
      })
    }
  })
}

searchPrompt()
