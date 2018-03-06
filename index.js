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
  constructor(grpcClient) {
    this._grpcClient = grpcClient;
    this._unaryCalls = new Map();
    this._serverStreamCalls = new Map();
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
    ].forEach(route => {
      const keys = routeToPathKeys(route);
      this._unaryCalls.set(keys.lower, keys.name);
      this._unaryCalls.set(keys.upper, keys.name);
    });
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
    ].forEach(route => {
      const keys = routeToPathKeys(route);
      this._serverStreamCalls.set(keys.lower, keys.name);
      this._serverStreamCalls.set(keys.upper, keys.name);
    });
  }

  /**
   * middleware processor
   * @param {http.IncomingMessage} req
   * @param {ServerReponse} res
   * @param {Function} next
   */
  process(req, res, next) {
    if (this._unaryCalls.has(req.path)) this.proxyUnaryCall(req, res);
    else if (this._serverStreamCalls.has(req.path))
      this.proxyServerStreamCall(req, res);
    else next();
  }

  async proxyUnaryCall(req, res) {
    res.setHeader('Content-Type', 'application/json');
    const grpcRequest = await this.getBody(req);
    this._grpcClient[this._unaryCalls.get(req.path)](
      grpcRequest,
      (err, response) => {
        if (err) res.status(502).send(err);
        else res.json(response);
      }
    );
  }

  async proxyServerStreamCall(req, res) {
    res.setHeader('Content-Type', 'application/json');
    const grpcRequest = await this.getBody(req);
    const stream = this._grpcClient[this._serverStreamCalls.get(req.path)](
      grpcRequest
    );
    let firstChunk = true;
    res.write('[');
    stream.on('data', chunk => {
      if (!firstChunk) res.write(',');
      res.write(JSON.stringify(chunk));
      firstChunk = false;
    });
    stream.on('end', () => {
      res.write(']');
      res.end();
    });
  }

  async getBody(req) {
    return new Promise(resolve => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(JSON.parse(body));
      });
    });
  }
}

/**
 * Creates a middleware with the given connected grpc client
 * @param grpcClient grpc client connected to a running server
 */
function factory(grpcClient) {
  const instance = new Middleware(grpcClient);
  return instance.process.bind(instance);
}

module.exports = factory;
