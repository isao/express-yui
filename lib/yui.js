/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint node:true, nomen: true */

/**
The `yui` middleware provides the foundation and some basic
features to attach information into the `res.locals` object
that could be used to boot `YUI` in the client runtime.

@module yui
**/

'use strict';

var utils   = require('./utils'),
    cdn     = require('./cdn'),
    seed    = require('./seed'),
    origin  = require('./origin'),
    groups  = require('./groups');

/**
The `yui` middleware provides the foundation and some basic
features to attach information into the `res.locals` object
that could be used to boot `YUI` in the client runtime.

When the `"seed"` sub-module is used, it will automatically
mix itself into `yui.expose()`, and it exposes a local variable
in a form of an array of object with the information to
build the script tag or tags that forms the seed:

The following is an example of how these features can be used:

    // Creates a new express app.
    var app = express();

    // Initialize yui middleware
    yui({}, 'path/to/yui/folder');

    // Set some basic configs
    app.use(yui.applyConfig({
        fetchCSS: false
    }));

    // Use helpers to do advanced configurations
    app.use(yui.debugMode());

    // Call expose middleware when a route match.
    app.get('/index.html', yui.expose(), anotherRoute);

In the example above, the few things will be exposed
thru `res.locals.*`, which means you can use it in your
templates by doing something like this:

    <script>
    YUI({{{yui_config}}}).use('node', function (Y) {
        Y.one('#content').setContent('<p>Ready!</p>');
    });
    </script>

In this particular case, `yui_config` will hold all the
appropiated settings generated by `yui` middleware and
its extensions.

@class yui
@static
@uses *express, *express-expose, utils, cdn, seed, origin
*/
function yui(config, path) {

    var YUI;

    // getting yui.locals ready is a one time operation
    if (yui.locals) {
        throw new Error("Multiple attemps to call `yui()`." +
            "Only one `yui` is allow per app.");
    }

    yui.locals = {};

    config = yui.config(config);

    if (path) {
        try {
            YUI = require(path);
        } catch (e1) {
            throw new Error('Error trying to require() yui from ' + path);
        }
    } else {
        // by default, we will try to pick up `yui` package that
        // is peer to `modown-yui` package if exists.
        try {
            YUI = require(__dirname + '/../../yui');
        } catch (e) {
            throw new Error('Error trying to require() yui from the app folder. ' +
                'You can install yui at the app level or specify the path by doing ' +
                '`modown.yui({}, "to/custom/yui/")`');
        }
    }

    yui.YUI  = YUI.YUI;
    yui.version = YUI.YUI.version;
    yui.path = YUI.path();
    console.log('Using yui@' + yui.version + ' from [' +
        yui.path + '].' + (path && ' To customize this use ' +
        '`modown.yui({}, "to/custom/yui/")` to control it.'));

    // for better readibility, we expose the version
    config.version = config.version || yui.version;

    return yui;

}

/**
Turns on debug mode for YUI Loader by setting
`debug=true`, `logLevel="debug"` and `filter="debug"`
into the static configuration. More available settings
[in the YUI API Docs](http://yuilibrary.com/yui/docs/api/classes/config.html).

    app.use(yui.debug({}));

@method debugMode
@param {Object} config optional object to overrule
specific settings when in debug mode.

    @param {boolean} config.debug default to `true`
    @param {string}  config.logLevel default to `"debug"`
    @param {string}  config.filter default to `"debug"`

@return {function} express middleware
**/
yui.debugMode = function (config) {

    // storing static config
    yui.config({
        debug: true,
        logLevel: 'debug',
        filter: 'debug'
    }, config);

    return false;

};

/**
Extends the static configuration with the supplier
object(s). You can use it like this:

    // Disable CSS computations
    app.use(yui.applyConfig({
        fetchCSS: false
    }));

@method applyConfig
@public
@param {Object*} supplier objects to be mixed with the
static configuration. All available settings
[from the YUI API Docs](http://yuilibrary.com/yui/docs/api/classes/config.html).
can be used here.

@return {function} express middleware
**/
yui.applyConfig = function (supplier) {
    var locals = yui.locals,
        args = Array.prototype.slice.call(arguments);

    if (!locals) {
        throw new Error('yui() should happen before.');
    }

    if (!locals.yui) {
        locals.yui = {};
    }
    if (supplier) {
        args.unshift(locals.yui);
        utils.extend.apply(utils, args);
    }

    return false;
};

/**
Extends the static configuration with the supplier object(s)
or returns the current static configuration reference. This
configuration is static, and attached to the server object.
Once you call `yui.expose()`, this configuration becomes
inmutable.

@method config
@protected
@param {Object*} supplier Optional supplier objects
that, if passed, will be mix with the static configuration.
@return {object} static configuration
**/
yui.config = function (supplier) {

    var locals = yui.locals,
        args = Array.prototype.slice.call(arguments);

    if (!locals) {
        throw new Error('yui() should happen before.');
    }

    if (!locals.yui) {
        locals.yui = {};
    }
    if (supplier) {
        args.unshift(locals.yui);
        utils.extend.apply(utils, args);
    }

    return locals.yui;

};

/**
Exposes `res.locals.yui_config` string with the serialized
configuration computed based on all the calls to `yui.*`
helpers. This method will be invoked by `yui.expose()`
automatically, which means you should not call it directly.

@method exposeConfig
@protected
@return {function} express middleware
**/
yui.exposeConfig = function () {

    // getting static config
    var config = yui.config(),
        configCache;

    // caching the serialized version of the configuration
    // note: other changes after this point will not
    // be reflected in the config that will be exposed.
    configCache = utils.serialize(config);

    return function (req, res, next) {

        var yui_config = configCache;

        if (res.locals.yui) {
            // if there is a custom setting per request, then
            // there is a perf penalty because we need to clone,
            // mix and serialize per request :(
            yui_config = utils.extend(utils.clone(config), res.locals.yui);
            yui_config = utils.serialize(yui_config);
        }

        // exposing the serialized version of the config
        res.locals.yui_config = yui_config;

        next();

    };

};

/**
Exposes different data structures thru `res.locals.*`,
all of them will be prefixed with `yui_` to avoid collitions.
E.g: `res.locals.yui_seed` and `res.locals.yui_config`.
Each of these structures could be string, array or object.

@method expose
@public
@return {function[]} express middleware collection
**/
yui.expose = function () {
    return [this.exposeConfig(), this.exposeSeed()];
};

utils.extend(yui, cdn, seed, origin, groups);

module.exports = yui;