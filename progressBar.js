var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

const progress = require('progress');

module.exports = function(label, total) {
  const bar = new progress('  '+label+' :bar :percent :etas', {
    complete: green,
    incomplete: red,
    width: 40,
    total: total
  });
  return bar;
}
