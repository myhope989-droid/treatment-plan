import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول الخطط العلاجية
export const treatmentPlans = mysqlTable("treatment_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  teacherName: varchar("teacherName", { length: 255 }).notNull(),
  schoolName: varchar("schoolName", { length: 255 }).notNull(),
  principalName: varchar("principalName", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  classCount: int("classCount").notNull().default(1),
  schoolLogoUrl: text("schoolLogoUrl"),
  academicYear: varchar("academicYear", { length: 50 }).default("الثاني / 1446-1447هـ"),
  gradeLevel: varchar("gradeLevel", { length: 100 }),
  examLink: text("examLink"),
  projectLink: text("projectLink"),
  examDuration: varchar("examDuration", { length: 100 }),
  projectDuration: varchar("projectDuration", { length: 100 }),
  teacherNotes: text("teacherNotes"),
  initialActions: text("initialActions"),
  planType: mysqlEnum("planType", ["exam", "project", "both", "other"]).default("both").notNull(),
  customPlanType: varchar("customPlanType", { length: 255 }),
  status: mysqlEnum("status", ["draft", "processing", "completed"]).default("draft").notNull(),
  pdfUrl: text("pdfUrl"),
  docxUrl: text("docxUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = typeof treatmentPlans.$inferInsert;

// جدول الفصول الدراسية لكل خطة
export const planClasses = mysqlTable("plan_classes", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  classNumber: int("classNumber").notNull(),
  className: varchar("className", { length: 100 }),
  uploadedFiles: text("uploadedFiles").default("[]"),
  analysisStatus: mysqlEnum("analysisStatus", ["pending", "processing", "done", "error"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlanClass = typeof planClasses.$inferSelect;
export type InsertPlanClass = typeof planClasses.$inferInsert;

// جدول الطلاب المستخرجين من الكشوف
export const planStudents = mysqlTable("plan_students", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  planId: int("planId").notNull(),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  examStatus: mysqlEnum("examStatus", ["did_exam", "no_exam"]).default("no_exam").notNull(),
  projectStatus: mysqlEnum("projectStatus", ["submitted", "not_submitted"]).default("not_submitted").notNull(),
  rowNumber: int("rowNumber"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlanStudent = typeof planStudents.$inferSelect;
export type InsertPlanStudent = typeof planStudents.$inferInsert;
