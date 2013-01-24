/**
 * Module dependencies.
 */
var utils = require('./utils')
  , async = require('async')
  , fs = require('fs');

// green tick symbol
var tick = '\033[32m✓\033[39m';
// short cut for the utils.log
var log = utils.log;

/*
 *
 */
module.exports = function(scope, cb) {
  gzipAssets(scope.assetsMap, function(err, rate) {
    if (err) return cb(err);
    log(' %s gzipped all gzippable \t\t\t %s% reduced ☺', tick, rate);
    cb();
  });
};

/**
 *
 */
function gzipAssets(assetsMap, cb) {
  var oldTotalSize = 0;
  var newTotalSize = 0;
  
  utils.eachAsset(assetsMap, function(filePath, p, cb) {
    var gzPath = filePath + '.gz';

    fs.stat(filePath, function(err, oldStat) {
      if (err) return cb(err);
      
      gzip(filePath, gzPath, function(err, newStat) {
        if (err) return cb(err);

        oldTotalSize += oldStat.size;
        newTotalSize += newStat.size;
        cb();
      });
    });
  }, function(err) {
    if (err) return cb(err);
    cb(null, 100 - ~~(newTotalSize / (oldTotalSize / 100)));
  });
}

/*
 *
 */
function gzip(from, to, cb) {
  var zlib = require('zlib');

  async.waterfall([
    function(cb) {
      utils.readFile(from, cb);
    },
    function(cont, cb) {
      zlib.gzip(cont, cb)
    },
    function(cont, cb) {
      utils.writeFile(to, cont, cb);
    }
  ], cb);
}