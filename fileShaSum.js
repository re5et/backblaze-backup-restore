const fs = require('fs');
const crypto = require('crypto');

const logger = require('./logger');

const db = require('./database');

const removeFileShaFromCache = require('./removeFileShaFromCache');

const checkFileShaCache = function(target, type, callback){
  if (process.env.BACKUP_RESTORE_READ_CACHE_FILE_SUMS !== "1") {
    return callback(null, null)
  }
  const sql = 'SELECT * from file_shas where name = ? and type = ? LIMIT 1'
  db.get(sql, [target, type], function(err, row) {
    callback(err, (row && row.sha) || false)
  })
}

const addFileShaToCache = function(target, sha, type, callback){
  if (process.env.BACKUP_RESTORE_WRITE_CACHE_FILE_SUMS !== "1") {
    return callback(null)
  }

  db.run('INSERT INTO file_shas (name, sha, type) VALUES (?, ?, ?)', [target, sha, type], callback)
}

module.exports = function(target, hashType, callback){
  logger.info(`generating sha (${hashType}) for: `, target);
  checkFileShaCache(target, hashType, function(err, sha) {
    if (err) {
      throw err
    }
    if (sha) {
      logger.info(`found cached sha (${hashType}) for: `, target, sha);
      callback(null, sha);
    } else {
      const stream = fs.ReadStream(target);
      const hash = crypto.createHash(hashType);
      stream.on('data', function(data) { hash.update(data); });
      stream.on('end', function() {
        sha = hash.digest('hex');
        logger.info(`completed sha (${hashType}) for: ${target} ${sha}`);
        addFileShaToCache(target, sha, hashType, function(err) {
          if (err) {
            return callback(err)
          }
          callback(null, sha);
        })
      });
    }
  })
}
