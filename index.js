'use strict';

// * Breaks proxying into a series of discrete steps, many of which can be swapped out by authors.
// * Uses Promises to support async.
// * Uses a quasi-Global called Container to tidy up the argument passing between the major work-flow steps.


var ScopeContainer = require('./lib/scopeContainer');
var assert = require('assert');
var debug = require('debug')('express-http-proxy');

var buildProxyReq                = require('./app/steps/buildProxyReq');
var copyProxyResHeadersToUserRes = require('./app/steps/copyProxyResHeadersToUserRes');
var decorateProxyReqBody         = require('./app/steps/decorateProxyReqBody');
var decorateProxyReqOpts         = require('./app/steps/decorateProxyReqOpts');
var decorateUserRes              = require('./app/steps/decorateUserRes');
var decorateUserResHeaders       = require('./app/steps/decorateUserResHeaders');
var handleProxyErrors          = require('./app/steps/handleProxyErrors');
var maybeSkipToNextHandler       = require('./app/steps/maybeSkipToNextHandler');
var prepareProxyReq              = require('./app/steps/prepareProxyReq');
var resolveProxyHost             = require('./app/steps/resolveProxyHost');
var resolveProxyReqPath          = require('./app/steps/resolveProxyReqPath');
var sendProxyRequest             = require('./app/steps/sendProxyRequest');
var sendUserRes                  = require('./app/steps/sendUserRes');

module.exports = function proxy(relays, userOptions) {
    // relays must be delivered
  return function handleProxy(req, res, next) {
    let url = req.url;
    let id = url.split("/")[2];
    let host = relays.addr(id);
    debug('[start proxy] ' + req.path);
    var container = new ScopeContainer(req, res, next, host, userOptions);

    // Skip proxy if filter is falsey.  Loose equality so filters can return
    // false, null, undefined, etc.

    if (!container.options.filter(req, res)) { return next(); }

    buildProxyReq(container)
      .then(resolveProxyHost)
      .then(decorateProxyReqOpts)
      .then(resolveProxyReqPath)
      .then(decorateProxyReqBody)
      .then(prepareProxyReq)
      .then(sendProxyRequest)
      .then(maybeSkipToNextHandler)
      .then(copyProxyResHeadersToUserRes)
      .then(decorateUserResHeaders)
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(function (err) {
        var resolver = (container.options.proxyErrorHandler) ?
          container.options.proxyErrorHandler :
          handleProxyErrors;
        resolver(err, res, next);
      });
  };
};
