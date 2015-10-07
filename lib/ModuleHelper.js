var PATH = require("path");
var stackTrace = require("stack-trace");
var _ = require("lodash");

module.exports = {
  getParentModule: function (depth) {
    // get unique filename call stack
    var paths = module.exports.getUniqueFilenameStackTrace();

    // we work relative to parent path,
    // so we remove ModuleHelper from stack trace
    paths = _.slice(paths, 1, paths.length);

    if (depth < paths.length) {
      var path = paths[depth];
      var m = require.cache[path];

      if(! m && require.main.filename === path) {
        m = require.main;
      }

      return m ? m : null;
    } else {
      return null;
    }
  },
  getUniqueFilenameStackTrace: function() {
    return _(stackTrace.get())
      .map(function (x) {
        return x.getFileName();
      }).reject(function (path) {
        return path === "module.js" || path === "node.js"
      }).uniq()
      .value();
  },
  getFilenameStackTrace: function() {
    return _(stackTrace.get())
      .map(function (x) {
        return x.getFileName();
      })
      .value();
  },
  getStackTrace: function() {
    return _(stackTrace.get())
      .map(function (x) {
        return x.getFileName()+":"+x.getLineNumber();
      })
      .value();
  }
};