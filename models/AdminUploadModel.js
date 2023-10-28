const mongoose = require("mongoose");

const adminUploadSchema = new mongoose.Schema({
  dollar_rate: {
    type: Number,
  },
  ads_percentage_rate: {
    type: Number,
  },
  game_percentage_rate: {
    type: Number,
  },
  min_deposit_rate: {
    type: Number,
  },
  withdraw_numbers: [],
  ad_images: [{}],
  uploadGames: [],
  total_reffered_balance: { type: Number, default: 0 },
});

const AdminUploadModel = mongoose.model("SiteInformations", adminUploadSchema);

module.exports = AdminUploadModel;
