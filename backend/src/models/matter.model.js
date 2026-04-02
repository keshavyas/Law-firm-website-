import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export const MATTER_STATUS_TRANSITIONS = {
  open:            ['in_progress', 'on_hold'],
  in_progress:     ['pending_review', 'on_hold'],
  pending_review:  ['closed', 'in_progress'],
  on_hold:         ['in_progress'],
  closed:          [],  
};
export const MATTER_STATUSES = Object.keys(MATTER_STATUS_TRANSITIONS);

class Matter extends Model {

  isTransitionAllowed(newStatus) {
    const allowedMoves = MATTER_STATUS_TRANSITIONS[this.status] || [];
    return allowedMoves.includes(newStatus);
  }
}

Matter.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,  
      primaryKey:   true,
    },
    caseId: {
      type:       DataTypes.STRING(30),
      allowNull:  false,
      references: {
        model: 'cases',  
        key:   'id',
      },
      onDelete: 'CASCADE',  
      onUpdate: 'CASCADE',
    },
    title: {
      type:      DataTypes.STRING(200),
      allowNull: false,
      validate:  { len: [3, 200], notEmpty: true },
    },
    description: {
      type:         DataTypes.TEXT,  
      allowNull:    true,
      defaultValue: null,
    },
    status: {
      type:         DataTypes.ENUM(...MATTER_STATUSES),
      allowNull:    false,
      defaultValue: 'open',  
    },
    priority: {
      type:         DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull:    false,
      defaultValue: 'medium',
    },
    assignedTo: {
      type:         DataTypes.STRING(100),
      allowNull:    true,
      defaultValue: null,
    },
    dueDate: {
      type:         DataTypes.DATEONLY, 
      allowNull:    true,
      defaultValue: null,
    },
    statusHistory: {
      type:         DataTypes.JSONB,
      defaultValue: [],
      allowNull:    false,
    },

    notes: {
      type:         DataTypes.TEXT,
      allowNull:    true,
      defaultValue: null,
    },

    resolvedAt: {
      type:         DataTypes.DATE,
      allowNull:    true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName:  'Matter',
    tableName:  'matters', 
    timestamps: true,     

    indexes: [
      { fields: ['caseId'] },           
      { fields: ['status'] },           
      { fields: ['priority'] },         
      { fields: ['caseId', 'status'] }, 
    ],
  }
);

export default Matter;