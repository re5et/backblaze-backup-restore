const getBackedUpFiles = require('./getBackedUpFiles');
const authenticate = require('./authenticate');
const downloadFile = require('./downloadFile');
const seriesRunner = require('./seriesRunner');
const encryptDecrypt = require('./encryptDecrypt');
const minimatch = require("minimatch")

const match = (path) => {
  const globs = process.env['BACKUP_RESTORE_BACKUP_GLOBS'].split(' ');
  return globs.some(glob => minimatch(path, glob))
}

function start(options){
  const tasks = [];
  getBackedUpFiles(options, function(err, response, body){
    response.map(function(backup){
      const encryptedOriginalPath = backup.fileInfo['original-path']
      const filePath = encryptDecrypt.decrypt(encryptedOriginalPath);
      if (match(filePath)) {
        tasks.push(downloadFile(backup))
      }
    })
    // shuffle in case there is an error with any specific file, it
    // will not just it, stop, start over, repeat.  This should allow
    // everything to finish when run with forever with just the bad
    // ones left at the end
    seriesRunner(tasks, {
      shuffle: true
    });
  });
}

authenticate(start);
