const { Payment } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { deleteFile } = require("../utils/fileHelper");
const path = require("path");
const { getPassengerById } = require("../utils/userService");

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

  // Enrich with passenger info (name, phone, email)
  const uniquePassengerIds = [...new Set(paymentsWithUrls.map(p => p.passenger_id).filter(Boolean))];
  const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
  const passengerInfoMap = new Map();
  await Promise.all(uniquePassengerIds.map(async (pid) => {
    try {
      const info = await getPassengerById(pid, authHeader);
      if (info) passengerInfoMap.set(pid, info);
    } catch (_) {}
  }));

  const enriched = paymentsWithUrls.map(p => {
    const info = passengerInfoMap.get(p.passenger_id);
    if (!info) return p;
    return {
      ...p,
      passenger_name: info.name || null,
      passenger_phone: info.phone || null,
      passenger_email: info.email || null,
    };
  });

  res.json({ success: true, data: enriched });
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

  // Enrich single payment with passenger info
  try {
    if (paymentWithUrl.passenger_id) {
      const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
      const info = await getPassengerById(paymentWithUrl.passenger_id, authHeader);
      if (info) {
        paymentWithUrl.passenger_name = info.name || null;
        paymentWithUrl.passenger_phone = info.phone || null;
        paymentWithUrl.passenger_email = info.email || null;
      }
    }
  } catch (_) {}

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
