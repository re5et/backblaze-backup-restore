const logger = require('./logger');
const request = require('request');

const _ = require('lodash');

let bucketId

module.exports = function getBucketId(options, callback){
  const bucketName = process.env['BACKUP_RESTORE_BACKBLAZE_BUCKET'];
	if (bucketId) {
		logger.info('using cached bucketId for: ', bucketName);
		options.bucketId = bucketId;
		return callback(null, options)
	}
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
		bucketId = bucket.bucketId
    options.bucketId = bucket.bucketId;
    callback(err, options);
  });
}
