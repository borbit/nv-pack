/**
 * Module dependencies.
 */
var progress = require('progress')
  , utils = require('../utils')
  , async = require('async')
  , path = require('path')
  , _ = require('lodash');

// green tick symbol
var tick = '\033[32m✓\033[39m';

// short cut for the utils.log
var log = utils.log;

/*
 *
 */
module.exports = function(scope, cb) {
  async.waterfall([
    function(cb) {
      optimizeJPEG(scope.tmpDir, scope.imagesMap, cb);
    },
    function(cb) {
      optimizePNG(scope.tmpDir, scope.imagesMap, cb);
    }
  ], cb);
};

/*
 *
 */
function optimizePNG(dirPath, imagesMap, cb) {
  var execFile = require('child_process').execFile;
  var oldSize = 0;

  var files = _.map(imagesMap, function(fileName) {
    return path.join(dirPath, fileName);
  });
  files = _.filter(files, function(filePath) {
    return ~filePath.indexOf('.png');
  });

  var bar = new progress(' ...optimizing PNGes with optipng \t :percent \t [:bar]', {
    total: files.length
  });

  async.waterfall([
    function(cb) {
      utils.sumFilesSize(files, cb);
    },
    function(size, cb) {
      oldSize = size;
      async.forEachSeries(files, function(filePath, cb) {
        var args = ['-o1', filePath];
        execFile('optipng', args, function(err) {
          if (err) return cb(err);
          bar.tick();
          cb();
        });
      }, cb);
    },
    function(cb) {
      utils.sumFilesSize(files, cb);
    }
  ], function(err, newSize) {
    if (err) return cb(err);
    log('\n %d% reduced ♥', 100 - ~~(newSize / (oldSize / 100)));
    cb();
  });
}

/*
 *
 */
function optimizeJPEG(dirPath, imagesMap, cb) {
  var execFile = require('child_process').execFile;
  var oldSize = 0;

  var files = _.map(imagesMap, function(fileName) {
    return path.join(dirPath, fileName);
  });
  files = _.filter(files, function(filePath) {
    return ~filePath.indexOf('.jpg') ||
           ~filePath.indexOf('.jpeg');
  });

  var bar = new progress(' ...optimizing JPEGs with jpegtran \t :percent \t [:bar]', {
    total: files.length
  });

  async.waterfall([
    function(cb) {
      utils.sumFilesSize(files, cb);
    },
    function(size, cb) {
      oldSize = size;
      bar.tick();
      async.forEachSeries(files, function(filePath, cb) {
        var args = [
          '-optimize'
        , '-progressive'
        , '-copy', 'none'
        , '-outfile', filePath
        , filePath
        ];
        execFile('jpegtran', args, function(err) {
          if (err) return cb(err);
          bar.tick();
          cb();
        });
      }, cb);
    },
    function(cb) {
      utils.sumFilesSize(files, cb);
    }
  ], function(err, newSize) {
    if (err) return cb(err);
    log('\n %d% reduced ♥', 100 - ~~(newSize / (oldSize / 100)));
    cb();
  });
}