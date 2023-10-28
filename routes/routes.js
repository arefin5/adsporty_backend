const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const adminController = require("../controllers/adminController");
const authController = require("../controllers/authController");

router.get("/", userController.home);
router.post("/signup", authController.signup);
router.get("/getAllUsers", authController.getAllUsers);
router.post("/login", authController.login);
router.get("/logout", authController.logout);
router.get("/currentUser/:userId", authController.currentUser);
router.patch("/updateMyPassword/:id", authController.updatePassword);
router.put("/marked-as-seen", userController.MarkAllNotificationsAsSeen);
router.post("/deposit", authController.protect, userController.deposit);
router.post("/withdraw", authController.protect, userController.withdraw);
router.post(
  "/depositAdsReveneue",
  authController.protect,
  userController.depositAdsReveneue
);
router.post(
  "/transferToAds",
  authController.protect,
  userController.transferBalanceToAds
);
router.post(
  "/transferToGames",
  authController.protect,
  userController.transferBalanceToGames
);

//add prediction
router.post(
  "/add-prediction",
  authController.protect,
  userController.userPrediction
);
router.post("/ad-game-revenue/:id", userController.adGameRevenue);
router.post("/send-mail", userController.mailSending);

//get user selected teams
router.get("/get-user-selected-teams/:id", userController.getSelectedTeams);
router.post("/add-ad-revenue", userController.addingAdReveneue);
router.post("/trackAd", userController.trackAd);
router.post("/calculate-ads-revenue", userController.calculateAdsRevenue);

//Admin Deal
router.post("/admin/registration", adminController.registration);
router.post("/admin/login", adminController.login);
router.post("/admin/upload-informations", adminController.uploadInformations);
router.get("/admin/get-informations", adminController.getInformations);
router.post("/admin/upload-game", adminController.uploadGame);
router.put("/admin/update-result/:id", adminController.updateResult);
router.delete("/admin/remove-game/:id", adminController.removeGame);
router.put("/admin/update-dollar-rate", adminController.updateDollarRate);
router.put("/admin/update-deposit-rate", adminController.uploadDepositLimit);
router.put("/admin/update-game-rate", adminController.updateGameRate);
router.put(
  "/admin/update-withdraw-number",
  adminController.updateWithdrawNumber
);
router.delete(
  "/admin/remove-withdraw-number/:withdrawNumberId",
  adminController.removeWithdrawNumber
);
router.put("/admin/upload-ads-image", adminController.uploadAdsImage);
router.delete("/admin/remove-ad-image/:imageId", adminController.removeAdImage);
router.put("/admin/ads-percentage", adminController.adsPercentage);

router.get(
  "/admin/pending-deposit-transactions",
  adminController.getPendingDepositTransactions
);

router.get(
  "/admin/pending-withdraw-transactions",
  adminController.getPendingWithdrawTransactions
);
router.put("/admin/approve", adminController.approveTransaction);
router.get("/admin/deposited-balances", adminController.depositedBalance);
router.get("/admin/withdrawn-balances", adminController.withdrawnBalance);
router.get("/admin/totalBalances", adminController.totalBalances);
router.get("/admin/allUsers", adminController.allUsers);
router.put("/admin/block-user/:userId", adminController.blockUser);
router.put("/admin/unblock-user/:userId", adminController.unblockUser);

module.exports = router;
