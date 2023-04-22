const db = require('./database');
const logger = require('./logger');

const removeFileShaFromCache = function(name, type, callback){
  if (process.env.BACKUP_RESTORE_WRITE_CACHE_FILE_SUMS !== "1") {
    return callback(null)
  }

  logger.info(`Removing ${name} from sha cache`);
  db.run("DELETE FROM file_shas WHERE name = ?;", [name], callback)
}

module.exports = removeFileShaFromCache
