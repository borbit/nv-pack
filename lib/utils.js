/**
 * Module dependencies.
 */
var program = require('commander')
  , async = require('async')
  , fs = require('fs');


// green tick symbol
var tick = '\033[32m✓\033[39m';

/*
 *
 */
exports.sumFilesSize = function(filesPath, cb) {
  async.reduce(filesPath, 0, function(size, filePath, cb) {
    fs.stat(filePath, function(err, stat) {
      if (err) return cb(err);
      cb(null, size + stat.size);
    });
  }, cb);
};

/*
 * Simple log
 */
exports.log = function() {
  if (program.verbose) {
    console.log.apply(console, arguments);
  }
};

/*
 * File action log
 */
exports.falog = function(msg, stat) {
  exports.log('   %s %s \033[90m%s kb\033[39m', tick, msg, kb(stat.size));
};

/**
 * Returns size value in kilobites
 *
 * @param size integer
 * @return float
 */
function kb(size) {
  return ~~(size / 1024 * 100) / 100;
}