require('dotenv').config();

const path = require('path');

const request = require('request');
const _ = require('lodash');

const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const downloadFile = require('./downloadFile');
const uploadFile = require('./uploadFile');
const removeFile = require('./removeFile');
const encryptDecrypt = require('./encryptDecrypt');
const prompt = require('./prompt');
const logger = require('./logger');
const seriesRunner = require('./seriesRunner');
const trackError = require('./trackError');

var searchResults = [];

function start(options){
  getBackedUpFiles(options, function(err, files){
    const backedUpFiles = _.orderBy(files.map(function(backup){
      const filePath = encryptDecrypt.decrypt(backup.fileInfo['original-path']);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      return {
        name: filePath,
        backup: backup,
        basename: basename
      }
    }), 'basename');

    function search(terms, fn){
      searchResults = _.filter(backedUpFiles, function(backup){
        return _.every(terms, fn(backup));
      });

      showSearchResults();
    }

    function searchBaseName(terms) {
      return search(terms, (backup) => (term) => {
        return backup.basename.match(new RegExp(term));
      })
    }

    function searchFullName(terms) {
      return search(terms, (backup) => (term) => {
        return backup.name.match(new RegExp(term));
      })
    }

    function showSearchResults(){
      searchResults.forEach(function(result, i){
        console.log('['+i+'] '+result.name);
      });
    }

    function download(args){
      var downloadableResult = searchResults[args[0]];
      if(!downloadableResult){
        console.log('No matching result!')
        showSearchResults();
      } else {
        downloadFile(downloadableResult.backup)(options, function(){
          console.log('completed download');
        });
      }
    }

    function remove(args){
      const index = parseInt(args[0], 10)
      const result = searchResults[index];
      if(!result){
        logger.warn('No matching result to remove!')
      } else {
        removeFile(result.backup)(options, (err) => {
          if (err) {
            console.error(err)
          }
        })
      }
    }

    function inspect(args){
      const index = parseInt(args[0], 10)
      const result = searchResults[index];
      if(!result){
        logger.warn('No matching result to inspect!')
      } else {
        console.log(result)
      }
    }

    function downloadMatched(){
      if(!searchResults[0]){
        logger.warn('No matching result to download!')
      } else {
        const tasks = [];
        searchResults.map(function(downloadable){
          logger.info('queueing download: ', downloadable.name)
          tasks.push(downloadFile(downloadable.backup))
        })
        seriesRunner(tasks)
      }
    }

    function upload(args){
      uploadFile(args.join(' '))(options, function(){
        console.log('upload complete');
      });
    }

    function help(){
      console.log('Commands: ', _.keys(commands).join(' '));
    }

    const commands = {
      search: searchBaseName,
      searchBaseName: searchBaseName,
      searchFullName: searchFullName,
      download: download,
      remove: remove,
      inspect: inspect,
      'download-matched': downloadMatched,
      upload: upload,
      help: help,
      throwError: () => trackError(new Error('WTF'))
    };

    help();
    prompt(function(line){
      const split = line.trim().split(' ');
      var directive = split[0];
      var args = split.splice(1);
      if(!isNaN(directive)){
        const downloadNumber = directive
        const downloadable = searchResults[downloadNumber]
        if(downloadable) {
          logger.warn("defaulting to downloading matched result", downloadable.name)
          args = [directive];
          directive = "download";
        }
      }
      const command = commands[directive]
      if(command){
        command(args);
      } else {
        logger.warn("Command not found, running search")
        searchBaseName(split);
      }
    })
  });
}

authenticate(start);
