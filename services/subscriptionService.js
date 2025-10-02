const { ContractSettings } = require("../models/indexModel");
const { calculateDistance } = require("../utils/pricingService");

/**
 * Calculate fare for a subscription based on locations and contract type
 * @param {string} pickupLocation - Pickup location name
 * @param {string} dropoffLocation - Dropoff location name
 * @param {number} pickupLat - Pickup latitude
 * @param {number} pickupLon - Pickup longitude
 * @param {number} dropoffLat - Dropoff latitude
 * @param {number} dropoffLon - Dropoff longitude
 * @param {string} contractType - Contract type (DAILY, WEEKLY, MONTHLY, YEARLY)
 * @returns {Object} Fare calculation result
 */
async function calculateSubscriptionFare(pickupLocation, dropoffLocation, pickupLat, pickupLon, dropoffLat, dropoffLon, contractType) {
  try {
    // Get contract settings for the specified type
    const settings = await ContractSettings.findOne({
      where: {
        contract_type: contractType,
        is_active: true,
      },
    });

    if (!settings) {
      return {
        success: false,
        message: `No active pricing settings found for contract type: ${contractType}`,
      };
    }

    // Calculate distance if coordinates are provided
    let distance = 0;
    if (pickupLat && pickupLon && dropoffLat && dropoffLon) {
      distance = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
    }

    // Calculate base fare
    const basePricePerKm = parseFloat(settings.base_price_per_km);
    const discountPercentage = parseFloat(settings.discount_percentage);
    const minimumFare = parseFloat(settings.minimum_fare);

    // Calculate fare based on distance
    const baseFare = distance * basePricePerKm;
    const discountAmount = baseFare * (discountPercentage / 100);
    const fareAfterDiscount = baseFare - discountAmount;
    const finalFare = Math.max(fareAfterDiscount, minimumFare);

    // Calculate multiplier based on contract type
    let multiplier = 1;
    switch (contractType) {
      case 'DAILY':
        multiplier = 1;
        break;
      case 'WEEKLY':
        multiplier = 7;
        break;
      case 'MONTHLY':
        multiplier = 30;
        break;
      case 'YEARLY':
        multiplier = 365;
        break;
    }

    const totalFare = finalFare * multiplier;

    return {
      success: true,
      data: {
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        distance_km: Math.round(distance * 100) / 100,
        contract_type: contractType,
        base_price_per_km: basePricePerKm,
        base_fare: Math.round(baseFare * 100) / 100,
        discount_percentage: discountPercentage,
        discount_amount: Math.round(discountAmount * 100) / 100,
        fare_after_discount: Math.round(fareAfterDiscount * 100) / 100,
        minimum_fare: minimumFare,
        daily_fare: Math.round(finalFare * 100) / 100,
        multiplier: multiplier,
        total_fare: Math.round(totalFare * 100) / 100,
        settings_id: settings.id,
      },
    };
  } catch (error) {
    console.error('Error calculating subscription fare:', error);
    return {
      success: false,
      message: 'Error calculating subscription fare',
      error: error.message,
    };
  }
}

/**
 * Get contract type multipliers for different periods
 * @returns {Object} Contract type multipliers
 */
function getContractTypeMultipliers() {
  return {
    DAILY: { multiplier: 1, description: 'Per day' },
    WEEKLY: { multiplier: 7, description: 'Per week (7 days)' },
    MONTHLY: { multiplier: 30, description: 'Per month (30 days)' },
    YEARLY: { multiplier: 365, description: 'Per year (365 days)' },
  };
}

module.exports = {
  calculateSubscriptionFare,
  getContractTypeMultipliers,
};