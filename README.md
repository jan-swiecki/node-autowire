Autowire 2.0
============

Angular-like automatic dependency injection.

This module automagically autowires everything it can find.

This is beta version: API may change with minor versions, performance may suffer.

# Installation

    npm install autowire

# Usage


```javascript
Autowire = require("autowire");

// inject modules which are auto discovered
Autowire(function(fs, express) {

  // ... do stuff with autowired modules, without `require`ing them ...

  console.log(fs.existsSync("package.json"));

});
```

# Advanced features

## `alias`, `wire` and `importPaths`

```javascript
Autowire = require("autowire");

// alias
// -----
// Alias names. Here `lodash` will be requiered in place of `_`.
Autowire.alias("_", "lodash");

// wire
// ----
// Directly wire names to values, so `myVar` will be injected with `{"awesome": "dude!"}`
Autowire.wire("myVar", {"awesome": "dude!"});

// importPaths
// -----------
// Add module discovery importPath (relative to current module)
// E.g. lets say that `./module/DbModel.js` file exists.
Autowire.addImportPath("./module");

Autowire(function(fs, express, _, myVar, DbModel) {

  console.log(myVar); // {"awesome": "dude!"}
  console.log(_); // lodash object
  console.log(DbModel) // required ./module/DbModel.js

});
```

## `module.exports`

```javascript
// simple
module.exports = Autowire(function(fs, express, _, myVar) {

    // this will be returned from Autowire function
    return {
        test: function(x) {
            console.log("x =", x);
        }
    };

});
```

## Module auto discovery algorithm

Lets say we want' to inject `name`.

    1. Try `inner_cache[name]` (hit Autowire inner cache)
    2. Try `require(name)`
    3. Construct search space of impot paths:
    
       importPaths = ["./", "./lib"] ++ [added import paths] ++ ["../", "../../", "../../../", ... until we find first parent folder with package.json]
       extensions  = [".js", ".json"]
    
    2. Try all combinations for all x and y: require( importPaths[x] + name + extensions[y] )
    3. Return first found module

## Caching

Beside native NodeJS module cache Autowire caches paths and performes autodiscovery once.