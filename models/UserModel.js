const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const gamePredictionSchema = new mongoose.Schema({
  gameId: String,
  match_type: {
    type: String,
  },
  which_sport: {
    type: String,
  },
  prediction_type: {
    type: String,
  },
  predictionInformations: [],
  match_date: {
    type: String,
  },
  match_time: {
    type: String,
  },
  winning_team: {
    type: String,
  },
  isApiCalled: {
    type: Boolean,
    default: false,
  },
  teams: [],
});

const userSchema = new mongoose.Schema({
  userinformation: {
    name: { type: String, required: [true, "Please tell us your name!"] },
    username: {
      type: String,
      required: [true, "Please tell us your username!"],
      unique: true,
    },
    phonenumber: {
      type: Number,
      required: [true, "Please provide your phone number!"],
      unique: true,
    },
    referralID: String,
    referrerReferralID: String,
    password: {
      type: String,
      required: [true, "Please provide a password!"],
    },
    passwordChangedAt: Date,
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  games_wallet: {
    balance: {
      type: Number,
      default: 0,
    },
    life_time_game_predict_earnings: {
      type: Number,
      default: 0,
    },
  },
  ads_wallet: {
    balance: {
      type: Number,
      default: 0,
    },
    life_time_ads_revenue: {
      type: Number,
      default: 0,
    },
  },
  notifications: [],
  trackAdRevenue: [],
  trackAdsView: [],
  todaysEarning: {},
  totalEarnings: { type: Number, default: 0 },
  totalReferralEarnings: { type: Number, default: 0 },
  transactionHistory: [],
  gamesPredictionHistory: [gamePredictionSchema],
});

// Middleware to hash the password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("userinformation.password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.userinformation.password = await bcrypt.hash(
      this.userinformation.password,
      salt
    );
    next();
  } catch (error) {
    return next(error);
  }
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("userinformation.password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  hashedPassword
) {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

const User = (module.exports = mongoose.model("User", userSchema));

module.exports = User;
