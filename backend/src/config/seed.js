'use strict';
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import sequelize, { User, Case } from '../models/index.js';

async function seed() {
  console.log('Seeding database...');

  try {
    await sequelize.authenticate();
    console.log(' Connected\n');

    const lawyerResult = await User.scope('withPassword').findOrCreate({
      where:    { email: 'lawyer@firm.com' },
      defaults: {
        name:           'Adv. Demo',
        email:          'lawyer@firm.com',
        password:       bcrypt.hashSync('lawyer123', 10),
        role:           'lawyer',
        initials:       'RS',
        firm:           'Sharma & Associates',
        specialization: 'Civil & Criminal Law',
      },
    });
    const lawyer   = lawyerResult[0];
    const lCreated = lawyerResult[1];
    console.log('  ' + (lCreated ? 'Created' : ' Exists') + ' : Lawyer  ' + lawyer.email);

    const clientResult = await User.scope('withPassword').findOrCreate({
      where:    { email: 'client@email.com' },
      defaults: {
        name:     'Demo user',
        email:    'client@email.com',
        password: bcrypt.hashSync('client123', 10),
        role:     'client',
        initials: 'PM',
        phone:    '+91 98765 43210',
      },
    });
    const client   = clientResult[0];
    const cCreated = clientResult[1];
    console.log('  ' + (cCreated ? 'Created' : ' Exists') + ' : Client  ' + client.email);

    const casesData = [
      {
        id:          'CASE-2024-001',
        clientId:    client.id,
        clientName:  client.name,
        title:       'Property Dispute \u2013 Sector 14 Plot',
        category:    'Civil',
        description: 'Dispute regarding ownership of a 2400 sq ft plot in Sector 14, Navi Mumbai.',
        status:      'active',
        priority:    'high',
        filedDate:   '2024-01-15',
        lastUpdated: '2024-03-08',
        documents:   ['Ownership_Deed.pdf', 'Tax_Receipts.pdf'],
        timeline: [
          { date: '2024-01-15', event: 'Complaint filed by client', by: 'client' },
          { date: '2024-01-18', event: 'Case accepted by lawyer',   by: 'lawyer' },
        ],
        lawyerNote:  'First hearing scheduled Mar 25.',
        nextHearing: '2024-03-25',
      },
      {
        id:          'CASE-2024-002',
        clientId:    client.id,
        clientName:  client.name,
        title:       'Consumer Complaint \u2013 Defective Electronics',
        category:    'Consumer',
        description: 'Washing machine worth \u20B942,000 stopped working after 3 months.',
        status:      'pending',
        priority:    'medium',
        filedDate:   '2024-02-20',
        lastUpdated: '2024-02-22',
        documents:   ['Purchase_Invoice.pdf'],
        timeline: [
          { date: '2024-02-20', event: 'Complaint filed by client', by: 'client' },
        ],
        lawyerNote:  null,
        nextHearing: null,
      }
    ];

    for (let i = 0; i < casesData.length; i++) {
      const data        = casesData[i];
      const caseResult  = await Case.findOrCreate({ where: { id: data.id }, defaults: data });
      const c           = caseResult[0];
      const created     = caseResult[1];
      console.log('  ' + (created ? '\u2705 Created' : '\u23ED\uFE0F  Exists') + ' : Case    ' + c.id);
    }

    console.log(' Seed complete!');
    console.log('  Lawyer : lawyer@firm.com  / lawyer123');
    console.log('  Client : client@email.com / client123\n');

  } catch (err) {
    console.error(' Seed failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();