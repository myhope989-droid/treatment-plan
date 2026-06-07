import QRCode from "qrcode";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  ImageRun, HeadingLevel, VerticalAlign, convertInchesToTwip
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { storageGetSignedUrl } from "./storage";
import sharp from "sharp";
import React from "react";
import { Document as PDFDoc, Page, Text, View, Image as PDFImage, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

// تحويل أي صورة (WebP, JPEG, PNG, SVG...) إلى PNG مدعوم من PDFKit
async function toSafePngBuffer(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).png().toBuffer();
  } catch {
    return input; // إذا فشل التحويل، أعد الصورة كما هي
  }
}

// مفاتيح الخطوط العربية في S3
const FONT_REGULAR_KEY = "NotoSansArabic-Regular_158bb32c.ttf";
const FONT_BOLD_KEY = "NotoSansArabic-Bold_e06b9419.ttf";

// cache للخطوط في الذاكرة
let fontRegularPath: string | null = null;
let fontBoldPath: string | null = null;
let fontsRegistered = false;

async function ensureFontPath(key: string, localName: string): Promise<string> {
  // أولاً: من الملف المحلي (sandbox / dev)
  const localPath = path.join(process.cwd(), "server", "assets", localName);
  if (fs.existsSync(localPath)) return localPath;
  // ثانياً: من S3 - نحفظه في /tmp
  const tmpPath = path.join("/tmp", localName);
  if (fs.existsSync(tmpPath)) return tmpPath;
  const url = await storageGetSignedUrl(key);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`فشل تحميل الخط: ${resp.status}`);
  fs.writeFileSync(tmpPath, Buffer.from(await resp.arrayBuffer()));
  return tmpPath;
}

async function ensureFontsRegistered(): Promise<void> {
  if (fontsRegistered) return;
  fontRegularPath = await ensureFontPath(FONT_REGULAR_KEY, "NotoSansArabic-Regular.ttf");
  fontBoldPath = await ensureFontPath(FONT_BOLD_KEY, "NotoSansArabic-Bold.ttf");
  Font.register({ family: "Arabic", fonts: [
    { src: fontRegularPath, fontWeight: "normal" },
    { src: fontBoldPath, fontWeight: "bold" },
  ]});
  Font.register({ family: "ArabicBold", src: fontBoldPath });
  fontsRegistered = true;
}

// دالة قديمة للتوافق مع DOCX
async function getFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  const regPath = await ensureFontPath(FONT_REGULAR_KEY, "NotoSansArabic-Regular.ttf");
  const boldPath = await ensureFontPath(FONT_BOLD_KEY, "NotoSansArabic-Bold.ttf");
  return { regular: fs.readFileSync(regPath), bold: fs.readFileSync(boldPath) };
}

const MOE_LOGO_PATH = path.join(process.cwd(), "server", "assets", "moe_logo.png");

// قراءة شعار وزارة التعليم كـ base64
function getMoeLogoBase64(): string {
  try {
    if (fs.existsSync(MOE_LOGO_PATH)) {
      const data = fs.readFileSync(MOE_LOGO_PATH);
      return `data:image/png;base64,${data.toString("base64")}`;
    }
  } catch {}
  return "";
}

// توليد QR Code كـ base64 data URL
async function generateQRBase64(url: string): Promise<string> {
  if (!url || !url.startsWith("http")) return "";
  try {
    return await QRCode.toDataURL(url, {
      width: 130,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a7a5e", light: "#ffffff" }
    });
  } catch {
    return "";
  }
}

const DEFAULT_NOTES = `بعد حصر الطلاب الذين لم يسلموا المشروع أو لم يؤدوا الاختبار، تم تنفيذ متابعة علاجية مستمرة خلال أكثر من خمس حصص دراسية، حيث تم الاستفسار بشكل فردي عن أسباب عدم التسليم أو عدم أداء الاختبار. وقد تبين أن جميع الطلاب لا يملكون أعذاراً مقنعة أو مبررات تمنعهم من إنجاز المطلوب. كما تم توفير الاختبار والمهام عبر عدة قنوات لضمان سهولة الوصول إليها، حيث نُشرت على منصة مدرستي، وأُرسلت عبر قناة المادة في تطبيق التليجرام، إضافة إلى التذكير والمتابعة المتكررة أثناء الحصص الدراسية.`;

