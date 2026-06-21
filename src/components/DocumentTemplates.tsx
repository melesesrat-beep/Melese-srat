import { DocumentType } from '../types';

interface DocumentTemplatesProps {
  type: string;
  refNum: string;
  date: string;
  photoUrl?: string;
  logo?: string;
  
  // Recommendation fields
  addressedTo?: string;
  name?: string;
  mother?: string;
  dob?: string;
  marital?: string;
  repName?: string;
  repPoa?: string;
  nation?: string;
  citizenship?: string;
  houseStatus?: string;
  subcity?: string;
  woreda?: string;
  house?: string;
  birthRegion?: string;
  employment?: string;
  resPeriod?: string;
  staffName?: string;

  // Residency fields
  fromYear?: string;
  toYear?: string;

  // Life Status fields
  representative?: string;
}

export function DocumentTemplates({
  type,
  refNum,
  date,
  photoUrl,
  logo = "",
  addressedTo = "ለሚመለከተው አካል",
  name = "_________________",
  mother = "_________________",
  dob = "_________________",
  marital = "ያላገባ",
  repName = "",
  repPoa = "",
  nation = "አማራ",
  citizenship = "ኢትዮጵያዊ",
  houseStatus = "የግል",
  subcity = "ቦሌ",
  woreda = "05",
  house = "_________",
  birthRegion = "አዲስ አበባ",
  employment = "የግል ስራ",
  resPeriod = "ከ 1998 ጀምሮ",
  staffName = "የዕለቱ ተረኛ ባለሙያ",
  fromYear = "____",
  toYear = "____",
  representative = ""
}: DocumentTemplatesProps) {
  
  return (
    <div className="bg-white p-8 md:p-10 text-black border border-slate-300 rounded-xl relative shadow-md print-area text-xs leading-relaxed max-w-2xl mx-auto font-sans overflow-hidden min-h-[820px] flex flex-col justify-between">
      
      {/* 1. Subtle Elegant Watermark Background in the Center (Very Low Opacity) */}
      {logo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.035] z-0">
          <img 
            src={logo} 
            alt="Watermark Official Logo" 
            className="w-100 h-100 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* 2. Official Header Container */}
      <div className="relative z-10 flex justify-between items-center border-b-2 border-slate-400 pb-3 mb-6">
        <div className="flex items-center space-x-3">
          {logo && (
            <img 
              src={logo} 
              alt="CRRSA Logo" 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="flex flex-col justify-center leading-tight">
            <span className="text-lg font-black tracking-tight text-slate-800 leading-none">CRRSA</span>
            <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider">Civil Registration & Residency Service</span>
            <span className="text-[10px] font-black text-slate-700 mt-0.5">የቦሌ ክፍለ ከተማ ወረዳ 05 ጽ/ቤት</span>
            <span className="text-[7.5px] font-semibold text-slate-400">Bole SC Woreda 05 Office</span>
          </div>
        </div>

        {/* Ref and Date Box on Right */}
        <div className="text-[9.5px] text-slate-700 space-y-1 text-right font-medium">
          <div className="flex justify-end gap-1.5 items-center">
            <span className="text-slate-500 font-bold">ቁጥር/Ref:</span>
            <span className="border-b border-slate-400 font-black text-slate-950 px-1 min-w-[90px]">{refNum || "W05/9012/18"}</span>
          </div>
          <div className="flex justify-end gap-1.5 items-center">
            <span className="text-slate-500 font-bold">ቀን/Date:</span>
            <span className="border-b border-slate-400 font-black text-slate-950 px-1 min-w-[90px]">{date || "___________"}</span>
          </div>
        </div>
      </div>

      {/* 3. Document Content (Dynamic Templates) */}
      <div className="relative z-10 flex-grow py-2">
        {type === DocumentType.RECOMMENDATION ? (
          <div className="space-y-4">
            <div className="space-y-1 mb-3">
              <p className="text-xs font-bold text-gray-900">ለ <span className="underline font-black text-sky-950" id="rec-addressed-to-out">{addressedTo}</span></p>
              <p className="text-xs font-bold pl-4 text-gray-700"><u>አዲስ አበባ</u></p>
            </div>

            <div className="space-y-2 border-t pt-3 border-slate-250">
              <p>• መጠየቂያው ሙሉ ስም (Requester Name)፦ <strong className="underline px-1 font-bold text-sky-950 text-xs">{name || "_________________"}</strong></p>
              <p>• የእናት ሙሉ ስም (Mother's Name)፦ <strong className="underline px-1 font-bold">{mother || "_________________"}</strong></p>
              <div className="grid grid-cols-2 gap-2">
                <p>• የትውልድ ዘመን (DOB)፦ <strong className="underline px-1">{dob || "_________________"}</strong></p>
                <p>• የጋብቻ ሁኔታ፦ <strong className="underline px-1">{marital}</strong></p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <p>• በተወካይ ከሆነ የተወካዩ ስም፦ <strong className="underline px-1">{repName || "_________________"}</strong></p>
                <p>• የውክልና መዝገብ ቁጥር፦ <strong className="underline px-1">{repPoa || "_________________"}</strong></p>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <p>• ብሔር፦ <strong className="underline px-1">{nation}</strong></p>
                <p>• ዜግነት፦ <strong className="underline px-1">{citizenship}</strong></p>
                <p>• የቤት ሁኔታ፦ <strong className="underline px-1">{houseStatus}</strong></p>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <p>• ከተማ፦ <strong className="underline px-1">{subcity}</strong></p>
                <p>• ወረዳ፦ <strong className="underline px-1">{woreda}</strong></p>
                <p>• የቤት ቁጥር፦ <strong className="underline font-bold text-sky-900 px-1">{house || "_________"}</strong></p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <p>• የትውልድ ቦታ (POB)፦ <strong className="underline px-1">{birthRegion}</strong></p>
                <p>• የስራ ሁኔታ፦ <strong className="underline px-1">{employment}</strong></p>
              </div>
              <p>• በወረዳው የኖረበት ጊዜ (Period)፦ <strong className="underline">{resPeriod}</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-50/95 p-2 rounded-xl border mt-4 text-[8.5px] text-gray-700 shadow-sm border-slate-200">
              <div className="border-r pr-1 border-slate-200">
                <p className="font-extrabold border-b pb-1 mb-1 text-gray-900">የስራው ባለሙያ</p>
                <p className="mb-0.5">ስም፦ <span className="font-semibold">{staffName}</span></p>
                <p>ፊርማ፦ ___________</p>
              </div>
              <div className="border-r px-1.5 border-slate-200">
                <p className="font-extrabold border-b pb-1 mb-1 text-gray-900">ያረጋገጠው ቡድን መሪ</p>
                <p className="mb-0.5">ስም፦ ____________</p>
                <p>ፊርማ፦ ___________</p>
              </div>
              <div className="pl-1">
                <p className="font-extrabold border-b pb-1 mb-1 text-sky-950">የጸደቀው ኃላፊ</p>
                <p className="mb-0.5">ስም፦ ____________</p>
                <p>ፊርማ፦ ___________</p>
              </div>
            </div>
          </div>
        ) : type === DocumentType.RESIDENCY ? (
          <div className="space-y-5">
            <div className="text-xs mb-3 space-y-1 font-bold text-gray-950">
              <p>ለ <span className="underline font-extrabold text-sky-950">{addressedTo}</span></p>
              <p className="pl-4"><u>አዲስ አበባ</u></p>
            </div>

            <div className="text-center font-bold text-xs my-5">
              <p className="underline decoration-double text-sky-950 font-black text-sm">ጉዳዩ፦ ነዋሪ መሆናቸውን ስለመግለጽ ይመለከታል::</p>
            </div>

            <div className="text-[11px] leading-relaxed space-y-4 text-justify pl-1" style={{ textIndent: '30px' }}>
              <p>
                ከላይ በርስቱ ለመግለጽ እንደተሞከረው አቶ/ወ/ሮ/ወ/ሪት {' '}
                <strong className="underline px-1 text-xs font-bold text-sky-950">{name}</strong> {' '}
                በዚህ ወረዳ 05 የቤት ቁጥር <strong className="underline px-2 font-bold">{house || "_________"}</strong> {' '}
                ነዋሪ መሆናቸውን ገልጸው ይጻፍላቸው ዘንድ አመልክተዋል።
              </p>
              <p>
                ስለሆነም አመልካች አቶ/ወ/ሮ/ወ/ሪት <strong className="underline px-1 font-bold text-sky-950">{name}</strong> በቦሌ ክ/ከተማ ወረዳ 05 የሲ/ም/የነ/አ/ቅ/ጽ/ቤት በቤት ቁጥር <strong className="underline px-1 font-bold">{house || "_________"}</strong> ላይ በቤተሰብ ቅጽ ላይ እና በኮምፒውተር ዳታ ቤዝ ውስጥ ተመዝግበው የሚገኙ እና መኖር የጀመሩበት ጊዜ ከ <strong className="underline px-1 font-extrabold text-sky-950">{fromYear}</strong> ዓ/ም እስከ <strong className="underline px-1 font-extrabold text-sky-950">{toYear}</strong> ዓ/ም ድረስ የኛ ወረዳ ነዋሪ መሆናቸውን በትህትና እንገልጻለን።
              </p>
            </div>

            <div className="text-right text-xs font-bold mt-8 pr-6">
              <p>ከሰላምታ ጋር</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 border-t pt-4 border-slate-250 text-[9.5px] text-gray-600">
              <div>
                <p><strong>የስራው ባለሙያ ስም፡</strong> {staffName || "____________________"}</p>
                <p className="mt-1">ፊርማ፡ __________________ ቀን፡ ___________</p>
              </div>
              <div className="text-right">
                <p><strong>ያጸደቀው ኃላፊ ስም፡</strong> ____________________</p>
                <p className="mt-1">ፊርማ፡ __________________ ቀን፡ ___________</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-xs mb-3 space-y-1 font-semibold text-gray-950">
              <p>ለ <span className="underline font-extrabold text-sky-950">{addressedTo}</span></p>
              <p className="pl-4"><u>አዲስ አበባ</u></p>
            </div>

            <div className="text-center font-bold text-xs my-5">
              <p className="underline decoration-double text-sky-950 font-black text-sm">ጉዳዩ፦ በሕይወት መኖራቸውን ይመለከታል::</p>
            </div>

            <div className="text-[11px] leading-relaxed space-y-4 text-justify pl-1" style={{ textIndent: '30px' }}>
              <p>
                በቦሌ ክ/ከተማ ወረዳ 05 በቤት ቁጥር <strong className="underline px-2 font-bold">{house || "_________"}</strong> ውስጥ ነዋሪ የሆኑት አቶ/ወ/ሮ/ወ/ሪት {' '}
                <strong className="underline px-1 text-xs font-bold text-sky-950">{name}</strong> የወረዳችን ነዋሪ መሆናቸውን ገልጸው እንደንጽፍላቸው በፊርማቸው ወይም በተወካያቸው <strong className="underline px-1 font-bold text-sky-900">{representative || "_________________"}</strong> በተጻፈ ደብዳቤ ጠይቀውናል።
              </p>
              <p>
                በዚህ መሰረት አመልካች የሆኑት አቶ/ወ/ሮ/ወ/ሪት <strong className="underline px-1 font-bold text-sky-950">{name}</strong> ከላይ በቤት ቁጥር በተገለጸው ቤት ውስጥ የወረዳው ነዋሪ መሆናቸውን እና በሕይወት መኖራቸውን በዓይናችን አይተን አረጋግጠናል ከቀበሌ ማህደር ቅጽ ያረጋገጥን በመሆኑ አስፈላጊው ትብብር እንዲደረግላቸው እንጠይቃለን።
              </p>
            </div>

            <div className="text-right text-xs font-bold mt-8 pr-6">
              <p>ከሰላምታ ጋር</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 border-t pt-4 border-slate-250 text-[9.5px] text-gray-600">
              <div>
                <p><strong>የስራው ባለሙያ ስም፡</strong> {staffName || "____________________"}</p>
                <p className="mt-1">ፊርማ፡ __________________ ቀን፡ ___________</p>
              </div>
              <div className="text-right">
                <p><strong>ያጸደቀው ኃላፊ ስም፡</strong> ____________________</p>
                <p className="mt-1">ፊርማ፡ __________________ ቀን፡ ___________</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Official Styled Footer matching layout exactly with beautiful CSS borders */}
      <div className="relative z-10 border-t border-slate-400 mt-6 pt-3 flex flex-col space-y-2">
        <div className="flex justify-between items-end">
          {/* Virtual Verification Block (Qr and verification text) */}
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 bg-white border border-slate-300 p-1 grid grid-cols-4 gap-0.5 rounded shadow-sm">
              <div className="bg-slate-700"></div><div className="bg-white"></div><div className="bg-slate-700"></div><div className="bg-white"></div>
              <div className="bg-white"></div><div className="bg-slate-700"></div><div className="bg-white"></div><div className="bg-slate-700"></div>
              <div className="bg-slate-700"></div><div className="bg-white"></div><div className="bg-slate-700"></div><div className="bg-white"></div>
              <div className="bg-white"></div><div className="bg-slate-700"></div><div className="bg-white"></div><div className="bg-slate-700"></div>
            </div>
            <div className="text-[7.5px] leading-tight text-slate-500 font-bold">
              <p className="font-extrabold text-slate-800 text-[8px]">ይፋዊ የዲጂታል ማረጋገጫ</p>
              <p className="font-black text-slate-400">Digitally Certified System</p>
            </div>
          </div>

          {/* Call Center Contacts matching image details */}
          <div className="text-right text-[8px] leading-none text-slate-500 font-bold font-sans space-y-1 pr-1">
            <p className="font-extrabold text-slate-700 text-[8.5px]">Call center: <span className="text-slate-900 font-black">7533</span></p>
            <p>+251 111580809</p>
            <p>+251 111263321</p>
            <p>info@aacrrsa.gov.et</p>
            <p>PO Box : 20320</p>
            <p>aacrrsa.gov.et</p>
          </div>
        </div>

        {/* Decorative pattern matching image visually */}
        <div className="w-full flex flex-col items-center pt-1 select-none pointer-events-none opacity-[0.85]">
          <div className="text-[7px] tracking-[5px] text-slate-300 font-black leading-none text-center">
            ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ● ○ ●
          </div>
          <div className="w-full h-[1.5px] bg-gradient-to-r from-transparent via-slate-350 to-transparent mt-0.5"></div>
        </div>
      </div>

    </div>
  );
}
