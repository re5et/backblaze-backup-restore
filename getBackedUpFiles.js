const logger = require('./logger');
const request = require('request');

const getBucketId = require('./getBucketId');

module.exports = function getBackedUpFiles(options, callback){
  logger.info('getting info about currently backed up files');
  const url = options.apiUrl + '/b2api/v1/b2_list_file_names';
  getBucketId(options, function(err, options){
    if(err){ throw new Error(err) }
    request({
      url: url,
      json: true,
      headers: {
        'Authorization': options.authorizationToken
      },
      qs: {
        bucketId: options.bucketId
      }
    }, callback);
  });
}
