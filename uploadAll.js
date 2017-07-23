require('dotenv').config();

const fs = require('fs');
const path = require('path');

const glob = require('glob');
const _ = require('lodash');

const logger = require('./logger');
const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const uploadFile = require('./uploadFile');
const encryptDecrypt = require('./encryptDecrypt');
const seriesRunner = require('./seriesRunner');
const fileShaSum = require('./fileShaSum');

function exclude(file){
  const excludes = process.env['BACKUP_RESTORE_EXCLUDE_PATTERNS']
  if(!excludes){
    return false;
  }
  return _.some(excludes.split(' '), function(exclude){
    return file.match(exclude)
  })
}

function getFilesToBackup(callback){
  const files = [];
  const backupPaths = process.env['BACKUP_RESTORE_BACKUP_GLOBS'].split(' ');
  backupPaths.forEach(function(backupPath){
    glob.sync(backupPath).forEach(function(file){
      if(exclude(file)){
        return;
      }
      files.push(file);
    })
  });
  return files;
}

function start(options){
  getBackedUpFiles(options, function(err, backedUpFiles){
    if(err){
      throw new Error(err);
    }
    const filesToBackup = getFilesToBackup();
    const tasks = filesToBackup.map(function(file){
      return function(callback) {
        fileShaSum(file, 'sha256', function(err, originalSha256){
          const foundFile = _.find(backedUpFiles, function(backup){
            return backup.fileName === originalSha256;
          });
          if(!foundFile){
            logger.info('did not find existing backup for: ', file, 'adding task.');
            uploadFile(options, file)(callback);
          } else {
            logger.info('found backup!', file);
            callback();
          }
        })
      }
    });
    seriesRunner(tasks);
  });
}

authenticate(start);
