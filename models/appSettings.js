module.exports = (sequelize, DataTypes) => {
  const AppSettings = sequelize.define(
    'AppSettings',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      terms: { type: DataTypes.TEXT, allowNull: true },
      privacy: { type: DataTypes.TEXT, allowNull: true },
      contactEmail: { type: DataTypes.STRING, allowNull: true },
      contactPhone: { type: DataTypes.STRING, allowNull: true },
      contactAddress: { type: DataTypes.STRING, allowNull: true },
      updatedByAdminId: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'app_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return AppSettings;
};

