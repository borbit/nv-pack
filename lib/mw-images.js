/**
 * Module dependencies.
 */
var utils = require('./utils')
  , async = require('async')
  , path = require('path')
  , _ = require('lodash')
  , fs = require('fs');

// green tick symbol
var tick = '\033[32m✓\033[39m';

// short cut for the utils.log
var log = utils.log;

/*
 *
 */
module.exports = function(scope, cb) {
  var cfg = scope.cfg;

  async.waterfall([
    function(cb) {
      gatherImages(cfg.STATIC_ROOT, scope.tmpDir, function(err, imagesMap) {
        if (err) return cb(err);
        log(' %s gathered all existing images', tick);
        scope.imagesMap = imagesMap;
        cb();
      });
    },
    function(cb) {
      applyImagesMap(scope.assetsMap, scope.imagesMap, function(err) {
        if (err) return cb(err);
        log(' %s applyed gathered images to assets', tick);
        cb();
      });
    },
    function(cb) {
      fs.writeFile(cfg.IMAGES_MAP_FILE, JSON.stringify(scope.imagesMap), function(err) {
        if (err) return cb(err);
        log(' %s created images map file \t\t \033[90m%s\033[39m', tick, cfg.IMAGES_MAP_FILE);
        cb();
      });
    }
  ], cb);
};

/*
 *
 */
function gatherImages(dirPath, outDirPath, cb) {
  findImages(dirPath, function(err, list) {
    if (err) return cb(err);

    var map = {};

    async.forEach(list, function(imgPath, cb) {
      utils.markFile(imgPath, outDirPath, function(err, newPath) {
        if (err) return cb(err);

        var orgImgUrl = imgPath.replace(dirPath + '/', '');
        var newImgUrl = newPath.replace(outDirPath + '/', '');
        map[orgImgUrl] = newImgUrl;
        cb();
      });
    }, function(err) {
      if (err) return cb(err);
      cb(null, map);
    });
  });
}

/*
 *
 */
function applyImagesMap(assetsMap, imagesMap, cb) {
  utils.eachAsset(assetsMap, function(filePath, p, cb) {
    utils.readFile(filePath, function(err, content) {
      if (err) return cb(err);

      _.each(imagesMap, function(newUrl, orgUrl) {
        content = content.split(orgUrl).join(newUrl);
      });
      
      utils.writeFile(filePath, content, cb);
    });
  }, cb);
}

/*
 *
 */
function findImages(dirPath, cb) {
  fs.readdir(dirPath, function(err, list) {
    if (err) return cb(err);

    var images = _.filter(list, function(fileName) {
      return ~fileName.indexOf('.jpg')
          || ~fileName.indexOf('.jpeg')
          || ~fileName.indexOf('.webp') //soon
          || ~fileName.indexOf('.png')
          || ~fileName.indexOf('.gif');
    });

    images = _.map(images, function(fileName) {
      return path.join(dirPath, fileName);
    });

    utils.filterDirs(list, dirPath, function(dirs) {
      dirs = _.map(dirs, function(dirName) {
        return path.join(dirPath, dirName);
      });

      async.concat(dirs, findImages, function(err, other) {
        if (err) return cb(err);
        cb(null, images.concat(other));
      });
    });
  });
}