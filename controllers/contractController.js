const { Contract, Discount, Subscription } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");

// Helper function to find an active discount.
const findActiveDiscount = async (discountId) => {
  if (!discountId) return null;
  return await Discount.findOne({
    where: { id: discountId, status: "APPLY" },
  });
};

// CREATE
exports.createContract = asyncHandler(async (req, res) => {
  const { cost, has_discount, discount_id } = req.body;
  let finalCost = parseFloat(cost);

  if (has_discount === true && discount_id) {
    const discount = await findActiveDiscount(discount_id);
    if (discount) {
      const percentage = parseFloat(discount.discount_percentage);
      const discountAmount = finalCost * (percentage / 100);
      finalCost = finalCost - discountAmount;
    }
  }

  const contractData = { ...req.body, cost: finalCost.toFixed(2) };
  const contract = await Contract.create(contractData);
  res.status(201).json({ success: true, data: contract });
});

// UPDATE
exports.updateContract = asyncHandler(async (req, res) => {
  const contractId = req.params.id;
  const updateData = req.body;

  const contract = await Contract.findByPk(contractId);
  if (!contract) {
    return res
      .status(404)
      .json({ success: false, message: "Contract not found" });
  }

  const isCurrentlyDiscounted = contract.has_discount;
  const willBeDiscounted = updateData.hasOwnProperty("has_discount")
    ? updateData.has_discount
    : isCurrentlyDiscounted;

  if (!isCurrentlyDiscounted && willBeDiscounted) {
    // --- SCENARIO A: Turning ON the discount flag ---
    const discountId = updateData.discount_id || contract.discount_id;
    const discount = await Discount.findOne({
      where: { id: discountId, status: "APPLY" },
    }); // Check master switch

    if (discount) {
      // If master switch is ON, apply the discount.
      const baseCost = parseFloat(contract.cost);
      const percentage = parseFloat(discount.discount_percentage);
      updateData.cost = (baseCost - baseCost * (percentage / 100)).toFixed(2);
    }
    // If master switch is OFF, the flag will be set to true, but the cost will not change yet.
  } else if (isCurrentlyDiscounted && !willBeDiscounted) {
    // --- SCENARIO B: Turning OFF the discount flag ---
    const discount = await Discount.findByPk(contract.discount_id);
    if (discount) {
      const currentCost = parseFloat(contract.cost);
      const percentage = parseFloat(discount.discount_percentage);
      // Revert the cost regardless of the discount's status.
      updateData.cost = (currentCost / (1 - percentage / 100)).toFixed(2);
    }
  }

  await contract.update(updateData);
  const updatedContract = await Contract.findByPk(contractId);
  res.json({ success: true, data: updatedContract });
});

// READ all - Admin sees all, Passenger sees only their own
exports.getContracts = asyncHandler(async (req, res) => {
  let whereClause = {};

  // Passengers can only see contracts they're associated with
  if (req.user.type === "passenger") {
    const passengerSubscriptions = await Subscription.findAll({
      where: { passenger_id: req.user.id },
      attributes: ["contract_id"],
    });

    const contractIds = passengerSubscriptions.map((sub) => sub.contract_id);
    if (contractIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    whereClause.id = contractIds;
  }

  const contracts = await Contract.findAll({
    where: whereClause,
    include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });
  res.json({ success: true, data: contracts });
});

// READ one - Admin sees all, Passenger sees only their own
exports.getContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findByPk(req.params.id, {
    include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });

  if (!contract) {
    return res
      .status(404)
      .json({ success: false, message: "Contract not found" });
  }

  // Ownership check for passengers
  if (req.user.type === "passenger") {
    const subscription = await Subscription.findOne({
      where: { passenger_id: req.user.id, contract_id: contract.id },
    });
    if (!subscription) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  }

  res.json({ success: true, data: contract });
});

// NEW: Get only ACTIVE contracts
exports.getActiveContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.findAll({
    where: { status: "ACTIVE" },
    // include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });

  // Return empty array instead of error when no contracts found
  res.json({ success: true, data: contracts });
});

// NEW: Get INDIVIDUAL contracts
exports.getIndividualContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.findAll({
    where: { contract_type: "INDIVIDUAL" },
    // include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });
  res.json({ success: true, data: contracts });
});

// NEW: Get GROUP contracts
exports.getGroupContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.findAll({
    where: { contract_type: "GROUP" },
    // include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });
  res.json({ success: true, data: contracts });
});

// NEW: Get INSTITUTIONAL contracts
exports.getInstitutionalContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.findAll({
    where: { contract_type: "INSTITUTIONAL" },
    // include: ["discount", "subscriptions", "payments", "ride_schedules"],
  });
  res.json({ success: true, data: contracts });
});
// DELETE
exports.deleteContract = asyncHandler(async (req, res) => {
  const deleted = await Contract.destroy({ where: { id: req.params.id } });
  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Contract not found" });
  res.json({ success: true, message: "Contract deleted" });
});
