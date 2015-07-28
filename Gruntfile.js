'use strict';
module.exports = function(grunt) {
var gitOpts = {
  repository: "https://github.com/ging/licode.git",
  branch: "master",
  directory: "repo"
}
var VENDOR = [
  "lib/xmlhttprequest.js",
  "src/hmac-sha1.js"
];
var SRC = [
  "src/N.js",
  "src/N.Base64.js",
  "src/N.API.js"
]

grunt.initConfig({
  pkg: grunt.file.readJSON('package.json'),
  clean: {
    post_build: [
      'src/',
      'tools/',
      'lib/'
    ],
    full: [
      'repo/*',
      'build/*'
    ]
  },
  jshint: {
    options: {
      jshintrc: '.jshintrc'
    },
    all: SRC
  },
  uglify: {
    dist: {
      files: {
        'dist/nuve.all.min.js': 'dist/nuve.all.js',
        'dist/nuve.min.js': 'dist/nuve.js'
      }
      // ,options: {
      //   // JS source map: to enable, uncomment the lines below and update sourceMappingURL based on your install
      //   sourceMap: 'dist/nuve.full.min.js.map',
      //   sourceMappingURL: 'dist/nuve.full.min.js.map'
      // }
    }
  },
  gitclone: {
    dist: {
      options: gitOpts
    }
  },
  concat: {
    basic: {
      src: SRC,
      dest: 'dist/nuve.js',
      options: {
        separator: '\n',
        stripBanners: true,
        banner: '/*!\n<%= pkg.name %> - v<%= pkg.version %> - ' +
          '<%= grunt.template.today("yyyy-mm-dd") %>\n*/\n' +
          '(function() {\n',
        footer: "if (typeof define === 'function' && define.amd) {\n" +
                        'define(function () {\n' +
                        '    return N;\n' +
                        '});\n' +
                    '}\n' +
                    "else if (typeof module !== 'undefined' && module.exports) {\n" +
                        'module.exports = N;\n' +
                    '}\n' +
                    'else {\n' +
                        'this.N = N;\n' +
                    '}\n' +
                '}.call(this));'
      }
    },
    all: {
      src: VENDOR.concat(SRC),
      dest: 'dist/nuve.all.js',
      options: {
          separator: '\n',
          stripBanners: true,
          banner: '/*! <%= pkg.name %> with dependencies - v<%= pkg.version %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
        }
    }
  },
  shell: {
    options: {
      stderr: false
    },
    copy: {
      command: 'cp -R ./repo/nuve/nuveClient/ ./'
    }
  }
});

  // Load tasks
  grunt.loadNpmTasks('grunt-git');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.registerTask('build', [
    'shell',
    'concat',
    'uglify',
    'clean:post_build'
  ])
  // Register tasks
  grunt.registerTask('update', [
    'clean',
    'gitclone'
  ]);
};
