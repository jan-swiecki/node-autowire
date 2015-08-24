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

Lets say we want to inject `name`.

    1. Try `inner_cache[name]` (hit Autowire inner cache)
    2. Try `require(name)`
    3. Construct search space of import paths:
    
       importPaths = ["./", "./lib"] ++ [added import paths] ++ ["../", "../../", "../../../", ... until we find first parent folder with package.json]
       extensions  = [".js", ".json"]
    
    2. Try all combinations for all x and y: require( importPaths[x] + name + extensions[y] )
    3. Return first found module

## Caching

Beside native NodeJS module cache Autowire caches paths and performes autodiscovery once.

# Why?

1. It is simpler
  * You get module autodiscovery in project folders
  * You write module name only once
2. Lexical-clojure encapsulation of modules makes more sense. For example now you are 100% sure you will not leak anything into global scope.
3. ???
4. Profit!

## License

The MIT License (MIT) Copyright (c) 2015 Jan ?wi?cki

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.