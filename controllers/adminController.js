const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Admin = require("../models/AdminModel");
const UploadAdmin = require("../models/AdminUploadModel");
const jwt = require("jsonwebtoken");
const uuid = require("uuid");

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
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

//Admim signup process
exports.registration = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  // console.log(username, password);

  const newAdmin = await Admin.create({
    username,
    password,
  });

  res.status(201).json({
    message: "Admin user created successfully",
    data: newAdmin,
  });
});

//Admin Login
exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  // console.log(username, password)

  // Check if username and password were provided
  if (!username || !password) {
    return next(new AppError("Please provide username and password!", 400));
  }

  // Find the user by username
  const user = await Admin.findOne({
    username: username,
  }).select("+password");

  // console.log(user)

  // Check if user exists
  if (!user) {
    return next(new AppError("Incorrect username or password", 401));
  }

  // Check if provided password matches the hashed password
  const passwordMatches = await user.correctPassword(password, user.password);
  if (!passwordMatches) {
    return next(new AppError("Incorrect username or password", 401));
  }

  // If everything is correct, generate and send a token
  createSendToken(user, 200, res);
});

//Admim upload process
exports.uploadInformations = catchAsync(async (req, res, next) => {
  const newInformation = await UploadAdmin.create({
    dollar_rate: 0,
    ads_percentage_rate: 0,
    game_percentage_rate: 0,
    min_deposit_rate: 0,
    withdraw_numbers: [],
    ad_images: [],
    uploadGames: [],
    total_reffered_balance: 0,
  });

  res.status(201).json({
    message: "Informations added successfully",
    data: newInformation,
  });
});

//Get site informations from admin panel
exports.getInformations = catchAsync(async (req, res, next) => {
  const informations = await UploadAdmin.find();

  if (!informations) {
    return next(new AppError("No informations found!", 400));
  }
  res.status(201).json({
    message: "Informations found successfully",
    data: informations,
  });
});

//upload games
exports.uploadGame = catchAsync(async (req, res) => {
  // console.log(req.body);
  const {
    matchType,
    sport,
    predictionType,
    teamA,
    teamB,
    matchDate,
    matchTime,
  } = req.body;

  const gameId = uuid.v4();

  // Create a new object with the provided fields
  const newUploadGame = {
    id: gameId,
    match_type: matchType,
    which_sport: sport,
    prediction_type: predictionType,
    teams: [teamA, teamB],
    match_date: matchDate,
    match_time: matchTime,
    winning_team: "Not Defined",
  };

  const informationDB = await UploadAdmin.find();

  // console.log(informationDB[0]);

  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // Push the new object to the uploadGames array
  informationDB[0].uploadGames.push(newUploadGame);

  // Save the updated admin object with the new uploadGame
  const updatedInformationDB = await informationDB[0].save();

  res.status(200).json({
    message: "Successfully added games",
    data: updatedInformationDB,
  });
});

//update game results
exports.updateResult = catchAsync(async (req, res, next) => {
  const gameId = req.params.id;
  const { winning_team } = req.body;

  const informationDB = await UploadAdmin.findOne();

  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  const filter = { "uploadGames.id": gameId };
  const update = { $set: { "uploadGames.$.winning_team": winning_team } };

  const updatedInformationDB = await UploadAdmin.findOneAndUpdate(
    filter,
    update,
    { new: true }
  );

  if (!updatedInformationDB) {
    return next(new AppError("Game Not Found!", 404));
  }

  const updatedGame = updatedInformationDB.uploadGames.find(
    (game) => game.id === gameId
  );

  res.status(200).json({
    message: "Game result updated",
    data: updatedGame,
  });
});

//remove games
exports.removeGame = catchAsync(async (req, res) => {
  const gameId = req.params.id; // Get the game ID from the request params

  const informationDB = await UploadAdmin.findOne();

  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // Find the index of the game with the given ID in the uploadGames array
  const gameIndex = informationDB.uploadGames.findIndex(
    (game) => game.id === gameId
  );

  if (gameIndex === -1) {
    return next(new AppError("Game not found!", 404));
  }

  // Remove the game from the uploadGames array
  informationDB.uploadGames.splice(gameIndex, 1);

  // Save the updated admin object without the removed game
  await informationDB.save();

  res.status(204).json({
    message: "Game Removed!",
  });
});

// Upload or Update Dollar Rate
exports.updateDollarRate = async (req, res, next) => {
  const { dollarRate } = req.body;
  // console.log(dollarRate);

  // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  // console.log(informationDB.dollar_rate);
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // // Update the dollar_rate field in the document
  informationDB.dollar_rate = dollarRate;

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Successfully updated dollar rate",
    data: updatedInformationDB,
  });
};

