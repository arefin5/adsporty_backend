const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const UploadAdmin = require("../models/AdminUploadModel");
const schedule = require("node-schedule");
const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");
// Schedule the job to run at 11:59 PM daily and Send 3% commission to refferer User
const job = schedule.scheduleJob("59 23 * * *", async function () {
  try {
    const users = await User.find({});

    const currentDate = new Date();
    const day = currentDate.getDate();
    const monthIndex = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const formattedDay = day <= 9 ? `0${day}` : day;
    const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

    // Iterate through the users and perform the specific task for each user
    for (const user of users) {
      if (user.userinformation.referrerReferralID) {
        const referrerUserID = user.userinformation.referrerReferralID;

        const referrerUser = await User.findOne({
          "userinformation.referralID": referrerUserID,
        });

        // console.log("30, the referrerUser is", referrerUser);

        if (!referrerUser) {
          console.log("Somehow referrerUser is missing!");
        }

        const calculateRefferBonus = (
          (user?.todaysEarning?.earning_from_games +
            user?.todaysEarning?.earning_from_ads +
            user?.todaysEarning?.earning_from_referral) *
          0.03
        ).toFixed(2); //3% of the users daily earnings
        const RefferBonus = parseFloat(calculateRefferBonus);

        // console.log("Bonus should be go", RefferBonus);

        const newTransaction = {
          date: formattedDate,
          selected_wallet: "ads_wallet",
          amount: RefferBonus,
          payment_method: "automation",
          payment_phone_number: "",
          trx_id: "",
          transaction_status: "approved",
          transaction_type: "Refferal Received",
        };

        referrerUser.transactionHistory.push(newTransaction);
        referrerUser.totalEarnings += RefferBonus;
        referrerUser.totalReferralEarnings += RefferBonus;
        referrerUser.ads_wallet.balance += RefferBonus;
        referrerUser.todaysEarning.earning_from_referral += RefferBonus;

        await referrerUser.save();

        const newTransactionUser = {
          date: formattedDate,
          selected_wallet: "ads_wallet",
          amount: RefferBonus,
          payment_method: "automation",
          payment_phone_number: "",
          trx_id: "",
          transaction_status: "approved",
          transaction_type: "Refferal Sent",
        };

        await User.findOneAndUpdate(
          { _id: user._id },
          {
            $inc: {
              "ads_wallet.balance": -RefferBonus,
            },
            $set: {
              "todaysEarning.earning_from_ads": 0,
              "todaysEarning.earning_from_games": 0,
              "todaysEarning.earning_from_referral": 0,
            },
          },
          { new: true }
        );

        user.transactionHistory.push(newTransactionUser);

        const indexToRemove = user.trackAdRevenue.findIndex(
          (item) => item.date === formattedDate
        );

        if (indexToRemove !== -1) {
          user.trackAdRevenue.splice(indexToRemove, 1);
        }

        // console.log("The user is", user);

        await user.save();
      } else {
        // console.log("This user has not a referel id");
        await User.findOneAndUpdate(
          { _id: user._id },
          {
            $set: {
              "todaysEarning.earning_from_ads": 0,
              "todaysEarning.earning_from_games": 0,
              "todaysEarning.earning_from_referral": 0,
            },
          },
          { new: true }
        );
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
});

//Home
exports.home = (req, res) => {
  res.send("hello world");
};

//Deposit API
exports.deposit = catchAsync(async (req, res, next) => {
  const {
    selected_wallet,
    deposit_amount,
    payment_method,
    payment_phone_number,
    trx_id,
  } = req.body;

  // console.log(typeof deposit_amount, "typeof deposit amount");

  const currentDate = new Date();

  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formattedDay = day <= 9 ? `0${day}` : day;

  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

  // console.log(formattedDate);

  const newTransaction = {
    date: formattedDate,
    selected_wallet,
    amount: deposit_amount,
    payment_method: payment_method,
    payment_phone_number,
    trx_id,
    transaction_status: "pending",
    transaction_type: "deposit",
  };

  // Check if isFirstDeposit is true and update if needed
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user) {
    let firstDepositTransaction;
    if (user.transactionHistory.length === 0) firstDepositTransaction = true;

    if (firstDepositTransaction) {
      user.transactionHistory.push(newTransaction);

      await user.save();

      // Use the findOne method to find a user by the referrerReferralID
      const referrerReferralID = user.userinformation.referrerReferralID;

      if (referrerReferralID) {
        const referrerUser = await User.findOne({
          "userinformation.referralID": referrerReferralID,
        });

        if (!referrerUser) {
          return next(new AppError("Refferer User not found", 404));
        }
        // console.log(referrerUser);

        const Bonus = parseFloat(deposit_amount) * 0.15;

        // Update the fields without using save()
        const updatedReferrerUser = await User.findOneAndUpdate(
          { _id: referrerUser._id }, // Use the appropriate identifier for the user (e.g., _id)
          {
            $inc: {
              "ads_wallet.balance": Bonus,
              totalEarnings: Bonus,
              totalReferralEarnings: Bonus,
            },
            $set: {
              "todaysEarning.earning_from_referral": Bonus,
            },
          },
          { new: true } // This option returns the updated document
        );
        if (!updatedReferrerUser) {
          return next(new AppError("Referrer User not found", 404));
        }

        const newReffererUserTransaction = {
          date: formattedDate,
          selected_wallet: "ads_wallet",
          amount: Bonus,
          payment_method: "",
          payment_phone_number: "",
          trx_id: "",
          transaction_status: "approved",
          transaction_type: "Refferal Received",
        };

        referrerUser.transactionHistory.push(newReffererUserTransaction);
        try {
          await referrerUser.save();
          // Log a success message if the save operation is successful
          // console.log("ReffererUser saved successfully.");
        } catch (error) {
          // Log the error if the save operation fails
          console.error("Error saving user:", error);
        }

        const informationDB = await UploadAdmin.find();
        // console.log(informationDB[0]);
        informationDB[0].total_reffered_balance += Bonus;

        await informationDB[0].save();

        const updatedUser = await User.findById(user.id);

        res.status(200).json({
          success: true,
          message:
            "Your Deposit request submitted. Your wallet will be credited within 24 hours.",
          data: updatedUser,
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Your Deposit request submitted. Your wallet will be credited within 24 hours.",
      });
    } else {
      // console.log("Not the first deposit for the user.");
      user.transactionHistory.push(newTransaction);
      await user.save();
      const updatedUser = await User.findById(user.id);

      res.status(200).json({
        success: true,
        message:
          "Your Deposit request submitted. Your wallet will be credited within 24 hours.",
        data: updatedUser,
      });
    }
  }
});

//Withdraw API
exports.withdraw = catchAsync(async (req, res, next) => {
  // console.log(req.body);
  const { selected_wallet, withdraw_amount, selected_method, reciever_number } =
    req.body;

  function generateRandomId(length) {
    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomId = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      randomId += charset.charAt(randomIndex);
    }

    return randomId;
  }
  const currentDate = new Date(); // Get the current date and time

  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formattedDay = day <= 9 ? `0${day}` : day;

  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

  // console.log(formattedDate);
  const newTransaction = {
    date: formattedDate,
    selected_wallet,
    amount: withdraw_amount,
    selected_method,
    reciever_number,
    transaction_status: "pending",
    transaction_type: "withdraw",
    trx_id: generateRandomId(8),
  };

  const user = await User.findById(req.user.id);
  // console.log(user.ads_wallet);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // console.log(withdraw_amount, selected_wallet,  user[selected_wallet]);

  let availableBalance = true;
  if (withdraw_amount > user[selected_wallet].balance) {
    availableBalance = false;
    return next(new AppError("Insufficient Balance!", 404));
  }

  // User validation failed: games_wallet.balance: Cast to Number failed for value "NaN" (type number) at path "games_wallet.balance"

  if (availableBalance) {
    const amount = parseFloat(withdraw_amount);
    // console.log(
    //   selected_wallet,
    //   withdraw_amount,
    //   typeof withdraw_amount,
    //   amount,
    //   typeof amount
    // );
    if (selected_wallet === "ads_wallet") {
      user.ads_wallet.balance -= amount;
    } else if (selected_wallet === "games_wallet") {
      user.games_wallet.balance -= amount;
    }
    user.transactionHistory.push(newTransaction);
    await user.save();
    const updatedUser = await User.findById(user.id);

    res.status(200).json({
      success: true,
      message:
        "Your Withdraw Request submitted. You will get your money within 24 hours",
      data: updatedUser,
    });
  }
});

// Transfer balance to ads wallet from games wallet
exports.transferBalanceToAds = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const amountToTransfer = req.body.amount;

  // console.log(userId, amountToTransfer)

  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if the user has sufficient balance in the games_wallet
  if (user.games_wallet.balance < amountToTransfer) {
    return next(new AppError("Insufficient balance in games wallet", 404));
  }

  // Deduct the balance from games_wallet and add it to ads_wallet
  user.games_wallet.balance -= parseInt(amountToTransfer);
  user.ads_wallet.balance += parseInt(amountToTransfer);

  const currentDate = new Date(); // Get the current date and time

  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formattedDay = day <= 9 ? `0${day}` : day;

  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

  // Create a transaction record
  const transaction = {
    date: formattedDate,
    selected_wallet: "ads_wallet",
    amount: amountToTransfer,
    transaction_type: "transfer",
    transaction_status: "automation",
  };

  user.transactionHistory.push(transaction);

  // Save the updated user document
  await user.save();

  return res.status(200).json({
    success: true,
    message: `$${amountToTransfer} transferred to ads wallet successfully`,
  });
});

