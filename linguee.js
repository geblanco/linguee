'use strict'

const request = require('request')
const cheerio = require('cheerio')
const { joinSafe } = require('upath')
const { queryDatabase, updateDatabase } = require(joinSafe(__dirname || '.', 'db'))
const { server, search, options } = require(joinSafe(__dirname || '.', 'config.json'))
const lang = require(joinSafe(__dirname || '.', 'dicts.json'))

const tildeRegexp = new RegExp("(\\'[a|e|i|o|u])|(\\~[n])", "i")
// Accept latex-like tilde chars (\'a, or just 'a)
const replacements = require(joinSafe(__dirname || '.', 'replacements.json'))

function expandTildes(word) {
  var ret = word
  if (tildeRegexp.test(word)) {
    ret = word.replace('\\', '')
    ret = ret.replace(tildeRegexp, function (char) {
      return replacements[char]
    })
    // Recurse for the rest of replacements
    return expandTildes(ret)
  }
  return ret
}

function checkOpts(opts) {
  return (
    opts.hasOwnProperty('from') &&
    opts.hasOwnProperty('to') &&
    lang.hasOwnProperty(opts['from']) &&
    lang.hasOwnProperty(opts['to'])
  )
}

function extractWordInfo(body) {
  return body('.exact').find('.tag_forms').map(function () {
    return body(this).text().trim()
  }).get()
}

function extractTranslations(context, body) {
  const translations = {}

  const t = body('.exact', context).find('.translation_desc').map(function () {
    const trans = body(this).find('.tag_trans')
    return {
      [trans.find('.tag_type').text()]: trans.find('.dictLink').text(),
    }
  }).get()

  for (let item of t) {
    for (let key in item) {
      if (!translations.hasOwnProperty(key)) {
        translations[key] = []
      }
      translations[key].push(item[key])
    }
  }

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

function extractExampleSentence(sentenceItem) {
  // get text from items with class source_url and so on (which are removable texts)
  var remElems = sentenceItem.children().filter(function () { return ["source_url_spacer", "source_url", "behindLinkDiv"].indexOf(cheerio(this).attr("class")) !== -1 }).get()
  var remTexts = remElems.map(elem => cheerio(elem).text()).map(elem => elem.trim()).filter(elem => !!elem)
  // get all text, removing blanks and removable texts
  var retElems = sentenceItem.text().split("\n").map(elem => elem.trim()).filter(elem => !!elem && remTexts.indexOf(elem) === -1)
  for (var rem of remTexts) {
    retElems = retElems.map(elem => elem.replace(rem, ""))
  }
  // remove linguee separator
  var retText = retElems.join(" ").split("[...]").map(elem => elem.trim()).join(" ")
  return retText
}

function extractExamples(body) {
  return body("tbody.examples").find("tr").map(function () {
    var fromSent = extractExampleSentence(body(this).find(".sentence.left").find(".wrap"))
    var toSent = extractExampleSentence(body(this).find(".sentence.right2").find(".wrap"))
    return { "from": fromSent, "to": toSent }
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

function formatResponse(opts, body) {
  const loadedBody = cheerio.load(body)
  const audio = !!opts['withAudio']
  const origContext = `[data-source-lang="${lang[opts.from].context}"]`
  const transContext = `[data-source-lang="${lang[opts.to].context}"]`
  const originalExtracted = extractFromBody(origContext, loadedBody, audio)
  const translatedExtracted = extractFromBody(transContext, loadedBody, audio)
  const [translatedInfo, originalInfo] = extractWordInfo(loadedBody)
  const examples = extractExamples(loadedBody)

  return {
    [`extras-${opts.to}`]: translatedInfo,
    [`extras-${opts.from}`]: originalInfo,
    [opts.to]: originalExtracted,
    [opts.from]: translatedExtracted,
    "examples": examples
  }
}

function formatOptLangForDB(opts) {
  return [opts.from, opts.to].sort().join("-")
}

function isEmptyResponse(ret, opts) {
  let emptyResp = JSON.stringify({ "pos": {} })
  return (JSON.stringify(ret[opts.from]) === emptyResp && JSON.stringify(ret[opts.to]) === emptyResp)
}

function translate(received, opts, callback) {
  if (!checkOpts(opts)) {
    return callback('Bad options supplied')
  }
  const queryText = expandTildes(received)
  const dbName = formatOptLangForDB(opts)
  const dbEntry = queryDatabase(dbName, queryText)
  if (dbEntry !== null) {
    return callback(null, dbEntry, dbEntry !== null)
  }
  const url = encodeURI(`${server}/${lang[opts.from].name}-${lang[opts.to].name}/${search}&query=${queryText}&${options}`)
  request(url, { encoding: 'binary' }, (error, response, body) => {

    if (error || response == undefined || response.statusCode !== 200) {
      console.log('Errored: ', error, response.statusCode)
      return callback('Unable to fecth')
    }

    const ret = formatResponse(opts, body)
    if (!isEmptyResponse(ret, opts)) {
      updateDatabase(dbName, queryText, ret)
    }
    callback(null, ret, dbEntry !== null)
  })
}

module.exports = {
  translate: translate,
  getLocales: () => lang
}
