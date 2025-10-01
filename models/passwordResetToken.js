module.exports = (sequelize, DataTypes) => {
  const PasswordResetToken = sequelize.define(
    'PasswordResetToken',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userType: { type: DataTypes.ENUM('driver'), allowNull: false, defaultValue: 'driver' },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      token: { type: DataTypes.STRING(128), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'password_reset_tokens', underscored: true, timestamps: true }
  );
  return PasswordResetToken;
};