// Transfer balance to games wallet from ads wallet
exports.transferBalanceToGames = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const amountToTransfer = req.body.amount;

  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if the user has sufficient balance in the ads_wallet
  if (user.ads_wallet.balance < amountToTransfer) {
    return next(new AppError("Insufficient balance in ads wallet", 404));
  }

  // Deduct the balance from ads_wallet and add it to games_wallet
  user.ads_wallet.balance -= parseInt(amountToTransfer);
  user.games_wallet.balance += parseInt(amountToTransfer);

  const currentDate = new Date(); // Get the current date and time

  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formattedDay = day <= 9 ? `0${day}` : day;

  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

  // Create a transaction record
  const transaction = {
    date: formattedDate,
    selected_wallet: "games_wallet",
    amount: amountToTransfer,
    transaction_type: "transfer",
    transaction_status: "automation",
  };

  user.transactionHistory.push(transaction);

  // Save the updated user document
  await user.save();

  return res.status(200).json({
    success: true,
    message: `$${amountToTransfer} transferred to games wallet successfully`,
  });
});

// Add Ads revenew to the ads wallet
exports.depositAdsReveneue = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { amount } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Add the specified amount to the ads_wallet's balance
  user.ads_wallet.balance += parseInt(amount);

  // Save the updated user document
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Amount added to ads wallet successfully",
  });
});

