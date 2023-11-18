const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
var Fingerprint = require("express-fingerprint");
const requestIp = require("request-ip");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const routes = require("./routes/routes");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

// Use request-ip middleware to get client's IP address
app.use(requestIp.mw());

// Use the express-fingerprint middleware
app.use(
  Fingerprint({
    parameters: [
      // Defaults
      Fingerprint.useragent,
      Fingerprint.acceptHeaders,
      Fingerprint.geoip,

      // Additional parameters
      function (next) {
        // ...do something...
        next(null, {
          param1: "value1",
        });
      },
      function (next) {
        // ...do something...
        next(null, {
          param2: "value2",
        });
      },
    ],
  })
);

// Endpoint to get device fingerprint
app.get("/fingerprint", (req, res) => {
  const fingerprint = req.fingerprint;
  const clientIp = req.clientIp;
  // console.log("Fingerprint:", fingerprint);
  // console.log("Client IP:", clientIp);
  res.json({ fingerprint, clientIp });
});

const corsOptions = {
  origin: "*",
};
app.use(cors(corsOptions));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

// 1) GLOBAL MIDDLEWARES

//Set security HTTP headers
app.use(helmet());

//Body parser, reading data from body into req.body
app.use(express.json());

//Data sanitization agains NoSQL query injection
app.use(mongoSanitize());

//Data sanitization agains XSS
app.use(xss());

//Prevent parameter pollution
// app.use(hpp());

app.use(bodyParser.json());

//Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers)
  next();
});

// 3) ROUTES
app.use(routes);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