// Upload or Update Deposit Limit
exports.uploadDepositLimit = async (req, res, next) => {
  const { depositRate } = req.body;
  // console.log(dollarRate);

  // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  // console.log(informationDB.dollar_rate);
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // // Update the dollar_rate field in the document
  informationDB.min_deposit_rate = depositRate;

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Successfully updated deposit limit",
    data: updatedInformationDB,
  });
};

// Upload or Update Game Percentage Rate
exports.updateGameRate = async (req, res, next) => {
  const { gamePercentageRate } = req.body;

  // // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // // Update the dollar_rate field in the document
  informationDB.game_percentage_rate = gamePercentageRate;

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Game Pencentage rate updated",
    data: updatedInformationDB,
  });
};

// Upload or Update Withdraw numbers
exports.updateWithdrawNumber = async (req, res, next) => {
  const { withdrawNumber, account_type, banking_method } = req.body;
  // console.log(withdrawNumber, account_type, banking_method);
  // // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  const numberId = uuid.v4();

  const newNumber = {
    id: numberId,
    number: withdrawNumber,
    account_type,
    banking_method,
  };

  // // Update the dollar_rate field in the document
  informationDB.withdraw_numbers.push(newNumber);

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Numbers Added",
    data: updatedInformationDB,
  });
};

// API endpoint to remove a withdraw number by ID
exports.removeWithdrawNumber = async (req, res, next) => {
  const { withdrawNumberId } = req.params;

  // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();

  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // Find the index of the withdraw number to remove
  const numberIndex = informationDB.withdraw_numbers.findIndex(
    (number) => number.id === withdrawNumberId
  );

  if (numberIndex === -1) {
    return next(new AppError("Withdraw Number Not Found!", 404));
  }

  // Remove the withdraw number from the array
  informationDB.withdraw_numbers.splice(numberIndex, 1);

  // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Withdraw Number Removed",
    data: updatedInformationDB,
  });
};

// Upload or Update Ads image
exports.uploadAdsImage = async (req, res, next) => {
  const { adsImage } = req.body;

  // // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  const adId = uuid.v4();
  const expirationDate = new Date();
  expirationDate.setHours(23, 59, 59, 999);

  const adImage = {
    id: adId,
    imgUrl: adsImage,
    exp: expirationDate,
  };

  // // Update the dollar_rate field in the document
  informationDB.ad_images.push(adImage);

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Image Added",
    data: updatedInformationDB,
  });
};

// API endpoint to remove a image number by ID
exports.removeAdImage = async (req, res, next) => {
  const { imageId } = req.params;

  // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();

  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // Find the index of the withdraw number to remove
  const numberIndex = informationDB.ad_images.findIndex(
    (img) => img.id === imageId
  );

  if (numberIndex === -1) {
    return next(new AppError("Image Not Found!", 404));
  }

  // Remove the withdraw number from the array
  informationDB.ad_images.splice(numberIndex, 1);

  // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Ad Image Removed",
    data: updatedInformationDB,
  });
};

// Upload or Update Ads Percentage Rate
exports.adsPercentage = async (req, res, next) => {
  const { adsPercentage } = req.body;

  // // Find the informationDB document, assuming you have a method for it
  const informationDB = await UploadAdmin.findOne();
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  // // Update the dollar_rate field in the document
  informationDB.ads_percentage_rate = adsPercentage;

  // // Save the updated document
  const updatedInformationDB = await informationDB.save();

  res.status(200).json({
    message: "Ads Pencentage rate updated",
    data: updatedInformationDB,
  });
};

// Get all pending deposit transactions for admin review
exports.getPendingDepositTransactions = catchAsync(async (req, res, next) => {
  const pipeline = [
    {
      $match: {
        "transactionHistory.transaction_type": "deposit",
        "transactionHistory.transaction_status": "pending",
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        userName: "$userinformation.name",
        transactions: {
          $filter: {
            input: "$transactionHistory",
            as: "txn",
            cond: {
              $and: [
                { $eq: ["$$txn.transaction_type", "deposit"] },
                { $eq: ["$$txn.transaction_status", "pending"] },
              ],
            },
          },
        },
      },
    },
    {
      $unwind: "$transactions",
    },
    {
      $project: {
        userId: 1,
        userName: 1,
        transaction: "$transactions",
      },
    },
  ];

  const pendingDeposits = await User.aggregate(pipeline);

  res.status(200).json({
    success: true,
    message: "",
    data: pendingDeposits,
    length: pendingDeposits.length,
  });
});

