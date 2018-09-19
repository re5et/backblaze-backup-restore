require('dotenv').config();

const fs = require('fs');
const zlib = require('zlib');

const request = require('request');

const logger = require('./logger');
const getBucketId = require('./getBucketId');
const encryptDecrypt = require('./encryptDecrypt');
const fileShaSum = require('./fileShaSum');
const progressBar = require('./progressBar');
const lodash = require('lodash');

function uploadFile(options, file){
  return function(callback){
		const chunkLengthsByTheSecond = []
		const chunkSampleSize = 5
		let chunkSecondIndex = 0
		setInterval(function(){
			chunkSecondIndex++
		}, 1000)
    logger.info('***** beginning upload of: ', file);
    fileShaSum(file, 'sha256', function(err, originalSha256){
      logger.info('generating encrypted name for: ', file);
      const originalPathEncrypted = encryptDecrypt.encrypt(file);
      logger.info('encrypted name for file: ', file, originalPathEncrypted);
      const workingFile = '/tmp/'+originalPathEncrypted;
      const reader = fs.createReadStream(file);
      const zip = zlib.createGzip();
      const writer = fs.createWriteStream(workingFile);
      logger.info('reading, zipping, encrypting and writing working file: ', file, workingFile);
      reader.pipe(zip).pipe(encryptDecrypt.createCipher()).pipe(writer).on('finish', function(){
        logger.info('zipped and encrypted file written: ', workingFile)
        fileShaSum(workingFile, 'sha1', function(err, sha1){
          const contentLength = fs.statSync(workingFile).size;
          logger.info('content length for: ', workingFile, contentLength);
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
              logger.info(`uploading file: ${file} storageKey: ${originalSha256}`);
              const w = fs.createReadStream(workingFile)
              w.on('data', function(chunk){
								if(!chunkLengthsByTheSecond[chunkSecondIndex]) {
									chunkLengthsByTheSecond[chunkSecondIndex] = []
								}
								chunkLengthsByTheSecond[chunkSecondIndex].push(chunk.length)
								const sample = chunkLengthsByTheSecond.slice(chunkLengthsByTheSecond.length - (chunkSampleSize+1), chunkLengthsByTheSecond.length - 1)
								const average = lodash.sum(lodash.flatten(sample)) / chunkSampleSize
                bar.tick(chunk.length, {
									'kbps': Math.floor(average / 1000)
								});
              }).pipe(request.post(uploadUrl, {
                headers: {
                  'Authorization': uploadToken,
                  'X-Bz-File-Name': originalSha256,
                  'X-Bz-Content-Sha1': sha1,
                  'Content-Length': contentLength,
                  'Content-Type': 'application/octet-stream',
                  'X-Bz-Info-Original-Path': originalPathEncrypted,
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
              }));
            });
          });
        });
      });
    });
  };
}

module.exports = uploadFile;
