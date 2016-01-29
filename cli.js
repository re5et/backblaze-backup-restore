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
  getBackedUpFiles(options, function(err, response, body){
    const backedUpFiles = body.files.map(function(backup){
      const filePath = encryptDecrypt.decrypt(backup.fileName);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      return {
        name: filePath,
        backup: backup,
        searchTerms: basename.split(' ')
      }
    });

    function search(terms){
      downloadableResults = _.filter(backedUpFiles, function(backup){
        return _.intersection(backup.searchTerms, terms).length == terms.length;
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

    const commands = {
      search: search,
      download: download
    };

    function help(){
      console.log('Commands: ', _.keys(commands).join(' '));
    }

    help();
    prompt(function(line){
      const split = line.trim().split(' ');
      const directive = split[0];
      const args = split.splice(1);
      const command = commands[directive]
      if(command){
        command(args);
      } else {
        help();
      }
    })
  });
}

authenticate(start);
