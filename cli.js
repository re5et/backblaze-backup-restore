require('dotenv').config();

const path = require('path');

const request = require('request');
const _ = require('lodash');

const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const downloadFile = require('./downloadFile');
const uploadFile = require('./uploadFile');
const encryptDecrypt = require('./encryptDecrypt');
const prompt = require('./prompt');
const logger = require('./logger');
const seriesRunner = require('./seriesRunner');

var downloadableResults = [];

function start(options){
  getBackedUpFiles(options, function(err, files){
    const backedUpFiles = files.map(function(backup){
      const filePath = encryptDecrypt.decrypt(backup.fileName);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      return {
        name: filePath,
        backup: backup,
        basename: basename
      }
    });

    function search(terms){
      downloadableResults = _.filter(backedUpFiles, function(backup){
        return _.every(terms, (term) => {
          return backup.basename.match(new RegExp(term));
        });
      });
      showDownloadableResults();
    }

    function showDownloadableResults(){
      _.orderBy(downloadableResults, 'basename').forEach(function(result, i){
        console.log('['+i+'] '+result.name);
      });
    }

    function download(args){
      var downloadableResult = downloadableResults[args[0]];
      if(!downloadableResult){
        console.log('No matching result!')
        showDownloadableResults();
      } else {
        downloadFile(options, downloadableResult.backup)(function(){
          console.log('completed download');
        });
      }
    }

    function downloadMatched(){
      if(!downloadableResults[0]){
        logger.warn('No matching result to download!')
      } else {
        const tasks = [];
        downloadableResults.map(function(downloadable){
          logger.info('queueing download: ', downloadable.name)
          tasks.push(downloadFile(options, downloadable.backup))
        })
        seriesRunner(tasks)
      }
    }

    function upload(args){
      uploadFile(options, args.join(' '))(function(){
        console.log('upload complete');
      });
    }

    function help(){
      console.log('Commands: ', _.keys(commands).join(' '));
    }

    const commands = {
      search: search,
      download: download,
      'download-matched': downloadMatched,
      upload: upload,
      help: help
    };

    help();
    prompt(function(line){
      const split = line.trim().split(' ');
      var directive = split[0];
      var args = split.splice(1);
      if(!isNaN(directive)){
        const downloadNumber = directive
        const downloadable = downloadableResults[downloadNumber]
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
        search(split);
      }
    })
  });
}

authenticate(start);
