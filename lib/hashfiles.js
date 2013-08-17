/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var fs = require('fs'),
    path = require('path'),
    hashfile = require('./hashfile');


/**
 * Get a cryptographic hash for each module in a shifter build directory.
 * @param {string} dir Full path to shifter's build directory
 * @param {string} suffix The suffix (like '-min.js') of the shifter-generated
 * module file to generate a hash.
 * @param {string} algo Hashing algorithm, i.e. 'md5', 'sha1'… See hashfile.js
 * @param {function} callback
 * @example: get the md5 hash of every "-min.js" file
 *
 *      // where dir looks like this:
 *      ├── moduleA
 *      │   ├── moduleA-debug.js
 *      │   ├── moduleA-min.js
 *      │   └── moduleA.js
 *      ├── this_will_be_ignored
 *      ├── moduleB
 *      │   ├── moduleB-debug.js
 *      │   ├── moduleB-min.js
 *      │   └── moduleB.js
 *      └── moduleC
 *          ├── moduleC-debug.js
 *          ├── moduleC-min.js
 *          └── moduleC.js
 *
 *      // method call:
 *      process(dir, '-min.js', 'md5', function(err, hashes, invalid) {
 *          console.log('hashed files\n', hashes);
 *          console.log('invalid things\n', invalid);
 *      });
 *
 *      // output like:
 *      hashed files
 *       {'moduleA': '4e5576ad323511fe16bcff59df25f61f',
 *        'moduleB': '007848ef03a610df740a9b8e5d4f8fbf',
 *        'moduleC': '90ff3546ad61b28a338c49151d05ec62' }
 *      invalid things
 *       {'/path/to/dir/bundleDir/this_will_be_ignored/this_will_be_ignored-min.js': 'ENOTDIR' }
 */
function process(dir, suffix, algo, callback) {
    var hashes = {},
        invalid = {},
        count = 0;

    function afterHash(err, hash, pathname) {
        var modname;

        if (err) {
            invalid[err.path] = err.code;
        } else {
            modname = path.basename(path.dirname(pathname));
            hashes[modname] = hash;
        }

        if (!--count) {
            callback(null, hashes, invalid);
        }
    }

    function eachFile(dir, suffix, cb) {
        return function (item) {
            var pathname = path.join(dir, item, item + suffix);
            count++;
            hashfile(pathname, algo, cb);
        };
    }

    function afterReaddir(err, files) {
        if (err) {
            callback(err, null);
        }
        files.forEach(eachFile(dir, suffix, afterHash));
    }

    fs.readdir(dir, afterReaddir);
}


module.exoprts = process;

// var dir = '/Users/isao/Repos/modown/express-yui/examples/locator-express/build/demo';
// process(dir, '-min.js', 'md5', function(err, hashes, invalid) {
//     console.log('hashed files\n', hashes);
//     console.log('invalid things\n', invalid);
// });
