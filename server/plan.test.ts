import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db functions
vi.mock("./db", () => ({
  createTreatmentPlan: vi.fn().mockResolvedValue(1),
  updateTreatmentPlan: vi.fn().mockResolvedValue(undefined),
  getTreatmentPlanById: vi.fn().mockResolvedValue({
    id: 1, userId: 1, teacherName: "أحمد", schoolName: "مدرسة الأمير",
    principalName: "خالد", subject: "رياضيات", classCount: 2,
    planType: "both", status: "draft", academicYear: "الثاني",
    examLink: null, projectLink: null, examDuration: null, projectDuration: null,
    teacherNotes: null, schoolLogoUrl: null, pdfUrl: null, docxUrl: null,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  getTreatmentPlansByUser: vi.fn().mockResolvedValue([]),
  createPlanClass: vi.fn().mockResolvedValue(10),
  updatePlanClass: vi.fn().mockResolvedValue(undefined),
  getPlanClassesByPlanId: vi.fn().mockResolvedValue([]),
  createPlanStudents: vi.fn().mockResolvedValue(undefined),
  updatePlanStudent: vi.fn().mockResolvedValue(undefined),
  deletePlanStudentsByClassId: vi.fn().mockResolvedValue(undefined),
  getPlanStudentsByClassId: vi.fn().mockResolvedValue([]),
  getPlanStudentsByPlanId: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "/manus-storage/test.pdf" }),
  storageGet: vi.fn().mockResolvedValue({ key: "test-key", url: "/manus-storage/test.pdf" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ students: [
      { name: "محمد أحمد", examStatus: "no_exam", projectStatus: "not_submitted", rowNumber: 1 },
    ] }) } }]
  }),
}));

// Mock report generator
vi.mock("./reportGenerator", () => ({
  generateTreatmentPlanPDF: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateTreatmentPlanDOCX: vi.fn().mockResolvedValue(Buffer.from("fake-docx")),
}));

function createMockContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId, openId: "test-user", email: "test@test.com",
      name: "Test User", loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("plan router", () => {
  it("creates a treatment plan and returns planId with classIds", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.plan.create({
      teacherName: "أحمد محمد",
      schoolName: "مدرسة الأمير فهد",
      principalName: "خالد سعد",
      subject: "رياضيات",
      classCount: 2,
      planType: "both",
    });

    expect(result.planId).toBe(1);
    expect(result.classIds).toHaveLength(2);
  });

  it("returns empty list for new user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.plan.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("updates plan fields successfully", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.plan.update({
      planId: 1,
      examLink: "https://forms.office.com/test",
      examDuration: "يومين",
    });
    expect(result.success).toBe(true);
  });

  it("generates report for existing plan", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.plan.generate({ planId: 1 });
    expect(result.success).toBe(true);
    expect(result.pdfUrl).toBeTruthy();
    expect(result.docxUrl).toBeTruthy();
  });

  it("throws unauthorized when plan belongs to different user", async () => {
    const { getTreatmentPlanById } = await import("./db");
    vi.mocked(getTreatmentPlanById).mockResolvedValueOnce({
      id: 1, userId: 999, teacherName: "آخر", schoolName: "مدرسة",
      principalName: "مدير", subject: "علوم", classCount: 1,
      planType: "exam", status: "draft", academicYear: "",
      examLink: null, projectLink: null, examDuration: null, projectDuration: null,
      teacherNotes: null, schoolLogoUrl: null, pdfUrl: null, docxUrl: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const ctx = createMockContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.plan.generate({ planId: 1 })).rejects.toThrow("غير مصرح");
  });
});

describe("auth router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