//user ad prediction API
exports.userPrediction = catchAsync(async (req, res) => {
  // console.log(req.body);
  // // Create a new GamePrediction instance and set each field individually
  const newPrediction = req.body;
  const predictionAmounts = req.body.predictionInformations;
  const totalBetAmount = predictionAmounts.reduce((total, prediction) => {
    return total + prediction.betAmount;
  }, 0);
  // console.log(newPrediction);

  const user = await User.findById(req.user.id);
  // console.log(user.gamesPredictionHistory, 'dkfjdkfjkdjkjkd');
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const currentDate = new Date();

  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const formattedDay = day <= 9 ? `0${day}` : day;
  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;

  const newTransaction = {
    date: formattedDate,
    selected_wallet: "games_wallet",
    amount: totalBetAmount,
    payment_method: "automation",
    payment_phone_number: "",
    trx_id: "",
    transaction_status: "approved",
    transaction_type: "Game Prediction",
  };

  // Save the new prediction to the gamePredictionHistory collection
  if (user) {
    user.gamesPredictionHistory.push(newPrediction);
    user.games_wallet.balance -= totalBetAmount;
    user.transactionHistory.push(newTransaction);
    await user.save();

    const updatedUser = await User.findById(user.id);

    res.status(200).json({
      success: true,
      message: "Game Predicted Successfully!",
      data: updatedUser,
    });
  }
});

