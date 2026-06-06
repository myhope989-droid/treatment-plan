import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createTreatmentPlan, updateTreatmentPlan, getTreatmentPlanById,
  getTreatmentPlansByUser, createPlanClass, updatePlanClass,
  getPlanClassesByPlanId, createPlanStudents, getPlanStudentsByClassId,
  getPlanStudentsByPlanId, deletePlanStudentsByClassId, updatePlanStudent
} from "./db";
import { generateTreatmentPlanPDF, generateTreatmentPlanDOCX } from "./reportGenerator.ts";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== Treatment Plans =====
  plan: router({
    // إنشاء خطة جديدة
    create: protectedProcedure
      .input(z.object({
        teacherName: z.string().min(1),
        schoolName: z.string().min(1),
        principalName: z.string().min(1),
        subject: z.string().min(1),
        classCount: z.number().min(1).max(20),
        schoolLogoUrl: z.string().optional(),
        academicYear: z.string().optional(),
        gradeLevel: z.string().optional(),
        planType: z.enum(["exam", "project", "both", "other"]),
        customPlanType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const planId = await createTreatmentPlan({
          userId: ctx.user.id,
          teacherName: input.teacherName,
          schoolName: input.schoolName,
          principalName: input.principalName,
          subject: input.subject,
          classCount: input.classCount,
          schoolLogoUrl: input.schoolLogoUrl,
          academicYear: input.academicYear || "الثاني / 1446-1447هـ",
          gradeLevel: input.gradeLevel,
          planType: input.planType,
          customPlanType: input.customPlanType,
          status: "draft",
        });

        // إنشاء سجلات الفصول
        const classIds: number[] = [];
        for (let i = 1; i <= input.classCount; i++) {
          const classId = await createPlanClass({
            planId,
            classNumber: i,
            className: `${i}`,
            uploadedFiles: "[]",
            analysisStatus: "pending",
          });
          classIds.push(classId);
        }

        return { planId, classIds };
      }),

    // تحديث بيانات الخطة
    update: protectedProcedure
      .input(z.object({
        planId: z.number(),
        examLink: z.string().optional(),
        projectLink: z.string().optional(),
        examDuration: z.string().optional(),
        projectDuration: z.string().optional(),
        teacherNotes: z.string().optional(),
        initialActions: z.string().optional(),
        schoolLogoUrl: z.string().optional(),
        schoolLogoBase64: z.string().optional(),
        gradeLevel: z.string().optional(),
        status: z.enum(["draft", "processing", "completed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await getTreatmentPlanById(input.planId);
        if (!plan || plan.userId !== ctx.user.id) throw new Error("غير مصرح");
        const { planId, schoolLogoBase64, ...data } = input;
        // حفظ شعار المدرسة إذا تم رفعه
        if (schoolLogoBase64) {
          const logoBuffer = Buffer.from(schoolLogoBase64, "base64");
          const logoKey = `plans/${planId}/school_logo.png`;
          const { url: logoUrl } = await storagePut(logoKey, logoBuffer, "image/png");
          data.schoolLogoUrl = logoUrl;
        }
        await updateTreatmentPlan(planId, data);
        return { success: true };
      }),

    // جلب خطة بالمعرف
    getById: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        const plan = await getTreatmentPlanById(input.planId);
        if (!plan || plan.userId !== ctx.user.id) throw new Error("غير مصرح");
        const classes = await getPlanClassesByPlanId(input.planId);
        const classesWithStudents = await Promise.all(
          classes.map(async (cls) => {
            const students = await getPlanStudentsByClassId(cls.id);
            return { ...cls, students };
          })
        );
        return { ...plan, classes: classesWithStudents };
      }),

    // جلب جميع خطط المعلم
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTreatmentPlansByUser(ctx.user.id);
    }),

    // رفع ملف كشف وتحليله
    uploadAndAnalyze: protectedProcedure
      .input(z.object({
        planId: z.number(),
        classId: z.number(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        planType: z.enum(["exam", "project", "both", "other"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // التحقق من الملكية
        const plan = await getTreatmentPlanById(input.planId);
        if (!plan || plan.userId !== ctx.user.id) throw new Error("غير مصرح");

        // رفع الملف إلى التخزين
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `plans/${input.planId}/class_${input.classId}/${Date.now()}_${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // تحديث قائمة الملفات في الفصل
        const classes = await getPlanClassesByPlanId(input.planId);
        const cls = classes.find(c => c.id === input.classId);
        if (!cls) throw new Error("الفصل غير موجود");
        const existingFiles: string[] = JSON.parse(cls.uploadedFiles || "[]");
        existingFiles.push(url);
        await updatePlanClass(input.classId, {
          uploadedFiles: JSON.stringify(existingFiles),
          analysisStatus: "processing",
        });

        // تحليل الصورة بالذكاء الاصطناعي
        const isImage = input.mimeType.startsWith("image/");
        const isPdf = input.mimeType === "application/pdf";

        let analysisPrompt = `أنت محلل كشوف طلابية سعودي متخصص. انظر بعناية شديدة إلى هذا الكشف الدراسي.

نوع الخطة المطلوبة: ${input.planType === "exam" ? "الاختبار فقط" : input.planType === "project" ? "المشروع فقط" : input.planType === "both" ? "الاختبار والمشروع معاً" : "أخرى"}

طريقة قراءة الكشف:
- الكشف يحتوي على أسماء طلاب بجانب أرقام تسلسلية
- بعض الطلاب أمام أسمائهم رموز دائرية باليد:
  * دائرة فارغة (O أو ○) = لم يحل الاختبار أو لم يحضر
  * دائرة مع خط (Ø أو أو خط عبر دائرة) = لم يسلم المشروع
  * وجود الرمزين معاً = لم يحل ولم يسلم

مهمةك:
1. استخرج أسماء جميع الطلاب الذين أمام أسمائهم أي رمز دائري
2. حدد لكل طالب نوع الرمز (اختبار أو مشروع أو كليهما)
3. اكتب الاسم كاملاً بالضبط كما هو مكتوب في الكشف
4. سجّل رقم الصف من العمود الأول في الكشف

أعد النتيجة بصيغة JSON فقط:
{
  "students": [
    {
      "name": "اسم الطالب كاملاً",
      "examStatus": "no_exam" أو "did_exam",
      "projectStatus": "not_submitted" أو "submitted",
      "rowNumber": رقم الصف في الكشف
    }
  ]
}

قواعد مهمة:
- استخرج فقط الطلاب الذين أمامهم رمز (دائرة بأي شكل)
- لا تضم طلاباً ليس أمامهم أي رمز
- إذا كانت الخطة "الاختبار فقط": الطلاب الذين أمامهم دائرة فارغة فقط
- إذا كانت الخطة "المشروع فقط": الطلاب الذين أمامهم دائرة مع خط فقط
- إذا كانت الخطة "الاختبار والمشروع": جميع الطلاب الذين أمامهم أي رمز
- إذا لم تجد أي طالب يحتاج خطة، أعد {"students": []}`;

        let llmMessages: any[] = [];

        if (isImage) {
          // رفع الصورة مباشرة للـ LLM
          const fullUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL?.replace('/v1', '') || 'https://api.manus.im'}${url}`;
          llmMessages = [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.fileBase64}`, detail: "high" } },
                { type: "text", text: analysisPrompt }
              ]
            }
          ];
        } else {
          // PDF - نطلب من المعلم وصفاً نصياً
          llmMessages = [
            {
              role: "user",
              content: [
                { type: "file_url", file_url: { url: `data:application/pdf;base64,${input.fileBase64}`, mime_type: "application/pdf" } },
                { type: "text", text: analysisPrompt }
              ]
            }
          ];
        }

        try {
          const response = await invokeLLM({
            messages: llmMessages,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "students_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    students: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          examStatus: { type: "string", enum: ["no_exam", "did_exam"] },
                          projectStatus: { type: "string", enum: ["not_submitted", "submitted"] },
                          rowNumber: { type: "integer" }
                        },
                        required: ["name", "examStatus", "projectStatus", "rowNumber"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["students"],
                  additionalProperties: false
                }
              }
            }
          });

          const content = response.choices[0]?.message?.content;
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          const students = parsed.students || [];

          // حذف الطلاب القديمين وإضافة الجدد
          await deletePlanStudentsByClassId(input.classId);
          if (students.length > 0) {
            await createPlanStudents(students.map((s: any, idx: number) => ({
              classId: input.classId,
              planId: input.planId,
              studentName: s.name,
              examStatus: s.examStatus || "no_exam",
              projectStatus: s.projectStatus || "not_submitted",
              rowNumber: s.rowNumber || idx + 1,
            })));
          }

          await updatePlanClass(input.classId, { analysisStatus: "done" });
          return { success: true, studentsFound: students.length, students };
        } catch (err) {
          await updatePlanClass(input.classId, { analysisStatus: "error" });
          throw new Error("فشل تحليل الكشف: " + String(err));
        }
      }),

    // تحديث بيانات طالب
    updateStudent: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        studentName: z.string().optional(),
        examStatus: z.enum(["did_exam", "no_exam"]).optional(),
        projectStatus: z.enum(["submitted", "not_submitted"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { studentId, ...data } = input;
        await updatePlanStudent(studentId, data);
        return { success: true };
      }),

    // إضافة طالب يدوياً
    addStudent: protectedProcedure
      .input(z.object({
        planId: z.number(),
        classId: z.number(),
        studentName: z.string().min(1),
        examStatus: z.enum(["did_exam", "no_exam"]),
        projectStatus: z.enum(["submitted", "not_submitted"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await getTreatmentPlanById(input.planId);
        if (!plan || plan.userId !== ctx.user.id) throw new Error("غير مصرح");
        await createPlanStudents([{
          classId: input.classId,
          planId: input.planId,
          studentName: input.studentName,
          examStatus: input.examStatus,
          projectStatus: input.projectStatus,
          rowNumber: 999,
        }]);
        return { success: true };
      }),

    // توليد التقرير
    generate: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const plan = await getTreatmentPlanById(input.planId);
        if (!plan || plan.userId !== ctx.user.id) throw new Error("غير مصرح");

        await updateTreatmentPlan(input.planId, { status: "processing" });

        try {
          const classes = await getPlanClassesByPlanId(input.planId);
          const classesWithStudents = await Promise.all(
            classes.map(async (cls) => {
              const students = await getPlanStudentsByClassId(cls.id);
              return { ...cls, students };
            })
          );

          const fullPlan = { ...plan, classes: classesWithStudents };

          // توليد PDF
          const pdfBuffer = await generateTreatmentPlanPDF(fullPlan);
          const pdfKey = `plans/${input.planId}/report_${Date.now()}.pdf`;
          const { url: pdfUrl } = await storagePut(pdfKey, pdfBuffer, "application/pdf");

          // توليد DOCX
          const docxBuffer = await generateTreatmentPlanDOCX(fullPlan);
          const docxKey = `plans/${input.planId}/report_${Date.now()}.docx`;
          const { url: docxUrl } = await storagePut(docxKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

          await updateTreatmentPlan(input.planId, {
            status: "completed",
            pdfUrl,
            docxUrl,
          });

          return { success: true, pdfUrl, docxUrl };
        } catch (err) {
          await updateTreatmentPlan(input.planId, { status: "draft" });
          throw new Error("فشل توليد التقرير: " + String(err));
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
