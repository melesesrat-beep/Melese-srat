import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Users table (for Firebase authentication mapping)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ID Inventory table
export const idInventory = pgTable('id_inventory', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  idNumber: text('id_number').notNull(),
  houseNumber: text('house_number').notNull(),
  status: text('status').$type<'ለመረከብ ዝግጁ' | 'የወሰደ'>().notNull(),
  pickupDate: text('pickup_date'),
  pickupSignature: text('pickup_signature'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Generated Documents table
export const generatedDocs = pgTable('generated_documents', {
  id: text('id').primaryKey(),
  ref: text('ref').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  house: text('house').notNull(),
  date: text('date').notNull(),
  payload: jsonb('payload').$type<Record<string, string>>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Form 010 Records table (using non-reserved SQL names)
export const form010 = pgTable('form010_records', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  qty: integer('qty').notNull(),
  method: text('method').$type<'ሲስተም' | 'ማኑዋል'>().notNull(),
  fromRange: text('from_range').notNull(),
  toRange: text('to_range').notNull(),
  date: text('date').notNull(),
  remark: text('remark').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Form 011 Records table
export const form011 = pgTable('form011_records', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  serviceType: text('service_type').notNull(),
  archive: text('archive').notNull(),
  customer: text('customer').notNull(),
  serial: text('serial').notNull(),
  method: text('method').$type<'ሲስተም' | 'ማኑዋል'>().notNull(),
  time: text('time').notNull(),
  phone: text('phone').notNull(),
  signature: text('signature'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Form 012 Records table
export const form012 = pgTable('form012_records', {
  id: text('id').primaryKey(),
  printType: text('print_type').notNull(),
  returnStatus: text('return_status').$type<'ያልተሰጠ' | 'የተበላሸ'>().notNull(),
  method: text('method').$type<'ሲስተም' | 'ማኑዋል'>().notNull(),
  serial: text('serial').notNull(),
  date: text('date').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
