#!/usr/bin/env node

'use strict'

const linguee = require('./linguee')
const readline = require('readline')
const { bold, red, blue, green, magenta, gray, underline } = require('cli-colors')
const langs = ['es', 'en']

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

    const firstExtras = resp[`extras-${from}`] ? bold(gray(resp[`extras-${from}`])) : ''
    const secondExtras = resp[`extras-${to}`] ? bold(gray(resp[`extras-${to}`])) : ''
    const firstTitle = `${underline(from)}  ${firstExtras}`
    const secondTitle = `${underline(to)}  ${secondExtras}`
    const str = `${firstTitle}\n${parseLangResult(resp[from])}\n${secondTitle}\n${parseLangResult(resp[to])}`
    callback(str)
  })
}

function changeLanguage(fromLang, callback) {
  rl.question(`Change from\n[${fromLang}] -> `, (input) => {
    if( input !== 'q' && !(input in linguee.getLocales()) ){
      console.log(bold(red('Language not found.')))
      console.log(`Available languages: ${Object.keys(linguee.getLocales())}`)
      return changeLanguage(fromLang, callback)
    }
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
    if( input === 'exit' || input === 'quit' ){
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

function translateWords(words){
  if( words.length > 0 ){
    let current = words.pop()
    translate(current, (res) => {
      console.log(bold(green(current)))
      console.log(res)
      translateWords(words)
    })
  }else{
    process.exit(0)
  }
}

if( process.argv.length > 2 ){
  return translateWords(process.argv.splice(2))
}

searchPrompt()
