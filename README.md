# grpc-express

An Express middleware to reverse-proxy HTTP 1.1 REST requests into HTTP 2.0 gRPC
requests and back. [![CircleCI](https://circleci.com/gh/sepehr-laal/grpc-express.svg?style=svg)](https://circleci.com/gh/sepehr-laal/grpc-express)

## summary

You can use this middleware with NodeJS and Express to serve a gRPC backed service API to browsers.
Focus of this middleware is ease of use and not performance. This middleware only supports Unary gRPC and server side streaming calls. As it is mentioned in [gRPC-web protocol](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md) it's unlikely that bidrectional or client side streaming calls would be supported by browsers any time soon with pure REST endpoints.

## why express middleware

Take a look at alternative methods of doing this:

* [gRPC-web](https://github.com/improbable-eng/grpc-web): requires TypeScript
* [gRPC-web-proxy](https://github.com/improbable-eng/grpc-web/tree/master/go/grpcwebproxy): requires Go
* [gRPC-gateway](https://github.com/grpc-ecosystem/grpc-gateway): requires `.proto` modification
* [grpc-bus-websocket-proxy-server](https://github.com/gabrielgrant/grpc-bus-websocket-proxy-server): as of writing this document it lacks tests and seems abandoned

On the other hand, Express middlewares are easy to use and the chance that your app already ships with Express is extremely high! Also it's NodeJS only and requires no additional setups in client or server side.

## how does it work

Begin by making a connection to a gRPC server in Node using official gRPC client for Node:

```JS
var PROTO_PATH = __dirname + '/path/to/some/service.proto';
var grpc = require('grpc');
var hello_proto = grpc.load(PROTO_PATH).helloworld;
var grpcClient = new hello_proto.Greeter('localhost:50051', grpc.credentials.createInsecure());
```

Then pass this already connected gRPC client to the middleware:

```JS
var grpcExpress = require('grpc-express');
var express = require('express');
var app = express();
// ...
app.use(grpcExpress(grpcClient));
```

Done! The middleware automatically registers REST endpoints and proxies requests to your gRPC server and back. If your service is in `packageName`, and its name is `serviceName`, you can access its methods over the following REST endpoints: `http://expressServer/packageName/serviceName/[METHOD NAME]`.

Arguments are passed as JSON objects in. Unary calls return JSON objects back and streaming calls return a JSON array of objects back. For a more detailed and in-depth example of calling REST endpoints look at [tests](test/middleware.test.js).
