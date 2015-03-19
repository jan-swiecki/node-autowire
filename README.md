Autowire
========

Automagically autowire everything.

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
