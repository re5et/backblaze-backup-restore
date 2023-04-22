require('dotenv').config();

const fs = require('fs');
const path = require('path');

const _ = require('lodash');

const logger = require('./logger');
const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const getFilesToBackup = require('./getFilesToBackup');
const uploadFile = require('./uploadFile');
const encryptDecrypt = require('./encryptDecrypt');
const seriesRunner = require('./seriesRunner');
const fileShaSum = require('./fileShaSum');

function start(options){
  getBackedUpFiles(options, function(err, backedUpFiles){
    if(err){
      throw new Error(err);
    }
    const filesToBackup = getFilesToBackup();
    const tasks = filesToBackup.map(function(file){
      return function(auth, callback) {
        logger.info('***** beginning work on: ', file);
        fileShaSum(file, 'sha256', function(err, originalSha256){
          const foundFile = _.find(backedUpFiles, function(backup){
            return backup.fileName === originalSha256;
          });
          if(!foundFile){
            logger.info('did not find existing backup for: ', file, 'adding task.');
            uploadFile(file)(auth, callback);
          } else {
            logger.info('found backup!', file);
            callback();
          }
        })
      }
    });
    seriesRunner(tasks, {
      shuffle: true
    });
  });
}

authenticate(start);
