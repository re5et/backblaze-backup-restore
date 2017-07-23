const fs = require('fs');
const crypto = require('crypto');

const logger = require('./logger');

module.exports = function(target, hashType, callback){
  logger.info(`generating sha (${hashType}) for: `, target);
  const stream = fs.ReadStream(target);
  const hash = crypto.createHash(hashType);
  stream.on('data', function(data) { hash.update(data); });
  stream.on('end', function() {
    const hashHex = hash.digest('hex');
    logger.info(`completed sha (${hashType}) for: ${target} ${hashHex}`);
    callback(null, hashHex);
  });
}
