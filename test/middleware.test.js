const { grpcClient, grpcServer } = require('./service');
const grpcExress = require('../index');
const express = require('express');
const fetch = require('node-fetch');
const chai = require('chai');

let httpServer = null;

describe('middleware tests', () => {
  it('should trigger the server stream proxy when placed on root', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}`;
    httpServer = app.listen(port, async () => {
      app.use(grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/serverStreamCallOne`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestData: 'test' })
        }
      );
      const body = await resp.text();
      chai
        .expect(
          '[{"responseData":"serverStreamCallOneData-0"},{"responseData":"serverStreamCallOneData-1"}]'
        )
        .to.be.equal(body);
      httpServer.close(done);
    })();
  });

  it('should trigger the server stream proxy when placed on route', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/ServerStreamCallTwo`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestData: 'test' })
        }
      );
      const body = await resp.text();
      chai
        .expect(
          '[{"responseData":"serverStreamCallTwoData-0"},{"responseData":"serverStreamCallTwoData-1"}]'
        )
        .to.be.equal(body);
      httpServer.close(done);
    })();
  });

  it('should trigger the unary proxy when placed on root', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}`;
    httpServer = app.listen(port, async () => {
      app.use(grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallOne`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestData: 'test' })
        }
      );
      const body = await resp.text();
      chai.expect('{"responseData":"unaryCallOneData"}').to.be.equal(body);
      httpServer.close(done);
    })();
  });

  it('should trigger the unary proxy when placed on route', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/UnaryCallTwo`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestData: 'test' })
        }
      );
      const body = await resp.text();
      chai.expect('{"responseData":"unaryCallTwoData"}').to.be.equal(body);
      httpServer.close(done);
    })();
  });

  it('should not trigger proxies when options are set to false', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    const opts = { proxyUnaryCalls: false, proxyServerStreamCalls: false };
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient, opts));
    });
    (async () => {
      const resp1 = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallOne`
      );
      chai.expect(resp1.status).to.be.equal(404);
      const resp2 = await fetch(
        `${base}/grpcexpress.GrpcExpressService/ServerStreamCallTwo`
      );
      chai.expect(resp2.status).to.be.equal(404);
      httpServer.close(done);
    })();
  });

  it('should return bad request when given bad json', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp1 = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallOne`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: 'bad json'
        }
      );
      chai.expect(resp1.status).to.be.equal(400);
      const resp2 = await fetch(
        `${base}/grpcexpress.GrpcExpressService/ServerStreamCallTwo`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: 'bad json'
        }
      );
      chai.expect(resp2.status).to.be.equal(400);
      httpServer.close(done);
    })();
  });

  it('should pass along invalid requests', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/invalid`
      );
      chai.expect(resp.status).to.be.equal(404);
      httpServer.close(done);
    })();
  });

  it('should return http bad gateway when unary call errors out', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallError`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestData: 'test' })
        }
      );
      chai.expect(resp.status).to.be.equal(502);
      httpServer.close(done);
    })();
  });

  it('should return http gateway timeout when unary is of wrong type', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallOne`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestData: 'test',
            additionalData: 'invalid'
          })
        }
      );
      chai.expect(resp.status).to.be.equal(504);
      httpServer.close(done);
    })();
  });

  it('should return http gateway timeout when unary call takes long', done => {
    const app = express();
    const port = 2000;
    const base = `http://localhost:${port}/sub`;
    httpServer = app.listen(port, async () => {
      app.use('/sub', grpcExress(grpcClient));
    });
    (async () => {
      const resp = await fetch(
        `${base}/grpcexpress.GrpcExpressService/unaryCallTimeout`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestData: 'test'
          })
        }
      );
      chai.expect(resp.status).to.be.equal(504);
      httpServer.close(done);
    })();
  });

  after(() => {
    httpServer.close();
    grpcServer.forceShutdown();
  });
});
