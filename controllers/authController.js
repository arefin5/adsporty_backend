const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: false,
  };
  // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Remove password from output
  user.userinformation.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// Function to generate a random short ID
function generateShortID() {
  const characters =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let shortID = "";
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    shortID += characters[randomIndex];
  }
  return shortID;
}

// Function to check if a short ID is unique in the database and generate a unique short ID
async function generateUniqueShortID() {
  let shortID;
  do {
    shortID = generateShortID();
  } while (!(await isShortIDUnique(shortID)));
  return shortID;
}

// Function to check if a short ID is unique in the database
async function isShortIDUnique(shortID) {
  const existingUser = await User.findOne({
    "userinformation.referralID": shortID,
  });
  return !existingUser;
}

//SignUp
exports.signup = catchAsync(async (req, res, next) => {
  // console.log(req.body);
  const { name, username, phonenumber, referralID, password } = req.body;
  // console.log(name, username, phonenumber, referralID, password);

  // Generate a random short ID with a maximum length of 5 characters
  const shortID = await generateUniqueShortID();

  const newUser = await User.create({
    userinformation: {
      name,
      username,
      phonenumber,
      referralID: shortID,
      referrerReferralID: referralID,
      password,
      isBlocked: false,
    },
    games_wallet: {
      balance: 0,
      life_time_game_predict_earnings: 0,
    },
    ads_wallet: {
      balance: 0,
      life_time_ads_revenue: 0,
    },
    notifications: [],
    trackAdsView: [],
    trackAdRevenue: [],
    todaysEarning: {
      earning_from_ads: 0,
      earning_from_games: 0,
      earning_from_referral: 0,
    },
    totalEarnings: 0,
    totalReferralEarnings: 0,
    transactionHistory: [],
    gamesPredictionHistory: [],
  });
  createSendToken(newUser, 201, res);
});

//Login
exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  // console.log(username, password);

  // Check if username and password were provided
  if (!username || !password) {
    return next(new AppError("Please provide username and password!", 400));
  }

  // Find the user by username
  const user = await User.findOne({
    "userinformation.username": username,
  }).select("+userinformation.password");

  // Check if user exists
  if (!user) {
    return next(new AppError("Incorrect username or password", 401));
  }

  // Check if provided password matches the hashed password
  const passwordMatches = await user.correctPassword(
    password,
    user.userinformation.password
  );
  if (!passwordMatches) {
    return next(new AppError("Incorrect username or password", 401));
  }

  // If everything is correct, generate and send a token
  createSendToken(user, 200, res);
});

//Logout
exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

//Protect middleware
exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting token and check of it's there
  let token;
  // console.log(req.headers.authorization);
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // console.log(token);
  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }
  //2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  // console.log(currentUser, 'from protect')
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  // console.log(currentUser)

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    // console.log("dksfjsjdfkjsdfj");
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

//currentUser
exports.currentUser = catchAsync(async (req, res) => {
  const userIdHex = req.params.userId;
  // console.log(userIdHex);
  const currentUser = await User.findById(userIdHex);

  res.status(200).json({
    success: true,
    message: "User Found Successfully!",
    data: currentUser,
  });
});

//update Password
exports.updatePassword = catchAsync(async (req, res, next) => {
  // console.log(req.body, "body", req.params.id);
  // 1) Get user from collection
  const user = await User.findById(req.params.id).select("+password");
  // console.log(user.userinformation);
  // 2) Check if POSTed current password is correct
  if (
    !(await user.correctPassword(
      req.body.old_password,
      user.userinformation.password
    ))
  ) {
    return next(new AppError("Your current password is wrong.", 404));
  }

  // 3) If so, update password
  user.userinformation.password = req.body.password;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  const updatedUser = await User.findById(req.params.id).select("+password");
  // console.log("updated user", updatedUser.userinformation);

  res.status(200).json({
    status: "success",
    message: "Successfully updated the password!",
  });
});

// Find all the users
exports.getAllUsers = catchAsync(async (req, res) => {
  // Query the database to get all users
  const users = await User.find();

  res.status(200).json({
    status: "success",
    data: users,
  });
});
