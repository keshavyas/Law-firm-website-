
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/sequelize.js";

class Case extends Model {}

Case.init(
  {
    id:          { type: DataTypes.STRING(30), primaryKey: true },
    clientId: {
      type: DataTypes.UUID, allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",   // Can't delete a user who has cases
      onUpdate: "CASCADE",
    },
    clientName:  { type: DataTypes.STRING(100), allowNull: false },
    title:       { type: DataTypes.STRING(200), allowNull: false, validate: { len: [5, 200] } },
    category: {
      type: DataTypes.ENUM("Civil", "Criminal", "Family", "Labour", "Consumer", "Corporate", "Other"),
      allowNull: false,
    },
    description: { type: DataTypes.TEXT, allowNull: false, validate: { len: [10, 5000] } },
    status: {
      type: DataTypes.ENUM("pending", "active", "urgent", "resolved", "closed"),
      allowNull: false, defaultValue: "pending",
    },
    priority:    { type: DataTypes.ENUM("low", "medium", "high"), allowNull: false, defaultValue: "medium" },
    documents:   { type: DataTypes.JSONB, defaultValue: [], allowNull: false },
    timeline:    { type: DataTypes.JSONB, defaultValue: [], allowNull: false },
    lawyerNote:  { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    filedDate:   { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    nextHearing: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    lastUpdated: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName:  "Case",
    tableName:  "cases",
    timestamps: true,
    indexes: [
      { fields: ["clientId"] },
      { fields: ["status"] },
      { fields: ["category"] },
      { fields: ["filedDate"] },
      { fields: ["status", "priority"] },
    ],
  }
);

export default Case;