//user's game revenue add  API

exports.adGameRevenue = catchAsync(async (req, res) => {
  const id = req.params.id;
  const userId = req.body.userId;
  const winning_team = req.body.winning_team;
  // console.log(id, userId, winning_team);

  // Find the user by userId
  const user = await User.findById(userId);

  const predictionInformations = user.gamesPredictionHistory.find(
    (g) => g.gameId === id
  );

  // console.log(predictionInformations, "504");

  let matchedPotentialWinnings = 0;
  let remainingBetAmount = 0;
  let winning_bonus = 0;
  let winningTeam = "";

  predictionInformations.predictionInformations.forEach((prediction) => {
    if (prediction.teamName === winning_team) {
      matchedPotentialWinnings = prediction.potentialWinnings;
      winning_bonus = prediction.potentialWinnings - prediction.betAmount;
      winningTeam = prediction.teamName;
    } else {
      remainingBetAmount += prediction.betAmount;
    }
  });

  const totalPotentialWinnings = matchedPotentialWinnings + remainingBetAmount;

  const currentDate = new Date();
  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const formattedDay = day <= 9 ? `0${day}` : day;
  const formattedDate = `${formattedDay}-${monthIndex}-${year}`;
  const newTransaction = {
    date: formattedDate,
    selected_wallet: "games_wallet",
    amount: totalPotentialWinnings,
    payment_method: "automation",
    payment_phone_number: "",
    trx_id: "",
    transaction_status: "approved",
    transaction_type: "Prediction Bonus",
  };

  // Update the winning_team field in predictionInformations
  // console.log(predictionInformations, winning_team, "541");
  predictionInformations.winning_team = winning_team;
  predictionInformations.isApiCalled = true;
  // Update user's transaction history and games_wallet
  user.transactionHistory.push(newTransaction);
  user.games_wallet.balance += totalPotentialWinnings;

  // console.log(winning_bonus, "547");
  // Update todaysEarning.earning_from_games if winning_bonus is greater than 0
  if (winning_bonus > 0) {
    user.games_wallet.life_time_game_predict_earnings += winning_bonus;
    user.totalEarnings += winning_bonus;
    user.todaysEarning.earning_from_games += winning_bonus;
  }
  user.markModified("gamesPredictionHistory");

  // Use findOneAndUpdate to update the user document
  await User.findOneAndUpdate({ _id: userId }, user);

  // Send a response
  res.json({ message: "Game revenue updated successfully", data: winningTeam });
});

// Main Sending
exports.mailSending = async (req, res) => {
  // console.log(req.body);
  // console.log(process.env.EMAIL, process.env.PASSWORD);

  let config = {
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  };

  let transporter = nodemailer.createTransport(config);

  let MailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Mailgen",
      link: "https://mailgen.js/",
    },
  });

  let response = {
    body: {
      
      name: `${req.body.name}`,
      intro: `Phone Number: ${req.body.phone} `,
      outro: `Message: ${req.body.details}`,
    },
  };

  let mail = MailGenerator.generate(response);

  let message = {
    from: "user@gmail.com",
    to: "tirionlanster7@gmail.com",
    subject: "Queries",
    html: mail,
  };

  transporter
    .sendMail(message)
    .then(() => {
      return res.status(201).json({
        msg: "you should receive an email",
      });
    })
    .catch((error) => {
      console.error("Error sending email:", error);
      return res.status(500).json({ error });
    });
};