// Get all pending withdraw transactions for admin review
exports.getPendingWithdrawTransactions = catchAsync(async (req, res, next) => {
  const pipeline = [
    {
      $match: {
        "transactionHistory.transaction_type": "withdraw",
        "transactionHistory.transaction_status": "pending",
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        userName: "$userinformation.name",
        transactions: {
          $filter: {
            input: "$transactionHistory",
            as: "txn",
            cond: {
              $and: [
                { $eq: ["$$txn.transaction_type", "withdraw"] },
                { $eq: ["$$txn.transaction_status", "pending"] },
              ],
            },
          },
        },
      },
    },
    {
      $unwind: "$transactions",
    },
    {
      $project: {
        userId: 1,
        userName: 1,
        transaction: "$transactions",
      },
    },
  ];

  const pendingWithdraws = await User.aggregate(pipeline);

  res.status(200).json({
    success: true,
    message: "",
    data: pendingWithdraws,
    length: pendingWithdraws.length,
  });
});

// Admin approves or rejects a transaction
exports.approveTransaction = catchAsync(async (req, res, next) => {
  // console.log(req.body)
  const { action, userId, transactionId } = req.body;
  // console.log(action, userId, transactionId);

  const user = await User.findById(userId);
  // console.log(user)
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const transaction = user.transactionHistory.find(
    (t) => t.trx_id === transactionId
  );

  // console.log(transaction);

  if (!transaction) {
    return next(new AppError("Transaction not found", 404));
  }

  // User validation failed: ads_wallet.balance: Cast to Number failed
  //  for value "NaN" (type number) at path "ads_wallet.balance"

  let newTransactionStatus;
  let newNotfication;

  if (action === "approve") {
    newTransactionStatus = "approved";

    const currentDate = new Date();

    const day = currentDate.getDate();
    const monthIndex = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const formattedDay = day <= 9 ? `0${day}` : day;
    const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

    var today = new Date();
    var time =
      today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

    const notificationID = uuid.v4();

    if (transaction.transaction_type === "deposit") {
      // console.log(getDate(), getTime(), "602 date and time");
      newNotfication = {
        id: notificationID,
        date: formattedDate,
        time,
        isSeen: false,
        message: `Your deposit request of $${transaction.amount} has been approved!`,
      };
      if (transaction.selected_wallet === "games_wallet") {
        user.games_wallet.balance += parseInt(transaction.amount);
      } else if (transaction.selected_wallet === "ads_wallet") {
        user.ads_wallet.balance += parseInt(transaction.amount);
      }
    } else if (transaction.transaction_type === "withdraw") {
      newNotfication = {
        id: notificationID,
        date: formattedDate,
        time,
        message: `Your withdraw request of $${transaction.amount} has been approved!`,
      };
      // if (transaction.selected_wallet === "games_wallet") {
      //   user.games_wallet.balance -= parseInt(transaction.amount);
      // } else if (transaction.selected_wallet === "ads_wallet") {
      //   user.ads_wallet.balance -= parseInt(transaction.amount);
      // }
    }

    user.notifications.push(newNotfication);

    await user.save();
  } else if (action === "reject") {
    const notificationID = uuid.v4();

    const currentDate = new Date();

    const day = currentDate.getDate();
    const monthIndex = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const formattedDay = day <= 9 ? `0${day}` : day;
    const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

    var today = new Date();
    var time =
      today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

    newTransactionStatus = "rejected";

    if (transaction.transaction_type === "deposit") {
      newNotfication = {
        id: notificationID,
        date: formattedDate,
        time,
        isSeen: false,
        message: `Your deposit request of $${transaction.amount} has been rejected!`,
      };
    } else if (transaction.transaction_type === "withdraw") {
      newNotfication = {
        id: notificationID,
        date: formattedDate,
        time,
        isSeen: false,
        message: `Your withdraw request of $${transaction.amount} has been rejected and $${transaction.amount} has been returned to your wallet`,
      };

      if (transaction.selected_wallet === "games_wallet") {
        user.games_wallet.balance += parseInt(transaction.amount);
      } else if (transaction.selected_wallet === "ads_wallet") {
        user.ads_wallet.balance += parseInt(transaction.amount);
      }
    }
    user.notifications.push(newNotfication);

    await user.save();
  }

  const updatedTransaction = user.transactionHistory.map((t) =>
    t.trx_id === transactionId
      ? { ...t, transaction_status: newTransactionStatus }
      : t
  );

  await User.findByIdAndUpdate(userId, {
    transactionHistory: updatedTransaction,
  });

  const updatedUser = await User.findById(userId);

  res.status(200).json({
    success: true,
    message: "Action Proceeded",
    data: updatedUser,
  });
});

