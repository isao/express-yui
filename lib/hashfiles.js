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
 * @param {string} buildDir Full path to shifter's build directory
 * @param {string} suffix The suffix (like '-min.js') of the shifter-generated
 * module file to generate a hash.
 * @param {string} algo Hashing algorithm, i.e. 'md5', 'sha1'… See hashfile.js
 * @param {function} callback
 * @example: get the md5 hash of every "-min.js" file
 *
 *      // where buildDir looks like this:
 *      buildDir/bundleDir
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
 *      process(buildDir, '-min.js', 'md5', function(err, hashes, invalid) {
 *          console.log('hashed files\n', hashes);
 *          console.log('invalid things\n', invalid);
 *      });
 *
 *      // output like:
 *      hashed files
 *       {'/path/to/buildDir/bundleDir/moduleA/moduleA-min.js': '4e5576ad323511fe16bcff59df25f61f',
 *        '/path/to/buildDir/bundleDir/moduleA/moduleB-min.js': '007848ef03a610df740a9b8e5d4f8fbf',
 *        '/path/to/buildDir/bundleDir/moduleA/moduleC-min.js': '90ff3546ad61b28a338c49151d05ec62' }
 *      invalid things
 *       {'/path/to/buildDir/bundleDir/this_will_be_ignored/this_will_be_ignored-min.js': 'ENOTDIR' }
 */
function process(buildDir, suffix, algo, callback) {
    var hashes = {},
        invalid = {},
        count = 0;

    function afterHash(err, hash, pathname) {
        // save pathname -> result key-values in either hashes or invalid object
        (err ? invalid : hashes)[pathname || err.path] = err ? err.code : hash;
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
        files.forEach(eachFile(buildDir, suffix, afterHash));
    }

    fs.readdir(buildDir, afterReaddir);
}


module.exoprts = process;

// var buildDir = '/Users/isao/Repos/modown/express-yui/examples/locator-express/build/demo';
// process(buildDir, '-min.js', function(err, hashes, invalid) {
//     console.log('hashed files\n', hashes);
//     console.log('invalid things\n', invalid);
// });
