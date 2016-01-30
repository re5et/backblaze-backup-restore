require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const _ = require('lodash');
const request = require('request');

const authenticate = require('./authenticate');
const logger = require('./logger');
const getBackedUpFiles = require('./getBackedUpFiles');
const getBucketId = require('./getBucketId');
const encryptDecrypt = require('./encryptDecrypt');
const fileShaSum = require('./fileShaSum');
const seriesRunner = require('./seriesRunner');
const progressBar = require('./progressBar');

const files = [];

function storageKey(file){
  return encryptDecrypt.encrypt(file);
}

function exclude(file){
  if(file == 'lost+found'){
    return true;
  }
  return false;
}

function getFilesToBackup(){
  const files = [];
  const backupPaths = process.env['BACKUP_RESTORE_PATHS_TO_BACKUP'].split(' ');
  backupPaths.forEach(function(backupPath){
    fs.readdirSync(backupPath).forEach(function(file){
      if(exclude(file)){
        return;
      }
      files.push(path.join(backupPath, file));
    });
  });
  return files;
}

function uploadFile(options, file){
  return function(callback){
    logger.info('***** beginning work on: ', file);
    fileShaSum(file, function(err, originalSha256){
      logger.info('generating encrypted name for: ', file);
      const originalPathEncrypted = encryptDecrypt.encrypt(file);
      logger.info('encrypted name for file: ', file, originalPathEncrypted);
      const workingFile = '/tmp/'+originalPathEncrypted;

      const reader = fs.createReadStream(file);
      const zip = zlib.createGzip();
      const writer = fs.createWriteStream(workingFile);
      logger.info('reading, zipping, encrypting and writing working file: ', file, workingFile);

      reader.pipe(zip).pipe(encryptDecrypt.encryptFile()).pipe(writer).on('finish', function(){
        zip.end();
        writer.end();
        logger.info('zipped and encrypted file written: ', workingFile);
        const body = fs.readFileSync(workingFile);
        logger.info('reading file: ', workingFile);
        const sha1 = crypto.createHash('sha1').update(body).digest("hex");
        logger.info('generated sha1 for : ', workingFile, sha1);
        const contentLength = fs.statSync(workingFile).size;
        logger.info('content length for : ', workingFile, contentLength);
        const url = options.apiUrl + '/b2api/v1/b2_get_upload_url';
        logger.info('getting upload authorization for: ', file);
        const bar = progressBar('uploading', contentLength);
        getBucketId(options, function(err, options){
          request({
            json: true,
            url: url,
            headers: {
              'Authorization': options.authorizationToken
            },
            qs: {
              bucketId: options.bucketId
            }
          }, function(err, response, data){
            if(err){ throw new Error(err) }
            logger.info('received upload authorization for: ', file);
            const uploadToken = data.authorizationToken;
            const uploadUrl = data.uploadUrl;
            logger.info('uploading file: ', file);
            const w = fs.createReadStream(workingFile)
            w.on('data', function(chunk){
              bar.tick(chunk.length);
            }).pipe(request.post(uploadUrl, {
              headers: {
                'Authorization': uploadToken,
                'X-Bz-File-Name': storageKey(file),
                'X-Bz-Content-Sha1': sha1,
                'Content-Length': contentLength,
                'Content-Type': 'application/octet-stream',
                'X-Bz-Info-Original-Sha256': originalSha256
              }
            }).on('error', function(err){
              fs.unlinkSync(workingFile);
              logger.error('error uploading file: ', file);
              callback(err);
            }).on('end', function(){
              logger.info('removing working file: ', workingFile);
              fs.unlinkSync(workingFile);
              logger.info('upload complete: ', file);
              callback();
            }));
          });
        });
      })
    })
  };
}

function start(options){
  getBackedUpFiles(options, function(err, response, data){
    if(err){
      throw new Error(err);
    }
    const backedUpFiles = data.files;
    const filesToBackup = getFilesToBackup();
    const tasks = [];
    filesToBackup.forEach(function(file){
      const foundFile = _.find(backedUpFiles, function(backup){
        return backup.fileName == storageKey(file);
      });
      if(!foundFile){
        logger.info('did not find existing backup for: ', file, 'adding task.');
        tasks.push(uploadFile(options, file));
      } else {
        logger.info('found backup!', file);
      }
    });
    seriesRunner(tasks);
  });
}

authenticate(start);
