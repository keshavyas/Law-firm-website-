'use strict';
// Migration: 001-create-users-table
// Creates the users table matching user.model.js exactly.
// Run with: sequelize db:migrate --config src/config/database.cjs --migrations-path src/migrations

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first (Postgres requires explicit ENUM creation)
    await queryInterface.sequelize.query(
      `DO $$ BEGIN
         CREATE TYPE "enum_users_role" AS ENUM('lawyer', 'client');
       EXCEPTION WHEN duplicate_object THEN null;
       END $$;`
    );

    await queryInterface.createTable('users', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey:   true,
        allowNull:    false,
      },
      name: {
        type:      Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type:      Sequelize.STRING(150),
        allowNull: false,
        unique:    true,
      },
      password: {
        type:      Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type:         Sequelize.ENUM('lawyer', 'client'),
        allowNull:    false,
        defaultValue: 'client',
      },
      initials: {
        type:      Sequelize.STRING(3),
        allowNull: false,
      },
      // Lawyer-specific
      firm:           { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      specialization: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      bar:            { type: Sequelize.STRING(50),  allowNull: true, defaultValue: null },
      // Client-specific
      phone:          { type: Sequelize.STRING(20),  allowNull: true, defaultValue: null },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};
