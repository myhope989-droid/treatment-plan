import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import { ArrowRight, Download, BookOpen, Home, Loader2, Users, FileText, Link2, Printer } from "lucide-react";
import { toast } from "sonner";

export default function PlanDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ planId: string }>();
  const planId = parseInt(params.planId || "0");
  const [isPrinting, setIsPrinting] = useState(false);
  const trpcUtils = trpc.useUtils();

  const { data: plan, isLoading } = trpc.plan.getById.useQuery(
    { planId },
    { enabled: !!planId }
  );

  // دمج صفحات HTML في مستند واحد قابل للطباعة
  function buildPrintableHtml(htmlPages: string[]): string {
    const bodies = htmlPages.map(html => {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch ? bodyMatch[1] : html;
    });
    const styleMatch = htmlPages[0]?.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const css = styleMatch ? styleMatch[1] : "";
    const pagesHtml = bodies.map((body, i) =>
      `<div class="report-page" style="page-break-after:${i < bodies.length - 1 ? 'always' : 'avoid'};">${body}</div>`
    ).join("\n");
    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>الخطة العلاجية</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>
${css}
body { font-family: 'Noto Naskh Arabic', 'Arial', 'Tahoma', serif; direction: rtl; background: white; }
.report-page { max-width: 210mm; margin: 0 auto; padding: 6mm 8mm; }
@media print {
  body { margin: 0; }
  .print-btn { display: none !important; }
  .report-page { page-break-after: always; max-width: 100%; padding: 6mm 8mm; }
  .report-page:last-child { page-break-after: avoid; }
}
.print-btn {
  position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
  background: #1a7a5e; color: white; border: none; padding: 10px 30px;
  font-size: 16px; border-radius: 8px; cursor: pointer; z-index: 9999;
  font-family: 'Noto Naskh Arabic', Arial, sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.print-btn:hover { background: #0d5c45; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">اضغط هنا للطباعة ←</button>
${pagesHtml}
</body>
</html>`;
  }

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const htmlResult = await trpcUtils.plan.getReportHtml.fetch({ planId });
      if (htmlResult && htmlResult.htmlPages && htmlResult.htmlPages.length > 0) {
        const combinedHtml = buildPrintableHtml(htmlResult.htmlPages);
        const printWin = window.open("", "_blank");
        if (printWin) {
          printWin.document.write(combinedHtml);
          printWin.document.close();
        } else {
          toast.error("تم حجب النافذة - يرجى السماح للنوافذ المنبثقة");
        }
      }
    } catch {
      toast.error("تعذر تحميل التقرير");
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
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

        {/* Print & Download buttons - always visible for any plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
          <h3 className="font-bold text-gray-700 mb-3">طباعة وتنزيل التقرير</h3>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحميل...</>
              ) : (
                <><Printer className="w-4 h-4 ml-2" /> طباعة / حفظ PDF</>
              )}
            </Button>
            {plan.docxUrl && (
              <a href={plan.docxUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 ml-2" /> تنزيل DOCX
                </Button>
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">ℹ️ اضغط "طباعة / حفظ PDF" لفتح صفحة الطباعة • من صفحة الطباعة اضغط على "حفظ كـ PDF" لحفظه على جهازك
          </p>
        </div>

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
