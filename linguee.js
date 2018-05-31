'use strict'

const request = require('request')
const cheerio = require('cheerio')
const { joinSafe } = require('upath')

const { server, search, options } = require(joinSafe(__dirname || './', 'config.json'))
const lang = require(joinSafe(__dirname || './', 'dicts.json'))

function checkOpts(opts) {
  return (
    opts.hasOwnProperty('from') &&
    opts.hasOwnProperty('to') &&
    lang.hasOwnProperty(opts['from']) &&
    lang.hasOwnProperty(opts['to'])
  )
}

function extractTranslations(context, body) {
  const translations = {}
  
  body('.exact', context).find('.translation_desc').map(function() {
    const trans = body(this).find('.tag_trans') 
    const translation = trans.find('.dictLink').text()
    const type = trans.find('.tag_type').text()
    if (!translations.hasOwnProperty(type)) {
      translations[type] = []
    }
    translations[type].push(translation)
    return { type, translation }
  }).get()

  return translations
}

function extractAudios(context, body) {
  return body('.exact').find('.lemma_desc').map(function () {
    return JSON.parse(
      body(this)
        .find('.audio')
        .attr('onclick')
        .replace('playSound(this,', '[')
        .replace(');', ']')
    )
  }).get()
}

function extractFromBody(context, body, withAudio) {
    
  const ret = {
    pos: extractTranslations(context, body)
  }

  if (withAudio) {
    const audios = extractAudios(context, body)
    ret['audio'] = (typeof audios[0] === 'undefined') ? null : `http://www.linguee.com.br/mp3/${audios[0]}`
  }
  return ret
}

function translate(received, opts, callback) {

  if (!checkOpts(opts)) {
    return callback('Bad options supplied')
  }

  const url = `${server}/${lang[opts.from].name}-${lang[opts.to].name}/${search}&query=${received}&${options}`
  request(url, { encoding: 'binary' }, (error, response, body) => {

    if (error || response.statusCode !== 200) {
      return callback('Unable to fecth')
    }

    const loadedBody = cheerio.load(body)
    const audio = !!opts['withAudio']
    const origContext = `[data-source-lang="${lang[opts.from].context}"]`
    const transContext = `[data-source-lang="${lang[opts.to].context}"]`
    const originalExtracted = extractFromBody(origContext, loadedBody, audio)
    const translatedExtracted = extractFromBody(transContext, loadedBody, audio)

    callback(null, { [opts.to]: originalExtracted, [opts.from]: translatedExtracted })
  })
}

module.exports = {
	translate : translate,
  getLocales: () => langs
}
