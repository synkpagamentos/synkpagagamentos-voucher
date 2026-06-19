const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const voucherSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  value: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  isRedeemed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

voucherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

voucherSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Voucher = mongoose.model('Voucher', voucherSchema);
module.exports = Voucher;
