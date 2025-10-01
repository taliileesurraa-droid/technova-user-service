const { Payment } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { deleteFile } = require("../utils/fileHelper");
const path = require("path");

// CREATE with file upload
exports.createPayment = asyncHandler(async (req, res) => {
  const paymentData = { ...req.body };

  if (req.user.type === "passenger") {
    paymentData.passenger_id = req.user.id;
  }

  if (req.file) {
    paymentData.receipt_image = path.join(
      "uploads",
      "payments",
      req.file.filename
    );
  }

  const payment = await Payment.create(paymentData);
  res.status(201).json({ success: true, data: payment });
});

// READ all - Admin sees all, Passenger sees only their own
exports.getPayments = asyncHandler(async (req, res) => {
  let whereClause = {};

  if (req.user.type === "passenger") {
    whereClause.passenger_id = req.user.id;
  }

  const payments = await Payment.findAll({
    where: whereClause,
    include: [{ association: "contract" }],
  });

  const paymentsWithUrls = payments.map((payment) => ({
    ...payment.toJSON(),
    receipt_image_url: payment.receipt_image
      ? `${req.protocol}://${req.get("host")}/${payment.receipt_image}`
      : null,
  }));

  res.json({ success: true, data: paymentsWithUrls });
});

// READ one - Admin sees all, Passenger sees only their own
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, {
    include: [{ association: "contract" }],
  });

  if (!payment) {
    return res
      .status(404)
      .json({ success: false, message: "Payment not found" });
  }

  // Ownership check for passengers
  if (req.user.type === "passenger" && payment.passenger_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Add full URL for the receipt image
  const paymentWithUrl = {
    ...payment.toJSON(),
    receipt_image_url: payment.receipt_image
      ? `${req.protocol}://${req.get("host")}/${payment.receipt_image}`
      : null,
  };

  res.json({ success: true, data: paymentWithUrl });
});

// UPDATE with optional file upload
exports.updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id);

  if (!payment) {
    return res
      .status(404)
      .json({ success: false, message: "Payment not found" });
  }

  const updateData = { ...req.body };

  // Handle file upload - delete old file if new one is uploaded
  if (req.file) {
    // Delete old file if it exists
    if (payment.receipt_image) {
      deleteFile(payment.receipt_image);
    }

    // Save the relative path to the new file
    updateData.receipt_image = path.join(
      "uploads",
      "payments",
      req.file.filename
    );
  }

  const [updated] = await Payment.update(updateData, {
    where: { id: req.params.id },
  });

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Payment not found" });
  }

  res.json({ success: true, message: "Payment updated" });
});

// DELETE with file cleanup
exports.deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id);

  if (!payment) {
    return res
      .status(404)
      .json({ success: false, message: "Payment not found" });
  }

  // Delete associated file if it exists
  if (payment.receipt_image) {
    deleteFile(payment.receipt_image);
  }

  const deleted = await Payment.destroy({ where: { id: req.params.id } });

  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Payment not found" });
  }

  res.json({ success: true, message: "Payment deleted" });
});
