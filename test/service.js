const config = require('rc')('test', {
  grpcPort: 50051,
  streamDelay: 100,
  streamNumMessages: 2
});
const { join } = require('path');
const grpc = require('grpc');
const grpcServer = new grpc.Server();
const schema = grpc.load(join(__dirname, 'test.proto'));

grpcServer.addService(schema.grpcexpress.GrpcExpressService.service, {
  unaryCallError: (call, callback) => {
    callback(new Error('error'));
  },
  unaryCallTimeout: (/* call, callback */) => {
    /* no-op */
  },
  unaryCallOne: (call, callback) => {
    callback(null, { responseData: 'unaryCallOneData' });
  },
  unaryCallTwo: (call, callback) => {
    callback(null, { responseData: 'unaryCallTwoData' });
  },
  serverStreamCallOne: call => {
    let count = 0;
    let timer = setInterval(() => {
      call.write({ responseData: `serverStreamCallOneData-${count}` });
      if (++count == config.streamNumMessages) {
        clearInterval(timer);
        call.end();
      }
    }, config.streamDelay);
  },
  serverStreamCallTwo: call => {
    let count = 0;
    let timer = setInterval(() => {
      call.write({ responseData: `serverStreamCallTwoData-${count}` });
      if (++count == config.streamNumMessages) {
        clearInterval(timer);
        call.end();
      }
    }, config.streamDelay);
  }
});
grpcServer.bind(
  `0.0.0.0:${config.grpcPort}`,
  grpc.ServerCredentials.createInsecure()
);
grpcServer.start();
const grpcClient = new schema.grpcexpress.GrpcExpressService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

module.exports = {
  grpcServer: grpcServer,
  grpcClient: grpcClient
};
