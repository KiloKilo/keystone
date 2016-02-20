var async = require('async');
var keystone = require('../..');
var ReactEngine = require('react-engine');
var view = require('react-engine/lib/expressView');
var engine = ReactEngine.server.create({});
var request = require('superagent');
var Nightwatch = require('nightwatch/lib/index.js');

keystone.init({
	'name': 'e2e',
	'brand': 'e2e',

	'less': 'public',
	'static': 'public',
	'favicon': 'public/favicon.ico',
	'views': 'templates/views',
	'view engine': '.jsx',
	'custom engine': engine,
	'view': view,

	'auto update': true,
	'session': true,
	'auth': true,
	'user model': 'User',
	'cookie secret': 'Secret',
});

keystone.import('../models');

function checkKeystoneReady(callback, results){
	console.log('Checking if KeystoneJS ready for request.');
	request
		.get('http://localhost:3000/keystone')
		.end(callback);
}

function runNightwatch() {
	try {
		Nightwatch.cli(function(argv) {
			Nightwatch.runner(argv, function(){
				process.exit();
			});
		});
	} catch (ex) {
		console.error('\nThere was an error while starting the nightwatch test runner:\n\n');
		process.stderr.write(ex.stack + '\n');
		process.exit(2);
	}
}

keystone.start({
	onMount: function(){
		console.log('KeystoneJS Mounted Successfuly');
	},
	onStart: function() {
		console.log('KeystoneJS Started Successfully');

		// make sure keystone returns 200 before starting Nightwatch testing
		async.retry({times: 10, interval: 3000}, checkKeystoneReady, function(err, result) {
			if (!err) {
				console.log('KeystoneJS Ready!');
				runNightwatch();
			} else {
				console.log('Nightwatch tests not ran!');
				process.exit();
			}
		});
	},
});