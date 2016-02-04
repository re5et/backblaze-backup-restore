require('dotenv').config();

const path = require('path');

const request = require('request');
const _ = require('lodash');

const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const downloadFile = require('./downloadFile');
const encryptDecrypt = require('./encryptDecrypt');
const prompt = require('./prompt');

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
      downloadableResults.forEach(function(match, i){
        console.log('['+i+'] '+match.name);
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

    function help(){
      console.log('Commands: ', _.keys(commands).join(' '));
    }

    const commands = {
      search: search,
      download: download,
      help: help
    };

    help();
    prompt(function(line){
      const split = line.trim().split(' ');
      var directive = split[0];
      var args = split.splice(1);
      if(!isNaN(directive)){
        args = [directive];
        directive = "download";
      }
      const command = commands[directive]
      if(command){
        command(args);
      } else {
        search(split);
      }
    })
  });
}

authenticate(start);