// توليد HTML لصفحة واحدة (فصل واحد)
export async function generatePageHTML(plan: any, cls: any): Promise<string> {
  const moeLogoB64 = getMoeLogoBase64();
  const qrExam = plan.examLink ? await generateQRBase64(plan.examLink) : "";
  const qrProject = plan.projectLink ? await generateQRBase64(plan.projectLink) : "";
  const notes = plan.teacherNotes || DEFAULT_NOTES;
  const initialActionsText = plan.initialActions || "";
  const students: any[] = cls.students || [];

  const rows = students.map((s: any, idx: number) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#f0faf6";
    const examColor = s.examStatus === "no_exam" ? "#c0392b" : "#1a7a5e";
    const projColor = s.projectStatus === "not_submitted" ? "#c0392b" : "#1a7a5e";
    const examText = s.examStatus === "no_exam" ? "لم يحل" : "حل ✓";
    const projText = s.projectStatus === "not_submitted" ? "لم يسلّم" : "سلّم ✓";
    return `<tr style="background:${bg}">
      <td><div class="fb"></div></td>
      <td><div class="fb"></div></td>
      <td style="color:${projColor};font-weight:bold;">${projText}</td>
      <td><div class="fb"></div></td>
      <td style="color:${examColor};font-weight:bold;">${examText}</td>
      <td></td>
      <td class="name-cell">${s.studentName}</td>
      <td class="num">${idx + 1}</td>
    </tr>`;
  }).join("");

  const qrSection = (qrExam || qrProject) ? `
  <div style="margin-top:5px;border-top:2px solid #1a7a5e;padding-top:5px;">
    <table style="width:100%;border:none;border-collapse:collapse;">
      <tr>
        ${qrExam ? `<td style="width:50%;border:none;text-align:center;padding:0 8px;vertical-align:top;">
          <div style="font-weight:bold;color:#1a7a5e;font-size:7.5pt;margin-bottom:3px;">رابط اختبار ${plan.subject}</div>
          <img src="${qrExam}" style="width:60px;height:60px;" alt="QR الاختبار"/>
          <div style="font-size:5.5pt;color:#0d5c45;word-break:break-all;margin-top:2px;">${plan.examLink}</div>
          ${plan.examDuration ? `<div style="font-size:6.5pt;color:#c0392b;font-weight:bold;margin-top:2px;">⚠️ متاح ${plan.examDuration}</div>` : ""}
        </td>` : "<td style='border:none'></td>"}
        ${qrProject ? `<td style="width:50%;border:none;text-align:center;padding:0 8px;vertical-align:top;border-right:1px dashed #1a7a5e;">
          <div style="font-weight:bold;color:#1a7a5e;font-size:7.5pt;margin-bottom:3px;">رابط تسليم مشروع ${plan.subject}</div>
          <img src="${qrProject}" style="width:60px;height:60px;" alt="QR المشروع"/>
          <div style="font-size:5.5pt;color:#0d5c45;word-break:break-all;margin-top:2px;">${plan.projectLink}</div>
          ${plan.projectDuration ? `<div style="font-size:6.5pt;color:#c0392b;font-weight:bold;margin-top:2px;">⚠️ متاح ${plan.projectDuration}</div>` : ""}
        </td>` : "<td style='border:none'></td>"}
      </tr>
    </table>
  </div>` : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 6mm 8mm 5mm 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Noto Naskh Arabic', 'Arial', 'Tahoma', serif;
    direction: rtl;
    background: white;
    color: #1a1a1a;
    font-size: 7pt;
    line-height: 1.2;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2.5px solid #1a7a5e;
    padding-bottom: 5px;
    margin-bottom: 5px;
  }
  .header img { width: 58px; height: 50px; object-fit: contain; }
  .header-center { text-align: center; flex: 1; padding: 0 8px; }
  .header-center .kingdom { font-size: 6.5pt; color: #666; }
  .header-center .ministry { font-size: 8pt; color: #1a7a5e; font-weight: bold; }
  .header-center .school-name { font-size: 11pt; font-weight: bold; }
  .title {
    text-align: center;
    margin: 4px 0;
    padding: 5px 12px;
    background: linear-gradient(135deg, #1a7a5e, #0d5c45);
    color: white;
    border-radius: 4px;
    font-size: 13pt;
    font-weight: bold;
  }
  .info-row {
    display: flex;
    gap: 4px;
    margin: 4px 0;
  }
  .info-box {
    flex: 1;
    border: 1px solid #1a7a5e;
    border-radius: 3px;
    padding: 2px 5px;
  }
  .info-box .lbl { color: #1a7a5e; font-weight: bold; font-size: 6pt; display: block; }
  .info-box .val { font-size: 7pt; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 6.8pt; }
  th {
    background: #1a7a5e;
    color: white;
    padding: 3px 2px;
    text-align: center;
    border: 1px solid #0d5c45;
    font-size: 6.5pt;
    font-weight: bold;
    line-height: 1.2;
  }
  td {
    padding: 2px 3px;
    text-align: center;
    border: 1px solid #ccc;
    vertical-align: middle;
    font-size: 6.8pt;
  }
  .num { width: 18px; font-weight: bold; color: #1a7a5e; }
  .name-cell { width: 115px; text-align: right; padding-right: 5px; }
  .fb { border: 1px solid #bbb; min-height: 13px; border-radius: 2px; background: white; }
  .notes {
    margin-top: 4px;
    border: 1px solid #1a7a5e;
    border-radius: 3px;
    padding: 3px 6px;
  }
  .notes-title { font-size: 7pt; font-weight: bold; color: #1a7a5e; border-bottom: 1px dashed #1a7a5e; padding-bottom: 2px; margin-bottom: 2px; }
  .notes-text { font-size: 6.5pt; line-height: 1.4; text-align: justify; }
  .sigs { display: flex; gap: 6px; margin-top: 4px; }
  .sig {
    flex: 1;
    text-align: center;
    border: 1px solid #1a7a5e;
    border-radius: 3px;
    padding: 3px;
  }
  .sig-title { font-size: 6.5pt; font-weight: bold; color: #1a7a5e; }
  .sig-name { font-size: 8pt; font-weight: bold; margin: 1px 0; }
  .sig-line { border-bottom: 1px solid #888; height: 12px; margin-top: 2px; }
  .sig-label { font-size: 6pt; color: #666; margin-top: 1px; }
  .footer { text-align: center; margin-top: 3px; padding-top: 2px; border-top: 1px solid #1a7a5e; font-size: 6pt; color: #888; }
</style>
</head>
<body>
  <div class="header">
    ${moeLogoB64 ? `<img src="${moeLogoB64}" alt="وزارة التعليم"/>` : `<div style="width:58px;text-align:center;font-size:6pt;color:#1a7a5e;font-weight:bold;">وزارة<br>التعليم</div>`}
    <div class="header-center">
      <div class="kingdom">المملكة العربية السعودية</div>
      <div class="ministry">وزارة التعليم</div>
      <div class="school-name">${plan.schoolName}</div>
    </div>
    ${plan.schoolLogoUrl ? `<img src="${plan.schoolLogoUrl}" alt="شعار المدرسة" style="max-width:58px;max-height:58px;object-fit:contain;"/>` : `<div style="width:58px;"></div>`}
  </div>

  <div class="title">الخطة العلاجية للصف ${plan.gradeLevel || cls.className || cls.classNumber}</div>

  <div class="info-row">
    <div class="info-box"><span class="lbl">الفصل الدراسي</span><span class="val">${plan.academicYear || "الثاني / 1446-1447هـ"}</span></div>
    <div class="info-box"><span class="lbl">الصف والفصل</span><span class="val">${plan.gradeLevel || "الصف"} / فصل ${cls.classNumber}</span></div>
    <div class="info-box"><span class="lbl">المادة الدراسية</span><span class="val">${plan.subject}</span></div>
    <div class="info-box"><span class="lbl">التاريخ</span><span class="val">...... / ...... / ....هـ</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50px">الإجراء المتخذ</th>
        <th>سبب عدم تسليم المشروع</th>
        <th style="width:42px">المشروع</th>
        <th>سبب عدم حل الاختبار</th>
        <th style="width:42px">الاختبار</th>
        <th style="width:42px">رقم الجلسة</th>
        <th style="width:115px">اسم الطالب</th>
        <th style="width:18px">م</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:#888;padding:8px;">لا يوجد طلاب</td></tr>`}</tbody>
  </table>

  ${initialActionsText ? `
  <div class="notes" style="border-color:#b8860b;background:#fffbeb;margin-bottom:3px;">
    <div class="notes-title" style="color:#92660a;border-color:#b8860b;">✅ الإجراءات الأولية المنفذة قبل الخطة العلاجية:</div>
    <div class="notes-text">${initialActionsText}</div>
  </div>` : ""}

  <div class="notes">
    <div class="notes-title">ملاحظات المعلم / الإجراءات العلاجية الأولية المنفذة:</div>
    <div class="notes-text">${notes}</div>
  </div>

  <div class="sigs">
    <div class="sig">
      <div class="sig-title">توقيع المعلم</div>
      <div class="sig-name">${plan.teacherName}</div>
      <div class="sig-line"></div>
      <div class="sig-label">التوقيع</div>
    </div>
    <div class="sig">
      <div class="sig-title">اطلع عليه مدير المدرسة</div>
      <div class="sig-name">${plan.principalName}</div>
      <div class="sig-line"></div>
      <div class="sig-label">التوقيع</div>
    </div>
    <div class="sig">
      <div class="sig-title">المرشد الطلابي</div>
      <div class="sig-name">${plan.counselorName || '.............................'}</div>
      <div class="sig-line"></div>
      <div class="sig-label">التوقيع</div>
    </div>
    <div class="sig">
      <div class="sig-title">توقيع ولي الأمر</div>
      <div class="sig-name">.............................</div>
      <div class="sig-line"></div>
      <div class="sig-label">التوقيع</div>
    </div>
  </div>

  ${qrSection}

  <div class="footer">${plan.schoolName} &nbsp;|&nbsp; وزارة التعليم &nbsp;|&nbsp; المملكة العربية السعودية</div>
</body>
</html>`;
}

// ===== توليد PDF باستخدام @react-pdf/renderer (دعم RTL كامل) =====

const GREEN = "#1a7a5e";
const DARK_GREEN = "#0d5c45";
const RED = "#c0392b";
const GOLD = "#b8860b";
const GOLD_BG = "#fffbeb";
const GRAY = "#888888";
const LIGHT_BG = "#f0faf6";
const WHITE = "#ffffff";

const styles = StyleSheet.create({
  page: { fontFamily: "Arabic", padding: "6mm 8mm 5mm 8mm", backgroundColor: WHITE, fontSize: 7 },
  // رأس الصفحة
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 4, marginBottom: 4 },
  headerLogo: { width: 44, height: 38, objectFit: "contain" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  headerKingdom: { fontSize: 6, color: GRAY },
  headerMinistry: { fontSize: 8, color: GREEN, fontFamily: "ArabicBold" },
  headerSchool: { fontSize: 11, fontFamily: "ArabicBold", color: "#1a1a1a" },
  // عنوان الخطة
  planTitle: { backgroundColor: GREEN, color: WHITE, textAlign: "center", fontSize: 13, fontFamily: "ArabicBold", paddingVertical: 4, borderRadius: 3, marginBottom: 4 },
  // صف المعلومات
  infoRow: { flexDirection: "row", marginBottom: 4, gap: 3 },
  infoBox: { flex: 1, borderWidth: 0.8, borderColor: GREEN, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 2, alignItems: "center" },
  infoLabel: { fontSize: 5.5, color: GREEN, fontFamily: "ArabicBold" },
  infoValue: { fontSize: 6.5, fontFamily: "ArabicBold", color: "#1a1a1a", textAlign: "center" },
  // جدول الطلاب
  tableHeaderRow: { flexDirection: "row", backgroundColor: GREEN },
  tableHeaderCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 1, borderRightWidth: 0.5, borderRightColor: DARK_GREEN, alignItems: "center", justifyContent: "center" },
  tableHeaderText: { fontSize: 6, color: WHITE, fontFamily: "ArabicBold", textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#cccccc" },
  tableCell: { flex: 1, paddingVertical: 2, paddingHorizontal: 1, borderRightWidth: 0.3, borderRightColor: "#cccccc", alignItems: "center", justifyContent: "center" },
  tableCellText: { fontSize: 6.5, textAlign: "center", color: "#1a1a1a" },
  tableCellName: { flex: 2.5, paddingVertical: 2, paddingHorizontal: 3, borderRightWidth: 0.3, borderRightColor: "#cccccc", justifyContent: "center" },
  tableCellNameText: { fontSize: 6.5, textAlign: "right", color: "#1a1a1a" },
  // ملاحظات
  notesBox: { borderWidth: 0.8, borderColor: GREEN, borderRadius: 2, padding: 4, marginBottom: 4 },
  notesTitle: { fontSize: 7, fontFamily: "ArabicBold", color: GREEN, marginBottom: 3, textAlign: "right" },
  notesText: { fontSize: 6.5, color: "#1a1a1a", textAlign: "right", lineHeight: 1.5 },
  // إجراءات أولية
  actionsBox: { borderWidth: 0.8, borderColor: GOLD, borderRadius: 2, padding: 4, marginBottom: 4, backgroundColor: GOLD_BG },
  actionsTitle: { fontSize: 7, fontFamily: "ArabicBold", color: GOLD, marginBottom: 3, textAlign: "right" },
  actionsText: { fontSize: 6.5, color: "#92660a", textAlign: "right", lineHeight: 1.5 },
  // التوقيعات
  sigRow: { flexDirection: "row", marginBottom: 4, gap: 3 },
  sigBox: { flex: 1, borderWidth: 0.8, borderColor: GREEN, borderRadius: 2, padding: 3, alignItems: "center", minHeight: 36 },
  sigTitle: { fontSize: 6, fontFamily: "ArabicBold", color: GREEN, marginBottom: 2 },
  sigName: { fontSize: 7.5, fontFamily: "ArabicBold", color: "#1a1a1a", marginBottom: 4 },
  sigLine: { borderTopWidth: 0.5, borderTopColor: GRAY, width: "80%", marginBottom: 1 },
  sigLabel: { fontSize: 5.5, color: GRAY },
  // QR
  qrRow: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: GREEN, paddingTop: 4, marginTop: 2 },
  qrHalf: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  qrTitle: { fontSize: 7, fontFamily: "ArabicBold", color: GREEN, marginBottom: 3, textAlign: "center" },
  qrImage: { width: 55, height: 55 },
  qrLink: { fontSize: 5, color: DARK_GREEN, marginTop: 2, textAlign: "center" },
  qrDuration: { fontSize: 6, fontFamily: "ArabicBold", color: RED, marginTop: 1, textAlign: "center" },
  // تذييل
  footer: { borderTopWidth: 0.8, borderTopColor: GREEN, paddingTop: 3, marginTop: 3 },
  footerText: { fontSize: 5.5, color: GRAY, textAlign: "center" },
});

export async function generateTreatmentPlanPDF(plan: any): Promise<Buffer> {
  await ensureFontsRegistered();
  const classesWithStudents = (plan.classes || []).filter((c: any) => c.students && c.students.length > 0);
  const allClasses = classesWithStudents.length > 0 ? classesWithStudents : [{ classNumber: 1, students: [] }];

  // تحميل شعار وزارة التعليم
  let moeLogoSrc: string | null = null;
  if (fs.existsSync(MOE_LOGO_PATH)) {
    try {
      const buf = await toSafePngBuffer(fs.readFileSync(MOE_LOGO_PATH));
      moeLogoSrc = `data:image/png;base64,${buf.toString("base64")}`;
    } catch { /* تجاهل */ }
  }

  // تحميل شعار المدرسة
  let schoolLogoSrc: string | null = null;
  if (plan.schoolLogoUrl) {
    try {
      const logoUrl = plan.schoolLogoUrl.startsWith("/manus-storage/")
        ? await storageGetSignedUrl(plan.schoolLogoUrl.replace("/manus-storage/", ""))
        : plan.schoolLogoUrl;
      const resp = await fetch(logoUrl);
      if (resp.ok) {
        const rawBuf = Buffer.from(await resp.arrayBuffer());
        const pngBuf = await toSafePngBuffer(rawBuf);
        schoolLogoSrc = `data:image/png;base64,${pngBuf.toString("base64")}`;
      }
    } catch { /* تجاهل */ }
  }

  // QR codes
  const qrExamDataUrl = plan.examLink ? await generateQRBase64(plan.examLink) : "";
  const qrProjectDataUrl = plan.projectLink ? await generateQRBase64(plan.projectLink) : "";

  const notes = plan.teacherNotes || DEFAULT_NOTES;
  const initialActionsText = plan.initialActions || "";

  // بناء مكوّن React-PDF
  const TreatmentPlanDoc = () => React.createElement(
    PDFDoc,
    { title: `الخطة العلاجية - ${plan.schoolName}` },
    ...allClasses.map((cls: any) => {
      const students: any[] = cls.students || [];
      const planTitle = `الخطة العلاجية للصف ${plan.gradeLevel || cls.className || cls.classNumber}`;

      return React.createElement(Page, { key: cls.classNumber, size: "A4", style: styles.page },
        // ===== الرأس ===== (من اليمين: شعار المدرسة، النص، شعار وزارة التعليم)
        React.createElement(View, { style: styles.header },
          schoolLogoSrc
            ? React.createElement(PDFImage, { style: styles.headerLogo, src: schoolLogoSrc })
            : React.createElement(View, { style: styles.headerLogo }),
          React.createElement(View, { style: styles.headerCenter },
            React.createElement(Text, { style: styles.headerKingdom }, "المملكة العربية السعودية"),
            React.createElement(Text, { style: styles.headerMinistry }, "وزارة التعليم"),
            React.createElement(Text, { style: styles.headerSchool }, plan.schoolName || ""),
          ),
          moeLogoSrc
            ? React.createElement(PDFImage, { style: styles.headerLogo, src: moeLogoSrc })
            : React.createElement(View, { style: styles.headerLogo }),
        ),

        // ===== عنوان الخطة =====
        React.createElement(Text, { style: styles.planTitle }, planTitle),

        // ===== صف المعلومات ===== (RTL: التاريخ أولاً من اليمين)
        React.createElement(View, { style: styles.infoRow },
          React.createElement(View, { style: styles.infoBox },
            React.createElement(Text, { style: styles.infoLabel }, "التاريخ"),
            React.createElement(Text, { style: styles.infoValue }, "...... / ...... / ....هـ"),
          ),
          React.createElement(View, { style: styles.infoBox },
            React.createElement(Text, { style: styles.infoLabel }, "المادة الدراسية"),
            React.createElement(Text, { style: styles.infoValue }, plan.subject || ""),
          ),
          React.createElement(View, { style: styles.infoBox },
            React.createElement(Text, { style: styles.infoLabel }, "الصف والفصل"),
            React.createElement(Text, { style: styles.infoValue }, `${plan.gradeLevel || "الصف"} / فصل ${cls.classNumber}`),
          ),
          React.createElement(View, { style: styles.infoBox },
            React.createElement(Text, { style: styles.infoLabel }, "الفصل الدراسي"),
            React.createElement(Text, { style: styles.infoValue }, plan.academicYear || "الثاني / 1446هـ"),
          ),
        ),

        // ===== جدول الطلاب =====
        React.createElement(View, { style: { borderWidth: 0.8, borderColor: GREEN, borderRadius: 2, marginBottom: 4 } },
          // رأس الجدول (LTR في الكود لكن يظهر RTL في PDF: م ← اسم الطالب ← رقم الجلسة ← الاختبار ← سبب عدم حل ← المشروع ← سبب عدم تسليم ← الإجراء)
          React.createElement(View, { style: styles.tableHeaderRow },
            React.createElement(View, { style: [styles.tableHeaderCell, { flex: 0.4 }] }, React.createElement(Text, { style: styles.tableHeaderText }, "م")),
            React.createElement(View, { style: [styles.tableHeaderCell, { flex: 2.5 }] }, React.createElement(Text, { style: styles.tableHeaderText }, "اسم الطالب")),
            React.createElement(View, { style: styles.tableHeaderCell }, React.createElement(Text, { style: styles.tableHeaderText }, "رقم الجلسة")),
            React.createElement(View, { style: styles.tableHeaderCell }, React.createElement(Text, { style: styles.tableHeaderText }, "الاختبار")),
            React.createElement(View, { style: [styles.tableHeaderCell, { flex: 1.5 }] }, React.createElement(Text, { style: styles.tableHeaderText }, "سبب عدم حل الاختبار")),
            React.createElement(View, { style: styles.tableHeaderCell }, React.createElement(Text, { style: styles.tableHeaderText }, "المشروع")),
            React.createElement(View, { style: [styles.tableHeaderCell, { flex: 1.5 }] }, React.createElement(Text, { style: styles.tableHeaderText }, "سبب عدم تسليم المشروع")),
            React.createElement(View, { style: [styles.tableHeaderCell, { borderRightWidth: 0 }] }, React.createElement(Text, { style: styles.tableHeaderText }, "الإجراء المتخذ")),
          ),
          // صفوف الطلاب
          ...students.map((s: any, si: number) =>
            React.createElement(View, { key: si, style: [styles.tableRow, { backgroundColor: si % 2 === 0 ? WHITE : LIGHT_BG }] },
              React.createElement(View, { style: [styles.tableCell, { flex: 0.4 }] }, React.createElement(Text, { style: [styles.tableCellText, { color: GREEN, fontFamily: "ArabicBold" }] }, String(si + 1))),
              React.createElement(View, { style: [styles.tableCellName, { flex: 2.5 }] }, React.createElement(Text, { style: styles.tableCellNameText }, s.studentName || "")),
              React.createElement(View, { style: styles.tableCell }, React.createElement(Text, { style: styles.tableCellText }, "")),
              React.createElement(View, { style: styles.tableCell }, React.createElement(Text, { style: [styles.tableCellText, { color: s.examStatus === "no_exam" ? RED : GREEN, fontFamily: "ArabicBold" }] }, s.examStatus === "no_exam" ? "لم يحل" : "حل")),
              React.createElement(View, { style: [styles.tableCell, { flex: 1.5 }] }, React.createElement(Text, { style: styles.tableCellText }, "")),
              React.createElement(View, { style: styles.tableCell }, React.createElement(Text, { style: [styles.tableCellText, { color: s.projectStatus === "not_submitted" ? RED : GREEN, fontFamily: "ArabicBold" }] }, s.projectStatus === "not_submitted" ? "لم يسلم" : "سلم")),
              React.createElement(View, { style: [styles.tableCell, { flex: 1.5 }] }, React.createElement(Text, { style: styles.tableCellText }, "")),
              React.createElement(View, { style: [styles.tableCell, { borderRightWidth: 0 }] }, React.createElement(Text, { style: styles.tableCellText }, "")),
            )
          ),
          students.length === 0 && React.createElement(View, { style: styles.tableRow },
            React.createElement(View, { style: { flex: 1, padding: 4, alignItems: "center" } },
              React.createElement(Text, { style: { fontSize: 7, color: GRAY } }, "لا يوجد طلاب")
            )
          ),
        ),

        // ===== الإجراءات الأولية =====
        initialActionsText ? React.createElement(View, { style: styles.actionsBox },
          React.createElement(Text, { style: styles.actionsTitle }, "الإجراءات الأولية المنفذة قبل الخطة العلاجية:"),
          React.createElement(Text, { style: styles.actionsText }, initialActionsText),
        ) : null,

        // ===== ملاحظات المعلم =====
        React.createElement(View, { style: styles.notesBox },
          React.createElement(Text, { style: styles.notesTitle }, "ملاحظات المعلم / الإجراءات العلاجية الأولية المنفذة:"),
          React.createElement(Text, { style: styles.notesText }, notes),
        ),

        // ===== التوقيعات ===== (RTL: ولي الأمر ← مرشد ← مدير ← معلم)
        React.createElement(View, { style: styles.sigRow },
          React.createElement(View, { style: styles.sigBox },
            React.createElement(Text, { style: styles.sigTitle }, "توقيع ولي الأمر"),
            React.createElement(Text, { style: styles.sigName }, "........................."),
            React.createElement(View, { style: styles.sigLine }),
            React.createElement(Text, { style: styles.sigLabel }, "التوقيع"),
          ),
          React.createElement(View, { style: styles.sigBox },
            React.createElement(Text, { style: styles.sigTitle }, "المرشد الطلابي"),
            React.createElement(Text, { style: styles.sigName }, plan.counselorName || "........................."),
            React.createElement(View, { style: styles.sigLine }),
            React.createElement(Text, { style: styles.sigLabel }, "التوقيع"),
          ),
          React.createElement(View, { style: styles.sigBox },
            React.createElement(Text, { style: styles.sigTitle }, "اطلع عليه مدير المدرسة"),
            React.createElement(Text, { style: styles.sigName }, plan.principalName || ""),
            React.createElement(View, { style: styles.sigLine }),
            React.createElement(Text, { style: styles.sigLabel }, "التوقيع"),
          ),
          React.createElement(View, { style: styles.sigBox },
            React.createElement(Text, { style: styles.sigTitle }, "توقيع المعلم"),
            React.createElement(Text, { style: styles.sigName }, plan.teacherName || ""),
            React.createElement(View, { style: styles.sigLine }),
            React.createElement(Text, { style: styles.sigLabel }, "التوقيع"),
          ),
        ),

        // ===== QR Codes =====
        (qrExamDataUrl || qrProjectDataUrl) ? React.createElement(View, { style: styles.qrRow },
          qrExamDataUrl ? React.createElement(View, { style: styles.qrHalf },
            React.createElement(Text, { style: styles.qrTitle }, `رابط اختبار ${plan.subject}`),
            React.createElement(PDFImage, { style: styles.qrImage, src: qrExamDataUrl }),
            plan.examLink ? React.createElement(Text, { style: styles.qrLink }, plan.examLink) : null,
            plan.examDuration ? React.createElement(Text, { style: styles.qrDuration }, `متاح ${plan.examDuration}`) : null,
          ) : React.createElement(View, { style: styles.qrHalf }),
          qrProjectDataUrl ? React.createElement(View, { style: [styles.qrHalf, { borderRightWidth: 0.5, borderRightColor: GREEN }] },
            React.createElement(Text, { style: styles.qrTitle }, `رابط تسليم مشروع ${plan.subject}`),
            React.createElement(PDFImage, { style: styles.qrImage, src: qrProjectDataUrl }),
            plan.projectLink ? React.createElement(Text, { style: styles.qrLink }, plan.projectLink) : null,
            plan.projectDuration ? React.createElement(Text, { style: styles.qrDuration }, `متاح ${plan.projectDuration}`) : null,
          ) : React.createElement(View, { style: styles.qrHalf }),
        ) : null,

        // ===== التذييل =====
        React.createElement(View, { style: styles.footer },
          React.createElement(Text, { style: styles.footerText }, `${plan.schoolName} | وزارة التعليم | المملكة العربية السعودية`),
        ),
      );
    })
  );

  return await renderToBuffer(React.createElement(TreatmentPlanDoc));
}

// توليد DOCX
export async function generateTreatmentPlanDOCX(plan: any): Promise<Buffer> {
  const moeLogoBuffer = fs.existsSync(MOE_LOGO_PATH) ? fs.readFileSync(MOE_LOGO_PATH) : null;
  const notes = plan.teacherNotes || DEFAULT_NOTES;
  const initialActionsText = plan.initialActions || "";
  const classesWithStudents = (plan.classes || []).filter((c: any) => c.students && c.students.length > 0);

  const docSections: any[] = [];

  for (let ci = 0; ci < classesWithStudents.length; ci++) {
    const cls = classesWithStudents[ci];
    const students: any[] = cls.students || [];
    const isLast = ci === classesWithStudents.length - 1;

    const headerChildren: any[] = [];
    if (moeLogoBuffer) {
      headerChildren.push(new ImageRun({
        data: moeLogoBuffer,
        transformation: { width: 55, height: 48 },
        type: "png",
      }));
    }

    // جدول الرأس
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: moeLogoBuffer ? [new ImageRun({ data: moeLogoBuffer, transformation: { width: 50, height: 44 }, type: "png" })] : [new TextRun({ text: "وزارة التعليم", bold: true, size: 16, color: "1a7a5e" })],
              })],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "المملكة العربية السعودية", size: 14, color: "666666" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "وزارة التعليم", bold: true, size: 18, color: "1a7a5e" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: plan.schoolName, bold: true, size: 22 })] }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: plan.schoolName.substring(0, 8), size: 12 })] })],
            }),
          ],
        }),
      ],
    });

    // جدول الطلاب
    const headers = ["م", "اسم الطالب", "رقم الجلسة", "الاختبار", "سبب عدم حل الاختبار", "المشروع", "سبب عدم تسليم المشروع", "الإجراء المتخذ"];
    const tableRows = [
      new TableRow({
        children: headers.map(h => new TableCell({
          shading: { type: ShadingType.SOLID, color: "1a7a5e" },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 14 })] })],
        })),
      }),
      ...students.map((s: any, idx: number) => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), bold: true, color: "1a7a5e", size: 14 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: s.studentName, size: 14 })] })] }),
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.examStatus === "no_exam" ? "لم يحل" : "حل ✓", bold: true, color: s.examStatus === "no_exam" ? "c0392b" : "1a7a5e", size: 14 })] })] }),
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.projectStatus === "not_submitted" ? "لم يسلّم" : "سلّم ✓", bold: true, color: s.projectStatus === "not_submitted" ? "c0392b" : "1a7a5e", size: 14 })] })] }),
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("")] }),
        ],
      })),
    ];

    const sectionChildren: any[] = [
      headerTable,
      new Paragraph({ text: `الخطة العلاجية للصف ${plan.gradeLevel || cls.className || cls.classNumber}`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `المعلم: ${plan.teacherName}  |  المادة: ${plan.subject}  |  الصف: ${plan.gradeLevel || ""}  |  الفصل: ${plan.academicYear || ""}`, size: 16 })], alignment: AlignmentType.CENTER }),
      new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      new Paragraph({ text: "" }),
      ...(initialActionsText ? [
        new Paragraph({ children: [new TextRun({ text: "✅ الإجراءات الأولية المنفذة قبل الخطة العلاجية:", bold: true, size: 16, color: "92660a" })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ children: [new TextRun({ text: initialActionsText, size: 15 })], alignment: AlignmentType.BOTH }),
        new Paragraph({ text: "" }),
      ] : []),
      new Paragraph({ children: [new TextRun({ text: "ملاحظات المعلم / الإجراءات العلاجية الأولية المنفذة:", bold: true, size: 16, color: "1a7a5e" })], alignment: AlignmentType.RIGHT }),
      new Paragraph({ children: [new TextRun({ text: notes, size: 15 })], alignment: AlignmentType.BOTH }),
      new Paragraph({ text: "" }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `المعلم: ${plan.teacherName}`, size: 16, bold: true }),
          new TextRun({ text: "          ", size: 16 }),
          new TextRun({ text: `مدير المدرسة: ${plan.principalName}`, size: 16, bold: true }),
          new TextRun({ text: "          ", size: 16 }),
          new TextRun({ text: `المرشد الطلابي: ${plan.counselorName || "......................."}`, size: 16, bold: true }),
          new TextRun({ text: "          ", size: 16 }),
          new TextRun({ text: "ولي الأمر: .......................", size: 16, bold: true }),
        ],
      }),
    ];

    docSections.push({
      children: sectionChildren,
      properties: isLast ? {} : { page: { size: { orientation: "portrait" } } },
    });
  }

  if (docSections.length === 0) {
    docSections.push({ children: [new Paragraph("لا يوجد طلاب يحتاجون خطة علاجية")] });
  }

  const doc = new Document({ sections: docSections });
  return Buffer.from(await Packer.toBuffer(doc));
}
