const async = require('async');
const _ = require('lodash');

const authenticate = require('./authenticate')
const trackError = require('./trackError')
const logger = require('./logger');

const runForever = process.env.BACKUP_RESTORE_SERIES_RUNNER_FOREVER === "1"
let restarts = 0

const seriesRunner = function(tasks, options = {}) {
  const tasksLength = tasks.length
  if (options.shuffle) {
    tasks = _.shuffle(tasks)
  }
  console.log("NUMBER OF TASKS:", tasks.length)
  async.series(tasks.map((t, i) => {
    return function(callback) {
      const taskNumber = i+1
      const percentComplete = ((taskNumber / tasksLength) * 100).toPrecision(4)
      logger.info(`seriesRunner starting task ${i+1} of ${tasks.length} (${percentComplete}%) `)
      return authenticate(auth =>
        t(auth, callback)
      )
    }
  }), function(e, results){
    if(e){
      trackError(e)
      if (runForever) {
        logger.info(`RESTARTING! restart count: ${++restarts}`)
        return seriesRunner(tasks, options)
      } else {
        process.exit(1);
      }
    }
    logger.info('done.');
    process.exit(0);
  });
}

module.exports = seriesRunner
