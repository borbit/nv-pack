/**
 * Module dependencies.
 */
var program = require('commander')
  , sprintf = require('sprintf').sprintf
  , utils = require('../utils')
  , async = require('async')
  , path = require('path')
  , _ = require('lodash')
  , fs = require('fs');

// short cut for the utils.log
var log = utils.log;
// short cut for the utils.falog
var falog = utils.falog;
// curent working directory
var cwd = process.cwd();
var cfg;

/**
 * Loading config
 */
try {  
  if (program.config) {
    cfg = require(program.config);
  } else {
    cfg = require(path.join(cwd, '/config'));
  }
} catch (e) {
  console.error(" error: cannot find config file");
  process.exit(1);
}

/*
 *
 */
module.exports = function(scope, cb) {
  async.waterfall([
    function(cb) {
      getPagesToPack(program.args, cfg.PAGES_ROOT, function(err, pages) {
        if (err) return cb(err);
        scope.pages = pages;
        cb();
      });
    },
    function(cb) {
      buildPagesDist(scope.pages, scope.tmpDir, function(err, assetsMap) {
        if (err) return cb(err);
        scope.assetsMap = assetsMap;
        cb();
      });
    }
  ], cb);
};


/**
 * Returns names list of pages to pack basing on the existing
 * pages and pages names passed through the first argument, returns
 * error of at least one of passed pages is not exist. Addes "cmn"
 * page to the list if particular pages are not passed.
 *
 * @param cb function
 */
function getPagesToPack(pages, rootPath, cb) {
  getExistingPages(rootPath, function(err, existing) {
    if (err) return cb(err);
    if (pages.length) {
      _.each(pages, function(page) {
        if (!~existing.indexOf(page)) {
          cb(new Error('cannot find page ' + page));
          return false;
        }
      });
    } else {
      pages = existing.concat('cmn');
    }
    cb(null, pages);
  });
}

/**
 * Looks through the pages directory and
 * returns names list of existing pages
 *
 * @param cb function
 */
function getExistingPages(rootPath, cb) {
  async.waterfall([
    function(cb) {
      fs.readdir(rootPath, cb);
    },
    function(files, cb) {
      var pages = [];

      async.forEach(files, function(file, cb) {
        fs.stat(path.join(rootPath, file), function(err, stat) {
          if (err) return cb(err);
          if (stat.isDirectory()) {
            pages.push(file);
          }
          cb();
        });
      }, function(err) {
        if (err) return cb(err);
        cb(null, pages);
      });
    }
  ], cb);
}

/*
 *
 */
function buildPagesDist(pages, dir, cb) {
  var map = {};
  var groups = {
    css : ['base', 'ie7', 'ie8', 'ie9'],
    js  : ['base', 'ie7', 'ie8', 'ie9']
  };

  async.forEachSeries(pages, function(page, cb) {
    buildPageDist(page, groups, dir, function(err, files) {
      map[page] = files;
      cb(err);
    });
  }, function(err) {
    if (err) return cb(err);
    cb(null, map);
  });
}

/*
 *
 */
function buildPageDist(page, groups, dir, cb) {
  log(' ...packing %s:', page);

  var res = {css: {}, js: {}};

  async.series([
    function(cb) {
      async.forEachSeries(groups.css, function(group, cb) {
        log('   • css %s', group);
        buildCssDist(page, group, dir, function(err, files) {
          if (err) return cb(err);
          if (files.length) res.css[group] = files;
          cb();
        });
      }, cb);
    },
    function(cb) {
      async.forEachSeries(groups.js, function(group, cb) {
        log('   • js %s', group);
        buildJSDist(page, group, dir, function(err, files) {
          if (err) return cb(err);
          if (files.length) res.js[group] = files;
          cb();
        });
      }, cb);
    }
  ], function(err) {
    if (err) return cb(err);
    cb(null, res);
  });
}

/*
 *
 */
function buildCssDist(page, group, dir, cb) {
  var srcs = getSources(page)
    , csses = srcs['css_' + group]
    , lesses = srcs['less_' + group];

  if ((!csses || !csses.length) &&
      (!lesses || !lesses.length)) {
    log('   \033[90m✘ nothing to build here\033[39m');
    return cb(null, []);
  }

  var dist = path.join(dir, sprintf('%s.%s.css', page, group));

  async.waterfall([
    function(cb) {
      collectCss(csses, dist, cb);
    },
    function(stat, cb) {
      stat && falog('concatted *.css files\t\t\t', stat);
      compileLess(lesses, srcs.includes, dist, cb);
    },
    function(stat, cb) {
      stat && falog('compiled *.less files\t\t\t', stat);
      buildSprites(dist, cb);
    },
    function(stat, cb) {
      stat && falog('built sprites with Tailor\t\t\t', stat);
      optimizeCSS(dist, cb);
    },
    function(stat, cb) {
      stat && falog('optimized with CSSO\t\t\t', stat);
      embedBase64(dist, cb);
    },
    function(stat, cb) {
      stat && falog('embedded images and asset hosts\t\t', stat);
      cb(null, dist);
    }
  ], cb);
}

