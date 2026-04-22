const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      max: 1000000
    },
    image: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

productSchema.index({ createdAt: -1 });
productSchema.index({ name: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model("Product", productSchema);