/*! nuve-client with dependencies - v1.1.0 - 2015-07-28 */
var Url = require("url"),
  spawn = require("child_process").spawn,
  fs = require('fs');

var XMLHttpRequest = function() {
  /**
   * Private variables
   */
  var self = this;
  var http = require('http');
  var https = require('https');

  // Holds http.js objects
  var client;
  var request;
  var response;

  // Request settings
  var settings = {};

  // Set some default headers
  var defaultHeaders = {
    "User-Agent": "node.js",
    "Accept": "*/*"
  };

  // Send flag
  var sendFlag = false;
  // Error flag, used when errors occur or abort is called
  var errorFlag = false;

  var headers = defaultHeaders;

  /**
   * Constants
   */
  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;

  /**
   * Public vars
   */
  // Current state
  this.readyState = this.UNSENT;

  // default ready state change handler in case one is not set or is set late
  this.onreadystatechange = null;

  // Result & response
  this.responseText = "";
  this.responseXML = "";
  this.status = null;
  this.statusText = null;

  /**
   * Open the connection. Currently supports local server requests.
   *
   * @param string method Connection method (eg GET, POST)
   * @param string url URL for the connection.
   * @param boolean async Asynchronous connection. Default is true.
   * @param string user Username for basic authentication (optional)
   * @param string password Password for basic authentication (optional)
   */
  this.open = function(method, url, async, user, password) {
    settings = {
      "method": method,
      "url": url.toString(),
      "async": (typeof async !== "boolean" ? true : async),
      "user": user || null,
      "password": password || null
    };

    this.abort();

    setState(this.OPENED);
  };

  /**
   * Sets a header for the request.
   *
   * @param string header Header name
   * @param string value Header value
   */
  this.setRequestHeader = function(header, value) {
    if (this.readyState != this.OPENED) {
      throw "INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN";
    }
    if (sendFlag) {
      throw "INVALID_STATE_ERR: send flag is true";
    }
    headers[header] = value;
  };

  /**
   * Gets a header from the server response.
   *
   * @param string header Name of header to get.
   * @return string Text of the header or null if it doesn't exist.
   */
  this.getResponseHeader = function(header) {
    if (this.readyState > this.OPENED
      && response.headers[header]
      && !errorFlag
    ) {
      return response.headers[header];
    }

    return null;
  };

  /**
   * Gets all the response headers.
   *
   * @return string
   */
  this.getAllResponseHeaders = function() {
    if (this.readyState < this.HEADERS_RECEIVED || errorFlag) {
      return "";
    }
    var result = "";

    for (var i in response.headers) {
      result += i + ": " + response.headers[i] + "\r\n";
    }
    return result.substr(0, result.length - 2);
  };

  /**
   * Sends the request to the server.
   *
   * @param string data Optional data to send as request body.
   */
  this.send = function(data) {
    if (this.readyState != this.OPENED) {
      throw "INVALID_STATE_ERR: connection must be opened before send() is called";
    }

    if (sendFlag) {
      throw "INVALID_STATE_ERR: send has already been called";
    }

    var ssl = false;
    var url = Url.parse(settings.url);

    // Determine the server
    switch (url.protocol) {
      case 'https:':
        ssl = true;
        // SSL & non-SSL both need host, no break here.
      case 'http:':
        var host = url.hostname;
        break;

      case undefined:
      case '':
        var host = "localhost";
        break;

      default:
        throw "Protocol not supported.";
    }

    // Default to port 80. If accessing localhost on another port be sure
    // to use http://localhost:port/path
    var port = url.port || (ssl ? 443 : 80);
    // Add query string if one is used
    var uri = url.pathname + (url.search ? url.search : '');

    // Set the Host header or the server may reject the request
    this.setRequestHeader("Host", host);

    // Set Basic Auth if necessary
    if (settings.user) {
      if (typeof settings.password == "undefined") {
        settings.password = "";
      }
      var authBuf = new Buffer(settings.user + ":" + settings.password);
      headers["Authorization"] = "Basic " + authBuf.toString("base64");
    }

    // Set content length header
    if (settings.method == "GET" || settings.method == "HEAD") {
      data = null;
    } else if (data) {
      this.setRequestHeader("Content-Length", Buffer.byteLength(data));

      if (!headers["Content-Type"]) {
        this.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
      }
    }

    var options = {
      host: host,
      port: port,
      path: uri,
      method: settings.method,
      headers: headers
    };

    // Reset error flag
    errorFlag = false;

    // Handle async requests
    if(!settings.hasOwnProperty("async") || settings.async) {
      // Use the proper protocol
      var doRequest = ssl ? https.request : http.request;

      // Request is being sent, set send flag
      sendFlag = true;

      // As per spec, this is called here for historical reasons.
      if (typeof self.onreadystatechange === "function") {
        self.onreadystatechange();
      }

      // Create the request
      request = doRequest(options, function(resp) {
        response = resp;
        response.setEncoding("utf8");

        setState(self.HEADERS_RECEIVED);
        self.status = response.statusCode;

        response.on('data', function(chunk) {
          // Make sure there's some data
          if (chunk) {
            self.responseText += chunk;
          }
          // Don't emit state changes if the connection has been aborted.
          if (sendFlag) {
            setState(self.LOADING);
          }
        });

        response.on('end', function() {
          if (sendFlag) {
            // Discard the 'end' event if the connection has been aborted
            setState(self.DONE);
            sendFlag = false;
          }
        });

        response.on('error', function(error) {
          self.handleError(error);
        });
      }).on('error', function(error) {
        self.handleError(error);
      });

      // Node 0.4 and later won't accept empty data. Make sure it's needed.
      if (data) {
        request.write(data);
      }

      request.end();
    } else { // Synchronous
      // Create a temporary file for communication with the other Node process
      var syncFile = ".node-xmlhttprequest-sync-" + process.pid;
      fs.writeFileSync(syncFile, "", "utf8");
      // The async request the other Node process executes
      var execString = "var http = require('http'), https = require('https'), fs = require('fs');"
        + "var doRequest = http" + (ssl?"s":"") + ".request;"
        + "var options = " + JSON.stringify(options) + ";"
        + "var responseText = '';"
        + "var req = doRequest(options, function(response) {"
        + "response.setEncoding('utf8');"
        + "response.on('data', function(chunk) {"
        + "responseText += chunk;"
        + "});"
        + "response.on('end', function() {"
        + "fs.writeFileSync('" + syncFile + "', 'NODE-XMLHTTPREQUEST-STATUS:' + response.statusCode + ',' + responseText, 'utf8');"
        + "});"
        + "response.on('error', function(error) {"
        + "fs.writeFileSync('" + syncFile + "', 'NODE-XMLHTTPREQUEST-ERROR:' + JSON.stringify(error), 'utf8');"
        + "});"
        + "}).on('error', function(error) {"
        + "fs.writeFileSync('" + syncFile + "', 'NODE-XMLHTTPREQUEST-ERROR:' + JSON.stringify(error), 'utf8');"
        + "});"
        + (data ? "req.write('" + data.replace(/'/g, "\\'") + "');":"")
        + "req.end();";
      // Start the other Node Process, executing this string
      syncProc = spawn(process.argv[0], ["-e", execString]);
      while((self.responseText = fs.readFileSync(syncFile, 'utf8')) == "") {
        // Wait while the file is empty
      }
      // Kill the child process once the file has data
      syncProc.stdin.end();
      // Remove the temporary file
      fs.unlinkSync(syncFile);
      if(self.responseText.match(/^NODE-XMLHTTPREQUEST-ERROR:/)) {
        // If the file returned an error, handle it
        var errorObj = self.responseText.replace(/^NODE-XMLHTTPREQUEST-ERROR:/, "");
        self.handleError(errorObj);
      } else {
        // If the file returned okay, parse its data and move to the DONE state
        self.status = self.responseText.replace(/^NODE-XMLHTTPREQUEST-STATUS:([0-9]*),.*/, "$1");
        self.responseText = self.responseText.replace(/^NODE-XMLHTTPREQUEST-STATUS:[0-9]*,(.*)/, "$1");
        setState(self.DONE);
      }
    }
  };

  this.handleError = function(error) {
    this.status = 503;
    this.statusText = error;
    this.responseText = error.stack;
    errorFlag = true;
    setState(this.DONE);
  };

  /**
   * Aborts a request.
   */
  this.abort = function() {
    if (request) {
      request.abort();
      request = null;
    }

    headers = defaultHeaders;
    this.responseText = "";
    this.responseXML = "";

    errorFlag = true;

    if (this.readyState !== this.UNSENT
        && (this.readyState !== this.OPENED || sendFlag)
        && this.readyState !== this.DONE) {
      sendFlag = false;
      setState(this.DONE);
    }
    this.readyState = this.UNSENT;
  };

  var listeners = {};
  this.addEventListener = function(event, callback) {
    if (!(event in listeners)) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  };

  /**
   * Changes readyState and calls onreadystatechange.
   *
   * @param int state New state
   */
  var setState = function(state) {
    self.readyState = state;
    if (typeof self.onreadystatechange === "function") {
      self.onreadystatechange();
    }

    if ("readystatechange" in listeners) {
      var count = listeners["readystatechange"].length, i = 0;
      for(; i < count; i++) {
        listeners["readystatechange"][i].call(self);
      }
    }
  };
};
var CryptoJS=CryptoJS||function(i,j){var f={},b=f.lib={},m=b.Base=function(){function a(){}return{extend:function(e){a.prototype=this;var c=new a;e&&c.mixIn(e);c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.$super.extend(this)}}}(),l=b.WordArray=m.extend({init:function(a,e){a=
this.words=a||[];this.sigBytes=e!=j?e:4*a.length},toString:function(a){return(a||d).stringify(this)},concat:function(a){var e=this.words,c=a.words,o=this.sigBytes,a=a.sigBytes;this.clamp();if(o%4)for(var b=0;b<a;b++)e[o+b>>>2]|=(c[b>>>2]>>>24-8*(b%4)&255)<<24-8*((o+b)%4);else if(65535<c.length)for(b=0;b<a;b+=4)e[o+b>>>2]=c[b>>>2];else e.push.apply(e,c);this.sigBytes+=a;return this},clamp:function(){var a=this.words,e=this.sigBytes;a[e>>>2]&=4294967295<<32-8*(e%4);a.length=i.ceil(e/4)},clone:function(){var a=
m.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var e=[],c=0;c<a;c+=4)e.push(4294967296*i.random()|0);return l.create(e,a)}}),n=f.enc={},d=n.Hex={stringify:function(a){for(var e=a.words,a=a.sigBytes,c=[],b=0;b<a;b++){var d=e[b>>>2]>>>24-8*(b%4)&255;c.push((d>>>4).toString(16));c.push((d&15).toString(16))}return c.join("")},parse:function(a){for(var e=a.length,c=[],b=0;b<e;b+=2)c[b>>>3]|=parseInt(a.substr(b,2),16)<<24-4*(b%8);return l.create(c,e/2)}},h=n.Latin1={stringify:function(a){for(var e=
a.words,a=a.sigBytes,b=[],d=0;d<a;d++)b.push(String.fromCharCode(e[d>>>2]>>>24-8*(d%4)&255));return b.join("")},parse:function(a){for(var b=a.length,c=[],d=0;d<b;d++)c[d>>>2]|=(a.charCodeAt(d)&255)<<24-8*(d%4);return l.create(c,b)}},k=n.Utf8={stringify:function(a){try{return decodeURIComponent(escape(h.stringify(a)))}catch(b){throw Error("Malformed UTF-8 data");}},parse:function(a){return h.parse(unescape(encodeURIComponent(a)))}},g=b.BufferedBlockAlgorithm=m.extend({reset:function(){this._data=l.create();
this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=k.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var b=this._data,c=b.words,d=b.sigBytes,f=this.blockSize,g=d/(4*f),g=a?i.ceil(g):i.max((g|0)-this._minBufferSize,0),a=g*f,d=i.min(4*a,d);if(a){for(var h=0;h<a;h+=f)this._doProcessBlock(c,h);h=c.splice(0,a);b.sigBytes-=d}return l.create(h,d)},clone:function(){var a=m.clone.call(this);a._data=this._data.clone();return a},_minBufferSize:0});b.Hasher=g.extend({init:function(){this.reset()},
reset:function(){g.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);this._doFinalize();return this._hash},clone:function(){var a=g.clone.call(this);a._hash=this._hash.clone();return a},blockSize:16,_createHelper:function(a){return function(b,c){return a.create(c).finalize(b)}},_createHmacHelper:function(a){return function(b,c){return p.HMAC.create(a,c).finalize(b)}}});var p=f.algo={};return f}(Math);
(function(){var i=CryptoJS,j=i.lib,f=j.WordArray,j=j.Hasher,b=[],m=i.algo.SHA1=j.extend({_doReset:function(){this._hash=f.create([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(f,i){for(var d=this._hash.words,h=d[0],k=d[1],g=d[2],j=d[3],a=d[4],e=0;80>e;e++){if(16>e)b[e]=f[i+e]|0;else{var c=b[e-3]^b[e-8]^b[e-14]^b[e-16];b[e]=c<<1|c>>>31}c=(h<<5|h>>>27)+a+b[e];c=20>e?c+((k&g|~k&j)+1518500249):40>e?c+((k^g^j)+1859775393):60>e?c+((k&g|k&j|g&j)-1894007588):c+((k^g^j)-
899497514);a=j;j=g;g=k<<30|k>>>2;k=h;h=c}d[0]=d[0]+h|0;d[1]=d[1]+k|0;d[2]=d[2]+g|0;d[3]=d[3]+j|0;d[4]=d[4]+a|0},_doFinalize:function(){var b=this._data,f=b.words,d=8*this._nDataBytes,h=8*b.sigBytes;f[h>>>5]|=128<<24-h%32;f[(h+64>>>9<<4)+15]=d;b.sigBytes=4*f.length;this._process()}});i.SHA1=j._createHelper(m);i.HmacSHA1=j._createHmacHelper(m)})();
(function(){var i=CryptoJS,j=i.enc.Utf8;i.algo.HMAC=i.lib.Base.extend({init:function(f,b){f=this._hasher=f.create();"string"==typeof b&&(b=j.parse(b));var i=f.blockSize,l=4*i;b.sigBytes>l&&(b=f.finalize(b));for(var n=this._oKey=b.clone(),d=this._iKey=b.clone(),h=n.words,k=d.words,g=0;g<i;g++)h[g]^=1549556828,k[g]^=909522486;n.sigBytes=d.sigBytes=l;this.reset()},reset:function(){var f=this._hasher;f.reset();f.update(this._iKey)},update:function(f){this._hasher.update(f);return this},finalize:function(f){var b=
this._hasher,f=b.finalize(f);b.reset();return b.finalize(this._oKey.clone().concat(f))}})})();

var N = N || {};

N.authors = ['aalonsog@dit.upm.es', 'prodriguez@dit.upm.es', 'jcervino@dit.upm.es'];

N.version = 0.1;
var N = N || {};
N.Base64 = (function (N) {
    "use strict";
    var END_OF_INPUT, base64Chars, reverseBase64Chars, base64Str, base64Count, i, setBase64Str, readBase64, encodeBase64, readReverseBase64, ntos, decodeBase64;

    END_OF_INPUT = -1;

    base64Chars = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
        'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
        'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
        'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
        'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
        'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
        'w', 'x', 'y', 'z', '0', '1', '2', '3',
        '4', '5', '6', '7', '8', '9', '+', '/'
    ];

    reverseBase64Chars = [];

    for (i = 0; i < base64Chars.length; i = i + 1) {
        reverseBase64Chars[base64Chars[i]] = i;
    }

    setBase64Str = function (str) {
        base64Str = str;
        base64Count = 0;
    };

    readBase64 = function () {
        var c;
        if (!base64Str) {
            return END_OF_INPUT;
        }
        if (base64Count >= base64Str.length) {
            return END_OF_INPUT;
        }
        c = base64Str.charCodeAt(base64Count) & 0xff;
        base64Count = base64Count + 1;
        return c;
    };

    encodeBase64 = function (str) {
        var result, inBuffer, lineCount, done;
        setBase64Str(str);
        result = '';
        inBuffer = new Array(3);
        lineCount = 0;
        done = false;
        while (!done && (inBuffer[0] = readBase64()) !== END_OF_INPUT) {
            inBuffer[1] = readBase64();
            inBuffer[2] = readBase64();
            result = result + (base64Chars[inBuffer[0] >> 2]);
            if (inBuffer[1] !== END_OF_INPUT) {
                result = result + (base64Chars[((inBuffer[0] << 4) & 0x30) | (inBuffer[1] >> 4)]);
                if (inBuffer[2] !== END_OF_INPUT) {
                    result = result + (base64Chars[((inBuffer[1] << 2) & 0x3c) | (inBuffer[2] >> 6)]);
                    result = result + (base64Chars[inBuffer[2] & 0x3F]);
                } else {
                    result = result + (base64Chars[((inBuffer[1] << 2) & 0x3c)]);
                    result = result + ('=');
                    done = true;
                }
            } else {
                result = result + (base64Chars[((inBuffer[0] << 4) & 0x30)]);
                result = result + ('=');
                result = result + ('=');
                done = true;
            }
            lineCount = lineCount + 4;
            if (lineCount >= 76) {
                result = result + ('\n');
                lineCount = 0;
            }
        }
        return result;
    };

    readReverseBase64 = function () {
        if (!base64Str) {
            return END_OF_INPUT;
        }
        while (true) {
            if (base64Count >= base64Str.length) {
                return END_OF_INPUT;
            }
            var nextCharacter = base64Str.charAt(base64Count);
            base64Count = base64Count + 1;
            if (reverseBase64Chars[nextCharacter]) {
                return reverseBase64Chars[nextCharacter];
            }
            if (nextCharacter === 'A') {
                return 0;
            }
        }
    };

    ntos = function (n) {
        n = n.toString(16);
        if (n.length === 1) {
            n = "0" + n;
        }
        n = "%" + n;
        return unescape(n);
    };

    decodeBase64 = function (str) {
        var result, inBuffer, done;
        setBase64Str(str);
        result = "";
        inBuffer = new Array(4);
        done = false;
        while (!done && (inBuffer[0] = readReverseBase64()) !== END_OF_INPUT && (inBuffer[1] = readReverseBase64()) !== END_OF_INPUT) {
            inBuffer[2] = readReverseBase64();
            inBuffer[3] = readReverseBase64();
            result = result + ntos((((inBuffer[0] << 2) & 0xff) | inBuffer[1] >> 4));
            if (inBuffer[2] !== END_OF_INPUT) {
                result +=  ntos((((inBuffer[1] << 4) & 0xff) | inBuffer[2] >> 2));
                if (inBuffer[3] !== END_OF_INPUT) {
                    result = result +  ntos((((inBuffer[2] << 6)  & 0xff) | inBuffer[3]));
                } else {
                    done = true;
                }
            } else {
                done = true;
            }
        }
        return result;
    };

    return {
        encodeBase64: encodeBase64,
        decodeBase64: decodeBase64
    };
}(N));
var N = N || {};

N.API = (function (N) {
    "use strict";
    var createRoom, getRooms, getRoom, deleteRoom, createToken, createService, getServices, getService, deleteService, getUsers, getUser, deleteUser, params, send, calculateSignature, init;

    params = {
        service: undefined,
        key: undefined,
        url: undefined
    };

    init = function (service, key, url) {
        N.API.params.service = service;
        N.API.params.key = key;
        N.API.params.url = url;
    };

    createRoom = function (name, callback, callbackError, options, params) {

        if (!options) {
            options = {};
        }

        send(function (roomRtn) {
            var room = JSON.parse(roomRtn);
            callback(room);
        }, callbackError, 'POST', {name: name, options: options}, 'rooms', params);
    };

    getRooms = function (callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'rooms', params);
    };

    getRoom = function (room, callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'rooms/' + room, params);
    };

    deleteRoom = function (room, callback, callbackError, params) {
        send(callback, callbackError, 'DELETE', undefined, 'rooms/' + room, params);
    };

    createToken = function (room, username, role, callback, callbackError, params) {
        send(callback, callbackError, 'POST', undefined, 'rooms/' + room + "/tokens", params, username, role);
    };

    createService = function (name, key, callback, callbackError, params) {
        send(callback, callbackError, 'POST', {name: name, key: key}, 'services/', params);
    };

    getServices = function (callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'services/', params);
    };

    getService = function (service, callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'services/' + service, params);
    };

    deleteService = function (service, callback, callbackError, params) {
        send(callback, callbackError, 'DELETE', undefined, 'services/' + service, params);
    };

    getUsers = function (room, callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'rooms/' + room + '/users/', params);
    };

    getUser = function (room, user, callback, callbackError, params) {
        send(callback, callbackError, 'GET', undefined, 'rooms/' + room + '/users/' + user, params);
    };

    deleteUser = function (room, user, callback, callbackError, params) {
        send(callback, callbackError, 'DELETE', undefined, 'rooms/' + room + '/users/' + user, params);
    };

    send = function (callback, callbackError, method, body, url, params, username, role) {
        var service, key, timestamp, cnounce, toSign, header, signed, req;

        if (params === undefined) {
            service = N.API.params.service;
            key = N.API.params.key;
            url = N.API.params.url + url;
        } else {
            service = params.service;
            key = params.key;
            url = params.url + url;
        }

        if (service === '' || key === '') {
            console.log('ServiceID and Key are required!!');
            return;
        }

        timestamp = new Date().getTime();
        cnounce = Math.floor(Math.random() * 99999);

        toSign = timestamp + ',' + cnounce;

        header = 'MAuth realm=http://marte3.dit.upm.es,mauth_signature_method=HMAC_SHA1';

        if (username && role) {

            username = formatString(username);

            header += ',mauth_username=';
            header +=  username;
            header += ',mauth_role=';
            header +=  role;

            toSign += ',' + username + ',' + role;
        }

        signed = calculateSignature(toSign, key);


        header += ',mauth_serviceid=';
        header +=  service;
        header += ',mauth_cnonce=';
        header += cnounce;
        header += ',mauth_timestamp=';
        header +=  timestamp;
        header += ',mauth_signature=';
        header +=  signed;

        req = new XMLHttpRequest();

        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                switch (req.status) {
                    case 100:
                    case 200:
                    case 201:
                    case 202:
                    case 203:
                    case 204:
                    case 205:
                        callback(req.responseText);
                        break;
                    case 400:
                        if (callbackError !== undefined) callbackError("400 Bad Request");
                        break;
                    case 401:
                        if (callbackError !== undefined) callbackError("401 Unauthorized");
                        break;
                    case 403:
                        if (callbackError !== undefined) callbackError("403 Forbidden");
                        break;
                    default:
                        if (callbackError !== undefined) callbackError(req.status + " Error" + req.responseText);
                }
            }
        };

        req.open(method, url, true);

        req.setRequestHeader('Authorization', header);

        if (body !== undefined) {
            req.setRequestHeader('Content-Type', 'application/json');
            req.send(JSON.stringify(body));
        } else {
            req.send();
        }

    };

    calculateSignature = function (toSign, key) {
        var hash, hex, signed;
        hash = CryptoJS.HmacSHA1(toSign, key);
        hex = hash.toString(CryptoJS.enc.Hex);
        signed = N.Base64.encodeBase64(hex);
        return signed;
    };

    formatString = function(s){
        var r = s.toLowerCase();
        non_asciis = {'a': '[àáâãäå]', 'ae': 'æ', 'c': 'ç', 'e': '[èéêë]', 'i': '[ìíîï]', 'n': 'ñ', 'o': '[òóôõö]', 'oe': 'œ', 'u': '[ùúûűü]', 'y': '[ýÿ]'};
        for (i in non_asciis) { r = r.replace(new RegExp(non_asciis[i], 'g'), i); }
        return r;
    };

    return {
        params: params,
        init: init,
        createRoom: createRoom,
        getRooms: getRooms,
        getRoom: getRoom,
        deleteRoom: deleteRoom,
        createToken: createToken,
        createService: createService,
        getServices: getServices,
        getService: getService,
        deleteService: deleteService,
        getUsers: getUsers,
        getUser: getUser,
        deleteUser: deleteUser
    };
}(N));
