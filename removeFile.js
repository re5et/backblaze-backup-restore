const request = require('request');
const trackError = require('./trackError')
const logger = require('./logger');
const encryptDecrypt = require('./encryptDecrypt');
const removeFileShaFromCache = require('./removeFileShaFromCache');

const removeFile = (backup) => {
  return function (auth, callback) {
    logger.info(`going to drop backup: ${backup.filePath}`)
    const url = auth.apiUrl + '/b2api/v1/b2_delete_file_version'
    request({
      method: 'post',
      json: true,
      url: url,
      headers: {
        'Authorization': auth.authorizationToken
      },
      body: {
        fileName: backup.fileName,
        fileId: backup.fileId,
      }
    }, (err, response) => {
      if (err) {
        trackError(err)
        return callback(err)
      }

      if (response.statusCode !== 200) {
        logger.error(`delete failed: ${response.statusCode}, ${JSON.stringify(response.body, null, 2)}`)
      } else {
        const name = encryptDecrypt.decrypt(backup.fileInfo['original-path'])
        logger.info(`successfully removed: ${name}`)
        removeFileShaFromCache(name, 'sha256', callback)
      }
    })
  }
}

module.exports = removeFile;
