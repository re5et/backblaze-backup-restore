require('dotenv').config();
const Bugsnag = require('@bugsnag/js');
const logger = require('./logger');
const bugsnagApiKey = process.env['BACKUP_RESTORE_BUGSNAG_APIKEY'];
if (bugsnagApiKey) {
  Bugsnag.start({ apiKey: bugsnagApiKey })
}

module.exports = (e) => {
  logger.error(e);
  if (bugsnagApiKey) {
    Bugsnag.notify(e)
  }
}
