var fs = require('fs'),
	glob = require('glob'),
	path = require('path'),
	colors = require('colors'),
	Promise = require('whenplus'),
	PromiseObject = require('promise-object')(Promise),
	Cubby = require('cubby'),
	cache = new Cubby({file: '.ccsscache'}),
	path = require('path'),
	ccss = require('component-css');

var CCSSTask = PromiseObject.create({
	initialize: function (files, dest, callback) {
		fs.lstat(dest, function (error, stat) {
			this.outputFile = dest;
			
			this.files = files;

			this.compileFiles().done(function () {
				callback();
			});
		}.bind(this));
	},

	$compileFilePairs: function ($deferred, $class, filePairs) {
		// make all dirs needed
		var dirs = $class.getAllDirsFromFilePairs(filePairs);
		dirs.forEach(function (dir) {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}
		});

		// compile all file pairs
		Promise.map(filePairs, $class.compileFilePair).done($deferred.resolve, $deferred.reject);
	},

	$compileFilePair: function ($deferred, filePair) {
		var instance = new CCSSTask(filePair.src, filePair.dest, function () {
			$deferred.resolve();
		});
	},

	$getAllDirsFromFilePairs: function ($class, filePairs) {
		var dirs = [],
			files = $class.getAllFilesFromFilePairs(filePairs);
		
		files.forEach(function (filePath) {
			var isDir = filePath.match(/\/$/);

			filePath.split('/').forEach(function (part, index, array) {
				if (part && (index !== array.length-1 || isDir && index === array.length-1)) {
					var dir = array.slice(0, index + 1).join('/') + '/';
					if (dirs.indexOf(dir) === -1) {
						dirs.push(array.slice(0, index + 1).join('/') + '/');
					}
				}
			});
		});
		
		return dirs;
	},

	$getAllFilesFromFilePairs: function (filePairs) {
		return Array.prototype.concat.apply([], filePairs.map(function (file) {
			return file.dest;
		}));
	},

	compileFiles: function ($deferred, $self) {
		Promise.map(this.files, $self.readFileAndWriteToCSS).done(function () {
			$deferred.resolve();
		});
	},

	readFileAndWriteToCSS: function ($deferred, $self, file) {
		var cachedInfo = cache.get(file, true),
			componentName = path.basename(file).split('.')[0];

		if (cachedInfo) {
			var lastChanged = fs.statSync(file).mtime.getTime(),
				changed = lastChanged != cachedInfo.timestamp;

			if (!changed) {
				fs.appendFileSync($self.outputFile, cachedInfo.source);
				return $deferred.resolve();
			}
		}

		fs.readFile(file, 'utf8', function (error, source) {
			fs.writeFile($self.outputFile, ccss({prefix: 'react-', name: componentName, data: source || ' '}), function (err) {
				console.log(('built Style("' + componentName + '")').cyan);
				$deferred.resolve();
			});
		});
	}
});


module.exports = function(grunt) {
	var config = grunt.config.get('ccss').options;

	grunt.registerMultiTask('ccss', 'Compile ccss files to css.', function(target) {
		var callback = this.async();

		CCSSTask.compileFilePairs(this.files).done(function () {
			callback();
		});
	});
};