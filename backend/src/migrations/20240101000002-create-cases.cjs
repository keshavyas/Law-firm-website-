'use strict';
// Migration: 002-create-cases-table
// Creates the cases table matching case.model.js exactly.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_cases_category" AS ENUM('Civil','Criminal','Family','Labour','Consumer','Corporate','Other');
        CREATE TYPE "enum_cases_status"   AS ENUM('pending','active','urgent','resolved','closed');
        CREATE TYPE "enum_cases_priority" AS ENUM('low','medium','high');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('cases', {
      id: {
        type:      Sequelize.STRING(30),
        primaryKey: true,
        allowNull: false,
      },
      clientId: {
        type:       Sequelize.UUID,
        allowNull:  false,
        references: { model: 'users', key: 'id' },
        onDelete:   'RESTRICT',
        onUpdate:   'CASCADE',
      },
      clientName:  { type: Sequelize.STRING(100), allowNull: false },
      title:       { type: Sequelize.STRING(200), allowNull: false },
      category:    { type: Sequelize.ENUM('Civil','Criminal','Family','Labour','Consumer','Corporate','Other'), allowNull: false },
      description: { type: Sequelize.TEXT,        allowNull: false },
      status:      { type: Sequelize.ENUM('pending','active','urgent','resolved','closed'), allowNull: false, defaultValue: 'pending' },
      priority:    { type: Sequelize.ENUM('low','medium','high'), allowNull: false, defaultValue: 'medium' },
      documents:   { type: Sequelize.JSONB, defaultValue: [], allowNull: false },
      timeline:    { type: Sequelize.JSONB, defaultValue: [], allowNull: false },
      lawyerNote:  { type: Sequelize.TEXT,     allowNull: true,  defaultValue: null },
      filedDate:   { type: Sequelize.DATEONLY, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      nextHearing: { type: Sequelize.DATEONLY, allowNull: true,  defaultValue: null },
      lastUpdated: { type: Sequelize.DATEONLY, allowNull: false, defaultValue: Sequelize.literal('NOW()') },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Indexes from case.model.js
    await queryInterface.addIndex('cases', ['clientId']);
    await queryInterface.addIndex('cases', ['status']);
    await queryInterface.addIndex('cases', ['category']);
    await queryInterface.addIndex('cases', ['filedDate']);
    await queryInterface.addIndex('cases', ['status', 'priority']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cases');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_cases_category";
      DROP TYPE IF EXISTS "enum_cases_status";
      DROP TYPE IF EXISTS "enum_cases_priority";
    `);
  },
};
