const { Subscription, Contract } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");

// CREATE
exports.createSubscription = asyncHandler(async (req, res) => {
  const { contract_id, amount_paid } = req.body;

  const contract = await Contract.findByPk(contract_id);
  if (!contract)
    return res
      .status(404)
      .json({ success: false, message: "Contract not found" });

  let status = "PENDING";
  if (amount_paid >= contract.cost) status = "ACTIVE";
  else if (amount_paid > 0) status = "PARTIAL";

  const subscription = await Subscription.create({ ...req.body, status });
  res.status(201).json({ success: true, data: subscription });
});

// READ all - Admin sees all, Passenger sees only their own
exports.getSubscriptions = asyncHandler(async (req, res) => {
  let whereClause = {};

  if (req.user.type === "passenger") {
    whereClause.passenger_id = req.user.id;
  }

  const subscriptions = await Subscription.findAll({
    where: whereClause,
    include: [{ association: "contract" }],
  });
  res.json({ success: true, data: subscriptions });
});

// READ one - Admin sees all, Passenger sees only their own
exports.getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findByPk(req.params.id, {
    include: [{ association: "contract" }],
  });

  if (!subscription) {
    return res
      .status(404)
      .json({ success: false, message: "Subscription not found" });
  }

  // Ownership check for passengers
  if (
    req.user.type === "passenger" &&
    subscription.passenger_id !== req.user.id
  ) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  res.json({ success: true, data: subscription });
});

// UPDATE
exports.updateSubscription = asyncHandler(async (req, res) => {
  const [updated] = await Subscription.update(req.body, {
    where: { id: req.params.id },
  });
  if (!updated)
    return res
      .status(404)
      .json({ success: false, message: "Subscription not found" });
  res.json({ success: true, message: "Subscription updated" });
});

// DELETE
exports.deleteSubscription = asyncHandler(async (req, res) => {
  const deleted = await Subscription.destroy({ where: { id: req.params.id } });
  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Subscription not found" });
  res.json({ success: true, message: "Subscription deleted" });
});
