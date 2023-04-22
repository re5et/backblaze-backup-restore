const request = require('request');

const logger = require('./logger');

let authInfo
let authInfoAt

module.exports = function(callback){
  const now = (new Date()).getTime()
  if (authInfo && (now - authInfoAt) < 1000 * 60 * 60) {
    logger.info('using auth from cache')
    return callback(authInfo)
  }
  logger.info('authorizing');
  request({
    json: true,
    url: 'https://api.backblaze.com/b2api/v1/b2_authorize_account',
    auth: {
      user: process.env['BACKUP_RESTORE_BACKBLAZE_ID'],
      pass: process.env['BACKUP_RESTORE_BACKBLAZE_KEY']
    }
  }, function(err, response, body){
    if(err){
      logger.error(err);
      throw new Error(err);
    }
    logger.info('authorized')
    if(!body.accountId){
      throw new Error(body.message);
    }
    authInfo = body
    authInfoAt = now
    return callback(body);
  });
}
