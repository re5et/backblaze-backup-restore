const getBackedUpFiles = require('./getBackedUpFiles');
const authenticate = require('./authenticate');
const downloadFile = require('./downloadFile');
const seriesRunner = require('./seriesRunner');

function start(options){
  const tasks = [];
  getBackedUpFiles(options, function(err, response, body){
    response.map(function(backup){
      tasks.push(downloadFile(options, backup))
    })
    seriesRunner(tasks);
  });
}

authenticate(start);
