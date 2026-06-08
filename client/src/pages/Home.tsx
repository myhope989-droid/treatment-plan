import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BookOpen, FileText, History, Sparkles, CheckCircle, Settings, X, Eye, EyeOff, Lock, KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ===== مودال كلمة المرور =====
function PasswordModal({
  title,
  hint,
  onSuccess,
  onClose,
}: {
  title: string;
  hint: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const verifyAdmin = trpc.settings.verifyAdmin.useMutation();
  const verifyStart = trpc.settings.verifyStart.useMutation();

  const isAdmin = title.includes("التحكم");

  const handleSubmit = async () => {
    setError("");
    try {
      if (isAdmin) {
        await verifyAdmin.mutateAsync({ password });
      } else {
        await verifyStart.mutateAsync({ password });
      }
      onSuccess();
    } catch {
      setError("كلمة المرور غير صحيحة، حاول مجدداً");
      setPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="green-header text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <span className="font-bold">{title}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="p-5">
          <p className="text-gray-500 text-sm mb-4 text-center">{hint}</p>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="أدخل كلمة المرور"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
          <p className="text-gray-400 text-xs text-center mt-2">💡 {isAdmin ? "تذكير: كلمة مرور لوحة التحكم" : "تذكير: كلمة مرور البدء"}</p>
          <Button
            className="w-full mt-4 text-white font-bold rounded-xl"
            style={{ background: "#92660a" }}
            onClick={handleSubmit}
            disabled={!password || verifyAdmin.isPending || verifyStart.isPending}
          >
            {(verifyAdmin.isPending || verifyStart.isPending) ? "جاري التحقق..." : "دخول"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== لوحة التحكم =====
function AdminPanel({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"main" | "changeAdmin" | "changeStart">("main");

  // تغيير كلمة مرور لوحة التحكم
  const [adminCurrent, setAdminCurrent] = useState("");
  const [adminNew, setAdminNew] = useState("");
  const [adminNew2, setAdminNew2] = useState("");
  const updateAdmin = trpc.settings.updateAdminPassword.useMutation();

  // تغيير كلمة مرور ابدأ الآن
  const [startAdminPass, setStartAdminPass] = useState("");
  const [startNew, setStartNew] = useState("");
  const [startNew2, setStartNew2] = useState("");
  const updateStart = trpc.settings.updateStartPassword.useMutation();

  const handleChangeAdmin = async () => {
    if (adminNew !== adminNew2) { toast.error("كلمتا المرور الجديدتان غير متطابقتين"); return; }
    if (adminNew.length < 4) { toast.error("كلمة المرور يجب أن تكون 4 أرقام على الأقل"); return; }
    try {
      await updateAdmin.mutateAsync({ currentPassword: adminCurrent, newPassword: adminNew });
      toast.success("تم تغيير كلمة مرور لوحة التحكم بنجاح");
      setView("main");
      setAdminCurrent(""); setAdminNew(""); setAdminNew2("");
    } catch (e: any) {
      toast.error(e?.message || "كلمة المرور الحالية غير صحيحة");
    }
  };

  const handleChangeStart = async () => {
    if (startNew !== startNew2) { toast.error("كلمتا المرور الجديدتان غير متطابقتين"); return; }
    if (startNew.length < 4) { toast.error("كلمة المرور يجب أن تكون 4 أرقام على الأقل"); return; }
    try {
      await updateStart.mutateAsync({ adminPassword: startAdminPass, newPassword: startNew });
      toast.success("تم تغيير كلمة مرور ابدأ الآن بنجاح");
      setView("main");
      setStartAdminPass(""); setStartNew(""); setStartNew2("");
    } catch (e: any) {
      toast.error(e?.message || "كلمة مرور لوحة التحكم غير صحيحة");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="green-header text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <span className="font-bold">⚙️ لوحة التحكم</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {view === "main" && (
            <div className="space-y-3">
              {/* سجل الخطط */}
              <button
                onClick={() => { onClose(); navigate("/history"); }}
                className="w-full flex items-center gap-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-4 py-3 transition-colors text-right"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#fef3c7" }}>
                  <History className="w-5 h-5" style={{ color: "#92660a" }} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">سجل الخطط العلاجية</p>
                  <p className="text-gray-500 text-xs">عرض جميع الخطط المحفوظة</p>
                </div>
              </button>

              {/* خططي السابقة */}
              <button
                onClick={() => { onClose(); navigate("/history"); }}
                className="w-full flex items-center gap-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl px-4 py-3 transition-colors text-right"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#d1fae5" }}>
                  <FileText className="w-5 h-5" style={{ color: "#065f46" }} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">خططي السابقة</p>
                  <p className="text-gray-500 text-xs">استعراض وتنزيل الخطط القديمة</p>
                </div>
              </button>

              <hr className="border-gray-100 my-2" />

              {/* تغيير كلمة مرور لوحة التحكم */}
              <button
                onClick={() => setView("changeAdmin")}
                className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl px-4 py-3 transition-colors text-right"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">تغيير رمز لوحة التحكم</p>
                  <p className="text-gray-500 text-xs">تعديل كلمة مرور الدخول لهذه اللوحة</p>
                </div>
              </button>

              {/* تغيير كلمة مرور ابدأ الآن */}
              <button
                onClick={() => setView("changeStart")}
                className="w-full flex items-center gap-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl px-4 py-3 transition-colors text-right"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-100">
                  <Lock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">تغيير رمز ابدأ الآن</p>
                  <p className="text-gray-500 text-xs">تعديل كلمة مرور إنشاء خطة جديدة</p>
                </div>
              </button>
            </div>
          )}

          {view === "changeAdmin" && (
            <div className="space-y-3">
              <button onClick={() => setView("main")} className="text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700">
                ← رجوع
              </button>
              <h3 className="font-bold text-gray-800">تغيير رمز لوحة التحكم</h3>
              <input
                type="password"
                placeholder="كلمة المرور الحالية"
                value={adminCurrent}
                onChange={e => setAdminCurrent(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="password"
                placeholder="كلمة المرور الجديدة (4 أرقام على الأقل)"
                value={adminNew}
                onChange={e => setAdminNew(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="password"
                placeholder="تأكيد كلمة المرور الجديدة"
                value={adminNew2}
                onChange={e => setAdminNew2(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <Button
                className="w-full text-white font-bold rounded-xl"
                style={{ background: "#92660a" }}
                onClick={handleChangeAdmin}
                disabled={!adminCurrent || !adminNew || !adminNew2 || updateAdmin.isPending}
              >
                {updateAdmin.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          )}

          {view === "changeStart" && (
            <div className="space-y-3">
              <button onClick={() => setView("main")} className="text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700">
                ← رجوع
              </button>
              <h3 className="font-bold text-gray-800">تغيير رمز ابدأ الآن</h3>
              <input
                type="password"
                placeholder="كلمة مرور لوحة التحكم (للتأكيد)"
                value={startAdminPass}
                onChange={e => setStartAdminPass(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="password"
                placeholder="كلمة المرور الجديدة لابدأ الآن"
                value={startNew}
                onChange={e => setStartNew(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="password"
                placeholder="تأكيد كلمة المرور الجديدة"
                value={startNew2}
                onChange={e => setStartNew2(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <Button
                className="w-full text-white font-bold rounded-xl"
                style={{ background: "#92660a" }}
                onClick={handleChangeStart}
                disabled={!startAdminPass || !startNew || !startNew2 || updateStart.isPending}
              >
                {updateStart.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function Home() {
  const [, navigate] = useLocation();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50 flex flex-col" dir="rtl">
      {/* مودال كلمة مرور لوحة التحكم */}
      {showAdminModal && (
        <PasswordModal
          title="دخول لوحة التحكم"
          hint="أدخل كلمة مرور لوحة التحكم للمتابعة"
          onSuccess={() => { setShowAdminModal(false); setShowAdminPanel(true); }}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {/* مودال كلمة مرور ابدأ الآن */}
      {showStartModal && (
        <PasswordModal
          title="ابدأ إنشاء خطة علاجية"
          hint="أدخل كلمة المرور للبدء في إنشاء خطة جديدة"
          onSuccess={() => { setShowStartModal(false); navigate("/wizard"); }}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* لوحة التحكم */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

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
          {/* زر لوحة التحكم */}
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            onClick={() => setShowAdminModal(true)}
          >
            <Settings className="w-4 h-4 ml-1" />
            ⚙️ لوحة التحكم
          </Button>
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

          {/* CTA - زر ابدأ الآن فقط */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="text-white px-8 py-3 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
              style={{background: "#92660a"}}
              onClick={() => setShowStartModal(true)}
            >
              <Sparkles className="w-5 h-5 ml-2" />
              ابدأ الآن
            </Button>
          </div>

          {/* Steps preview */}
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
