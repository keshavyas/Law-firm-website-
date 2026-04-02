
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class User extends Model {
  // Returns user object safe to send to client (no password)
  toSafeJSON() {
    const { password, ...safe } = this.toJSON();
    return safe;
  }
}

User.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:           { type: DataTypes.STRING(100), allowNull: false, validate: { len: [2, 100], notEmpty: true } },
    email: {
      type: DataTypes.STRING(150), allowNull: false,
      unique: { name: "users_email_unique", msg: "Email already registered" },
      validate: { isEmail: true },
      set(v) { this.setDataValue("email", v?.toLowerCase()?.trim()); },
    },
    password:       { type: DataTypes.STRING(255), allowNull: false },
    role:           { type: DataTypes.ENUM("lawyer", "client"), allowNull: false, defaultValue: "client" },
    initials:       { type: DataTypes.STRING(3), allowNull: false },

    // Lawyer-specific (null for clients)
    firm:           { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    specialization: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    bar:            { type: DataTypes.STRING(50),  allowNull: true, defaultValue: null },

    // Client-specific (null for lawyers)
    phone:          { type: DataTypes.STRING(20), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName:  "User",
    tableName:  "users",
    timestamps: true,

    hooks: {
      // Auto-generate initials before validation runs
      beforeValidate: (user) => {
        if (user.name && !user.initials) {
          user.initials = user.name.split(" ").map(w => w[0]?.toUpperCase()).join("").slice(0, 2);
        }
      },
    },

    // exclude password from every SELECT query
    defaultScope: {
      attributes: { exclude: ["password"] },
    },

    scopes: {
      withPassword: { attributes: { include: ["password"] } }, // use for login only
      lawyers:      { where: { role: "lawyer" } },
      clients:      { where: { role: "client" } },
    },
  }
);

export default User;