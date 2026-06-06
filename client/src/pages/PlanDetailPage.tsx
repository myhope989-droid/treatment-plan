import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import { ArrowRight, Download, BookOpen, Home, Loader2, Users, FileText, Link2, Printer } from "lucide-react";

export default function PlanDetailPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ planId: string }>();
  const planId = parseInt(params.planId || "0");

  const { data: plan, isLoading } = trpc.plan.getById.useQuery(
    { planId },
    { enabled: isAuthenticated && !!planId }
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">الخطة غير موجودة</p>
          <Button onClick={() => navigate("/history")}>العودة للسجل</Button>
        </div>
      </div>
    );
  }

  const totalStudents = plan.classes?.reduce((sum: number, c: any) => sum + (c.students?.length || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50" dir="rtl">
      <header className="green-header text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-bold text-sm">تفاصيل الخطة العلاجية</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate("/history")}>
              <ArrowRight className="w-4 h-4 ml-1" /> السجل
            </Button>
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{plan.schoolName}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: "المعلم", value: plan.teacherName, icon: Users },
              { label: "المدير", value: plan.principalName, icon: Users },
              { label: "المادة", value: plan.subject, icon: BookOpen },
              { label: "عدد الفصول", value: String(plan.classCount), icon: FileText },
              { label: "إجمالي الطلاب", value: String(totalStudents), icon: Users },
              { label: "الفصل الدراسي", value: plan.academicYear || "", icon: FileText },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <item.icon className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-400 text-xs">{item.label}</p>
                  <p className="font-semibold text-gray-700">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {(plan.examLink || plan.projectLink) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-gray-700 text-sm">الروابط</span>
              </div>
              <div className="space-y-1 text-xs">
                {plan.examLink && <p className="text-blue-600 break-all">الاختبار: {plan.examLink}</p>}
                {plan.projectLink && <p className="text-blue-600 break-all">المشروع: {plan.projectLink}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Download & Print buttons */}
        {plan.status === "completed" && (plan.pdfUrl || plan.docxUrl) && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
            <h3 className="font-bold text-gray-700 mb-3">تنزيل وطباعة التقرير</h3>
            <div className="flex flex-wrap gap-3">
              {plan.pdfUrl && (
                <a href={plan.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-red-600 hover:bg-red-700 text-white">
                    <Download className="w-4 h-4 ml-2" /> تنزيل PDF
                  </Button>
                </a>
              )}
              {plan.docxUrl && (
                <a href={plan.docxUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4 ml-2" /> تنزيل DOCX
                  </Button>
                </a>
              )}
              {plan.pdfUrl && (
                <Button
                  className="bg-amber-700 hover:bg-amber-800 text-white"
                  onClick={() => {
                    const printWindow = window.open(plan.pdfUrl!, "_blank");
                    if (printWindow) {
                      printWindow.addEventListener("load", () => {
                        printWindow.print();
                      });
                    }
                  }}
                >
                  <Printer className="w-4 h-4 ml-2" /> طباعة مباشرة
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">ℹ️ للطباعة المباشرة سيتم فتح ملف PDF ثم ستظهر نافذة الطباعة تلقائياً</p>
          </div>
        )}

        {/* Classes & Students */}
        {plan.classes?.map((cls: any) => (
          <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="bg-amber-800 text-white px-4 py-2 flex items-center justify-between">
              <span className="font-bold text-sm">الفصل {cls.classNumber}</span>
              <span className="text-white/70 text-xs">{cls.students?.length || 0} طالب</span>
            </div>
            {cls.students?.length === 0 ? (
              <p className="p-4 text-center text-gray-400 text-sm">لا يوجد طلاب في هذا الفصل</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {cls.students?.map((s: any, si: number) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
                    <span className="text-amber-700 font-bold text-xs w-5">{si + 1}</span>
                    <span className="flex-1 text-sm text-gray-700">{s.studentName}</span>
                    <div className="flex gap-1">
                      {s.examStatus === "no_exam" && (
                        <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-medium">لم يحل الاختبار</span>
                      )}
                      {s.projectStatus === "not_submitted" && (
                        <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-medium">لم يسلّم المشروع</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
