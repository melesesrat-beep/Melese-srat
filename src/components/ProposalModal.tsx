import React from 'react';
import { X, Download, Printer, FileText, CheckCircle, ShieldCheck, Cpu, LayoutGrid, Users, AlertTriangle } from 'lucide-react';

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProposalModal({ isOpen, onClose }: ProposalModalProps) {
  if (!isOpen) return null;

  const handleDownloadWord = () => {
    // Compile standard MS Word-compatible HTML format containing rich CSS and metadata
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት (CRRSA) ፕሮፖዛል</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Nyala&family=Abyssinica+SIL&display=swap');
          body { 
            font-family: 'Nyala', 'Abyssinica SIL', 'Power Ge\\'ez', Arial, sans-serif; 
            line-height: 1.6; 
            color: #1e293b; 
            padding: 40px; 
            background-color: #ffffff;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px double #0d9488;
            margin-bottom: 30px;
            padding-bottom: 15px;
          }
          .title-text {
            color: #0f172a;
            font-size: 22pt;
            font-weight: bold;
            text-align: center;
            margin: 0;
          }
          .subtitle-text {
            color: #0d9488;
            font-size: 14pt;
            text-align: center;
            margin-top: 5px;
            font-weight: bold;
          }
          h2 { 
            color: #0f172a; 
            font-size: 16pt; 
            border-bottom: 2px solid #0d9488; 
            padding-bottom: 5px; 
            margin-top: 35px; 
            margin-bottom: 15px;
          }
          h3 { 
            color: #0d9488; 
            font-size: 13pt; 
            margin-top: 20px; 
            margin-bottom: 10px;
            font-weight: bold;
          }
          p { 
            font-size: 11pt; 
            text-align: justify; 
            margin-bottom: 12px;
            text-indent: 15px;
          }
          ol, ul {
            margin-bottom: 15px;
            padding-left: 20px;
          }
          li {
            font-size: 11pt;
            margin-bottom: 6px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            margin-bottom: 20px;
          }
          th { 
            background-color: #0d9488; 
            color: #ffffff; 
            padding: 10px; 
            font-weight: bold; 
            border: 1px solid #cbd5e1; 
            font-size: 11pt;
            text-align: left;
          }
          td { 
            padding: 10px; 
            border: 1px solid #cbd5e1; 
            font-size: 10.5pt;
          }
          .accent-box {
            background-color: #f0fdfa;
            border-left: 4px solid #0d9488;
            padding: 15px;
            margin: 20px 0;
            font-style: italic;
          }
          .footer-section {
            text-align: center;
            font-size: 9pt;
            color: #64748b;
            margin-top: 60px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
          }
          .signature-box {
            margin-top: 40px;
            width: 100%;
          }
          .signature-col {
            width: 50%;
            vertical-align: top;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: center; border: none;">
              <div class="title-text">የአዲስ አበባ ከተማ አስተዳደር ሲቪል ምዝገባ እና ነዋሪነት አገልግሎት ኤጀንሲ</div>
              <div class="subtitle-text">ቦሌ ክፍለ ከተማ ወረዳ 05 ጽህፈት ቤት</div>
              <div style="font-size: 12pt; margin-top: 5px; color: #475569; font-weight: bold;">ከወረቀት ወደ ሙሉ ዲጂታል ስርዓት ሽግግር ዝርዝር የስራ ፕሮፖዛል እና የሪፖርት ሰነድ (CRRSA Suite)</div>
            </td>
          </tr>
        </table>

        <div style="text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 20px;">
          ቀን፡ ሰኔ 19 ቀን 2018 ዓ.ም<br/>
          የቀረበው በ፡ መለሰ ስርዓት (Melese Sirat)<br/>
          ለ፡ ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት ኃላፊ እና አስተባባሪዎች
        </div>

        <h2>1. መግቢያ እና ዳራ (Introduction & Background)</h2>
        <p>
          የአዲስ አበባ ከተማ አስተዳደር ሲቪል ምዝገባ እና ነዋሪነት አገልግሎት ኤጀንሲ በየደረጃው በሚገኙ መዋቅሮቹ አማካኝነት ለነዋሪዎች ህጋዊ፣ አስተማማኝ እና ፈጣን አገልግሎት ለመስጠት ሰፊ ጥረቶችን እያደረገ ይገኛል። ቦሌ ክፍለ ከተማ ወረዳ 05 ጽህፈት ቤት በቀን በመቶዎች ለሚቆጠሩ ባለጉዳዮች የነዋሪነት መታወቂያ ህትመት፣ ዕድሳት፣ እንዲሁም የልደት፣ የጋብቻ እና የሞት ሲቪል ምዝገባ አገልግሎቶችን ይሰጣል።
        </p>
        <p>
          ባህላዊው አሰራር ሙሉ በሙሉ በወረቀት ላይ የተመሰረተ በመሆኑ፣ ባለጉዳዮች መታወቂያቸው መቼ ታትሞ እንደሚደርስ በአካል እየመጡ ከመጠየቅ ጀምሮ፣ በወረቀት የተመዘገቡ መዝገቦች ለመጥፋት፣ ለመበላሸት እና በቀላሉ ለመጭበርበር የተጋለጡ ነበሩ። ይህንን ሰፊ ማነቆ ለመቅረፍ እና የከተማ አስተዳደሩን የዲጂታላይዜሽን ራዕይ ለማሳካት፣ <strong>የቦሌ ወረዳ 05 የሲቪል ምዝገባ እና የነዋሪነት ዲጂታል ማህደር ስርዓት (CRRSA Suite)</strong> ተገንብቶ ሙሉ በሙሉ ስራ ላይ ውሏል።
        </p>

        <h2>2. የነበሩ ፈተናዎች - ባህላዊው የወረቀት አሰራር ማነቆዎች (Previous Challenges)</h2>
        <p>ወደ ዲጂታል ስርዓቱ ከመሸጋገራችን በፊት የነበሩት ዋነኛ የአሰራር ማነቆዎች የሚከተሉት ነበሩ፡</p>
        <ul>
          <li><strong>የመረጃ መጥፋት እና አለመጠበቅ (Data Loss & Degradation)፡</strong> የወረቀት መዝገቦች በጊዜ ሂደት ይበሰብሳሉ፣ በጥፋት ወይም በአደጋ (ለምሳሌ ውሃ ወይም እሳት) በቀላሉ ሊወድሙ ይችላሉ። እንዲሁም አንድ የቤት ማህደር ፋይል በስህተት ሌላ ቦታ ከተቀመጠ መረጃውን መልሶ ማግኘት እጅግ ፈታኝ ነበር።</li>
          <li><strong>የባለጉዳዮች እንግልት እና የጊዜ ብክነት (Citizen Inconvenience)፡</strong> አንድ ነዋሪ መታወቂያው ታትሞ መድረሱን ለማወቅ ደጋግሞ በአካል መምጣት ነበረበት። ይህ በመጓጓዣ፣ በጊዜ እና በጉልበት ላይ ከፍተኛ ኪሳራ ያስከትላል፤ በቢሮ ላይም ከፍተኛ መጨናነቅ ይፈጥራል።</li>
          <li><strong>የሲቪል ምዝገባ መዘግየት እና የስራ ጫና (Administrative Bottlenecks)፡</strong> የልደት (ቅጽ 010)፣ የጋብቻ (ቅጽ 011) እና የሞት (ቅጽ 012) ኹነቶችን በወረቀት መዝግቦ መያዝ ከፍተኛ ሰዓት የሚወስድ ሲሆን፣ ስህተት ቢፈጠር ለማረም እንዲሁም ቀደም ሲል የተመዘገቡ መረጃዎችን ለማጣራት የቢሮውን ሰራተኞች ለከፍተኛ የአካል ድካም ያጋልጥ ነበር።</li>
          <li><strong>የፊርማ እና የሰነድ ማረጋገጫ ድክመት (Signature Verification & Fraud)፡</strong> በወረቀት ላይ ያሉ ፊርማዎች ለስርቆት ወይም ለሐሰተኛ ምዝገባ የተጋለጡ ሲሆኑ፣ የተጠቃሚውን እውነተኛ ማንነት በፍጥነት ለማረጋገጥ የሚያስችል ዘመናዊ መቆጣጠሪያ አልነበረም።</li>
          <li><strong>የመረጃ አቀናጅቶ ሪፖርት የማመንጨት አስቸጋሪነት (Reporting Delays)፡</strong> የወረዳው የስራ ክንውን ሁኔታ (ዛሬ ስንት መታወቂያ ተሰጠ? ዛሬ ስንት የልደት ምዝገባ ተከናወነ?) የሚለውን መረጃ ለማጠቃለል ሰራተኞቹ የወረቀት መዛግብቱን አንድ በአንድ መቁጠርና መደመር ነበረባቸው።</li>
        </ul>

        <h2>3. ዲጂታል ስርዓቱ ያመጣው ለውጥ እና መፍትሄዎች (The Digital Transformation)</h2>
        <p>ይህ አዲስ የተዘረጋው የዲጂታል ስርዓት ከላይ የተጠቀሱትን ችግሮች በሚከተሉት ዘመናዊ መፍትሄዎች ሙሉ በሙሉ ቀይሮታል፡</p>
        <ul>
          <li><strong>እውነተኛ የደመና ማከማቻ (Real-time Cloud Syncing)፡</strong> በ Google Cloud Firebase Firestore አማካኝነት ሁሉም ምዝገባዎች በተጠበቀ ደመና (Cloud Database) ላይ ወዲያውኑ ስለሚቀመጡ፣ ኮምፒውተር ቢበላሽ እንኳ መረጃው በፍጹም አይጠፋም። ሁሉም ባለሙያዎች በተለያዩ መሣሪያዎች ላይ በአንድ ጊዜ መረጃውን ማግኘት ይችላሉ።</li>
          <li><strong>የቀጥታ መታወቂያ ሁኔታ ፍለጋ (Instant Online Verification)፡</strong> ነዋሪዎች በማንኛውም ሰዓትና ቦታ ሆነው በስልካቸው ወይም በኮምፒውተር ስማቸውን ወይም መታወቂያ ቁጥራቸውን በማስገባት መታወቂያቸው ዝግጁ መሆኑን በቀጥታ ያረጋግጣሉ።</li>
          <li><strong>ዲጂታል የሲቪል ምዝገባ ቅጾች (Forms 010, 011, 012)፡</strong> የልደት፣ ጋብቻ እና ሞት ኹነቶች በጥራት በተደራጀ ዲጂታል ፎርም የሚመዘገቡ ሲሆን ሰነዱን ወዲያውኑ ማተም ይቻላል።</li>
          <li><strong>ኤሌክትሮኒክ የፊርማ ሰሌዳ (Digital Signature Pad)፡</strong> ባለሙያዎችና ነዋሪዎች በቀጥታ በስክሪኑ ላይ እንዲፈርሙ በማድረግ የፊርማውን ትክክለኛነት በዲጂታል መንገድ ያረጋግጣል።</li>
          <li><strong>ራስ-ሰር የኤስኤምኤስ መልዕክት (Automated SMS Alerts)፡</strong> መታወቂያቸው ዝግጁ ለሆኑ ነዋሪዎች በአንድ ጠቅታ (One-Click) 'መታወቂያዎ ታትሞ ዝግጁ ሆኗል' የሚል የአማርኛ መልዕክት በስልካቸው ይላክላቸዋል።</li>
        </ul>

        <h2>4. የስርዓቱ ዝርዝር አገልግሎቶች (System Modules Detail)</h2>
        <p>ስርዓቱ የሚከተሉትን ዋና ዋና የአገልግሎት ክፍሎች ይይዛል፡</p>
        
        <h3>4.1. የህዝብ አገልግሎት ፖርታል (Public Portal)</h3>
        <ul>
          <li><strong>የቀጥታ ፍለጋና ማረጋገጫ፡</strong> በስም ወይም መታወቂያ ቁጥር መታወቂያው 'ለመረከብ ዝግጁ' መሆኑን ወይም 'የወሰደ' መሆኑን ያሳያል።</li>
          <li><strong>በቀን መፈለግ (Select/Search by Date)፡</strong> ነዋሪዎች በምዝገባ ወይም በደረሰበት ቀን መታወቂያቸውን መርጠው ማረጋገጥ ይችላሉ።</li>
          <li><strong>የአገልግሎት መመሪያ (Requirements Panel)፡</strong> መታወቂያ ለማውጣት፣ ለልደት፣ ለጋብቻ እና ለሞት ምዝገባ የሚያስፈልጉ ቅድመ ሁኔታዎችን በግልጽ ያሳያል።</li>
        </ul>

        <h3>4.2. የአስተዳደር እና የባለሙያዎች ዳሽቦርድ (Admin/Clerk Dashboard)</h3>
        <ul>
          <li><strong>የመታወቂያ ክምችት ቁጥጥር (Inventory Management)፡</strong> የደረሱ መታወቂያዎችን መመዝገብ፣ ሁኔታቸውን ማዘመን እና በአይነት መለየት።</li>
          <li><strong>የዲጂታል መዛግብት ማውጫ (Resident Records Digital Archive)፡</strong> የእያንዳንዱን ነዋሪ የቤተሰብ መረጃዎች፣ የቤት ቁጥር፣ ፎቶዎች እና የተቃኙ የሰነድ ፎርማቶች በፒዲኤፍ (PDF) ማህደር አያይዞ መያዝ።</li>
          <li><strong>ሪፖርት ማመንጫ እና የላቀ ቁጥጥር (Analytics & CSV Export)፡</strong> የተረከቡ፣ የቀሩ፣ ዛሬ የተከናወኑ ርክክቦችን በመለየት በጥራት የተጠቃለሉ ሰነዶችን ማዘጋጀት።</li>
        </ul>

        <h2>5. የተጠቃሚዎች ፋይዳ በዝርዝር (Stakeholder Benefits)</h2>
        
        <h3>5.1. ለወረዳው ባለሙያዎችና ለሰራተኞች (Benefits for Staff)</h3>
        <ul>
          <li>የወረቀት መዛግብትን በእጅ የመፈተሽ ሰልችቶ የነበረውን ስራ ሙሉ በሙሉ በማስቀረት የአንድን ባለጉዳይ መረጃ በ1 ሴኮንድ ውስጥ በስም ፈልጎ ማግኘት ያስችላል።</li>
          <li>ፊርማዎችን በዲጂታል መንገድ በመፈረም በሰነዶች ላይ የሚከሰቱ የአሰራር ስህተቶችን ያስወግዳል።</li>
          <li>ሪፖርቶችን ለማዘጋጀት የሚፈጀውን ጊዜ ከቀናት ወደ ሴኮንዶች በመቀነስ የስራ ምርታማነትን ያሳድጋል።</li>
          <li>በየቀኑና በየወሩ የሚሰሩ ርክክቦችንና የሲቪል ምዝገባ ቅጽ ዝርዝሮችን (ቅጽ 010፣ 011፣ 012) በአንድ ቁልፍ በቀጥታ ወደ Excel/CSV በመቀየር የስራ ግምገማን ያቀልጣል።</li>
        </ul>

        <h3>5.2. ለነዋሪዎችና ለባለጉዳዮች (Benefits for Citizens)</h3>
        <ul>
          <li><strong>መንከራተት ቀረ (Zero Hustle)፡</strong> ነዋሪዎች መታወቂያቸው መድረሱን ከቤታቸው ሆነው ያረጋግጣሉ፤ ዝግጁ ሲሆን በስልካቸው ቴክስት (SMS) ይደርሳቸዋል።</li>
          <li><strong>ፈጣን አገልግሎት (Fast Processing)፡</strong> የልደት ወይም የጋብቻ ምስክር ወረቀቶች በደቂቃዎች ውስጥ ተመዝግበውና ተረጋግጠው ይታተሙላቸዋል።</li>
          <li><strong>የመረጃ ደህንነት (Record Safety)፡</strong> የነዋሪነት ወይም የወሳኝ ኩነት ምዝገባቸው በስርዓቱ ላይ ስለሚቀመጥ፣ ዳግም ሰነድ ቢጠፋባቸው እንኳ በቀላሉ እንዲተካላቸው ያደርጋል።</li>
        </ul>

        <h2>6. የቴክኖሎጂ አወቃቀር (Technical Architecture)</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">ክፍል</th>
              <th style="width: 70%;">ጥቅም ላይ የዋለ ቴክኖሎጂ እና ፋይዳው</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Frontend Engine</strong></td>
              <td>React 19 & TypeScript - እጅግ ፈጣን፣ ደህንነቱ የተጠበቀና በስልክም በኮምፒውተርም በቀላሉ የሚሰራ ገጽ።</td>
            </tr>
            <tr>
              <td><strong>Database</strong></td>
              <td>Firebase Cloud Firestore - መረጃዎችን በደመና ላይ በአስተማማኝ ሁኔታ የሚያመሳስል።</td>
            </tr>
            <tr>
              <td><strong>Styling & Responsive UI</strong></td>
              <td>Tailwind CSS - የተዋበ፣ ዘመናዊ እና ለዓይን ምቹ የሆነ ባለ ሙሉ ቀለም ገጽታ።</td>
            </tr>
            <tr>
              <td><strong>Signature Capture</strong></td>
              <td>HTML5 Canvas API - የቀጥታ ዲጂታል ፊርማዎችን በጥራት መቅረጫ።</td>
            </tr>
          </tbody>
        </table>

        <h2>7. ማጠቃለያ (Conclusion)</h2>
        <p>
          ይህ በቦሌ ክፍለ ከተማ ወረዳ 05 ጽህፈት ቤት የተዘረጋው የዲጂታል ሲቪል ምዝገባ እና የነዋሪነት አገልግሎት አስተዳደር ስርዓት (CRRSA)፣ ከወረቀት አሰራር ወደ ዘመናዊ የደመና (Cloud-Native) ቴክኖሎጂ የተደረገ ታሪካዊ ሽግግር ነው። ስርዓቱ የሰራተኞችን የስራ ጫና በእጅጉ የቀነሰ፣ የባለጉዳዮችን እንግልት ያስቀረ እና የአገልግሎት ጥራትንና መተማመንን ያረጋገጠ ነው። ወረዳ 05ን በአዲስ አበባ ከተማ አስተዳደር ቀዳሚ ዲጂታል ወረዳ ለማድረግ ለተጀመረው ጉዞ ይህ ስርዓት ዋነኛ ምሳሌ ነው።
        </p>

        <table class="signature-box">
          <tr>
            <td class="signature-col" style="border: none;">
              <strong>አቅራቢ/አዘጋጅ፡</strong><br/>
              መለሰ ስርዓት (Melese Sirat)<br/>
              ቦሌ ወረዳ 05 የዲጂታል ሲስተም መሐንዲስ<br/>
              ፊርማ፡ __________________________
            </td>
            <td class="signature-col" style="border: none; text-align: right;">
              <strong>ስርዓቱን አጽዳቂ የወረዳው ኃላፊ፡</strong><br/>
              ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት ጽ/ቤት ኃላፊ<br/>
              ፊርማ፡ __________________________<br/>
              ማህተም፡
            </td>
          </tr>
        </table>

        <div class="footer-section">
          የቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት (CRRSA)<br/>
          የጥሪ ማዕከል፡ 7533 | ድረ-ገጽ፡ aacrrsa.gov.et | ኢሜይል፡ info@aacrrsa.gov.et
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'የቦሌ_ወረዳ_05_የዲጂታል_አገልግሎት_ስርዓት_ሙሉ_ፕሮፖዛል.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printDocument = `
        <html>
        <head>
          <title>የቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት ፕሮፖዛል</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Nyala&family=Abyssinica+SIL&display=swap');
            body { 
              font-family: 'Nyala', 'Abyssinica SIL', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1e293b; 
              padding: 40px; 
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #0d9488;
              margin-bottom: 30px;
              padding-bottom: 15px;
            }
            .title {
              font-size: 20pt;
              font-weight: bold;
              color: #0d9488;
            }
            h2 { 
              color: #0f172a; 
              font-size: 14pt; 
              border-bottom: 2px solid #0d9488; 
              padding-bottom: 5px; 
              margin-top: 30px; 
            }
            h3 { 
              color: #0d9488; 
              font-size: 12pt; 
              margin-top: 15px; 
            }
            p { 
              font-size: 11pt; 
              text-align: justify; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 15px; 
            }
            th { 
              background-color: #0d9488; 
              color: #ffffff; 
              padding: 8px; 
              font-weight: bold; 
              border: 1px solid #cbd5e1; 
              font-size: 11pt;
            }
            td { 
              padding: 8px; 
              border: 1px solid #cbd5e1; 
              font-size: 10pt;
            }
            .footer {
              text-align: center;
              font-size: 9pt;
              color: #64748b;
              margin-top: 50px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 10px;">
            <button onclick="window.print();" style="background-color: #0d9488; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 5px; cursor: pointer;">ማተሚያ (Print)</button>
          </div>
          <div class="header">
            <div class="title">የአዲስ አበባ ከተማ አስተዳደር ሲቪል ምዝገባ እና ነዋሪነት አገልግሎት ኤጀንሲ</div>
            <div style="font-size: 13pt; color: #0f172a; font-weight: bold; margin-top: 5px;">ቦሌ ክፍለ ከተማ ወረዳ 05 ጽህፈት ቤት (CRRSA Suite)</div>
            <div style="font-size: 11pt; color: #64748b; margin-top: 5px;">ድርጅታዊ አገልግሎት፣ ሽግግርና ቴክኒካል ፕሮፖዛል (Technical Proposal & Impact Report)</div>
          </div>
          
          <div style="text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 20px;">
            ቀን፡ ሰኔ 19 ቀን 2018 ዓ.ም<br/>
            አዘጋጅ፡ መለሰ ስርዓት (Melese Sirat)<br/>
            ለ፡ ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት
          </div>

          <h2>1. መግቢያ እና ዳራ (Introduction & Background)</h2>
          <p>
            ይህ ፕሮፖዛል የቀረበው በቦሌ ክፍለ ከተማ ወረዳ 05 የነዋሪነትና የሲቪል ምዝገባ አገልግሎቶችን ሙሉ በሙሉ ዲጂታይዝ በማድረግ የአገልግሎት አሰጣጡን ቀልጣፋ፣ ግልጽና ተደራሽ ለማድረግ ለተገነባው የዲጂታል ሲቪል ምዝገባ ማህደር (CRRSA Suite) ነው። ባህላዊው የወረቀት ስራ መረጃዎችን በፍጥነት ለማግኘት፣ የታተሙ መታወቂያዎችን ሁኔታ ለነዋሪዎች ለማሳወቅና የሲቪል ኹነቶችን ተአማኒነት ባለው መልኩ ለመመዝገብ ሰፊ ማነቆዎችን ፈጥሮ ቆይቷል።
          </p>

          <h2>2. የነበሩ ፈተናዎች - የወረቀት አሰራር ማነቆዎች (Previous Challenges)</h2>
          <p>
            በቀድሞው የወረቀት አሰራር መረጃዎች ለመጥፋት፣ ፋይሎች በስህተት ተደራርበው ለመጥፋት፣ እና መታወቂያቸው የደረሰላቸው ባለጉዳዮች ደጋግመው በአካል በመመላለስ ለመንከራተት ይገደዱ ነበር። ይህም ሰፊ የስራ ጫና እና ከፍተኛ የጊዜ ብክነትን ሲያስከትል ቆይቷል።
          </p>

          <h2>3. ዲጂታል ስርዓቱ ያመጣው ለውጥ እና መፍትሄዎች (The Transformation)</h2>
          <p>
            ይህ ዘመናዊ ዲጂታል ስርዓት የነዋሪዎችን የመታወቂያ ህትመት ሁኔታ በቀጥታ ከቤታቸው ሆነው ከመከታተል ጀምሮ የልደት፣ የጋብቻና የሞት ምዝገባ ቅጾችን (ቅጽ 010፣ 011፣ 012) በደመና (Cloud Database) ላይ በማስቀመጥ በደህንነቱ የተረጋገጠ አሰራር ያመጣል። አውቶሜትድ የኤስኤምኤስ መልዕክት በስልካቸው በመላክ መንከራተትን አስቀርቷል።
          </p>

          <h2>4. የተጠቃሚዎች ፋይዳ በዝርዝር (Stakeholder Benefits)</h2>
          <h3>4.1. ለወረዳው ባለሙያዎችና ለሰራተኞች (For Staff)</h3>
          <ul>
            <li>የወረቀት መዛግብትን መፈለግ አስቀርቷል - በ1 ሴኮንድ ስም ፈልጎ ማግኘት ይቻላል።</li>
            <li>የፊርማ ትክክለኛነትን በስክሪን ላይ በመፈረም ያረጋግጣል።</li>
            <li>ሪፖርቶችን በሴኮንዶች ውስጥ በማመንጨት ወደ Excel/CSV መላክ ያስችላል።</li>
          </ul>
          <h3>4.2. ለነዋሪዎችና ለባለጉዳዮች (For Citizens)</h3>
          <ul>
            <li>መንከራተት ቀረ (ከቤት ሆኖ ሁኔታ መከታተል ይቻላል)።</li>
            <li>መታወቂያው ሲደርስ ቀጥታ ኤስኤምኤስ (SMS) ይደርሳቸዋል።</li>
            <li>የልደት፣ የጋብቻና የሞት ቅጾች በፍጥነት በጥራት ተመዝግበው ይታተማሉ።</li>
          </ul>

          <h2>5. የቴክኖሎጂ አቅርቦት ዝርዝር (Technical Stack)</h2>
          <table>
            <thead>
              <tr>
                <th>የስርዓቱ ክፍል</th>
                <th>ጥቅም ላይ የዋለበት የቴክኖሎጂ ዝርዝር</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>የፊት ገጽ (Frontend)</strong></td>
                <td>React 19, TypeScript, Tailwind CSS, Motion (React)</td>
              </tr>
              <tr>
                <td><strong>የመረጃ ቋት (Database)</strong></td>
                <td>Firebase Cloud Firestore - እውነተኛ የደመና ማመሳሰል (Real-time Cloud Sync)</td>
              </tr>
              <tr>
                <td><strong>ደህንነት (Security)</strong></td>
                <td>በይለፍ ቃል የተጠበቀ የባለሙያ መግቢያ፣ Firebase Security Rules</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
            <table style="width: 100%; border: none;">
              <tr>
                <td style="border: none;">
                  <strong>አቅራቢ/አዘጋጅ፡</strong><br/>
                  መለሰ ስርዓት (Melese Sirat)<br/>
                  ፊርማ፡ __________________________
                </td>
                <td style="border: none; text-align: right;">
                  <strong>አጽዳቂ፡</strong><br/>
                  ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባ ጽ/ቤት<br/>
                  ፊርማ፡ __________________________
                </td>
              </tr>
            </table>
          </div>

          <div class="footer">
            የቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት (CRRSA)
          </div>
        </body>
        </html>
      `;
      printWindow.document.write(printDocument);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-gradient-to-r from-teal-950 to-teal-900 rounded-t-3xl">
          <div className="flex items-center space-x-3 text-white">
            <div className="p-2 bg-teal-800 rounded-xl">
              <FileText className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-white">የቦሌ ወረዳ 05 የሲቪል ምዝገባ ስርዓት አስተዳደር</h3>
              <p className="text-[10px] sm:text-xs text-teal-200 font-semibold uppercase tracking-wider">የቴክኒክና አገልግሎት ሙሉ ፕሮፖዛል (CRRSA Proposal)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-teal-850 hover:bg-teal-800 text-teal-300 hover:text-white rounded-full transition focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Proposal Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-750 text-xs sm:text-sm leading-relaxed max-h-[65vh]">
          {/* Metadata banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-teal-50 border border-teal-100 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-teal-900 font-black text-xs sm:text-sm block">የወረቀት አልባ አሰራር ሽግግር ማብራሪያ ሰነድ</span>
              <p className="text-[10.5px] text-slate-500 font-bold">ይህ ሰነድ ወደ ዲጂታል ስርዓት መሸጋገራችን ያስገኘውን ጠቀሜታ የሚያብራራና ለኃላፊዎች ለማቅረብ የተዘጋጀ ነው።</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadWord}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-sm text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> በዎርድ አውርድ
              </button>
              <button 
                onClick={handlePrint}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-sm text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> ፕሪንት (Print)
              </button>
            </div>
          </div>

          <div className="border border-slate-100 p-6 rounded-2xl bg-white shadow-inner prose space-y-5 text-justify">
            <div className="text-center font-bold border-b-2 double border-teal-500 pb-3 mb-4">
              <h2 className="text-xl md:text-2xl text-slate-900 tracking-tight font-extrabold">የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል ማህደር (CRRSA)</h2>
              <p className="text-xs text-teal-600 font-sans tracking-wide">Bole Woreda 05 Digital Civil Registration Registry Suite</p>
              <p className="text-xs text-slate-500 font-bold mt-1">የቴክኒክና አገልግሎት ማብራሪያ ሙሉ ፕሮፖዛል</p>
            </div>

            <div className="text-right text-[11px] font-bold text-slate-500 mb-6 font-sans">
              ቀን፡ ሰኔ 19 ቀን 2018 ዓ.ም<br/>
              አዘጋጅ፡ መለሰ ስርዓት (Melese Sirat)<br/>
              ለ፡ ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት
            </div>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" /> 1. መግቢያና ዳራ (Introduction & Background)
            </h3>
            <p>
              ይህ ፕሮፖዛል የቀረበው በቦሌ ክፍለ ከተማ ወረዳ 05 የነዋሪነትና የሲቪል ምዝገባ አገልግሎቶችን ሙሉ በሙሉ ዲጂታይዝ በማድረግ የአገልግሎት አሰጣጡን ቀልጣፋ፣ ግልጽና ተደራሽ ለማድረግ ለተገነባው የዲጂታል ሲቪል ምዝገባ ማህደር (CRRSA) ነው። ባህላዊው የወረቀት ስራ መረጃዎችን በፍጥነት ለማግኘት፣ የታተሙ መታወቂያዎችን ሁኔታ ለነዋሪዎች ለማሳወቅና የሲቪል ኹነቶችን ተአማኒነት ባለው መልኩ ለመመዝገብ ሰፊ ማነቆዎችን ፈጥሮ ቆይቷል።
            </p>
            <p>
              ይህ ዘமናዊ ዲጂታል ስርዓት የነዋሪዎችን የመታወቂያ ህትመት ሁኔታ በቀጥታ ከመከታተል ጀምሮ የልደት፣ የጋብቻና የሞት ምዝገባ ቅጾችን (ቅጽ 010፣ 011፣ 012) በደመና (Cloud Database) ላይ በማስቀመጥ በማንኛውም ሰዓትና ቦታ በተለያዩ ኮምፒውተሮችና ሞባይሎች ላይ ያለምንም መረጃ መጥፋት እንዲሰምሩ ያደርጋል።
            </p>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> 2. የነበሩ ፈተናዎች - ባህላዊው የወረቀት አሰራር ማነቆዎች (Previous Challenges)
            </h3>
            <p>ወደ ዲጂታል ስርዓቱ ከመሸጋገራችን በፊት የነበሩት ዋነኛ የአሰራር ማነቆዎች የሚከተሉት ነበሩ፡</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-650 font-sans font-medium">
              <li><strong>የመረጃ መጥፋት እና ፋይል መበላሸት (Data Loss)፡</strong> የወረቀት መዝገቦች በጊዜ ሂደት የሚበሰብሱ፣ የሚቀደዱ ወይም በአደጋ (ለምሳሌ ውሃ ወይም እሳት) በቀላሉ ሊወድሙ የሚችሉ ነበሩ።</li>
              <li><strong>የባለጉዳዮች መንከራተትና እንግልት (Citizen Inconvenience)፡</strong> አንድ ነዋሪ መታወቂያው ታትሞ መድረሱን ለማወቅ ደጋግሞ በአካል መምጣት ነበረበት። ይህም ጊዜን፣ ጉልበትንና ገንዘብን ያባክናል፤ በቢሮ ላይም ከፍተኛ ወረፋ ይፈጥራል።</li>
              <li><strong>የስራ መደራረብና ድካም (Administrative Workload)፡</strong> የልደት (ቅጽ 010)፣ የጋብቻ (ቅጽ 011) እና የሞት (ቅጽ 012) ምዝገባዎችን በወረቀት መዝግቦ መያዝ ከፍተኛ ሰዓት የሚወስድ ከመሆኑም በላይ፣ መረጃን ፈልጎ ለማግኘት ሰፊ ድካም ያስከትላል።</li>
              <li><strong>የፊርማና የሰነድ ማረጋገጫ ማጣት (Security Risks)፡</strong> በወረቀት ላይ ያሉ ፊርማዎች ለሐሰተኛ ምዝገባ የተጋለጡ ሲሆኑ፣ የተጠቃሚውን እውነተኛ ማንነት በፍጥነት ለማረጋገጥ የሚያስችል ዘመናዊ መቆጣጠሪያ አልነበረም።</li>
              <li><strong>ሪፖርት ለማዘጋጀት መዘግየት (Reporting Delays)፡</strong> በየቀኑ ወይም በየወሩ የተረከቡ ነዋሪዎችን ቁጥር ለማጠቃለል መዛግብቱን በእጅ መቁጠርና መደመር ነበረባቸው።</li>
            </ul>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <Cpu className="w-4 h-4 text-teal-600 shrink-0" /> 3. ዲጂታል ስርዓቱ ያመጣው ለውጥ እና መፍትሄዎች (The Transformation)
            </h3>
            <p>ይህ አዲስ የተዘረጋው የዲጂታል ስርዓት ከላይ የተጠቀሱትን ችግሮች በሚከተሉት ዘመናዊ መፍትሄዎች ቀይሮታል፡</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-650 font-sans font-medium">
              <li><strong>እውነተኛ የደመና ማከማቻ (Real-time Cloud Syncing)፡</strong> በ Google Cloud Firebase Firestore አማካኝነት ሁሉም ምዝገባዎች በተጠበቀ ደመና ላይ ወዲያውኑ ስለሚቀመጡ፣ ኮምፒውተር ቢበላሽ እንኳ መረጃው በፍጹም አይጠፋም።</li>
              <li><strong>የቀጥታ መታወቂያ ሁኔታ ፍለጋ (Online Verification)፡</strong> ነዋሪዎች በማንኛውም ሰዓትና ቦታ ሆነው በስልካቸው ስማቸውን ወይም መታወቂያ ቁጥራቸውን በማስገባት መታወቂያቸው ዝግጁ መሆኑን በቀጥታ ያረጋግጣሉ።</li>
              <li><strong>የኤስኤምኤስ መልዕክት (Automated SMS Alerts)፡</strong> መታወቂያቸው ዝግጁ ለሆኑ ነዋሪዎች በአንድ ጠቅታ (One-Click) 'መታወቂያዎ ታትሞ ዝግጁ ሆኗል' የሚል የአማርኛ መልዕክት በስልካቸው ይላካል።</li>
              <li><strong>ኤሌክትሮኒክ የፊርማ ሰሌዳ (Digital Signature)፡</strong> ባለሙያዎችና ነዋሪዎች በቀጥታ በስክሪኑ ላይ እንዲፈርሙ በማድረግ የፊርማውን ትክክለኛነት በዲጂታል መንገድ ያረጋግጣል።</li>
            </ul>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <Users className="w-4 h-4 text-teal-600 shrink-0" /> 4. የተጠቃሚዎች ፋይዳ በዝርዝር (Stakeholder Benefits)
            </h3>
            <div className="space-y-3 font-sans">
              <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
                <span className="font-black text-teal-905 block mb-1">👩‍💼 ለወረዳው ባለሙያዎችና ለሰራተኞች፡</span>
                <ul className="list-disc pl-5 space-y-1 text-slate-650 text-xs sm:text-sm">
                  <li>የወረቀት መዛግብትን በእጅ መፈለግን ሙሉ በሙሉ ያስቀራል - በ1 ሴኮንድ ስም ፈልጎ ማግኘት ይቻላል።</li>
                  <li>ፊርማዎችን በዲጂታል መንገድ በመፈረም በሰነዶች ላይ የሚከሰቱ ስህተቶችን ያስወግዳል።</li>
                  <li>ሪፖርቶችን ለማዘጋጀት የሚፈጀውን ጊዜ ከቀናት ወደ ሴኮንዶች በመቀነስ የስራ ምርታማነትን ያሳድጋል።</li>
                  <li>የምዝገባ ቅጽ ዝርዝሮችን በአንድ ቁልፍ በቀጥታ ወደ Excel/CSV በመቀየር የስራ ግምገማን ያቀልጣል።</li>
                </ul>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="font-black text-emerald-900 block mb-1">👨‍👩‍👧‍👦 ለነዋሪዎችና ለባለጉዳዮች (ለህዝብ)፡</span>
                <ul className="list-disc pl-5 space-y-1 text-slate-650 text-xs sm:text-sm">
                  <li><strong>መንከራተት ቀረ (Zero Hustle)፡</strong> ነዋሪዎች መታወቂያቸው መድረሱን ከቤታቸው ሆነው ያረጋግጣሉ፤ ዝግጁ ሲሆን በስልካቸው ኤስኤምኤስ (SMS) ይደርሳቸዋል።</li>
                  <li><strong>ፈጣን አገልግሎት፡</strong> የልደት ወይም የጋብቻ ምስክር ወረቀቶች በደቂቃዎች ውስጥ ተመዝግበውና ተረጋግጠው ይታተሙላቸዋል።</li>
                  <li><strong>የመረጃ ደህንነት፡</strong> የነዋሪነት ወይም የወሳኝ ኩነት ምዝገባቸው በስርዓቱ ላይ ስለሚቀመጥ፣ ዳግም ሰነድ ቢጠፋባቸው እንኳ በቀላሉ እንዲተካላቸው ያደርጋል።</li>
                </ul>
              </div>
            </div>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <LayoutGrid className="w-4 h-4 text-teal-600 shrink-0" /> 5. የስርዓቱ ዋና ዋና ሞጁሎች (System Core Modules)
            </h3>
            <p className="font-sans font-bold text-slate-700">ስርዓቱ በዋናነት ሁለት ወሳኝ የበይነ-መረብ ክፍሎች ይዟል፡</p>
            
            <h4 className="text-xs font-bold text-teal-800 ml-2 mt-2">5.1. የህዝብ አገልግሎት ገጽ (Public facing Portal)</h4>
            <p className="ml-2">ይህ ክፍል ማንኛውም ነዋሪ ያለምንም መግቢያ ቃል (Password) በቀጥታ ሊጠቀምበት የሚችል ሲሆን የሚከተሉትን ክፍሎች ያካትታል፡</p>
            <ul className="list-disc pl-8 space-y-1 text-slate-650 ml-2">
              <li><strong>የቀጥታ መታወቂያ ዝግጁነት ፍለጋ፡</strong> ነዋሪዎች ስማቸውን፣ የቤት ቁጥራቸውን ወይም መታወቂያ ቁጥራቸውን በማስገባት መታወቂያቸው ታትሞ ዝግጁ መሆኑን በቀጥታ ያረጋግጣሉ።</li>
              <li><strong>የአገልግሎት መስፈርቶች (Requirements Accordion)፡</strong> የልደት፣ ጋብቻ፣ የሞት ምዝገባ እንዲሁም የአዲስ ነዋሪነት መታወቂያ ለማውጣት የሚጠየቁ አስገዳጅ ቅድመ-ሁኔታዎችን በግልጽ ያሳያል።</li>
            </ul>

            <h4 className="text-xs font-bold text-teal-800 ml-2 mt-3">5.2. የባለሙያና አስተዳዳሪ ገጽ (Admin/Professional Dashboard)</h4>
            <p className="ml-2">ይህ ክፍል በልዩ ምስጠራ የተጠበቀና ፈቃድ ያላቸው የወረዳው ባለሙያዎች ብቻ የሚገቡበት ነው፡</p>
            <ul className="list-disc pl-8 space-y-1 text-slate-650 ml-2">
              <li><strong>የታታሚ መታወቂያዎች የቁጥጥር ሰሌዳ፡</strong> አዳዲስ ታትመው የደረሱ መታወቂያዎችን መመዝገብ፣ ለአካል ማስረከብ እንዲሁም መረጃዎችን ማዘመን።</li>
              <li><strong>የሲቪል ምዝገባ ዲጂታል ቅጾች (010, 011, 012)፡</strong> የልደት፣ የጋብቻ እና የሞት መረጃዎችን በዲጂታል መልክ ከፊርማ ጋር ማደራጀት።</li>
              <li><strong>ዲጂታል ፊርማ (Digital Signature Pad)፡</strong> ለቅጾቹ ማረጋገጫ የሚሆኑ ባለሙያዎችንና ነዋሪዎችን ዲጂታል ፊርማ በቀጥታ በስክሪን ላይ በመፈረም ማስቀመጥ።</li>
              <li><strong>የሰነድ ማተሚያ (Instant PDF/Print Generator)፡</strong> የተመዘገቡ ቅጾችንና መታወቂያዎችን በደብዳቤ ፎርማት በጥራት ማተም (Standard Print View)።</li>
            </ul>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" /> 6. የቴክኖሎጂ አቅም እና የደመና አወቃቀር (Technical Stack)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-200 mt-2 font-sans text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-teal-50">
                    <th className="border border-slate-200 p-2 font-black text-teal-950">የስርዓቱ ክፍል</th>
                    <th className="border border-slate-200 p-2 font-black text-teal-950">ጥቅም ላይ የዋለበት የቴክኖሎጂ ዝርዝር</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="border border-slate-200 p-2 font-bold text-slate-800">የፊት ገጽ (Frontend)</td>
                    <td className="border border-slate-200 p-2 ">React 19, TypeScript ለታማኝ መረጃ ፍሰት፣ Tailwind CSS ለተዋበና ምቹ የሞባይል ዲዛይን።</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2 font-bold text-slate-800">የመረጃ ቋት (Database)</td>
                    <td className="border border-slate-200 p-2 ">Firebase Cloud Firestore - እውነተኛ የዳታ ማመሳሰል (Real-time Cloud Sync) በሁሉም መሣሪያዎች ላይ።</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 p-2 font-bold text-slate-800">ደህንነት (Security)</td>
                    <td className="border border-slate-200 p-2 ">በይለፍ ቃል የተጠበቀ የባለሙያ መግቢያ፣ Firebase Security Rules እና በባለሙያው የሚቆለፍ የውሂብ ማስቀመጫ።</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-yellow-50/50 border-l-4 border-yellow-400 rounded-lg text-[11px] font-sans font-semibold leading-relaxed text-amber-900 mt-4">
              📌 <strong>የደህንነትና የመረጃ አስተማማኝነት፡</strong> በስርዓቱ ላይ የሚመዘገቡ ሁሉም መረጃዎች በ Google Cloud Platform ጥበቃ ስር በሚገኘው Firebase Firestore ላይ ስለሚቀመጡ፣ ባለሙያዎች ራሳቸው ካላጠፏቸው በስተቀር መረጃዎች በድንገት ከኮምፒውተር ወይም ከሞባይል ላይ አይጠፉም። በተለያዩ ባለሙያዎች ስልኮችና ላፕቶፖች ላይ በአንድ ጊዜ አገልግሎቱ ይሰራል።
            </div>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <Users className="w-4 h-4 text-teal-600 shrink-0" /> 7. ማጠቃለያ (Conclusion)
            </h3>
            <p>
              ይህ የወረዳ 05 የሲቪል ምዝገባ የቴክኒክ ፕሮፖዛል፣ ወረዳውን በአዲስ አበባ ከተማ ካሉ ወረዳዎች ሁሉ ቀዳሚ የዲጂታል አገልግሎት ማዕከል የሚያደርግ ነው። ስርዓቱ ለአይፎን፣ ለአንድሮይድ እና ለማንኛውም ላፕቶፕ ሙሉ በሙሉ ተስማሚ (Responsive) ሆኖ የተገነባ በመሆኑ ሰራተኛው በቀላሉ አገልግሎት እንዲሰጥበት ያስችለዋል።
            </p>

            <div className="pt-8 border-t border-slate-100 flex justify-between items-start gap-4 flex-col sm:flex-row text-[11px] font-medium text-slate-500 font-sans">
              <div className="space-y-1">
                <strong>አቅራቢ/አዘጋጅ፡</strong>
                <p>መለሰ ስርዓት (Melese Sirat)<br/>ቦሌ ወረዳ 05 የዲጂታል ሲስተም መሐንዲስ</p>
                <div className="w-40 border-b border-slate-300 pt-8"></div>
                <p className="text-[9px]">ፊርማ</p>
              </div>
              <div className="space-y-1 sm:text-right">
                <strong>ስርዓቱን አጽዳቂ የወረዳው ኃላፊ፡</strong>
                <p>ቦሌ ክፍለ ከተማ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት ጽ/ቤት ኃላፊ</p>
                <div className="w-40 border-b border-slate-300 pt-8 sm:ml-auto"></div>
                <p className="text-[9px]">ፊርማ እና ማህተም</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
          <p className="text-[10px] text-slate-400 font-extrabold">የቦሌ ወረዳ 05 ዲጂታል ሲስተም አስተዳደር ፕሮፖዛል</p>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-xs sm:text-sm cursor-pointer transition focus:outline-none"
            >
              ዝጋ
            </button>
            <button 
              onClick={handleDownloadWord}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer focus:ring-4 focus:ring-teal-100 focus:outline-none"
            >
              <Download className="w-4 h-4" /> በዎርድ ፎርማት አውርድ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
