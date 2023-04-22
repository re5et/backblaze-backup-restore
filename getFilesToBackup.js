const fs = require('fs');
const _ = require('lodash');
const glob = require('glob');
const logger = require('./logger');

function exclude(file){
  const excludes = process.env['BACKUP_RESTORE_EXCLUDE_PATTERNS']
  if(!excludes){
    return false;
  }
  return _.some(excludes.split(','), function(exclude){
    return file.match(exclude)
  })
}

module.exports = (callback) => {
  const files = [];
  const backupPaths = process.env['BACKUP_RESTORE_BACKUP_GLOBS'].split(',');
  logger.info('working with backup paths', backupPaths)
  backupPaths.forEach(function(backupPath){
    glob.sync(backupPath).forEach(function(file){
      if(exclude(file)){
        logger.info('skipping because of exclude match!', file)
        return;
      }
      if (fs.lstatSync(file).isFile()) {
        files.push(file);
      }
    })
  });
  return files;
}
