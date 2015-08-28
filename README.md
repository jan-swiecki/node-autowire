Autowire 2.1 (beta)
===================

Angular-like automatic dependency injection for NodeJS.

Buzzwords: Easy to use, Rapid prototyping, Easy decoupling, Focus On Things That Matter<sup>TM</sup>

This module automagically autowires everything it can find. It finds installed modules (native node discovery) and user modules in current project folders. It also auto instantiates and injects class instances.

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

## classes auto instantiation via `markAsClass` and `wireClass`

* `Autowire.markAsClass("MyClass")` to mark class with name `MyClass` to be auto insantiated
* `Autowire.wireClass("MyInstance", MyClass)` to `wire` `MyClass` to name `MyInstance` with auto instantiation

**Example**

```javascript
// ./lib/OtherLib.js
module.exports = 1337;

// ./lib/MyClass.js
function MyClass(fs, OtherLib) {
    this.fs = fs;
    this.OtherLib = OtherLib;
}

module.exports = MyClass;

// ./index.js
Autowire = require("autowire");
Autowire.markAsClass("MyClass");

Autowire(function(MyClass) {
    console.log(MyClass.fs.existsSync("index.js")); // true
    console.log(MyClass.OtherLib); // 1337
});
```

Note: on each `Autowire` execution same class will be instantiated **each time** (cache won't work). If you want to have singleton behaviour pass `true` to `wireClass` or `markAsClass` as last parameter. E.g. `Autowire.markAsClass("MyClass", true)`.

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

Imho this is just a better approach.

* You don't waste time on manually resolving module relative paths.
* You don't waste time on manually wiring dependencies.
* You are forced to write code in a decoupled way (true dependency injection, without classes being instantiated inside constructors).
* Auto discovery is just awesome!:D
* You make your code DRYier (you write module name only once).
* Lexical-clojure encapsulation of modules makes more sense. For example now you are 100% sure you will not leak anything into global scope.
* ???
* Profit!

## TODO

* Auto discovery inside project folders (recursively)
* Auto instantiation of classes (configurable)
* Auto convert dash-case into camelCase, so e.g. we can with zero config inject `node-uuid` as `nodeUuid`. Maybe add auto discovery with partial matching, so `uuid` will match?
* Somehow allow having same file names in different folders. Proposition: create namespaces as folders (and manually configurable namespaces). (Non?)-problem: variable names don't have `/` character.
* Write tests per module (e.g. tests for `ModuleFinder`)

## License

The MIT License (MIT) Copyright (c) 2015 Jan Święcki

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