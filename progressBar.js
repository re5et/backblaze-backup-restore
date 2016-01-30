var green = '\u001b[32m▪\u001b[0m';
var red = '\u001b[2m▪\u001b[0m';

const progress = require('progress');

module.exports = function(label, total) {
  const bar = new progress('  '+label+' :bar :percent :etas', {
    complete: green,
    incomplete: red,
    width: 50,
    total: total
  });
  return bar;
}
