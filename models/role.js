module.exports = (sequelize, DataTypes) => {
const Role = sequelize.define('Role', {
id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
name: { type: DataTypes.STRING, allowNull: false },
}, { tableName: 'roles', underscored: true });
return Role;
};
