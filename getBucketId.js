const logger = require('./logger');
const request = require('request');

const _ = require('lodash');

module.exports = function getBucketId(options, callback){
  const bucketName = process.env['BACKUP_RESTORE_BACKBLAZE_BUCKET'];
  logger.info('getting bucketId for: ', bucketName);
  const url = options.apiUrl + '/b2api/v1/b2_list_buckets';
  request({
    json: true,
    url: url,
    headers: {
      'Authorization': options.authorizationToken
    },
    qs: {
      accountId: options.accountId
    }
  }, function(err, response, body){
    if(err){ throw new Error(err) }
    const bucket = _.find(body.buckets, ['bucketName', bucketName]);
    options.bucketId = bucket.bucketId;
    callback(err, options);
  });
}
