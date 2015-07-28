/*!
nuve-client - v1.1.0 - 2015-07-28
*/
(function() {
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
if (typeof define === 'function' && define.amd) {
define(function () {
    return N;
});
}
else if (typeof module !== 'undefined' && module.exports) {
module.exports = N;
}
else {
this.N = N;
}
}.call(this));