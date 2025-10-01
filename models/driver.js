module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    'Driver',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: false }, // removed unique to avoid MySQL key limit
      password: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true }, // removed unique
      wallet: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      rating: { type: DataTypes.FLOAT, defaultValue: 5.0 },
      rewardPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      drivingLicenseFile: { type: DataTypes.STRING },
      document: { type: DataTypes.STRING },
      nationalIdFile: { type: DataTypes.STRING },
      vehicleRegistrationFile: { type: DataTypes.STRING },
      insuranceFile: { type: DataTypes.STRING },
      carName: { type: DataTypes.STRING },
      vehicleType: { type: DataTypes.ENUM('mini', 'sedan', 'suv', 'mpv', 'motorbike', 'bajaj') },
      carPlate: { type: DataTypes.STRING },
      carModel: { type: DataTypes.STRING },
      carColor: { type: DataTypes.STRING },
      availability: { type: DataTypes.BOOLEAN, defaultValue: false },
      bankAccountNo: { type: DataTypes.STRING },
      verification: { type: DataTypes.BOOLEAN, defaultValue: false },
      carServiceDate: { type: DataTypes.DATE, allowNull: true },
      bolloRenewalDate: { type: DataTypes.DATE, allowNull: true },
      insuranceExpiry: { type: DataTypes.DATE, allowNull: true },
      paymentPreference: { type: DataTypes.INTEGER, allowNull: true }, // default null
      emergencyContacts: { type: DataTypes.TEXT, allowNull: true },
      documentStatus: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending', allowNull: false },
    },
    {
      tableName: 'drivers',
      underscored: true,
      defaultScope: { attributes: { exclude: ['password'] } },
    }
  );



  return Driver;
};