// Find all time deposit amount
exports.depositedBalance = catchAsync(async (req, res) => {
  // Query the database to find all users with approved deposit transactions
  const users = await User.find({
    "transactionHistory.transaction_status": "approved",
    "transactionHistory.transaction_type": "deposit",
  });

  // Calculate the total deposited balance for each user
  const userBalances = users.map((user) => {
    const depositedBalance = user.transactionHistory
      .filter(
        (transaction) =>
          transaction.transaction_status === "approved" &&
          transaction.transaction_type === "deposit"
      )
      .reduce(
        (total, transaction) => total + parseFloat(transaction.amount),
        0
      );

    return {
      userId: user._id,
      userName: user.userinformation.name,
      depositedBalance,
    };
  });

  // Calculate the total deposited balance for all users
  const totalDepositedBalance = userBalances.reduce(
    (total, userBalance) => total + userBalance.depositedBalance,
    0
  );

  res.status(200).json({
    status: "success",
    message: "Total deposited balance for all users",
    totalDepositedBalance,
  });
});

exports.withdrawnBalance = catchAsync(async (req, res) => {
  // Query the database to find all users with approved withdraw transactions
  const users = await User.find({
    "transactionHistory.transaction_status": "approved",
    "transactionHistory.transaction_type": "withdraw",
  });

  // Calculate the total withdrawn balance for each user
  const userBalances = users.map((user) => {
    const withdrawnBalance = user.transactionHistory
      .filter(
        (transaction) =>
          transaction.transaction_status === "approved" &&
          transaction.transaction_type === "withdraw"
      )
      .reduce(
        (total, transaction) => total + parseFloat(transaction.amount),
        0
      );

    return {
      userId: user._id,
      userName: user.userinformation.name,
      withdrawnBalance,
    };
  });

  // Calculate the total withdrawn balance for all users
  const totalWithdrawnBalance = userBalances.reduce(
    (total, userBalance) => total + userBalance.withdrawnBalance,
    0
  );

  res.status(200).json({
    status: "success",
    message: "Total withdrawn balance for all users",
    totalWithdrawnBalance,
  });
});

// API endpoint to calculate total ads_wallet and games_wallet balances for all users
exports.totalBalances = catchAsync(async (req, res) => {
  const pipeline = [
    {
      $group: {
        _id: null,
        totalAdsWalletBalance: { $sum: "$ads_wallet.balance" },
        totalGamesWalletBalance: { $sum: "$games_wallet.balance" },
      },
    },
  ];

  const result = await User.aggregate(pipeline);

  // Extract the totals from the result
  const totalAdsWalletBalance = result[0].totalAdsWalletBalance;
  const totalGamesWalletBalance = result[0].totalGamesWalletBalance;

  // console.log(totalAdsWalletBalance, totalGamesWalletBalance);

  res.status(200).json({
    status: "success",
    message: "Total wallet balances calculated",
    totalAvailableBalance: totalAdsWalletBalance + totalGamesWalletBalance,
  });
});

// Find all the users
exports.allUsers = catchAsync(async (req, res) => {
  // Query the database to get all users
  const users = await User.find();

  // Calculate the required fields for each user
  const usersWithFields = users.map((user) => {
    const {
      _id,
      userinformation,
      transactionHistory,
      games_wallet,
      ads_wallet,
    } = user;
    const totalApprovedDeposit = transactionHistory
      .filter(
        (transaction) =>
          transaction.transaction_status === "approved" &&
          transaction.transaction_type === "deposit"
      )
      .reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    const totalApprovedWithdraw = transactionHistory
      .filter(
        (transaction) =>
          transaction.transaction_status === "approved" &&
          transaction.transaction_type === "withdraw"
      )
      .reduce((acc, transaction) => acc + parseFloat(transaction.amount), 0);

    const totalBalance = ads_wallet.balance + games_wallet.balance;

    return {
      id: _id,
      username: userinformation.username,
      phonenumber: userinformation.phonenumber,
      totalApprovedDeposit,
      totalApprovedWithdraw,
      totalBalance,
      isBlocked: userinformation.isBlocked,
    };
  });

  res.status(200).json({
    status: "success",
    data: usersWithFields,
  });
});

// Block a user
exports.blockUser = catchAsync(async (req, res) => {
  const userId = req.params.userId;

  // console.log(userId);

  // Find the user by userId and update the isBlocked field to true
  try {
    await User.findByIdAndUpdate(userId, {
      $set: { "userinformation.isBlocked": true },
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }

  res.status(200).json({
    status: "success",
    message: "User blocked successfully",
  });
});

// Unblock a user
exports.unblockUser = catchAsync(async (req, res) => {
  const userId = req.params.userId;

  try {
    // Find the user by userId and update the isBlocked field to false
    await User.findByIdAndUpdate(userId, {
      $set: { "userinformation.isBlocked": false },
    });
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
