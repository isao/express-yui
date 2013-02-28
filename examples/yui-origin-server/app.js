/*jslint node:true, nomen: true*/

'use strict';

var express = require('express'),
    exphbs  = require('express3-handlebars'),
    yui     = require('../../'),
    app     = express();

// you can use a custom version of YUI by
// specifying a custom path as a second argument,
// or by installing yui at th app level using npm.
// in this example we are using the yui from
// npm's devDependencies.
yui({
    "allowRollup" : false
}, __dirname + '/../../node_modules/yui');

app.configure('development', function () {
    // when using `yui.debug()` you will get debug,
    // filter and logLevel set accordingly
    app.use(yui.debug());
    // using the express app as origin server for
    // yui core modules
    app.use(yui.serveCoreFromAppOrigin());
});

app.configure('production', function () {
    app.use(yui.serveCoreFromCDN());
});


// template engine
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

// creating a page with YUI embeded
app.get('*', yui.expose(), function (req, res, next) {
    res.render('page');
});

// listening
app.set('port', process.env.PORT || 8666);
app.listen(app.get('port'), function () {
    console.log("Server listening on port " +
        app.get('port') + " in " + app.get('env') + " mode");
});