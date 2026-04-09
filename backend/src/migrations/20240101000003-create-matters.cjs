'use strict';
// Migration: 003-create-matters-table
// Creates the matters table matching matter.model.js exactly.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_matters_status"   AS ENUM('open','in_progress','pending_review','on_hold','closed');
        CREATE TYPE "enum_matters_priority" AS ENUM('low','medium','high','urgent');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('matters', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey:   true,
        allowNull:    false,
      },
      caseId: {
        type:       Sequelize.STRING(30),
        allowNull:  false,
        references: { model: 'cases', key: 'id' },
        onDelete:   'CASCADE',
        onUpdate:   'CASCADE',
      },
      title:         { type: Sequelize.STRING(200), allowNull: false },
      description:   { type: Sequelize.TEXT,        allowNull: true,  defaultValue: null },
      status:        { type: Sequelize.ENUM('open','in_progress','pending_review','on_hold','closed'), allowNull: false, defaultValue: 'open' },
      priority:      { type: Sequelize.ENUM('low','medium','high','urgent'), allowNull: false, defaultValue: 'medium' },
      assignedTo:    { type: Sequelize.STRING(100), allowNull: true,  defaultValue: null },
      dueDate:       { type: Sequelize.DATEONLY,    allowNull: true,  defaultValue: null },
      statusHistory: { type: Sequelize.JSONB,       defaultValue: [], allowNull: false },
      notes:         { type: Sequelize.TEXT,        allowNull: true,  defaultValue: null },
      resolvedAt:    { type: Sequelize.DATE,        allowNull: true,  defaultValue: null },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Indexes from matter.model.js
    await queryInterface.addIndex('matters', ['caseId']);
    await queryInterface.addIndex('matters', ['status']);
    await queryInterface.addIndex('matters', ['priority']);
    await queryInterface.addIndex('matters', ['caseId', 'status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('matters');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_matters_status";
      DROP TYPE IF EXISTS "enum_matters_priority";
    `);
  },
};
