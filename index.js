const debug = require('debug')('grpc-express');
const config = require('rc')('grpc-express', {
  proxyUnaryCalls: true,
  proxyServerStreamCalls: true,
  unaryCallsTimeout: 5000,
  serverStreamCallsTimeout: 10000
});

function toUpperCaseFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function toLowerCaseFirstLetter(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}
function routeToPathKeys(route) {
  const functionName = route.split('/').slice(-1)[0];
  return {
    upper: route.replace(functionName, toUpperCaseFirstLetter(functionName)),
    lower: route.replace(functionName, toLowerCaseFirstLetter(functionName)),
    name: toLowerCaseFirstLetter(functionName)
  };
}

class Middleware {
  constructor(grpcClient, opts) {
    opts = opts || {};
    this._opts = Object.assign({}, config, opts);
    debug('gRPC middleware constructed', this._opts);
    this._grpcClient = grpcClient;
    this._unaryCalls = new Map();
    this._serverStreamCalls = new Map();
    if (this._opts.proxyUnaryCalls) {
      [
        ...new Set(
          Object.keys(grpcClient.__proto__)
            .filter(
              route =>
                !grpcClient[route].requestStream &&
                !grpcClient[route].responseStream
            )
            .map(route => grpcClient[route].path)
        )
      ].filter(r => r).forEach(route => {
        const keys = routeToPathKeys(route);
        this._unaryCalls.set(keys.lower, keys.name);
        this._unaryCalls.set(keys.upper, keys.name);
      });
      debug('gRPC unary calls', this._unaryCalls);
    } else {
      debug('gRPC unary calls are not proxied');
    }
    if (this._opts.proxyServerStreamCalls) {
      [
        ...new Set(
          Object.keys(grpcClient.__proto__)
            .filter(
              route =>
                !grpcClient[route].requestStream &&
                grpcClient[route].responseStream
            )
            .map(route => grpcClient[route].path)
        )
      ].filter(r => r).forEach(route => {
        const keys = routeToPathKeys(route);
        this._serverStreamCalls.set(keys.lower, keys.name);
        this._serverStreamCalls.set(keys.upper, keys.name);
      });
      debug('gRPC server stream calls', this._serverStreamCalls);
    } else {
      debug('gRPC server stream calls are not proxied');
    }
  }

  proxy(req, res, next) {
    if (this._unaryCalls.has(req.path)) this.proxyUnaryCall(req, res);
    else if (this._serverStreamCalls.has(req.path))
      this.proxyServerStreamCall(req, res);
    else next();
  }

  proxyUnaryCall(req, res) {
    let timedout = false;
    // look at https://github.com/grpc/grpc/issues/9973
    // gRPC's node sdk is potato quality. it does not pass up the error.
    let timer = setTimeout(() => {
      timedout = true;
      res.status(504);
      res.end();
    }, this._opts.unaryCallsTimeout);
    (async () => {
      debug('gRPC unary proxy request', req);
      res.setHeader('Content-Type', 'application/json');
      const grpcRequest = await this.getBody(req).catch(err => {
        res.status(400).send(err);
      });
      if (!grpcRequest) return;
      this._grpcClient[this._unaryCalls.get(req.path)](
        grpcRequest,
        (err, response) => {
          if (timedout) {
            debug('gRPC call already timedout');
            return;
          }
          debug('gRPC unary end', err, response);
          if (err) res.status(502).send(err);
          else res.json(response);
          clearTimeout(timer);
        }
      );
    })();
  }

  proxyServerStreamCall(req, res) {
    (async () => {
      debug('gRPC server stream proxy request', req);
      res.setHeader('Content-Type', 'application/json');
      const grpcRequest = await this.getBody(req).catch(err => {
        res.status(400).send(err);
      });
      if (!grpcRequest) return;
      const stream = this._grpcClient[this._serverStreamCalls.get(req.path)](
        grpcRequest
      );
      let firstChunk = true;
      res.write('[');
      stream.on('data', chunk => {
        debug('gRPC server stream chunk', chunk);
        if (!firstChunk) res.write(',');
        res.write(JSON.stringify(chunk));
        firstChunk = false;
      });
      stream.on('end', () => {
        debug('gRPC server stream end');
        res.write(']');
        res.end();
      });
    })();
  }

  async getBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          body = JSON.parse(body);
          debug('gRPC request body read', body);
          resolve(body);
        } catch (err) {
          debug('gRPC request body fail', err);
          reject(err);
        }
      });
    });
  }
}

function factory(grpcClient, opts) {
  const instance = new Middleware(grpcClient, opts);
  return instance.proxy.bind(instance);
}

module.exports = factory;
