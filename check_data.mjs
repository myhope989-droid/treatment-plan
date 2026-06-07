import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// قراءة DATABASE_URL من .env
const envContent = readFileSync('/home/ubuntu/treatment-plan/.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = match ? match[1].trim() : process.env.DATABASE_URL;

const connection = await mysql.createConnection(dbUrl);
const [plans] = await connection.execute('SELECT id, schoolName, gradeLevel, academicYear FROM treatment_plans ORDER BY id DESC LIMIT 3');
console.log('Plans:', JSON.stringify(plans, null, 2));

const [classes] = await connection.execute('SELECT id, planId, classNumber, className FROM plan_classes LIMIT 5');
console.log('Classes:', JSON.stringify(classes, null, 2));

await connection.end();
