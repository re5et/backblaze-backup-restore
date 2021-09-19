const async = require('async');
const _ = require('lodash');

const trackError = require('./trackError')
const logger = require('./logger');

module.exports = function(tasks, options = {}) {
  const tasksLength = tasks.length
  if (options.shuffle) {
    tasks = _.shuffle(tasks)
  }
  async.series(tasks.map((t, i) => {
    return function(callback) {
      const taskNumber = i+1
      const percentComplete = ((taskNumber / tasksLength) * 100).toPrecision(4)
      logger.info(`seriesRunner starting task ${i+1} of ${tasks.length} (${percentComplete}%) `)
      return t(callback)
    }
  }), function(e, results){
    if(e){
      trackError(e)
      process.exit(1);
    }
    logger.info('done.');
    process.exit(0);
  });
}
