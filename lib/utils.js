/**
 * Module dependencies.
 */
var program = require('commander')
  , crypto = require('crypto')
  , rimraf = require('rimraf')
  , async = require('async')
  , path = require('path')
  , _ = require('lodash')
  , fs = require('fs-extra');

// green tick symbol
var tick = '\033[90m✓\033[39m';
// shortcut
var utils = module.exports;

/*
 *
 */
utils.sumFilesSize = function(filesPath, cb) {
  async.reduce(filesPath, 0, function(size, filePath, cb) {
    fs.stat(filePath, function(err, stat) {
      if (err) return cb(err);
      cb(null, size + stat.size);
    });
  }, cb);
};

/*
 * Renames file adding md5 checksum of its content.
 * Passes new name to the callback function.
 *
 * @param filePath string
 * @param outDirPath string (optional)
 * @param cb fucntion
 */
utils.markFile = function(filePath, outDirPath, cb) {
  // if outDirPath is not provided
  if (!cb) {
    cb = outDirPath;
    outDirPath = null;
  }

  utils.readFile(filePath, function(err, cont) {
    if (err) return cb(err);

    var fileName = path.basename(filePath);
    var md5 = crypto.createHash('md5');
    md5 = md5.update(cont);
    md5 = md5.digest('hex');

    var chunks = fileName.split('.');
    var mark = md5.substr(0, 15);

    chunks.splice(chunks.length-1, 0, mark);

    var newName = chunks.join('.');

    if (outDirPath) {
      var newPath = path.join(outDirPath, newName);
      var rStream = fs.createReadStream(filePath);
      var wStream = fs.createWriteStream(newPath);
      rStream.pipe(wStream);
      rStream.on('end', function(err) {
        if (err) return cb(err);
        cb(null, newPath);
      });
    } else {
      var dirPath = path.dirname(filePath);
      var newPath = path.join(dirPath, newName);

      fs.copy(filePath, newPath, function(err) {
        if (err) return cb(err);
        fs.unlink(filePath, function(err) {
          if (err) return cb(err);
          cb(null, newPath);
        });
      });
    }
  });
};

/*
 *
 */
utils.readFile = function(filePath, cb) {
  fs.readFile(filePath, 'utf8', cb);
};

/*
 *
 */
utils.writeFile = function(filePath, cont, cb) {
  async.waterfall([
    function(cb) {
      fs.writeFile(filePath, cont, cb);
    },
    function(cb) {
      fs.stat(filePath, cb);
    }
  ], cb);
};

/*
 *
 */
utils.appendFile = function(file, cont, cb) {
  async.waterfall([
    function(cb) {
      fs.appendFile(file, cont, cb);
    },
    function(cb) {
      fs.stat(file, cb);
    }
  ], cb);
};

/*
 *
 */
utils.concatFiles = function(files, each, cb) {
  if (!cb) {
    cb = each;
    each = null;
  }

  async.concatSeries(files, utils.readFile, function(err, res) {
    if (err) return cb(err);
    cb(null, res.join(''));
  });
};

/**
 *
 */
utils.filterDirs = function(list, rootPath, cb) {
  async.filter(list, function(fileName, cb) {
    var filePath = path.join(rootPath, fileName);

    fs.stat(filePath, function(err, stat) {
      if (err) return cb(err);
      cb(stat.isDirectory());
    });
  }, cb);
};

/*
 *
 */
utils.removeDir = function(path, cb) {
  rimraf(path, cb);
};

/**
 *
 */
utils.eachAsset = function(map, iter, cb) {
  var pages = _.keys(map);

  async.forEach(pages, function(page, cb) {
    var groups = _.keys(map[page]);
    var inpage = map[page];

    async.forEach(groups, function(group, cb) {
      var assets = _.keys(inpage[group]);
      var ingroup = inpage[group];

      async.forEach(assets, function(asset, cb) {
        iter(ingroup[asset], {
          page  : page
        , group : group
        , asset : asset
        }, cb);
      }, cb);
    }, cb);
  }, cb);
};

/*
 * Simple log
 */
utils.log = function() {
  if (program.verbose) {
    console.log.apply(console, arguments);
  }
};

/*
 * File action log
 */
utils.falog = function(msg, stat) {
  utils.log('   %s %s \033[90m%s kb\033[39m', tick, msg, ~~(stat.size / 1024 * 100) / 100);
};
