import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Home, Plus, Download, Eye, BookOpen, Calendar, Users, Loader2, FileText } from "lucide-react";
import { getLoginUrl } from "@/const";

function formatDate(d: Date | string) {
  const date = new Date(d);
  return date.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  exam: "الاختبار فقط",
  project: "المشروع فقط",
  both: "الاختبار والمشروع",
  other: "أخرى",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-600" },
  processing: { label: "جاري التوليد", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "مكتملة", color: "bg-amber-100 text-amber-800" },
};

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: plans, isLoading } = trpc.plan.list.useQuery(undefined, { enabled: isAuthenticated });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50" dir="rtl">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">تسجيل الدخول مطلوب</h2>
          <Button className="w-full bg-amber-800 hover:bg-amber-900" onClick={() => window.location.href = getLoginUrl()}>
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50" dir="rtl">
      {/* Header */}
      <header className="green-header text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-bold">سجل الخطط العلاجية</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              onClick={() => navigate("/wizard")}
            >
              <Plus className="w-4 h-4 ml-1" /> خطة جديدة
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              <Home className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!plans || plans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد خطط علاجية بعد</h3>
            <p className="text-gray-400 text-sm mb-6">ابدأ بإنشاء خطتك العلاجية الأولى الآن</p>
            <Button
              className="bg-amber-800 hover:bg-amber-900 text-white px-8"
              onClick={() => navigate("/wizard")}
            >
              <Plus className="w-4 h-4 ml-2" /> إنشاء خطة علاجية
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-700">
                {plans.length} خطة علاجية
              </h2>
              <Button
                size="sm"
                className="bg-amber-800 hover:bg-amber-900 text-white"
                onClick={() => navigate("/wizard")}
              >
                <Plus className="w-4 h-4 ml-1" /> خطة جديدة
              </Button>
            </div>

            {plans.map((plan) => {
              const statusInfo = STATUS_LABELS[plan.status] || STATUS_LABELS.draft;
              return (
                <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 text-base">{plan.schoolName}</h3>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-500" />
                          <span>{plan.teacherName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-amber-500" />
                          <span>{plan.subject}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-500" />
                          <span>{PLAN_TYPE_LABELS[plan.planType] || plan.planType}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-500" />
                          <span>{formatDate(plan.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {plan.status === "completed" && (
                        <>
                          {plan.pdfUrl && (
                            <a href={plan.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs w-full">
                                <Download className="w-3 h-3 ml-1" /> PDF
                              </Button>
                            </a>
                          )}
                          {plan.docxUrl && (
                            <a href={plan.docxUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs w-full">
                                <Download className="w-3 h-3 ml-1" /> DOCX
                              </Button>
                            </a>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
                        onClick={() => navigate(`/plan/${plan.id}`)}
                      >
                        <Eye className="w-3 h-3 ml-1" /> تفاصيل
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
