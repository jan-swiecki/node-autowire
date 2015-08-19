Autowire
========

Automagically autowire everything.

This is alpha version, API may change drastically with major versions.

Installation
------------

    npm install autowire

Usage
-----

```javascript
Autowire = require("autowire");

// auto wire core modules or any modules available in node_modules or at paths ./*, ./lib/*
Autowire(function(fs, express) {

  // ... do stuff with autowired modules, without `require`ing them ...

  console.log(fs.existsSync("package.json"));

});



```
