import React from 'react';
import { X, Download, Printer, FileText, CheckCircle, ShieldCheck, Cpu, LayoutGrid, Users } from 'lucide-react';

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
        <title>የቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት ፕሮፖዛል</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Nyala&family=Abyssinica+SIL&display=swap');
          body { 
            font-family: 'Nyala', 'Abyssinica SIL', 'Power Ge\'ez', Arial, sans-serif; 
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
              <div class="title-text">የቦሌ ወረዳ 05 የዲጂታል አገልግሎት ስርዓት አስተዳደር</div>
              <div class="subtitle-text">Digital Civil Registration Registry Suite (CRRSA)</div>
              <div style="font-size: 12pt; margin-top: 5px; color: #475569; font-weight: bold;">ሙሉ የቴክኒክና አገልግሎት አቅርቦት ፕሮፖዛል (Technical & Service Proposal)</div>
            </td>
          </tr>
        </table>

        <div style="text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 20px;">
          ቀን፡  ሰኔ 09 ቀን 2018 ዓ.ም<br/>
          አዘጋጅ፡ መለሰ ስርዓት (Melese Sirat)<br/>
          ለ፡ ቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት
        </div>

        <h2>1. መግቢያና ዳራ (Introduction & Background)</h2>
        <p>
          ይህ ፕሮፖዛል የቀረበው በቦሌ ወረዳ 05 የነዋሪነትና የሲቪል ምዝገባ አገልግሎቶችን ሙሉ በሙሉ ዲጂታይዝ በማድረግ የአገልግሎት አሰጣጡን ቀልጣፋ፣ ግልጽና ተደራሽ ለማድረግ ለተገነባው የዲጂታል ሲቪል ምዝገባ ማህደር (CRRSA) ነው። ባህላዊው የወረቀት ስራ መረጃዎችን በፍጥነት ለማግኘት፣ የታተሙ መታወቂያዎችን ሁኔታ ለነዋሪዎች ለማሳወቅና የሲቪል ኹነቶችን ተአማኒነት ባለው መልኩ ለመመዝገብ ሰፊ ማነቆዎችን ፈጥሮ ቆይቷል።
        </p>
        <p>
          ይህ ዘመናዊ ዲጂታል ስርዓት የነዋሪዎችን የመታወቂያ ህትመት ሁኔታ በቀጥታ ከመከታተል ጀምሮ የልደት፣ የጋብቻና የሞት ምዝገባ ቅጾችን (ቅጽ 010፣ 011፣ 012) በደመና (Cloud Database) ላይ በማስቀመጥ በማንኛውም ሰዓትና ቦታ በተለያዩ ኮምፒውተሮችና ሞባይሎች ላይ ያለምንም መረጃ መጥፋት እንዲሰምሩ ያደርጋል።
        </p>

        <h2>2. የስርዓቱ ዋና ዋና ዓላማዎች (Core Objectives)</h2>
        <ul>
          <li><strong>ቀልጣፋ አገልግሎት፡</strong> ነዋሪዎች መታወቂያቸው ታትሞ መድረሱን ያለ አንዳች መንከራተት በስልክ ወይም በኮምፒውተር በሴኮንዶች ውስጥ እንዲያረጋግጡ ማስቻል።</li>
          <li><strong>የደመና ውሂብ ማመሳሰል (Cloud Syncing)፡</strong> መረጃዎችን በተለያዩ የቢሮ ኮምፒውተሮችና የባለሙያ ስልኮች ላይ ወዲያውኑ በማመሳሰል ለአንድ ወጥ አሰራር ማደራጀት።</li>
          <li><strong>የመረጃ ደህንነት ማረጋገጥ፡</strong> የተመዘገቡ መረጃዎች ያለፈቃድ ማንም እንዳያጠፋቸውና እንዳያስተካክላቸው በልዩ የይለፍ ቃል የተጠበቁ የባለሙያ መግቢያዎችን ማዘጋጀት።</li>
          <li><strong>ዘመናዊ የሲቪል ኹነቶች ምዝገባ፡</strong> የልደት (010)፣ የጋብቻ (011) እና የሞት (012) ክስተቶችን በዲጂታል ቅጽ መዝግቦ መያዝ።</li>
        </ul>

        <h2>3. የስርዓቱ ዋና ዋና ሞጁሎች (System Core Modules)</h2>
        <p>ስርዓቱ በዋናነት ሁለት ወሳኝ የበይነ-መረብ ክፍሎች ይዟል፡</p>
        
        <h3>3.1. የህዝብ አገልግሎት ገጽ (Public Facing Portal)</h3>
        <p>ይህ ክፍል ማንኛውም ነዋሪ ያለምንም መግቢያ ቃል (Password) በቀጥታ ሊጠቀምበት የሚችል ሲሆን የሚከተሉትን ክፍሎች ያካትታል፡</p>
        <ul>
          <li><strong>የቀጥታ መታወቂያ ዝግጁነት ፍለጋ፡</strong> ነዋሪዎች ስማቸውን ወይም መታወቂያ ቁጥራቸውን በማስገባት መታወቂያቸው ታትሞ ዝግጁ መሆኑን በቀጥታ ያረጋግጣሉ።</li>
          <li><strong>የአገልግሎት መስፈርቶች (Requirements Accordion)፡</strong> የልደት፣ ጋብቻ፣ የሞት ምዝገባ እንዲሁም የአዲስ ነዋሪነት መታወቂያ ለማውጣት የሚጠየቁ አስገዳጅ ቅድመ-ሁኔታዎችን በግልጽ ያሳያል።</li>
        </ul>

        <h3>3.2. የባለሙያና አስተዳዳሪ ገጽ (Admin/Professional Dashboard)</h3>
        <p>ይህ ክፍል በልዩ ምስጠራ የተጠበቀና ፈቃድ ያላቸው የወረዳው ባለሙያዎች ብቻ የሚገቡበት ነው፡</p>
        <ul>
          <li><strong>የታታሚ መታወቂያዎች የቁጥጥር ሰሌዳ፡</strong> አዳዲስ ታትመው የደረሱ መታወቂያዎችን መመዝገብ፣ ለአካል ማስረከብ እንዲሁም መረጃዎችን ማዘመን።</li>
          <li><strong>የሲቪል ምዝገባ ዲጂታል ቅጾች፡</strong>
            <ul>
              <li><strong>ቅጽ 010 (የልደት ምዝገባ)፡</strong> የልጅ፣ የወላጆች፣ የምስክሮች መረጃ ከፊርማ ጋር ያካትታል።</li>
              <li><strong>ቅጽ 011 (የጋብቻ ምዝገባ)፡</strong> የባልና ሚስት እንዲሁም የምስክሮች ሙሉ መረጃ ይይዛል።</li>
              <li><strong>ቅጽ 012 (የሞት ምዝገባ)፡</strong> የሟች መረጃዎች፣ የሞቱበት ምክንያትና አስረጂ መረጃዎችን ይይዛል።</li>
            </ul>
          </li>
          <li><strong>ዲጂታል ፊርማ (Digital Signature Pad)፡</strong> ለቅጾቹ ማረጋገጫ የሚሆኑ ባለሙያዎችንና ነዋሪዎችን ዲጂታል ፊርማ በቀጥታ በስክሪን ላይ በመፈረም ማስቀመጥ።</li>
          <li><strong>የሰነድ ማተሚያ (Instant PDF/Print Generator)፡</strong> የተመዘገቡ ቅጾችንና መታወቂያዎችን በደብዳቤ ፎርማት በጥራት ማተም (Standard Print View)።</li>
        </ul>

        <h2>4. የቴክኖሎጂ አቅም እና የደመና አወቃቀር (Technical Stack & Database)</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">የስርዓቱ ክፍል</th>
              <th style="width: 70%;">ጥቅም ላይ የዋለበት የቴክኖሎጂ ዝርዝር</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>የፊት ገጽ (Frontend)</strong></td>
              <td>React 19, TypeScript ለታማኝ መረጃ ፍሰት፣ Tailwind CSS ለተዋበና ምቹ የሞባይል ዲዛይን።</td>
            </tr>
            <tr>
              <td><strong>የመረጃ ቋት (Database)</strong></td>
              <td>Firebase Cloud Firestore - እውነተኛ የዳታ ማመሳሰል (Real-time Cloud Sync) በሁሉም መሣሪያዎች ላይ።</td>
            </tr>
            <tr>
              <td><strong>ደህንነት (Security)</strong></td>
              <td>በይለፍ ቃል የተጠበቀ የባለሙያ መግቢያ፣ Firebase Security Rules እና በባለሙያው የሚቆለፍ የውሂብ ማስቀመጫ።</td>
            </tr>
            <tr>
              <td><strong>አኒሜሽን (Animations)</strong></td>
              <td>Motion (React) - ለስላሳ ሽግግሮችና ጥራት ላለው የተጠቃሚ ልምድ።</td>
            </tr>
          </tbody>
        </table>

        <div class="accent-box">
          <strong>ማሳሰቢያ ስለ ዳታ ደህንነት፡</strong> በስርዓቱ ላይ የሚመዘገቡ ሁሉም መረጃዎች በ Google Cloud Platform ጥበቃ ስር በሚገኘው Firebase Firestore ላይ ስለሚቀመጡ፣ ባለሙያዎች ራሳቸው ካላጠፏቸው በስተቀር መረጃዎች በድንገት ከኮምፒውተር ወይም ከሞባይል ላይ አይጠፉም። በተለያዩ ባለሙያዎች ስልኮችና ላፕቶፖች ላይ በአንድ ጊዜ አገልግሎቱ ይሰራል።
        </div>

        <h2>5. ማጠቃለያና የወደፊት እቅድ (Conclusion & Roadmap)</h2>
        <p>
          ይህ የወረዳ 05 የሲቪል ምዝገባ የቴክኒክ ፕሮፖዛል፣ ወረዳውን በአዲስ አበባ ከተማ ካሉ ወረዳዎች ሁሉ ቀዳሚ የዲጂታል አገልግሎት ማዕከል የሚያደርግ ነው። ስርዓቱ ለአይፎን፣ ለአንድሮይድ እና ለማንኛውም ላፕቶፕ ሙሉ በሙሉ ተስማሚ (Responsive) ሆኖ የተገነባ በመሆኑ ሰራተኛው በቀላሉ አገልግሎት እንዲሰጥበት ያስችለዋል።
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
              ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት ጽ/ቤት ኃላፊ<br/>
              ፊርማ፡ __________________________<br/>
              ማህተም፡
            </td>
          </tr>
        </table>

        <div class="footer-section">
          የቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት (CRRSA)<br/>
          የጥሪ ማዕከል፡ 7533 | ድረ-ገጽ፡ aacrrsa.gov.et | ኢሜይል፡ info@aacrrsa.gov.et
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'የቦሌ_ወረዳ_05_የዲጂታል_አገልግሎት_ስርዓት_ፕሮፖዛል.doc';
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
            <div class="title">የቦሌ ወረዳ 05 የዲጂታል አገልግሎት ስርዓት አስተዳደር</div>
            <div style="font-size: 13pt; color: #0f172a; font-weight: bold; margin-top: 5px;">Digital Civil Registration Registry Suite (CRRSA)</div>
            <div style="font-size: 11pt; color: #64748b; margin-top: 5px;">ድርጅታዊ አገልግሎትና ቴክኒካል ፕሮፖዛል (Technical Proposal)</div>
          </div>
          
          <div style="text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 20px;">
            ቀን፡ ሰኔ 09 ቀን 2018 ዓ.ም<br/>
            አዘጋጅ፡ መለሰ ስርዓት (Melese Sirat)<br/>
            ለ፡ ቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት
          </div>

          <h2>1. መግቢያና ዳራ (Introduction & Background)</h2>
          <p>
            ይህ ፕሮፖዛል የቀረበው በቦሌ ወረዳ 05 የነዋሪነትና የሲቪል ምዝገባ አገልግሎቶችን ሙሉ በሙሉ ዲጂታይዝ በማድረግ የአገልግሎት አሰጣጡን ቀልጣፋ፣ ግልጽና ተደራሽ ለማድረግ ለተገነባው የዲጂታል ሲቪል ምዝገባ ማህደር (CRRSA) ነው። ስርዓቱ የታተሙ መታወቂያዎችን ሁኔታ በኦንላይን በቀጥታ ከመከታተል ጀምሮ የልደት፣ የጋብቻና የሞት ምዝገባ ቅጾችን (ቅጽ 010፣ 011፣ 012) በደመና (Cloud Database) ላይ በማስቀመጥ በደህንነቱ የተረጋገጠ አሰራር ያመጣል።
          </p>

          <h2>2. የስርዓቱ ዋና ዋና ዓላማዎች (Core Objectives)</h2>
          <ul>
            <li>የነዋሪዎችን መረጃ በዲጂታል ዘመናዊ መመዝገቢያና መከታተያ መዝገብ መያዝ።</li>
            <li>የታተሙ መታወቂያዎችን ሁኔታ በኦንላይን በቀላሉ ለህዝብ ይፋ ማድረግ (ታትመው ለርክክብ የደረሱ መታወቂያዎች ማረጋገጫ)።</li>
            <li>የደመና ውሂብ ማመሳሰል (Cloud Syncing) በተለያዩ የቢሮ ኮምፒውተሮችና ባለሙያዎች ስልኮች ላይ።</li>
            <li>የልደት (010)፣ የጋብቻ (011) እና የሞት (012) ክስተቶችን በዲጂታል ቅጽ መዝግቦ መያዝ።</li>
          </ul>

          <h2>3. የስርዓቱ ዋና ዋና ሞጁሎች (System Core Modules)</h2>
          <h3>3.1. የህዝብ አገልግሎት ገጽ (Public facing Portal)</h3>
          <ul>
            <li><strong>የቀጥታ መታወቂያ ዝግጁነት ፍለጋ፡</strong> ነዋሪዎች መታወቂያቸው መድረሱን በቀጥታ ያረጋግጣሉ።</li>
            <li><strong>የአገልግሎት መስፈርቶች፡</strong> የሲቪል ኹነቶችን ለመመዝገቢያ አስፈላጊ መስፈርቶችን በዝርዝር ያሳያል።</li>
          </ul>
          <h3>3.2. የባለሙያና አስተዳዳሪ ገጽ (Admin Component)</h3>
          <ul>
            <li><strong>የታታሚ መታወቂያዎች የቁጥጥር ሰሌዳ፡</strong> ዝግጁ የሆኑ መታወቂያዎችን መመዝገብ፣ ለአካል ማስረከብ እንዲሁም መረጃዎችን ማዘመን።</li>
            <li><strong>የሲቪል ምዝገባ ዲጂታል ቅጾች (010, 011, 012)</strong> ለልደት፣ ለጋብቻና ለሞት መረጃዎች ምዝገባ።</li>
            <li><strong>ዲጂታል ፊርማ (Digital Signature Pad)፡</strong> ባለሙያዎችና ነዋሪዎች በስክሪን ላይ በመፈረም ያረጋግጣሉ።</li>
          </ul>

          <h2>4. የቴክኖሎጂ አቅርቦት ዝርዝር (Technical Stack)</h2>
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
                <td>Firebase Cloud Firestore - እውነተኛ የዳታ ማመሳሰል (Real-time Cloud Sync)</td>
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
                  ወረዳ 05 የሲቪል ምዝገባ ጽ/ቤት<br/>
                  ፊርማ፡ __________________________
                </td>
              </tr>
            </table>
          </div>

          <div class="footer">
            የቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል አስተዳደር ስርዓት (CRRSA)
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
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
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
            className="p-2 bg-teal-850 hover:bg-teal-800 text-teal-300 hover:text-white rounded-full transition focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Proposal Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-750 text-xs sm:text-sm leading-relaxed max-h-[65vh]">
          {/* Metadata banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-teal-50 border border-teal-100 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-teal-900 font-black text-xs sm:text-sm">የፕሮጀክት ሙሉ ዝርዝር መግለጫ ሰነድ</span>
              <p className="text-[10px] text-slate-500 font-bold">MS Word ፎርማት ተኳሃኝ የሆነ እና በቀጥታ ወደ ኮምፒውተርዎ ለማውረድ የተዘጋጀ ሰነድ።</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadWord}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-sm text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> በዎርድ አውርድ
              </button>
              <button 
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-sm text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> ፕሪንት (Print)
              </button>
            </div>
          </div>

          <div className="border border-slate-100 p-6 rounded-2xl bg-white shadow-inner font-serif prose space-y-4 text-justify">
            <div className="text-center font-bold border-b-2 double border-teal-500 pb-3 mb-4">
              <h2 className="text-xl md:text-2xl text-slate-900 tracking-tight font-extrabold">የሲቪል ምዝገባና የነዋሪነት አገልግሎት ዲጂታል ማህደር (CRRSA)</h2>
              <p className="text-xs text-teal-600 font-sans tracking-wide">Bole Woreda 05 Digital Civil Registration Registry Suite</p>
              <p className="text-xs text-slate-405 font-bold mt-1">የቴክኒክና አገልግሎት ማብራሪያ ሙሉ ፕሮፖዛል</p>
            </div>

            <div className="text-right text-[11px] font-bold text-slate-500 mb-6">
              ቀን፡ ሰኔ 09 ቀን 2018 ዓ.ም<br/>
              አዘጋጅ፡ መለሰ ስርዓት (Melese Sirat)<br/>
              ለ፡ ቦሌ ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት አገልግሎት ጽ/ቤት
            </div>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <CheckCircle className="w-4 h-4 text-teal-600" /> 1. መግቢያና ዳራ (Introduction & Background)
            </h3>
            <p>
              ይህ ፕሮፖዛል የቀረበው በቦሌ ወረዳ 05 የነዋሪነትና የሲቪል ምዝገባ አገልግሎቶችን ሙሉ በሙሉ ዲጂታይዝ በማድረግ የአገልግሎት አሰጣጡን ቀልጣፋ፣ ግልጽና ተደራሽ ለማድረግ ለተገነባው የዲጂታል ሲቪል ምዝገባ ማህደር (CRRSA) ነው። ባህላዊው የወረቀት ስራ መረጃዎችን በፍጥነት ለማግኘት፣ የታተሙ መታወቂያዎችን ሁኔታ ለነዋሪዎች ለማሳወቅና የሲቪል ኹነቶችን ተአማኒነት ባለው መልኩ ለመመዝገብ ሰፊ ማነቆዎችን ፈጥሮ ቆይቷል።
            </p>
            <p>
              ይህ ዘመናዊ ዲጂታል ስርዓት የነዋሪዎችን የመታወቂያ ህትመት ሁኔታ በቀጥታ ከመከታተል ጀምሮ የልደት፣ የጋብቻና የሞት ምዝገባ ቅጾችን (ቅጽ 010፣ 011፣ 012) በደመና (Cloud Database) ላይ በማስቀመጥ በማንኛውም ሰዓትና ቦታ በተለያዩ ኮምፒውተሮችና ሞባይሎች ላይ ያለምንም መረጃ መጥፋት እንዲሰምሩ ያደርጋል።
            </p>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <Cpu className="w-4 h-4 text-teal-600" /> 2. የስርዓቱ ዋና ዋና ዓላማዎች (Core Objectives)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 font-sans font-medium text-slate-600">
              <li><strong>ቀልጣፋ አገልግሎት፡</strong> ነዋሪዎች መታወቂያቸው ታትሞ መድረሱን ያለ አንዳች መንከራተት በስልክ ወይም በኮምፒውተር በሴኮንዶች ውስጥ እንዲያረጋግጡ ማስቻል።</li>
              <li><strong>የደመና ውሂብ ማመሳሰል (Cloud Syncing)፡</strong> መረጃዎችን በተለያዩ የቢሮ ኮምፒውተሮችና የባለሙያ ስልኮች ላይ ወዲያውኑ በማመሳሰል ለአንድ ወጥ አሰራር ማደራጀት።</li>
              <li><strong>የመረጃ ደህንነት ማረጋገጥ፡</strong> የተመዘገቡ መረጃዎች ያለፈቃድ ማንም እንዳያጠፋቸውና እንዳያስተካክላቸው በልዩ የይለፍ ቃል የተጠበቁ የባለሙያ መግቢያዎችን ማዘጋጀት።</li>
              <li><strong>ዘመናዊ የሲቪል ኹነቶች ምዝገባ፡</strong> የልደት (010)፣ የጋብቻ (011) እና የሞት (012) ክስተቶችን በዲጂታል ቅጽ መዝግቦ መያዝ።</li>
            </ul>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <LayoutGrid className="w-4 h-4 text-teal-600" /> 3. የስርዓቱ ዋና ዋና ሞጁሎች (System Core Modules)
            </h3>
            <p className="font-sans font-bold text-slate-700">ስርዓቱ በዋናነት ሁለት ወሳኝ የበይነ-መረብ ክፍሎች ይዟል፡</p>
            
            <h4 className="text-xs font-bold text-teal-800 ml-2 mt-2">3.1. የህዝብ አገልግሎት ገጽ (Public facing Portal)</h4>
            <p className="ml-2">ይህ ክፍል ማንኛውም ነዋሪ ያለምንም መግቢያ ቃል (Password) በቀጥታ ሊጠቀምበት የሚችል ሲሆን የሚከተሉትን ክፍሎች ያካትታል፡</p>
            <ul className="list-disc pl-8 space-y-1 text-slate-650 ml-2">
              <li><strong>የቀጥታ መታወቂያ ዝግጁነት ፍለጋ፡</strong> ነዋሪዎች ስማቸውን ወይም መታወቂያ ቁጥራቸውን በማስገባት መታወቂያቸው ታትሞ ዝግጁ መሆኑን በቀጥታ ያረጋግጣሉ።</li>
              <li><strong>የአገልግሎት መስፈርቶች (Requirements Accordion)፡</strong> የልደት፣ ጋብቻ፣ የሞት ምዝገባ እንዲሁም የአዲስ ነዋሪነት መታወቂያ ለማውጣት የሚጠየቁ አስገዳጅ ቅድመ-ሁኔታዎችን በግልጽ ያሳያል።</li>
            </ul>

            <h4 className="text-xs font-bold text-teal-800 ml-2 mt-3">3.2. የባለሙያና አስተዳዳሪ ገጽ (Admin/Professional Dashboard)</h4>
            <p className="ml-2">ይህ ክፍል በልዩ ምስጠራ የተጠበቀና ፈቃድ ያላቸው የወረዳው ባለሙያዎች ብቻ የሚገቡበት ነው፡</p>
            <ul className="list-disc pl-8 space-y-1 text-slate-650 ml-2">
              <li><strong>የታታሚ መታወቂያዎች የቁጥጥር ሰሌዳ፡</strong> አዳዲስ ታትመው የደረሱ መታወቂያዎችን መመዝገብ፣ ለአካል ማስረከብ እንዲሁም መረጃዎችን ማዘመን።</li>
              <li><strong>የሲቪል ምዝገባ ዲጂታል ቅጾች፡</strong> (ቅጽ 010፣ 011፣ 012) የልደት፣ ጋብቻ እና የሞት መረጃዎችን በዲጂታል መልክ ከፊርማ ጋር ማደራጀት።</li>
              <li><strong>ዲጂታል ፊርማ (Digital Signature Pad)፡</strong> ለቅጾቹ ማረጋገጫ የሚሆኑ ባለሙያዎችንና ነዋሪዎችን ዲጂታል ፊርማ በቀጥታ በስክሪን ላይ በመፈረም ማስቀመጥ።</li>
              <li><strong>የሰነድ ማተሚያ (Instant PDF/Print Generator)፡</strong> የተመዘገቡ ቅጾችንና መታወቂያዎችን በደብዳቤ ፎርማት በጥራት ማተም (Standard Print View)።</li>
            </ul>

            <h3 className="text-sm font-black text-teal-950 flex items-center gap-1 border-b border-teal-100 pb-1 mt-6">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> 4. የቴክኖሎጂ አቅም እና የደመና አወቃቀር (Technical Stack)
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
              <Users className="w-4 h-4 text-teal-600" /> 5. ማጠቃለያና የወደፊት እቅድ (Conclusion)
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
                <p>ወረዳ 05 የሲቪል ምዝገባና የነዋሪነት ጽ/ቤት ኃላፊ</p>
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
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-800 font-black rounded-xl text-xs sm:text-sm cursor-pointer transition focus:outline-none"
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