//Calculate Ads Revenue API and saving to database
exports.calculateAdsRevenue = catchAsync(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const user_ads_wallet_balance = user.ads_wallet.balance;
  const informationDB = await UploadAdmin.findOne();
  if (!informationDB) {
    return next(new AppError("Information Database Not Found!", 404));
  }

  const ads_percentage_rate = informationDB.ads_percentage_rate;
  const ads_length = informationDB.ad_images.length;
  // console.log("Total ads is", ads_length);

  const ad_revenue = (
    (user_ads_wallet_balance * (ads_percentage_rate / 100)) /
    ads_length
  ).toFixed(2);

  const currentDate = new Date();
  const day = currentDate.getDate();
  const monthIndex = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const formattedDay = day <= 9 ? `0${day}` : day;
  const todaysDate = `${formattedDay}-${monthIndex}-${year}`;

  const newAdRevenue = {
    date: todaysDate,
    revenue: ad_revenue,
    current_ad_wallet_balance: user_ads_wallet_balance.toFixed(2),
    current_ad_rate: ads_percentage_rate,
  };

  if (user.trackAdRevenue.length === 0) {
    user.trackAdRevenue.push(newAdRevenue);
  } else {
    const existingAdRevenue = user.trackAdRevenue.find(
      (revenue) => revenue.date === todaysDate
    );

    if (!existingAdRevenue) {
      user.trackAdRevenue.push(newAdRevenue);
    }
  }

  await user.save();

  const updatedUser = await User.findById(userId);

  res.status(200).json({
    data: updatedUser,
  });
});

//user addingAdReveneue API
exports.addingAdReveneue = catchAsync(async (req, res) => {
  const { adId, revenue, userId } = req.body;
  // console.log( adId, revenue, userId);
  // console.log("Type of", typeof(revenue))

  const user = await User.findById(userId);
  // console.log(user);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Add the specified amount to the ads_wallet's balance
  user.ads_wallet.balance += parseFloat(revenue);
  user.trackAdsView.push(adId);
  user.todaysEarning.earning_from_ads += parseFloat(revenue);
  user.totalEarnings += parseFloat(revenue);
  user.ads_wallet.life_time_ads_revenue += parseFloat(revenue);
  user.markModified("todaysEarning");

  // Save the updated user document
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Ads revenue added successfully",
  });
});
//user trackAd API
exports.trackAd = catchAsync(async (req, res) => {
  const { adId, revenue, userId } = req.body;
  // console.log("Int", parseInt(revenue), "Float", parseFloat(revenue));
  // console.log("Type of", typeof(revenue))

  const user = await User.findById(userId);
  // console.log(typeof(user.todaysEarning.earning_from_ads), typeof(revenue));

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Add the specified amount to the ads_wallet's balance
  user.ads_wallet.balance += revenue;
  user.trackAdsView.push(adId);
  user.todaysEarning.earning_from_ads += revenue;
  user.markModified("todaysEarning");

  // Save the updated user document
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Ads revenue added successfully",
  });
});

// get user selected teams name
exports.getSelectedTeams = catchAsync(async (req, res) => {
  // console.log(req.params.id);

  //   // Fetch the user's information from the database based on the provided userId
  const user = await User.findById(req.params.id);
  // console.log(user);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  //   // Assuming that the selected games are stored in the 'gamesPredictionHistory' array
  const selectedGames = user.gamesPredictionHistory;

  res.status(200).json(selectedGames);
});

exports.MarkAllNotificationsAsSeen = catchAsync(async (req, res, next) => {
  const userID = req.body.userID;

  // Find the user and update all notifications to isSeen: true
  const updatedUser = await User.findOneAndUpdate(
    { _id: userID },
    {
      $set: {
        "notifications.$[].isSeen": true, // Update isSeen field for all notifications
      },
    },
    { new: true } // Return the updated user document
  );

  if (!updatedUser) {
    return next(new AppError("User not found", 404));
  }

  // Respond with a success message or appropriate response
  res.status(200).json({
    message: "All notifications marked as seen",
    data: updatedUser,
  });
});
