var green = '\u001b[32m▪\u001b[0m';
var red = '\u001b[2m▪\u001b[0m';

const progress = require('progress');

module.exports = function(label, total) {
  var format = '  '+label+' :bar :percent elapsed: :elapseds remaining: :etas';
  var options = {
    complete: green,
    incomplete: red,
    width: 50,
    total: total
  }
  return new progress(format, options);
}
