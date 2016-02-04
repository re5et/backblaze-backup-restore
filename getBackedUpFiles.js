const request = require('request');
const async = require('async');

const logger = require('./logger');
const getBucketId = require('./getBucketId');

var haveAllFiles;

function getSomeFiles(startAt) {
}

module.exports = function getBackedUpFiles(options, callback){
  haveAllFiles = false;
  var nextFile = undefined;
  var files = [];
  logger.info('getting info about currently backed up files');
  const url = options.apiUrl + '/b2api/v1/b2_list_file_names';
  getBucketId(options, function(err, options){
    if(err){ throw new Error(err) }
    async.whilst(
      function () { return !haveAllFiles },
      function (cb) {
        if(haveAllFiles){
          return cb(null, files);
        }
        request({
          url: url,
          json: true,
          headers: {
            'Authorization': options.authorizationToken
          },
          qs: {
            bucketId: options.bucketId,
            maxFileCount: 100,
            startFileName: nextFile
          }
        }, function(err, response, data){
          if(err){ throw new Error(err) }
          files = files.concat(data.files)
          logger.info('loaded backup files: ', files.length);
          if(data.nextFileName){
            nextFile = data.nextFileName;
          } else {
            haveAllFiles = true;
          }
          return cb(null, files);
        });
      },
      callback);
  });
}
