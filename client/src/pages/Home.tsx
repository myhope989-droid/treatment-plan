import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { BookOpen, FileText, History, ArrowLeft, Sparkles, CheckCircle } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="green-header text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">منشئ الخطة العلاجية</h1>
              <p className="text-white/70 text-xs">وزارة التعليم - المملكة العربية السعودية</p>
            </div>
          </div>
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              onClick={() => navigate("/history")}
            >
              <History className="w-4 h-4 ml-1" />
              سجل الخطط
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full text-center">
          {/* Logo area */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl" style={{background: "linear-gradient(135deg, #92660a 0%, #b8860b 100%)"}}>
              <FileText className="w-12 h-12 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            منشئ الخطة العلاجية الذكي
          </h2>
          <p className="text-gray-500 text-base mb-8 leading-relaxed">
            أداة احترافية تساعدك على إنشاء خطط علاجية مخصصة لطلابك<br />
            بتحليل ذكي للكشوف وتوليد تقارير PDF وDOCX جاهزة للطباعة
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Sparkles, title: "تحليل ذكي", desc: "استخراج أسماء الطلاب تلقائياً من صور الكشوف" },
              { icon: FileText, title: "تقارير احترافية", desc: "PDF وDOCX بتصميم رسمي يشمل الشعارات والباركود" },
              { icon: History, title: "سجل محفوظ", desc: "جميع خططك محفوظة ويمكن تنزيلها في أي وقت" },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 text-center hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{background: "#fef3c7"}}>
                  <f.icon className="w-5 h-5" style={{color: "#92660a"}} />
                </div>
                <h3 className="font-bold text-gray-800 text-sm mb-1">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-white px-8 py-3 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                style={{background: "#92660a"}}
                onClick={() => navigate("/wizard")}
              >
                <Sparkles className="w-5 h-5 ml-2" />
                إنشاء خطة علاجية جديدة
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-3 text-base rounded-xl"
                style={{borderColor: "#b8860b", color: "#92660a"}}
                onClick={() => navigate("/history")}
              >
                <History className="w-5 h-5 ml-2" />
                خططي السابقة
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="text-white px-10 py-3 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                style={{background: "#92660a"}}
                onClick={() => window.location.href = getLoginUrl()}
              >
                <ArrowLeft className="w-5 h-5 ml-2" />
                ابدأ الآن - تسجيل الدخول
              </Button>
              <p className="text-gray-400 text-xs">مجاني تماماً • لا يحتاج تثبيت</p>
            </div>
          )}

          {/* Steps preview */}
          {isAuthenticated && (
            <div className="mt-10 bg-white rounded-2xl p-6 shadow-sm border border-amber-100 text-right">
              <h3 className="font-bold text-gray-700 mb-4 text-sm">كيف يعمل التطبيق؟</h3>
              <div className="space-y-3">
                {[
                  "أدخل بيانات المعلم والمدرسة والمادة",
                  "ارفع صور كشوف الطلاب لكل فصل",
                  "الذكاء الاصطناعي يستخرج أسماء الطلاب تلقائياً",
                  "أدخل روابط الاختبار والمشروع",
                  "نزّل التقرير بصيغة PDF أو DOCX",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{background: "#fef3c7"}}>
                      <span className="font-bold text-xs" style={{color: "#92660a"}}>{i + 1}</span>
                    </div>
                    <span className="text-gray-600 text-sm">{step}</span>
                    <CheckCircle className="w-4 h-4 mr-auto flex-shrink-0" style={{color: "#b8860b"}} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-amber-100">
        منشئ الخطة العلاجية &nbsp;|&nbsp; وزارة التعليم &nbsp;|&nbsp; المملكة العربية السعودية
        <br />
        <span className="text-amber-700 font-semibold">برمجة الأستاذ أسعد الجحدلي</span>
      </footer>
    </div>
  );
}
