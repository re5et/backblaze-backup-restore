require('dotenv').config();

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const assert = require('assert');

const request = require('request');

const logger = require('./logger');
const getBucketId = require('./getBucketId');
const encryptDecrypt = require('./encryptDecrypt');
const fileShaSum = require('./fileShaSum');
const progressBar = require('./progressBar');

const files = [];
const oneGigabyte = 1073741824;
const bigFileSize = process.env.BIG_FILE_SIZE || oneGigabyte;

function storageKey(file){
  return encryptDecrypt.encrypt(file);
}

function exclude(file){
  if(file == 'lost+found'){
    return true;
  }
  return false;
}

function uploadBigFile(authOptions, file, workingFile, originalSha256, contentLength, callback) {
  return function(err, sha1) {
    logger.info('generated sha1 for: ', workingFile, sha1);
    const startUrl = authOptions.apiUrl + '/b2api/v1/b2_start_large_file';
    logger.info('getting upload authorization for: ', file);
    const partSize = authOptions.minimumPartSize;
    assert.ok(partSize, 'options.minimumPartSize not found');

    getBucketId(authOptions, function(err, bucketOptions) {
      request.post({
        json: true,
        url: startUrl,
        headers: {
          'Authorization': authOptions.authorizationToken,
        },
        body: {
          bucketId: bucketOptions.bucketId,
          fileName: storageKey(file),
          contentType: 'application/octet-stream',
          fileInfo: {
            'Original-Sha256': originalSha256,
            large_file_sha1: sha1
          }
        }
      }, function(err, response, data) {
        if(err){ throw new Error(err) }
        logger.info('received large file upload authorization for: ', file);

        const fileId = data.fileId;
        const getPartUrl = authOptions.apiUrl + '/b2api/v1/b2_get_upload_part_url';

        logger.info(file, 'fileId:', data.fileId)

        request.post({
          json: true,
          url: getPartUrl,
          body: { fileId },
          headers: {
            'Authorization': authOptions.authorizationToken
          }
        }, function(err, response, data) {
          if (err) throw new Error(err);

          const partUploadUrl = data.uploadUrl;
          const partAuthToken = data.authorizationToken;
          const finishUrl = authOptions.apiUrl + '/b2api/v1/b2_finish_large_file';
          const cancelUrl = authOptions.apiUrl + '/b2api/v1/b2_cancel_large_file';

          assert.ok(partUploadUrl, 'part upload URL not found');
          assert.ok(partAuthToken, 'part auth token not found');

          const fd = fs.openSync(workingFile, 'r');

          (function uploadPart(partSha1Array, cursor) {
            var thisPartSize;

            if (cursor + partSize < contentLength) {
              thisPartSize = partSize;
            } else {
              thisPartSize = contentLength - cursor - 1;
            }

            logger.info("part:", partSha1Array.length + 1);
            logger.info("part size", thisPartSize);
            logger.info('content length:', contentLength);

            const buf = new Buffer(thisPartSize);
            fs.readSync(fd, buf, 0, thisPartSize, cursor);

            const hash = crypto.createHash('sha1');
            hash.update(buf);
            const hashHex = hash.digest('hex');
            partSha1Array.push(hashHex);

            request.post(partUploadUrl, {
              headers: {
                'Authorization': partAuthToken,
                'X-Bz-Part-Number': partSha1Array.length,
                'X-Bz-Content-Sha1': hashHex,
                'Content-Length': thisPartSize
              },
              body: buf
            }).on('error', function(err) {
              fs.closeSync(fd);

              logger.error('error uploading large file: ', file);
              logger.info('removing working file: ', workingFile);
              fs.unlinkSync(workingFile);

              logger.info('canceling large file upload: ', file);
              request.post(cancelUrl, {
                json: true,
                headers: {
                  'Authorization': authOptions.authorizationToken
                },
                body: { fileId }
              }, function () {
                logger.info('canceled large file upload: ', file);
                callback(err);
              })
            }).on('end', function() {
              if (cursor + thisPartSize + 1 < contentLength) {
                uploadPart(partSha1Array, cursor + thisPartSize);
              } else {
                request.post(finishUrl, {
                  json: true,
                  headers: { 'Authorization': authOptions.authorizationToken },
                  body: { fileId, partSha1Array }
                }, function(err, res, body) {
                  debugger
                  fs.closeSync(fd);
                  if (err || (res.statusCode !== 200)) {
                    logger.error('error finishing large file: ', file);
                    logger.info('removing working file: ', workingFile);
                    fs.unlinkSync(workingFile);

                    logger.err('status code: ', res.statusCode);
                    logger.err(err);
                  }

                  logger.info('removing working file: ', workingFile);
                  fs.unlinkSync(workingFile);
                  logger.info('upload complete: ', file);
                  callback();
                })
              }
            })
          })([], 0); // lol
        })
      })
    })
  }
}

function uploadSmallFile(options, file, workingFile, originalSha256, contentLength, callback) {
  return function(err, sha1) {
    logger.info('generated sha1 for: ', workingFile, sha1);
    const url = options.apiUrl + '/b2api/v1/b2_get_upload_url';
    logger.info('getting upload authorization for: ', file);
    const bar = progressBar('uploading', contentLength);

    getBucketId(options, function(err, options) {
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
        }).pipe(
          request.post(uploadUrl, {
            headers: {
              'Authorization': uploadToken,
              'X-Bz-File-Name': storageKey(file),
              'X-Bz-Content-Sha1': sha1,
              'Content-Length': contentLength,
              'Content-Type': 'application/octet-stream',
              'X-Bz-Info-Original-Sha256': originalSha256
            }
          }).on('error', function(err){
            logger.error('error uploading file: ', file);
            logger.info('removing working file: ', workingFile);
            fs.unlinkSync(workingFile);
            callback(err);
          }).on('end', function(){
            logger.info('removing working file: ', workingFile);
            fs.unlinkSync(workingFile);
            logger.info('upload complete: ', file);
            callback();
          })
        );
      });
    });
  };
}

function uploadFile(options, file){
  return function(callback){
    logger.info('***** beginning work on: ', file);
    fileShaSum(file, 'sha256', function(err, originalSha256){
      logger.info('generating encrypted name for: ', file);
      const originalPathEncrypted = encryptDecrypt.encrypt(file);
      logger.info('encrypted name for file: ', file, originalPathEncrypted);

      const workingFile = '/tmp/'+originalPathEncrypted;
      const reader = fs.createReadStream(file);
      const zip = zlib.createGzip();
      const writer = fs.createWriteStream(workingFile);

      logger.info('reading, zipping, encrypting and writing working file: ', file, workingFile);

      reader
        .pipe(zip)
        .pipe(encryptDecrypt.createCipher())
        .pipe(writer).on('finish', function() {
          zip.end();
          writer.end();

          logger.info('zipped and encrypted file written: ', workingFile);

          const contentLength = fs.statSync(workingFile).size;
          logger.info('content length for: ', workingFile, contentLength);

          const uploadFunc = contentLength < bigFileSize ?
            uploadSmallFile(options, file, workingFile, originalSha256, contentLength, callback) :
            uploadBigFile(options, file, workingFile, originalSha256, contentLength, callback)

          fileShaSum(workingFile, 'sha1', uploadFunc);
        });
    });
  };
}

module.exports = uploadFile;
