/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint node:true, nomen: true */

/**
The `express-yui.server` extension that provides a set of features
to control a YUI instance on the server side.

@module yui
@submodule server
**/

'use strict';

var libpath = require('path'),
    utils = require('./utils'),
    debug = require('debug')('express:yui:server'),
    groupsQueue = {},
    modulesQueue = [];

/**
The `express-yui.server` extension that provides a set of features
to control a YUI instance on the server side.

@class server
@static
@uses *path, utils
@extensionfor yui
*/
module.exports = {

    /**
    Add a group and its modules into the server Y instance or
    updates the current Y instance by re-adding them.

    @method registerModules
    @public
    @param {string} groupName The bundle/group name to be attached.
    @param {Object} groupModules The modules meta for the group.
    @chainable
    **/
    registerModules: function (groupName, groupModules) {
        var YUIEnv = this.YUI && this.YUI.Env,
            version = this.version,
            YEnv = this._Y && this._Y.Env,
            module;

        groupsQueue[groupName] = {
            modules: groupModules
        };

        if (YEnv && YUIEnv) {
            for (module in groupModules) {
                if (groupModules.hasOwnProperty(module)) {
                    // if the module was attached already, we should clean up the loader internal hashes
                    if (YEnv._attached && YEnv._attached[module]) {
                        // instance entries
                        delete YEnv._attached[module];
                        delete YEnv._used[module];
                        delete YEnv._loader.loaded[module];
                        delete YEnv._loader.inserted[module];
                        delete YEnv._loader.required[module];
                        // global entries
                        delete YUIEnv._loaded[version][module];
                        delete YUIEnv.mods[module];
                        // TODO: can we optimize this? delete is evil
                    }
                }
            }
        }

        return this;
    },

    /**
    Attach modules into the Y instance on the server. This is equivalent to call
    `req.app.yui.use(moduleName)` for every module in `mods`, but it
    does queue them until the first `Y` gets ready to be used.

    @method attachModules
    @public
    @param {array} mods The list of modules to be attached.
    @chainable
    **/
    attachModules: function (mods) {
        var Y = this._Y;

        modulesQueue = modulesQueue.concat(mods || []);

        if (Y) {
            try {
                Y.use(modulesQueue);
            } catch (e) {
                console.error('error attaching modules: ' + mods);
                console.error(e);
                console.error(e.stack);
            } finally {
                modulesQueue = [];
            }
        }

        return this;
    },

    /**
    Creates a YUI Instance and attaches all registered modules for all registered
    groups into it, and optional attaches some more modules my mimicing the original
    YUI.use method.

    @method use
    @public
    @return {Object} Y instance
    **/
    use: function () {
        var config = this.config(),
            Y = this._Y,
            groupName,
            obj,
            modules,
            callback;

        for (groupName in groupsQueue) {
            if (groupsQueue.hasOwnProperty(groupName) && (config.groups && config.groups.hasOwnProperty(groupName))) {
                // we don't want obj to be set if we are not sure we have
                // at least one group config to be applied
                obj = obj || { groups: {}, useSync: true };
                obj.groups[groupName] = utils.extend(groupsQueue[groupName], utils.clone(config.groups[groupName]), {
                    base: libpath.join(this._groupFolderMap[groupName], '/'),
                    combine: false
                });
            }
        }

        if (!Y) {
            config = utils.clone(config);
            config.groups = {}; // disabling the groups that will be added later on
            this.YUI.applyConfig(config);
            this.YUI.applyConfig({
                base: libpath.normalize(this.path + '/'),
                combine: false
            });
            this.YUI.applyConfig(obj);
            Y = this._Y = this.YUI({
                useSync: true,
                loadErrorFn: function (Y, i, o) {
                    debug('--> Something really bad happened when trying to load yui modules on the server side');
                    debug('--> ' + o.msg);
                    if (Y.config.modules) {
                        debug('--> Y.config.modules = ' + JSON.stringify(Y.config.modules));
                    }
                    if (Y.config.groups) {
                        debug('--> Y.config.groups = ' + JSON.stringify(Y.config.groups));
                    }
                }
            });
        } else if (obj) {
            this.YUI.applyConfig(obj);
            Y.applyConfig(obj);
        }

        // attaching modules
        // in case a callback is passed, we should consider that
        modules = Array.prototype.slice.call(arguments, 0);
        if (modules.length > 0 && (typeof modules[modules.length - 1] === 'function')) {
            callback = modules.pop();
        }
        modulesQueue = modulesQueue.concat(modules);
        if (modulesQueue.length) {
            try {
                Y.use(modulesQueue);
            } catch (e) {
                console.error('error attaching modules: ' + modulesQueue);
                console.error(e);
                console.error(e.stack);
            }
        }

        // reseting the queues
        modulesQueue = [];
        groupsQueue = {};

        if (callback) {
            callback(Y);
        }

        return Y;

    }

};
