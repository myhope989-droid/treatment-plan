import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, treatmentPlans, planClasses, planStudents, InsertTreatmentPlan, InsertPlanClass, InsertPlanStudent, appSettings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Treatment Plans =====

export async function createTreatmentPlan(data: InsertTreatmentPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(treatmentPlans).values(data);
  return result[0].insertId as number;
}

export async function updateTreatmentPlan(id: number, data: Partial<InsertTreatmentPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(treatmentPlans).set(data).where(eq(treatmentPlans.id, id));
}

export async function getTreatmentPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(treatmentPlans).where(eq(treatmentPlans.id, id)).limit(1);
  return result[0];
}

export async function getTreatmentPlansByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(treatmentPlans).where(eq(treatmentPlans.userId, userId)).orderBy(desc(treatmentPlans.createdAt));
}

// ===== Plan Classes =====

export async function createPlanClass(data: InsertPlanClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(planClasses).values(data);
  return result[0].insertId as number;
}

export async function updatePlanClass(id: number, data: Partial<InsertPlanClass>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(planClasses).set(data).where(eq(planClasses.id, id));
}

export async function getPlanClassesByPlanId(planId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planClasses).where(eq(planClasses.planId, planId)).orderBy(planClasses.classNumber);
}

// ===== Plan Students =====

export async function createPlanStudents(students: InsertPlanStudent[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (students.length === 0) return;
  await db.insert(planStudents).values(students);
}

export async function updatePlanStudent(id: number, data: Partial<InsertPlanStudent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(planStudents).set(data).where(eq(planStudents.id, id));
}

export async function deletePlanStudentsByClassId(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(planStudents).where(eq(planStudents.classId, classId));
}

export async function getPlanStudentsByClassId(classId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planStudents).where(eq(planStudents.classId, classId)).orderBy(planStudents.rowNumber);
}

export async function getPlanStudentsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planStudents).where(eq(planStudents.planId, planId)).orderBy(planStudents.classId, planStudents.rowNumber);
}

// ===== App Settings =====
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  return rows[0]?.settingValue ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(appSettings)
    .values({ settingKey: key, settingValue: value })
    .$dynamic()
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}
