/**
 * Module dependencies.
 */
var utils = require('../utils');

// green tick symbol
var tick = '\033[32m✓\033[39m';
// short cut for the utils.log
var log = utils.log;

/*
 *
 */
module.exports = function(scope, cb) {
  markAssets(scope.assetsMap, function(err, assetsMap) {
    if (err) return cb(err);
    log(' %s marked assets with md5 checksum', tick);
    scope.assetsMap = assetsMap;
    cb();
  });
};

/**
 *
 */
function markAssets(map, cb) {
  var marked = {};

  utils.eachAsset(map, function(filePath, p, cb) {
    utils.markFile(filePath, function(err, newPath) {
      if (err) return cb(err);

      var inpage = marked[p.page] || (marked[p.page] = {});
      var ingroup = inpage[p.group] || (inpage[p.group] = {});
      ingroup[p.asset] = newPath;

      cb();
    });
  }, function(err) {
    if (err) return cb(err);
    cb(null, marked);
  });
}