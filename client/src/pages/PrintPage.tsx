import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintPage() {
  const params = useParams<{ planId: string }>();
  const planId = parseInt(params.planId || "0");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [combinedHtml, setCombinedHtml] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.plan.getReportHtml.useQuery(
    { planId },
    { enabled: !!planId }
  );

  // بناء HTML مدمج من الصفحات
  useEffect(() => {
    if (!data?.htmlPages?.length) return;

    const htmlPages = data.htmlPages;
    const bodies = htmlPages.map(html => {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch ? bodyMatch[1] : html;
    });
    const styleMatch = htmlPages[0]?.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const css = styleMatch ? styleMatch[1] : "";

    const pagesHtml = bodies.map((body, i) =>
      `<div class="report-page" style="page-break-after:${i < bodies.length - 1 ? 'always' : 'avoid'};">${body}</div>`
    ).join("\n");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>الخطة العلاجية</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>
${css}
* { box-sizing: border-box; }
body { font-family: 'Noto Naskh Arabic', 'Arial', 'Tahoma', serif; direction: rtl; background: white; margin: 0; padding: 0; }
.report-page { max-width: 210mm; margin: 0 auto; padding: 6mm 8mm; }
@media print {
  body { margin: 0; }
  .report-page { page-break-after: always; max-width: 100%; padding: 6mm 8mm; }
  .report-page:last-child { page-break-after: avoid; }
}
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;

    setCombinedHtml(html);
  }, [data]);

  // حقن HTML في iframe
  useEffect(() => {
    if (!combinedHtml || !iframeRef.current) return;
    const iframe = iframeRef.current;
    iframe.onload = () => setIframeReady(true);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(combinedHtml);
      doc.close();
      setIframeReady(true);
    }
  }, [combinedHtml]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  if (!planId) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">معرّف الخطة غير صحيح</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-green-700" />
        <p className="text-gray-600 text-lg">جاري تحميل التقرير...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" dir="rtl">
        <p className="text-red-500 text-lg">تعذر تحميل التقرير</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowRight className="w-4 h-4 ml-1" /> رجوع
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* شريط أدوات الطباعة */}
      <div className="sticky top-0 z-50 bg-green-700 text-white shadow-lg print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="bg-white text-green-800 hover:bg-green-50 font-bold px-6 py-2 rounded-lg shadow"
              size="lg"
            >
              <Printer className="w-5 h-5 ml-2" />
              اطبع / احفظ PDF
            </Button>
            <span className="text-green-100 text-sm hidden sm:block">
              من نافذة الطباعة اختر "حفظ كـ PDF" لحفظ الملف
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => window.history.back()}
          >
            <ArrowRight className="w-4 h-4 ml-1" />
            رجوع
          </Button>
        </div>
      </div>

      {/* معاينة التقرير في iframe */}
      <div className="max-w-4xl mx-auto py-4 px-2">
        {!iframeReady && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-green-700" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="معاينة التقرير"
          className="w-full bg-white rounded-xl shadow-lg border border-gray-200 print:hidden"
          style={{
            height: "calc(100vh - 80px)",
            display: iframeReady ? "block" : "none",
          }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* CSS للطباعة - يطبع محتوى iframe مباشرة */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          iframe, iframe * { visibility: visible; }
          iframe { position: fixed; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        }
      `}</style>
    </div>
  );
}
