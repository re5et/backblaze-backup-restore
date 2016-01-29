const readline = require('readline');

module.exports = function(callback){
  const rl = readline.createInterface(process.stdin, process.stdout);

  rl.setPrompt('backup-restore> ');
  rl.prompt();

  rl.on('line', function(line){
    callback(line);
    rl.prompt();
  }).on('close', () => {
    process.exit(0);
  });
}
