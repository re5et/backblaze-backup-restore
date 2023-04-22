require('dotenv').config();

const minimatch = require("minimatch")
const yesno = require("yesno")

const authenticate = require('./authenticate');
const getBackedUpFiles = require('./getBackedUpFiles');
const getFilesToBackup = require('./getFilesToBackup');
const encryptDecrypt = require('./encryptDecrypt');
const removeFile = require('./removeFile');
const seriesRunner = require('./seriesRunner');
const logger = require('./logger');

const start = (options) => {
  getBackedUpFiles(options, async (err, backedUpFiles) => {
    if(err){
      throw new Error(err);
    }
    logger.info('finding backups that do not correspond to globbed local...')
    const globs = process.env.BACKUP_RESTORE_BACKUP_GLOBS.split(",")
    const backedUpfilesWithPath = backedUpFiles.map(f => ({
      ...f,
      filePath: encryptDecrypt.decrypt(f.fileInfo['original-path']),
    })).filter(f => {
      return globs.some(glob => minimatch(f.filePath, glob))
    })
    const filesToBackup = getFilesToBackup();
    const toRemove = []
    backedUpfilesWithPath.forEach(backup => {
      if (!filesToBackup.includes(backup.filePath)) {
        toRemove.push(backup)
      }
    })

    if (toRemove.length === 0) {
      logger.info('all looks clean, nothing to remove.')
      process.exit(0);
    }

    logger.info(`Found ${toRemove.length} backups to remove (they do not exist on globbed paths):

${toRemove.map(x => x.filePath).join("\n")}

`)

    const removeThemAll = await yesno({ question: `Remove them all (${toRemove.length} files)?  If no, will ask one by one, y/n: `})
    let tasks = []
    if (removeThemAll) {
      toRemove.forEach(backup => {
        tasks.push(removeFile(backup))
        logger.info(`Added task to remove ${backup.filePath}`)
      })
    } else {
      for (const backup of toRemove) {
        const ok = await yesno({ question: `
${JSON.stringify(backup, null, 2)}

Really remove backup for ${backup.filePath}?`})
        if (ok) {
          tasks.push(removeFile(backup))
          logger.info(`Added task to remove ${backup.filePath}`)
        }
      }
    }

    if (tasks.length !== 0) {
      const ok = await yesno({ question: 'Are you really sure?' })
      if (ok) {
        logger.info('ok, starting removals...')
        seriesRunner(tasks)
      } else {
        logger.info('ok, bailing.')
      }
    } else {
      logger.error('something is wrong, had files to remove but no tasks?')
    }
  })
}

authenticate(start);
