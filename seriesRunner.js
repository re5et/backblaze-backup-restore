const async = require('async');

const logger = require('./logger');

module.exports = function(tasks) {
  async.series(tasks, function(err, results){
    if(err){ return logger.error(err); }
    logger.info('done.');
  });
}
