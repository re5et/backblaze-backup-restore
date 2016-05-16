require('dotenv').config();

const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const path = require('path');

const mkdirp = require('mkdirp');
const request = require('request');

const logger = require('./logger');
const encryptDecrypt = require('./encryptDecrypt');
const fileShaSum = require('./fileShaSum');
const progressBar = require('./progressBar');

const chroot = process.env['BACKUP_RESTORE_DOWNLOAD_CHROOT'];

function existsAndIsFile(path){
  try {
    return fs.statSync(path)
  } catch(e){
    return false;
  }
}

function ensureActuallyRestored(options, backup, target, callback){
  logger.info('Ensuring backup restored properly: ', target);
  const url = options.apiUrl + '/b2api/v1/b2_get_file_info';
  fileShaSum(target, 'sha256', function(err, localSha){
    request({
      json: true,
      url: url,
      headers: {
        'Authorization': options.authorizationToken
      },
      qs: {
        fileId: backup.fileId
      }
    }, function(err, response, body){
      const storedSha = body.fileInfo['original-sha256'];
      if(storedSha != localSha){
        logger.info('shas do not match!: ', target, storedSha, localSha);
        restoreBackup(options, backup, target, callback);
      } else {
        logger.info('confirmed valid backup of: ', target);
        callback();
      }
    });
  });
}

function restoreBackup(options, backup, target, callback){
  logger.info('Restoring backup: ', target);
  const destinationDirectory = path.dirname(target);
  logger.info('making sure path is writeable: ', target);
  mkdirp.sync(destinationDirectory);
  const url = options.downloadUrl + '/b2api/v1/b2_download_file_by_id';

  const unzip = zlib.createGunzip();
  const w = fs.createWriteStream(target, {flags: 'w'});
  var bar;
  request({
    json: true,
    url: url,
    headers: {
      'Authorization': options.authorizationToken
    },
    qs: {
      fileId: backup.fileId
    }
  }).on('response', function(response){
    if(response.statusCode === 200){
      logger.info('Found restorable upload for: ' + target + ', downloading now ');
      bar = progressBar('downloading', parseInt(response.headers['content-length'], 10))
    }
  }).on('error', function(err){
    throw new Error(err);
  }).on('data', function(chunk){
    if(bar){
      bar.tick(chunk.length);
    }
  }).on('end', function(){
    w.end();
    callback();
  }).pipe(encryptDecrypt.createDecipher()).pipe(unzip).pipe(w);
}

function downloadFile(options, backup){
  const filePath = encryptDecrypt.decrypt(backup.fileName);
  const target = chroot ? path.join(chroot, filePath) : filePath;
  return function(callback){
    if(existsAndIsFile(target)){
      logger.info('Local path for backup exists:', target);
      ensureActuallyRestored(options, backup, target, callback);
    } else {
      logger.info('Local path for backup does not exist:', target);
      restoreBackup(options, backup, target, callback);
    }
  }
}

module.exports = downloadFile;
