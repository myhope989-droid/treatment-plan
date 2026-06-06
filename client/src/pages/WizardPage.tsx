import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowRight, ArrowLeft, CheckCircle, Upload, Loader2,
  User, School, BookOpen, Users, Link2, Clock, FileText,
  Trash2, Plus, Eye, Download, Home, X, Edit2, Save,
  History as HistoryIcon
} from "lucide-react";
import { getLoginUrl } from "@/const";

// ===== Types =====
type PlanType = "exam" | "project" | "both" | "other";
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface ClassFile {
  name: string;
  base64: string;
  mimeType: string;
  preview?: string;
}

interface StudentData {
  id?: number;
  studentId?: number;
  studentName: string;
  examStatus: "did_exam" | "no_exam";
  projectStatus: "submitted" | "not_submitted";
  rowNumber: number;
}

interface ClassData {
  classId?: number;
  classNumber: number;
  files: ClassFile[];
  students: StudentData[];
  analysisStatus: "pending" | "processing" | "done" | "error";
}

// ===== Step Indicator =====
const STEPS = [
  { label: "الترحيب", icon: "👋" },
  { label: "البيانات", icon: "📋" },
  { label: "الشعار", icon: "🏫" },
  { label: "الكشوف", icon: "📄" },
  { label: "المراجعة", icon: "✅" },
  { label: "الروابط", icon: "🔗" },
  { label: "التقرير", icon: "📊" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-1 py-3 overflow-x-auto">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex flex-col items-center gap-0.5 transition-all ${i <= current ? "opacity-100" : "opacity-40"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
              ${i < current ? "bg-amber-700 text-white" : i === current ? "bg-amber-800 text-white ring-2 ring-amber-300 ring-offset-1" : "bg-gray-200 text-gray-500"}`}>
              {i < current ? <CheckCircle className="w-4 h-4" /> : s.icon}
            </div>
            <span className={`text-[9px] font-medium hidden sm:block ${i === current ? "text-amber-800" : "text-gray-400"}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-4 sm:w-8 h-0.5 transition-all ${i < current ? "bg-amber-500" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ===== Main Wizard =====
export default function WizardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(0);
  const [planId, setPlanId] = useState<number | null>(null);

  // Form data
  const [teacherName, setTeacherName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [subject, setSubject] = useState("");
  const [classCount, setClassCount] = useState(1);
  const [planType, setPlanType] = useState<PlanType>("both");
  const [customPlanType, setCustomPlanType] = useState("");
  const [academicYear, setAcademicYear] = useState("الثاني / 1446-1447هـ");
  const [schoolLogoBase64, setSchoolLogoBase64] = useState<string>("");
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>("");
  const [examLink, setExamLink] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [examDuration, setExamDuration] = useState("يومين");
  const [projectDuration, setProjectDuration] = useState("يومين");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [initialActions, setInitialActions] = useState("");
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [currentClassIdx, setCurrentClassIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState("");
  const [generatedDocxUrl, setGeneratedDocxUrl] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createPlan = trpc.plan.create.useMutation();
  const updatePlan = trpc.plan.update.useMutation();
  const uploadAnalyze = trpc.plan.uploadAndAnalyze.useMutation();
  const generateReport = trpc.plan.generate.useMutation();
  const updateStudent = trpc.plan.updateStudent.useMutation();
  const addStudent = trpc.plan.addStudent.useMutation();

  // ===== Auth Guard =====
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-700" /></div>;
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50" dir="rtl">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">تسجيل الدخول مطلوب</h2>
          <p className="text-gray-500 text-sm mb-6">يجب تسجيل الدخول لإنشاء خطة علاجية</p>
          <Button className="w-full bg-amber-800 hover:bg-amber-900" onClick={() => window.location.href = getLoginUrl()}>
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  // ===== Helpers =====
  const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string; preview?: string }> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type;
        const preview = file.type.startsWith("image/") ? dataUrl : undefined;
        resolve({ base64, mimeType, preview });
      };
      reader.readAsDataURL(file);
    });

  const initClasses = (count: number) => {
    const arr: ClassData[] = [];
    for (let i = 1; i <= count; i++) {
      arr.push({ classNumber: i, files: [], students: [], analysisStatus: "pending" });
    }
    setClasses(arr);
  };

  // ===== Step 0: Welcome =====
  const renderStep0 = () => (
    <div className="step-enter text-center py-8 px-4">
      <div className="text-6xl mb-4">👋</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-3">
        أهلاً بك عزيزي / عزيزتي المعلم / المعلمة
      </h2>
      <p className="text-gray-500 mb-2 text-sm leading-relaxed max-w-md mx-auto">
        مرحباً بك في منشئ الخطة العلاجية الذكي.<br />
        سنساعدك على إنشاء خطة علاجية احترافية لطلابك في خطوات بسيطة.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto mt-4 mb-6 text-right">
        <p className="text-amber-800 font-bold text-sm mb-2">ما ستحتاجه:</p>
        <ul className="text-amber-700 text-xs space-y-1">
          <li>• بيانات المعلم والمدرسة والمادة</li>
          <li>• صور كشوف الطلاب (صورة أو PDF)</li>
          <li>• روابط الاختبار أو المشروع (اختياري)</li>
        </ul>
      </div>
      <Button
        size="lg"
        className="bg-amber-800 hover:bg-amber-900 text-white px-10 py-3 text-base font-bold rounded-xl"
        onClick={() => setStep(1)}
      >
        ابدأ الآن
        <ArrowLeft className="w-5 h-5 mr-2" />
      </Button>
    </div>
  );

  // ===== Step 1: Teacher Info =====
  const renderStep1 = () => (
    <div className="step-enter space-y-4 py-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">بيانات المعلم والمدرسة</h2>
        <p className="text-gray-400 text-sm">أدخل المعلومات الأساسية للخطة العلاجية</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المعلم / المعلمة *</label>
          <Input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="مثال: أحمد محمد العمري" className="text-right" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المدرسة *</label>
          <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="مثال: مدرسة الأمير فهد الابتدائية" className="text-right" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم مدير / مديرة المدرسة *</label>
          <Input value={principalName} onChange={e => setPrincipalName(e.target.value)} placeholder="مثال: عبدالله سعد القحطاني" className="text-right" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">المادة الدراسية *</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثال: الرياضيات، اللغة العربية" className="text-right" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">الفصل الدراسي</label>
          <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="الثاني / 1446-1447هـ" className="text-right" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">عدد الفصول *</label>
          <Input
            type="number" min={1} max={20}
            value={classCount}
            onChange={e => setClassCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="text-right"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">نوع الخطة العلاجية *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: "both", label: "الاختبار والمشروع", icon: "📋" },
            { value: "exam", label: "الاختبار فقط", icon: "📝" },
            { value: "project", label: "المشروع فقط", icon: "🗂️" },
            { value: "other", label: "أخرى", icon: "✏️" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPlanType(opt.value as PlanType)}
              className={`p-3 rounded-xl border-2 text-center transition-all text-sm font-medium
                ${planType === opt.value ? "border-amber-700 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
            >
              <div className="text-xl mb-1">{opt.icon}</div>
              {opt.label}
            </button>
          ))}
        </div>
        {planType === "other" && (
          <Input
            className="mt-2 text-right"
            placeholder="حدد نوع الخطة..."
            value={customPlanType}
            onChange={e => setCustomPlanType(e.target.value)}
          />
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(0)}>
          <ArrowRight className="w-4 h-4 ml-1" /> السابق
        </Button>
        <Button
          className="bg-amber-800 hover:bg-amber-900 text-white"
          onClick={() => {
            if (!teacherName || !schoolName || !principalName || !subject) {
              toast.error("يرجى ملء جميع الحقول المطلوبة");
              return;
            }
            initClasses(classCount);
            setStep(2);
          }}
        >
          التالي <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );

  // ===== Step 2: School Logo =====
  const renderStep2 = () => (
    <div className="step-enter py-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">شعار المدرسة (اختياري)</h2>
        <p className="text-gray-400 text-sm">يمكنك رفع شعار المدرسة أو تخطي هذه الخطوة</p>
      </div>

      <div className="max-w-sm mx-auto">
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const { base64, mimeType, preview } = await readFileAsBase64(file);
            setSchoolLogoBase64(base64);
            setSchoolLogoUrl(preview || "");
          }}
        />

        {schoolLogoUrl ? (
          <div className="text-center">
            <img src={schoolLogoUrl} alt="شعار المدرسة" className="w-32 h-32 object-contain mx-auto rounded-2xl border-2 border-amber-200 p-2 mb-4" />
            <Button variant="outline" size="sm" onClick={() => { setSchoolLogoBase64(""); setSchoolLogoUrl(""); }}>
              <Trash2 className="w-4 h-4 ml-1" /> حذف الشعار
            </Button>
          </div>
        ) : (
          <div
            className="upload-zone p-10 text-center cursor-pointer rounded-2xl"
            onClick={() => logoInputRef.current?.click()}
          >
            <School className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium mb-1">انقر لرفع شعار المدرسة</p>
            <p className="text-gray-400 text-xs">PNG, JPG, SVG</p>
          </div>
        )}

        <div className="mt-4 bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-amber-800 text-xs">
            ✅ شعار وزارة التعليم سيُضاف تلقائياً في التقرير
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={() => setStep(1)}>
          <ArrowRight className="w-4 h-4 ml-1" /> السابق
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(3)}>تخطي</Button>
          <Button className="bg-amber-800 hover:bg-amber-900 text-white" onClick={() => setStep(3)}>
            التالي <ArrowLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ===== Step 3: Upload Kashfs =====
  const handleFileUpload = async (classIdx: number, files: FileList) => {
    const newFiles: ClassFile[] = [];
    for (const file of Array.from(files)) {
      const { base64, mimeType, preview } = await readFileAsBase64(file);
      newFiles.push({ name: file.name, base64, mimeType, preview });
    }
    setClasses(prev => prev.map((c, i) => i === classIdx ? { ...c, files: [...c.files, ...newFiles] } : c));
  };

  const analyzeClass = async (classIdx: number) => {
    const cls = classes[classIdx];
    if (cls.files.length === 0) { toast.error("يرجى رفع كشف الطلاب أولاً"); return; }

    // إنشاء الخطة في قاعدة البيانات إذا لم تكن موجودة
    let currentPlanId = planId;
    let currentClassIds: number[] = classes.map((c, i) => c.classId || 0);
    if (!currentPlanId) {
      try {
        const result = await createPlan.mutateAsync({
          teacherName, schoolName, principalName, subject, classCount,
          planType, customPlanType, academicYear,
        });
        currentPlanId = result.planId;
        currentClassIds = result.classIds || [];
        setPlanId(currentPlanId);
        // تحديث classIds في الـ state
        setClasses(prev => prev.map((c, i) => ({ ...c, classId: result.classIds?.[i] || c.classId })));
      } catch (err) {
        toast.error("فشل إنشاء الخطة: " + String(err));
        return;
      }
    }

    const realClassId = currentClassIds[classIdx] || classes[classIdx].classId || classIdx + 1;

    // جلب classId من الخادم
    setClasses(prev => prev.map((c, i) => i === classIdx ? { ...c, analysisStatus: "processing" } : c));

    try {
      // تحليل كل ملف
      let allStudents: StudentData[] = [];
      for (const file of cls.files) {
        const result = await uploadAnalyze.mutateAsync({
          planId: currentPlanId!,
          classId: realClassId,
          fileBase64: file.base64,
          mimeType: file.mimeType,
          fileName: file.name,
          planType,
        });
        if (result.students) {
          allStudents = [...allStudents, ...result.students.map((s: any) => ({
            studentName: s.name,
            examStatus: s.examStatus,
            projectStatus: s.projectStatus,
            rowNumber: s.rowNumber,
          }))];
        }
      }

      setClasses(prev => prev.map((c, i) => i === classIdx ? {
        ...c,
        students: allStudents,
        analysisStatus: "done",
      } : c));
      toast.success(`تم تحليل كشف الفصل ${classIdx + 1} - وُجد ${allStudents.length} طالب يحتاج خطة علاجية`);
    } catch (err) {
      setClasses(prev => prev.map((c, i) => i === classIdx ? { ...c, analysisStatus: "error" } : c));
      toast.error("فشل التحليل: " + String(err));
    }
  };

  const renderStep3 = () => (
    <div className="step-enter py-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">رفع كشوف الطلاب</h2>
        <p className="text-gray-400 text-sm">ارفع صور أو PDF لكشوف كل فصل، ثم اضغط تحليل</p>
      </div>

      {/* Class tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {classes.map((cls, i) => (
          <button
            key={i}
            onClick={() => setCurrentClassIdx(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
              ${currentClassIdx === i ? "bg-amber-800 text-white border-amber-800" : "border-gray-200 text-gray-600 hover:border-amber-300"}
              ${cls.analysisStatus === "done" ? "ring-1 ring-amber-400" : ""}`}
          >
            فصل {cls.classNumber}
            {cls.analysisStatus === "done" && <CheckCircle className="w-3 h-3 inline mr-1 text-amber-300" />}
            {cls.analysisStatus === "processing" && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
          </button>
        ))}
      </div>

      {classes[currentClassIdx] && (
        <div className="border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-700 mb-3">الفصل {classes[currentClassIdx].classNumber}</h3>

          {/* Upload zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFileUpload(currentClassIdx, e.target.files)}
          />
          <div
            className="upload-zone p-6 text-center mb-3 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
            onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove("drag-over");
              e.dataTransfer.files && handleFileUpload(currentClassIdx, e.dataTransfer.files);
            }}
          >
            <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">اسحب الملفات هنا أو انقر للرفع</p>
            <p className="text-gray-400 text-xs mt-1">صور (JPG, PNG) أو PDF • يمكن رفع أكثر من ملف</p>
          </div>

          {/* Uploaded files */}
          {classes[currentClassIdx].files.length > 0 && (
            <div className="space-y-2 mb-3">
              {classes[currentClassIdx].files.map((f, fi) => (
                <div key={fi} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  {f.preview ? (
                    <img src={f.preview} alt={f.name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
                  <button
                    onClick={() => setClasses(prev => prev.map((c, i) => i === currentClassIdx ? { ...c, files: c.files.filter((_, j) => j !== fi) } : c))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze button */}
          <Button
            className="w-full bg-amber-800 hover:bg-amber-900 text-white"
            disabled={classes[currentClassIdx].files.length === 0 || classes[currentClassIdx].analysisStatus === "processing"}
            onClick={() => analyzeClass(currentClassIdx)}
          >
            {classes[currentClassIdx].analysisStatus === "processing" ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحليل بالذكاء الاصطناعي...</>
            ) : (
              <><Eye className="w-4 h-4 ml-2" /> تحليل الكشف واستخراج الأسماء</>
            )}
          </Button>

          {/* Results preview */}
          {classes[currentClassIdx].analysisStatus === "done" && (
            <div className="mt-3 bg-amber-50 rounded-xl p-3">
              <p className="text-amber-800 font-bold text-sm mb-2">
                ✅ تم استخراج {classes[currentClassIdx].students.length} طالب
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {classes[currentClassIdx].students.map((s, si) => (
                  <div key={si} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1">
                    <span className="font-medium text-gray-700">{s.studentName}</span>
                    <div className="flex gap-1">
                      {s.examStatus === "no_exam" && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px]">لم يحل</span>}
                      {s.projectStatus === "not_submitted" && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px]">لم يسلّم</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(2)}>
          <ArrowRight className="w-4 h-4 ml-1" /> السابق
        </Button>
        <Button
          className="bg-amber-800 hover:bg-amber-900 text-white"
          onClick={() => setStep(4)}
        >
          التالي <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );

  // ===== Step 4: Review Students =====
  const renderStep4 = () => (
    <div className="step-enter py-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">مراجعة بيانات الطلاب</h2>
        <p className="text-gray-400 text-sm">راجع وعدّل قائمة الطلاب قبل توليد التقرير</p>
      </div>

      {classes.map((cls, ci) => (
        <div key={ci} className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-amber-800 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-bold text-sm">الفصل {cls.classNumber} - {cls.students.length} طالب</span>
            <button
              onClick={() => {
                const name = prompt("اسم الطالب:");
                if (name) {
                  setClasses(prev => prev.map((c, i) => i === ci ? {
                    ...c,
                    students: [...c.students, {
                      studentName: name,
                      examStatus: planType === "project" ? "did_exam" : "no_exam",
                      projectStatus: planType === "exam" ? "submitted" : "not_submitted",
                      rowNumber: c.students.length + 1,
                    }]
                  } : c));
                }
              }}
              className="bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> إضافة طالب
            </button>
          </div>
          {cls.students.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              لا يوجد طلاب - يمكنك إضافتهم يدوياً
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cls.students.map((s, si) => (
                <div key={si} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                  <span className="text-amber-700 font-bold text-xs w-5">{si + 1}</span>
                  <span className="flex-1 text-sm text-gray-700">{s.studentName}</span>
                  <div className="flex gap-1">
                    {(planType === "exam" || planType === "both") && (
                      <button
                        onClick={() => setClasses(prev => prev.map((c, i) => i === ci ? {
                          ...c,
                          students: c.students.map((st, j) => j === si ? {
                            ...st,
                            examStatus: st.examStatus === "no_exam" ? "did_exam" : "no_exam"
                          } : st)
                        } : c))}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.examStatus === "no_exam" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}
                      >
                        {s.examStatus === "no_exam" ? "لم يحل" : "حل ✓"}
                      </button>
                    )}
                    {(planType === "project" || planType === "both") && (
                      <button
                        onClick={() => setClasses(prev => prev.map((c, i) => i === ci ? {
                          ...c,
                          students: c.students.map((st, j) => j === si ? {
                            ...st,
                            projectStatus: st.projectStatus === "not_submitted" ? "submitted" : "not_submitted"
                          } : st)
                        } : c))}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.projectStatus === "not_submitted" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}
                      >
                        {s.projectStatus === "not_submitted" ? "لم يسلّم" : "سلّم ✓"}
                      </button>
                    )}
                    <button
                      onClick={() => setClasses(prev => prev.map((c, i) => i === ci ? {
                        ...c, students: c.students.filter((_, j) => j !== si)
                      } : c))}
                      className="text-red-300 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(3)}>
          <ArrowRight className="w-4 h-4 ml-1" /> السابق
        </Button>
        <Button
          className="bg-amber-800 hover:bg-amber-900 text-white"
          onClick={async () => {
            // حفظ تعديلات الطلاب في DB إذا كان الطلاب لديهم studentId
            const savePromises: Promise<any>[] = [];
            for (const cls of classes) {
              for (const s of cls.students) {
                if (s.studentId) {
                  savePromises.push(
                    updateStudent.mutateAsync({
                      studentId: s.studentId,
                      examStatus: s.examStatus as "did_exam" | "no_exam",
                      projectStatus: s.projectStatus as "submitted" | "not_submitted",
                    }).catch(() => {})
                  );
                }
              }
            }
            if (savePromises.length > 0) {
              await Promise.all(savePromises);
            }
            setStep(5);
          }}
        >
          التالي <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );

  // ===== Step 5: Links & Notes =====
  const renderStep5 = () => (
    <div className="step-enter py-4 space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">الروابط والملاحظات</h2>
        <p className="text-gray-400 text-sm">أدخل روابط الاختبار والمشروع وملاحظاتك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(planType === "exam" || planType === "both") && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              <Link2 className="w-4 h-4 inline ml-1 text-amber-700" />
              رابط اختبار {subject}
            </label>
            <Input
              value={examLink}
              onChange={e => setExamLink(e.target.value)}
              placeholder="https://forms.office.com/..."
              className="text-left"
              dir="ltr"
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">مدة الإتاحة</label>
              <Input
                value={examDuration}
                onChange={e => setExamDuration(e.target.value)}
                placeholder="مثال: يومين، 48 ساعة"
                className="text-right"
              />
            </div>
          </div>
        )}

        {(planType === "project" || planType === "both") && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              <Link2 className="w-4 h-4 inline ml-1 text-amber-700" />
              رابط تسليم مشروع {subject}
            </label>
            <Input
              value={projectLink}
              onChange={e => setProjectLink(e.target.value)}
              placeholder="https://forms.cloud.microsoft/..."
              className="text-left"
              dir="ltr"
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">مدة الإتاحة</label>
              <Input
                value={projectDuration}
                onChange={e => setProjectDuration(e.target.value)}
                placeholder="مثال: يومين، 48 ساعة"
                className="text-right"
              />
            </div>
          </div>
        )}
      </div>

      {/* الإجراءات الأولية المنفذة */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <label className="block text-sm font-bold text-amber-900">
          ✅ الإجراءات الأولية المنفذة قبل الخطة العلاجية
        </label>
        <p className="text-xs text-amber-700">
          ما قام به المعلم من إجراءات قبل رفع هذه الخطة للمدير (مثال: تواصل مع الطالب، تنبيه شفهي، إرسال رسالة لولي الأمر...)
        </p>
        <Textarea
          value={initialActions}
          onChange={e => setInitialActions(e.target.value)}
          placeholder="مثال: تم تنبيه الطالب شفهياً داخل الفصل، وإرسال رسالة لولي الأمر عبر نظام المدرسة..."
          className="text-right min-h-[80px]"
          rows={3}
        />
      </div>

      {/* ملاحظات المعلم / الإجراءات العلاجية الأولية المنفذة */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          ملاحظات المعلم / الإجراءات العلاجية الأولية المنفذة
        </label>
        <Textarea
          value={teacherNotes}
          onChange={e => setTeacherNotes(e.target.value)}
          placeholder="أدخل ملاحظاتك والإجراءات العلاجية المقترحة للطلاب..."
          className="text-right min-h-[100px]"
          rows={4}
        />
        <p className="text-gray-400 text-xs mt-1">ستظهر هذه الملاحظات في التقرير المرفوع للمدير</p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(4)}>
          <ArrowRight className="w-4 h-4 ml-1" /> السابق
        </Button>
        <Button
          className="bg-amber-800 hover:bg-amber-900 text-white"
          onClick={async () => {
            setIsGenerating(true);
            try {
              // إنشاء الخطة إذا لم تكن موجودة
              let currentPlanId = planId;
              if (!currentPlanId) {
                const result = await createPlan.mutateAsync({
                  teacherName, schoolName, principalName, subject, classCount,
                  planType, customPlanType, academicYear,
                });
                currentPlanId = result.planId;
                setPlanId(currentPlanId);
              }

              // تحديث الروابط والملاحظات وشعار المدرسة
              await updatePlan.mutateAsync({
                planId: currentPlanId!,
                examLink: examLink || undefined,
                projectLink: projectLink || undefined,
                examDuration: examDuration || undefined,
                projectDuration: projectDuration || undefined,
                teacherNotes: teacherNotes || undefined,
                initialActions: initialActions || undefined,
                schoolLogoBase64: schoolLogoBase64 || undefined,
              });

              // توليد التقرير
              const result = await generateReport.mutateAsync({ planId: currentPlanId! });
              setGeneratedPdfUrl(result.pdfUrl);
              setGeneratedDocxUrl(result.docxUrl);
              setStep(6);
            } catch (err) {
              toast.error("فشل توليد التقرير: " + String(err));
            } finally {
              setIsGenerating(false);
            }
          }}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري توليد التقرير...</>
          ) : (
            <>توليد التقرير <ArrowLeft className="w-4 h-4 mr-1" /></>
          )}
        </Button>
      </div>
    </div>
  );

  // ===== Step 6: Download =====
  const renderStep6 = () => (
    <div className="step-enter text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">تم توليد الخطة العلاجية!</h2>
      <p className="text-gray-500 text-sm mb-8">يمكنك تنزيل التقرير بصيغة PDF أو DOCX</p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
        {generatedPdfUrl && (
          <a href={generatedPdfUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white px-8 rounded-xl w-full sm:w-auto">
              <Download className="w-5 h-5 ml-2" />
              تنزيل PDF
            </Button>
          </a>
        )}
        {generatedDocxUrl && (
          <a href={generatedDocxUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl w-full sm:w-auto">
              <Download className="w-5 h-5 ml-2" />
              تنزيل DOCX
            </Button>
          </a>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate("/history")}>
          <HistoryIcon className="w-4 h-4 ml-1" /> سجل خططي
        </Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          <Home className="w-4 h-4 ml-1" /> الصفحة الرئيسية
        </Button>
        <Button
          className="bg-amber-800 hover:bg-amber-900 text-white"
          onClick={() => {
            setStep(0); setPlanId(null); setTeacherName(""); setSchoolName("");
            setPrincipalName(""); setSubject(""); setClasses([]);
            setGeneratedPdfUrl(""); setGeneratedDocxUrl("");
          }}
        >
          إنشاء خطة جديدة
        </Button>
      </div>
    </div>
  );

  // ===== Render =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50" dir="rtl">
      {/* Header */}
      <header className="green-header text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-bold text-sm">منشئ الخطة العلاجية</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Step indicator */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 mb-4 px-4">
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>
      </div>
    </div>
  );
}
