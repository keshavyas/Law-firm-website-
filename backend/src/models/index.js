import sequelize from '../config/database.js';
import User      from './user.model.js';
import Case      from './case.model.js';
import Matter     from './matter.model.js'; 

User.hasMany(Case, { foreignKey: 'clientId', as: 'filedCases' });
Case.belongsTo(User, { foreignKey: 'clientId', as: 'client' });

Case.hasMany(Matter, {
  foreignKey: 'caseId',   
  as:         'matters',  
  onDelete:   'CASCADE',  
});

Matter.belongsTo(Case, {
  foreignKey: 'caseId',
  as:         'case',
});

export { sequelize, User, Case, Matter };
export default sequelize;