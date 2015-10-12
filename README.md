Autowire 2.2 (beta)
===================

[![Build Status](https://api.travis-ci.org/jan-swiecki/node-autowire.svg?branch=master)](https://travis-ci.org/jan-swiecki/node-autowire)

Angular-like automatic dependency injection for NodeJS.

Buzzwords: Easy to use, Rapid prototyping, Easy decoupling, Focus On Things That Matter<sup>TM</sup>

This module automagically autowires everything it can find. It finds installed modules (native node discovery) and user modules in current project folders. It also auto instantiates and injects class instances.

This is beta version: API may change with minor versions, performance may suffer.

## Installation

    npm install autowire

## Usage


```javascript
Autowire = require("autowire");

// inject modules which are auto discovered
Autowire(function(fs, express, MyLib) {

  // ... do stuff with autowired modules, without `require`ing them ...

  // MyLib.js location is auto discovered in project directory tree

  console.log(fs.existsSync("package.json"));

});
```

## Advanced features

### `alias` and `wire`

```javascript
Autowire = require("autowire");

// Alias names. Here `lodash` will be requiered in place of `_`.
Autowire.alias("_", "lodash"); // this is an example, but _ is already automatically aliased

// Directly wire names to values, so `myVar` will be injected with `{"awesome": "dude!"}`
Autowire.wire("myVar", {"awesome": "dude!"});

Autowire(function(fs, express, _, myVar, DbModel) {

  // DbModel is auto discovered in project directory tree
  // and if it is not found error is thrown

  console.log(myVar); // {"awesome": "dude!"}
  console.log(_); // lodash object
  console.log(DbModel) // required ./module/DbModel.js

});
```

### Autowire return value

In simplest terms

```javascript
var x = Autowire(function(fs) { return fs; });

console.log(x === require('fs')); // true
```

So when we create new module we can easily export it with `module.exports`:

```javascript
// ./lib/some/path/Test.js
module.exports = Autowire(function(fs, express, _, myVar) {

  // this will be attached to module.exports
  return {
    test: function(x) {
      console.log("x =", x);
    }
  };

});

// ./index.js
Autowire(function(Test) {
  Test.test(1337); // outputs to console: x = 1337
});
```

### Class auto instantiation

You can mark a class for auto instantiation with automatic dependency injection.

**Example**

```javascript
// ./lib/leet.js
module.exports = 1337;

// ./lib/MyClass.js
function MyClass(fs, leet) {
    this.fs = fs;
    this.leet = leet;
}

MyClass.autowire = {
  instantiate: true,
  
  // if set to true then class is instatiated only once for multiple injections
  singleton: false
};

module.exports = MyClass;

// ./index.js
Autowire = require("autowire");

Autowire(function(MyClass) {
    console.log(MyClass.fs.existsSync("index.js")); // true
    console.log(MyClass.leet); // 1337
});
```

Note: on each `Autowire` execution same class will be instantiated **each time** (cache won't work). If you want to have singleton behaviour set `autowire.singleton` to `true` on class object (e.g. `MyClass.autowire = { instantiate: true, singleton: true };`).

### `Autowire.getModuleByName(name)`

Autowire can auto find a module by name. Just do `var MyLib = Autowire.getModuleByName('MyLib');`.

This is a syntactic sugar for `var MyLib = Autowire(new Function("MyLib", "return MyLib;"));`.

### `Autowire.include(path)` i.e. include submodules of a module or include module at different path

```javascript
// equivalent to require("urijs/src/URITemplate")
Autowire.include("urijs/src/URITemplate");

Autowire.include("/some/absolute/path/of/node-uuid");
Autowire.include("nodeUuid/some/sub/path/MyLib");

Autowire(function(URITemplate, nodeUuid, MyLib) {
  var uriTemplate = new URITemplate();
  var uuid = nodeUuid.v4();
});

```

### Caching

Beside native NodeJS module cache Autowire caches paths and performes autodiscovery only once.

## Why?

Imho this is just a better approach.

* You don't waste time on manually resolving module relative paths.
* You don't waste time on manually wiring dependencies.
* Module dependencies are clearly and well defined (no more finding all `require` invocations).
* You are forced to write code in a decoupled way (true dependency injection, without classes being instantiated inside constructors).
* Lexical-clojure encapsulation of modules makes more sense.
* You make your code DRYier (you write module name only once).
* Auto discovery is awesome!:D
* ???
* Profit!

## Module auto discovery algorithm

Let's say we want to inject `name`.

  Note: if `name` is an alias it will be first converted to aliased name, i.e. `name = alias[name]`.

  1. Find project root as the first folder up the directory structure with `package.json`. E.g. if we are at `/a/b/c/d` and there exists `/a/b/package.json` then `/a/b` is project root.
  2. Map all file names to their absolute paths (ignore node_modules) and call it `name_cache`.
  3. Try `inner_cache[name]` (hit Autowire inner cache)
  4. Try to get path from `name_cache[name]` - if found then try to `require(name_cache[name])`
  5. Try `require(name)`
  6. If any try is successful:
    * If found module is a function with `autowire.instantiate` set to `true`
      * Instantiate as class instance
      * If `autowire.singleton` is `true` then put instance inside `inner_cache`: `inner_cache[name] = instance`
      * Return instance
    * Else
      * Save found module in `inner_cache`: `inner_cache[name] = found_module`
      * Return found module

## TODO

* <s>Auto discovery inside project folders (recursively)</s> Done since version 2.2
* <s>Auto instantiation of classes (configurable)</s> Done since version 2.2
* <s>Auto convert dash-case into camelCase, so e.g. we can with zero config inject `node-uuid` as `nodeUuid`.</s> Done since version 2.2
* Somehow allow having same file names in different folders. Proposition: create namespaces as folders (and manually configurable namespaces). (Non?)-problem: variable names don't have `/` character.
* Write tests per module (e.g. tests for `ModuleFinder`)
* ECMAScript 6 support

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