var log = require("./../lib/SimpleLogger.js").getLogger();

Autowire = require("./../index.js");

// auto wire core modules
Autowire(function(fs) {

  // ... do stuff with core modules, without `require`ing them ...

  log(fs.existsSync("package.json"));

});