/*
 *
 */
function collectCss(files, dist, cb) {
  if (!files || !files.length) {
    return cb(null, null);
  }

  files = _.map(files, function(file) {
    return cfg.STATIC_ROOT + '/' + file;
  });

  async.waterfall([
    function(cb) {
      utils.concatFiles(files, cb);
    },
    function(css, cb) {
      utils.appendFile(dist, css, cb);
    }
  ], cb);
}

/*
 *
 */
function compileLess(lesses, inclds, dist, cb) {
  if (!lesses || !lesses.length)
    return cb(null, null);

  var dir = cfg.STATIC_ROOT + '/';
  var files = [];

  files = files.concat(inclds || []);
  files = files.concat(lesses);

  var less = require('less');

  async.waterfall([
    function(cb) {
      // Cancat all less files before rendering and patch
      // all the image urls to be relative to the static dir
      async.concatSeries(files, function(file, cb) {
        utils.readFile(dir + file, cb);
      }, cb);
    },
    function(cont, cb) {
      less.render(cont.join(''), cb);
    },
    function(css, cb) {
      utils.appendFile(dist, css, cb);
    }
  ], cb);
}

/*
 *
 */
function optimizeCSS(file, cb) {
  var ccso = require('csso');

  async.waterfall([
    function(cb) {
      utils.readFile(file, cb);
    },
    function(cont, cb) {
      utils.writeFile(file, ccso.justDoIt(cont), cb);
    }
  ], cb);
}

/*
 *
 */
function buildSprites(filePath, cb) {
  try {
    var tailor = require('tailor');
  } catch (err) {
    return cb(null, null);
  }

  tailor([filePath], {
    outDirPath: path.dirname(filePath)
  , rootDirPath: cfg.STATIC_ROOT
  }, function(err, files) {
    if (err) return cb(err);
    if (files[0].length == 1) {
      return cb(null, null);
    }
    fs.stat(filePath, cb);
  });
}

/*
 *
 */
function embedBase64(file, cb) {
  var enhance;
  enhance = require('enhance-css');
  enhance = new enhance({
    assetHosts: cfg.ASSETS_HOSTS
  , rootPath: cfg.STATIC_ROOT
  , stamp: !!program.stamp
  });

  async.waterfall([
    function(cb) {
      utils.readFile(file, cb);
    },
    function(cont, cb) {
      enhance.process(cont, cb)
    },
    function(cont, cb) {
      utils.writeFile(file, cont.embedded.plain, cb);
    }
  ], cb);
}

/*
 *
 */
function buildJSDist(page, group, dir, cb) {
  var srcs = getSources(page);
  var jses = srcs['js_' + group];

  if (!jses || !jses.length) {
    log('   \033[90m✘ nothing to build here\033[39m');
    return cb(null, []);
  }

  var dist = path.join(dir, sprintf('%s.%s.js', page, group));

  collectJS(jses, dist, function(err, stat) {
    if (err) return cb(err);

    falog('concatted *.js files\t\t\t', stat);

    if (program.readable) {
      return cb(null, dist);
    }
    
    compressJS(dist, function() {
      falog('compressed with UglifyJS\t\t\t', stat);
      cb(null, dist);
    });
  });
}

/*
 *
 */
function collectJS(files, dist, cb) {
  files = _.map(files, function(file) {
    return cfg.STATIC_ROOT + '/' + file;
  });

  async.waterfall([
    function(cb) {
      utils.concatFiles(files, cb);
    },
    function(css, cb) {
      utils.appendFile(dist, css, cb);
    }
  ], cb);
}

/*
 *
 */
function compressJS(file, cb) {
  var jsp = require("uglify-js").parser;
  var pro = require("uglify-js").uglify;

  async.waterfall([
    function(cb) {
      utils.readFile(file, cb);
    },
    function(cont, cb) {
      var ast = jsp.parse(cont);

      ast = pro.ast_mangle(ast);
      ast = pro.ast_squeeze(ast);

      utils.writeFile(file, pro.gen_code(ast), cb);
    }
  ], cb);
}

/*
 *
 */
function getSources(name) {
  if (name == 'cmn') {
    return require(getCmnSrcsPath());
  } else {
    return _.extend({}, require(getPageSrcsPath(name)),
      _.pick(require(getCmnSrcsPath()), 'includes'));
  }
}

/*
 *
 */
function getPageSrcsPath(name) {
  return sprintf('%s/%2$s/%2$s.json', cfg.PAGES_ROOT, name);
}

/*
 *
 */
function getCmnSrcsPath() {
  return sprintf('%s/cmn.json', cfg.PAGES_ROOT);
}