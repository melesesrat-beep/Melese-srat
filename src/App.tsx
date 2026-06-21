import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { 
  Search, FileText, CheckCircle2, Calendar, Clock, Lock, Unlock, LogOut, 
  Printer, Download, AlertTriangle, Menu, X, Plus, Trash2, ShieldCheck, 
  Languages, Fingerprint, RefreshCw, Eye, ChevronRight, Check, FileSpreadsheet,
  ChevronDown, MessageSquare, Send, Smartphone, Camera, Sparkles, Globe, Folder, FolderClosed,
  Columns, Maximize2, Layers, BookOpen
} from 'lucide-react';

import { 
  IDRecord, GeneratedDocument, Form010Record, Form011Record, Form012Record, DocumentType, OnlinePortalTicket, ResidentDocument,
  ScannedFile, HouseholdMember
} from './types';

import { 
  getEthiopianDate, getEthiopianTime, getEthiopianDateComponents, ethMonths,
  initialIdInventory, initialGeneratedDocs, initialForm010, initialForm011, initialForm012,
  encryptWithPassword, decryptWithPassword
} from './utils';

import { SignaturePad } from './components/SignaturePad';
import { DocumentTemplates } from './components/DocumentTemplates';
import { ProposalModal } from './components/ProposalModal';

import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
// @ts-ignore
import crrsaLogo from './assets/images/crrsa_logo_1781630175687.jpg';

const isFirebaseMock = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('mock');

const extractNameAndHouseFromFilename = (fileName: string, relativePath?: string) => {
  let sourceText = fileName;
  if (relativePath && relativePath.includes('/')) {
    sourceText = relativePath.split('/')[0];
  }
  let cleanName = sourceText.replace(/\.[^/.]+$/, "");
  cleanName = cleanName.replace(/[_\-+]/g, " ").trim();
  
  const housePattern = /\b\d+(?:\s*[\/\-]\s*[ሀ-ፐa-zA-Z\d]+)?\b/;
  const houseMatch = cleanName.match(housePattern);
  let extractedHouse = "";
  if (houseMatch) {
    extractedHouse = houseMatch[0].trim();
    cleanName = cleanName.replace(housePattern, "");
  }
  
  const stopwords = /(?:ቤት|ቁጥር|page|ገጽ|scan|ስካን|ካርታ|doc|document|file|ፋይል|ወረዳ|ቀበሌ)/gi;
  cleanName = cleanName.replace(stopwords, "");
  cleanName = cleanName.replace(/[\s\(\)\[\]\{\}\.:,]+/g, " ").trim();
  
  return { name: cleanName, houseNumber: extractedHouse };
};

const compressImageBase64 = (base64Str: string, maxWidth = 1200, maxHeight = 1600): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressed);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

// Helper function to dynamically generate sequential Doc ID starting from bw000001
const getNextResDocIdNumber = (docs: ResidentDocument[]): string => {
  let maxSeq = 0;
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.idNumber) {
        const match = doc.idNumber.toLowerCase().match(/^bw(\d+)/i);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });
  }
  const nextSeq = maxSeq + 1;
  return `bw${String(nextSeq).padStart(6, '0')}`;
};

export default function App() {
  // Navigation & UI States
  const [activePortal, setActivePortal] = useState<'public' | 'admin'>('public');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [adminTab, setAdminTab] = useState<'handovers' | 'docs' | 'form010' | 'form011' | 'form012' | 'security' | 'prerequisites' | 'smsGateway' | 'residentDocs' | 'printingForms'>('residentDocs');
  const [activePrintForm, setActivePrintForm] = useState<'form010' | 'form011' | 'form012'>('form010');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  // New Language, dropdown, and custom menus states
  const [currentLang, setCurrentLang] = useState<'am' | 'or' | 'en'>('am');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [selectedPublicID, setSelectedPublicID] = useState<any | null>(null);

  // Translation Support function
  const t = (key: string): string => {
    const translations: Record<string, Record<'am' | 'or' | 'en', string>> = {
      appTitle: {
        am: "የቦሌ ወረዳ 05 የዲጅታል አገልግሎት ስርዓት",
        or: "Siraata Diijitaalaa Bolee Woreda 05",
        en: "Bole Woreda 05 Digital Services"
      },
      agencySub: {
        am: "የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት ኤጀንሲ - ቦሌ ወረዳ 05",
        or: "Eejansii Galmeessa Haala Shabaakee fi Jiraattotaa - Bolee Woreda 05",
        en: "Civil Registration and Residency Services Agency - Bole Woreda 05"
      },
      quickChecker: {
        am: "ዕለታዊ የመታወቂያ ዝግጁነት አረጋጋጭ (Quick ID Ready Checker)",
        or: "Mirkaneessaa Qophaa'ina Eenyummeessaa Guyyaa",
        en: "Daily ID Readiness Checker"
      },
      searchSubtext: {
        am: "መታወቂያዎ ታትሞ መድረሱን ለማረጋገጥ ስምዎን ወይም የመታወቂያ ቁጥርዎን ከታች ባለው መፈለጊያ ሳጥን ውስጥ ያስገቡ።",
        or: "Mirkaneeffachuuf maqaa ykn lakkoofsa eenyummeessaa kee saanduqa barbaachaa gadii keessa galchi.",
        en: "Enter your name or ID number in the search box below to check if your ID is printed and ready."
      },
      searchPlaceholder: {
        am: "🔍 ስምዎን (ለምሳሌ፦ ዮሴፍ) ወይም የመታወቂያ ቁጥርዎን እዚህ ይፈልጉ...",
        or: "🔍 Maqaa keessan (fkn. Yoseef) ykn lakkoofsa eenyummeessaa asitti barbaadaa...",
        en: "🔍 Search your name (e.g., Yosef) or ID number here..."
      },
      clearSearch: {
        am: "ፍለጋውን አጽዳ",
        or: "Barbaacha Dhabamsiisi",
        en: "Clear Search"
      },
      searchResults: {
        am: "የፍለጋ ውጤት",
        or: "Bu'aa Barbaachaa",
        en: "Search Results"
      },
      foundCount: {
        am: "ተገኝቷል",
        or: "Argameera",
        en: "Found"
      },
      civilRegistry: {
        am: "የሲቪል ምዝገባ",
        or: "Galmeessa Haala Shabaakee",
        en: "Civil Registry"
      },
      residentService: {
        am: "የነዋሪ አገልግሎት",
        or: "Tajaajila Jiraattotaa",
        en: "Resident Service"
      },
      documentVerify: {
        am: "የሰነድ ማረጋገጫ",
        or: "Mirkaneessaa Ragaalee",
        en: "Document Verification"
      },
      serviceRequirementsDesc: {
        am: "አገልግሎቶችን ለማግኘት እና ቀጠሮ ከመያዝዎ በፊት የሚያስፈልጉዎትን ዝርዝር ሰነዶች እዚህ ይረዱ",
        or: "Tajaajila argachuu fi beellama qabachuu keessaniin dura ragaalee isiniif barbaachisan addaan baasaa",
        en: "Understand required documentation and preconditions before booking or visiting the center."
      },
      tabRequirementLabel: {
        am: "ለአገልግሎቱ የሚያስፈልጉ ሁኔታዎችና መስፈርቶች",
        or: "Ulaagaalee fi Haalawwan Duree",
        en: "Requirements & Prerequisites"
      },
      howToApply: {
        am: "በቀኝ በኩል ያለውን የቋንቋ ምርጫ በመጠቀም ወይም የባለሙያ መግቢያን በመጠቀም ሙሉ በይነገጹን መመልከት ይቻላል።",
        or: "Filannoo afaanii mirga jiru ykn seenumsa ogeessaa fayyadamuun tajaajiloota hunda argachuu ni dandeessu.",
        en: "Use the language selector on the top-right or professional login for advanced features."
      },
      directoryTitle: {
        am: "ታትመው ለርክክብ የደረሱ መታወቂያዎች የቀጥታ ሙሉ ማውጫ (Printed IDs Directory)",
        or: "Galmeen Jiraattotaa Mirkanaa'anii fi Qophaa'an",
        en: "Printed National Resident IDs Directory"
      },
      directorySub: {
        am: "በወረዳው ተዘጋጅተው ለርክክብ ዝግጁ የሆኑ የሁሉንም ነዋሪዎች መታወቂያ ቀጥታ ዝርዝር ከዚህ በታች መመልከት ይችላሉ።",
        or: "Iisni madaallii mirkaneessaa fiduun kaartaa eenyummeessaa jiraattotaa asii gadiitti ilaaluu dandeessu.",
        en: "Browse the live table below to verify and view national resident identity cards printed and ready."
      }
    };
    return translations[key]?.[currentLang] || translations[key]?.['am'] || key;
  };

  // Database States loaded from local storage
  const [idInventory, setIdInventory] = useState<IDRecord[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [form010, setForm010] = useState<Form010Record[]>([]);
  const [form011, setForm011] = useState<Form011Record[]>([]);
  const [form012, setForm012] = useState<Form012Record[]>([]);
  const [residentDocs, setResidentDocs] = useState<ResidentDocument[]>([]);

  // Resident Scanned Document Form States
  const [resDocHouseOwnerName, setResDocHouseOwnerName] = useState('');
  const [resDocHouseNumber, setResDocHouseNumber] = useState('');
  const [resDocType, setResDocType] = useState('የነዋሪነት ማስረጃ');
  const [resDocUploadedFiles, setResDocUploadedFiles] = useState<ScannedFile[]>([]);
  const [resDocMembers, setResDocMembers] = useState<HouseholdMember[]>([]);
  const [resDocNotes, setResDocNotes] = useState('');

  // Scanned doc form bind variables
  const [resDocResidentName, setResDocResidentName] = useState('');
  const [resDocIdNumber, setResDocIdNumber] = useState('');
  const [resDocFileName, setResDocFileName] = useState('');
  const [resDocFileSize, setResDocFileSize] = useState('');
  const [resDocContent, setResDocContent] = useState('');

  // Helper inputs for adding members during registration
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'የቤት ባለቤት' | 'ቤተሰብ' | 'ተከራይ' | 'ሌላ'>('ቤተሰብ');
  const [newMemberId, setNewMemberId] = useState('');

  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedDocFilterType, setSelectedDocFilterType] = useState('all');
  const [selectedViewDoc, setSelectedViewDoc] = useState<ResidentDocument | null>(null);
  
  // Custom states for 3000 bulk files table pagination and togglable row info
  const [archiveCurrentPage, setArchiveCurrentPage] = useState(0);
  const [archiveRowsPerPage, setArchiveRowsPerPage] = useState(25);
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>({});
  const [isDocsFullWidth, setIsDocsFullWidth] = useState(true);
  
  // Rich Scanned Doc Viewer & Interactive Editor Modal States
  const [resDocActivePage, setResDocActivePage] = useState<number>(0);
  const [resDocZoom, setResDocZoom] = useState<number>(1);
  const [resDocRotate, setResDocRotate] = useState<number>(0);
  const [resDocMemberSearch, setResDocMemberSearch] = useState<string>('');
  
  // Quick-Add Member fields inside the active Viewer Modal
  const [modalNewMemberName, setModalNewMemberName] = useState<string>('');
  const [modalNewMemberRole, setModalNewMemberRole] = useState<'የቤት ባለቤት' | 'ቤተሰብ' | 'ተከራይ' | 'ሌላ'>('ቤተሰብ');
  const [modalNewMemberId, setModalNewMemberId] = useState<string>('');

  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Constant preset requirements
  const DEFAULT_PRESET_REQUIREMENTS = [
    {
      id: "req-birth",
      category: "civil",
      subCategory: "ልደት",
      title: "የልደት ምዝገባ ቅድመ ሁኔታዎች (Birth Registration)",
      description: "የልደት ምዝገባ ሕጻኑ ከተወለደበት ቀን ጀምሮ በ90 ቀናት ውስጥ በአቅራቢያዎ በሚገኝ የወረዳ የሲቪል ምዝገባ ክፍል ቀርበው መመዝገብ ያለበት መሰረታዊ የሰብዓዊ መብት መነሻ ነው። ይህ በሕግ የተደነገገ አስገዳጅ ምዝገባ ነው።",
      points: [
        "የህክምና ተቋም የልደት ምስክር ወረቀት (የተወለደበት ተቋም ማስረጃ) ዋናው እና ኮፒ",
        "የወላጆች ህጋዊ የነዋሪነት መታወቂያ እና ዋናው ከፎቶኮፒ ጋር",
        "የልጁ ወላጆች ጋብቻ ምስክር ወረቀት (ካለ)",
        "ከተወለደ በ90 ቀናት ውስጥ መመዝገብ አለበት (ከዚያ በኋላ የዘግይቶ መቀጮ አለው)"
      ]
    },
    {
      id: "req-marriage",
      category: "civil",
      subCategory: "ጋብቻ",
      title: "የጋብቻ ምዝገባ ቅድመ ሁኔታዎች (Marriage Registration)",
      description: "የጋብቻ ምዝገባ የሚከናወነው በሕግ በተፈቀደውና በተደነገገው መሠረት ተጋቢዎች እና ሦስት ምስክሮች በአካል ቀርበው በመፈረም ነው። ምዝገባው የቤተሰብን ሕጋዊ መብቶች ያስከብራል።",
      points: [
        "ከተጋቢዎች ቀበሌ የመጣ ያላገባ ምስክር ወረቀት (ለአዲስ ነዋሪዎች)",
        "የተጋቢዎች የታደሰ የነዋሪነት መታወቂያ እና ዋናው ፎቶኮፒ",
        "ዕድሜያቸው 18 ዓመት የሞላቸው የሶስት ምስክሮች የታደሰ መታወቂያ",
        "የሶስት ምስክሮች በአካል መገኘት ወሳኝ ነው"
      ]
    },
    {
      id: "req-divorce",
      category: "civil",
      subCategory: "ፍቺ",
      title: "የፍቺ ምዝገባ ቅድመ ሁኔታዎች (Divorce Registration)",
      description: "በፍርድ ቤት የተወሰነ ፍቺ በ30 ቀናት ውስጥ ተገቢውን የፍርድ ቤት ውሳኔ ሰነድ እና የቀድሞ መረጃዎችን በመያዝ በወረዳው የሲቪል ምዝገባ ክፍል መመዝገብ ይኖርበታል።",
      points: [
        "የጸደቀ የፍርድ ቤት የፍቺ ውሳኔ ሰነድ (ዋናውና ኮፒ)",
        "የቀድሞ የጋብቻ ምስክር ወረቀት (ከተገኘ)",
        "የተፋችዎች የነዋሪነት መታወቂያ"
      ]
    },
    {
      id: "req-death",
      category: "civil",
      subCategory: "ሞት",
      title: "የሞት ምዝገባ ቅድመ ሁኔታዎች (Death Registration)",
      description: "ሞት በደረሰበት በ30 ቀናት ውስጥ የቅርብ ዘመድ ወይም ኃላፊነት ያለበት አካል የወረዳውን የሲቪል ምዝገባ ክፍል ማሳወቅና መመዝገብ አለበት።",
      points: [
        "ከጤና ተቋም የተሰጠ የሞት ማረጋገጫ ወይም የቀበሌ ሰፊ ምስክርነት ደብዳቤ",
        "የሟች የቀድሞ ነዋሪነት መታወቂያ (ለማስረከብ እና ለማምከን)",
        "የሪፖርት አድራጊው ህጋዊ መታወቂያ"
      ]
    },
    {
      id: "req-adoption",
      category: "civil",
      subCategory: "የጉዲፈቻ",
      title: "የጉዲፈቻ ምዝገባ ቅድመ ሁኔታዎች (Adoption Registration)",
      description: "የጉዲፈቻ ውሳኔ ከፍርድ ቤት በተሰጠ በ30 ቀናት ውስጥ በሲቪል ምዝገባ ክፍል መጽደቅና መመዝገብ አለበት።",
      points: [
        "በህግ የጸደቀ የጉዲፈቻ ስምምነት የፍርድ ቤት ውሳኔ ሰነድ",
        "የአሳዳጊዎች የነዋሪነት መታወቂያ እና ፎቶግራፍ",
        "የልጁ የልደት ሰነድ (ከተገኘ)"
      ]
    },
    {
      id: "req-id-new",
      category: "residency",
      subCategory: "አዲስ መታወቂያ",
      title: "አዲስ የነዋሪነት መታወቂያ መውረጃ ቅድመ ሁኔታዎች",
      description: "በወረዳ 05 ውስጥ በአዲስ መልክ የነዋሪነት መታወቂያ ለመውጣት ቢያንስ ለስድስት ወራት ለመኖርዎ ተገቢው ሕጋዊ ማስረጃ መቅረብ ይኖርበታል።",
      points: [
        "የልደት ምስክር ወረቀት ወይም የትምህርት ማስረጃ (የእድሜ ማረጋገጫ)",
        "በወረዳው ውስጥ ለመኖራቸው የታደሰ የቤት ክራይ ውል ወይም የቤት ባለቤትነት ማረጋገጫ (ካርታ)",
        "3 የቅርብ ጊዜ ፓስፖርት መጠን ፎቶግራፎች (ነጭ ዳራ ያላቸው)",
        "የቀድሞ መታወቂያ (ካለ)"
      ]
    },
    {
      id: "req-id-renew",
      category: "residency",
      subCategory: "መታወቂያ እድሳት",
      title: "የነዋሪነት መታወቂያ ለማደስ የሚያስፈልጉ ቅድመ ሁኔታዎች",
      description: "የነዋሪነት መታወቂያ በየ2 ዓመቱ መታደስ ያለበት በመሆኑ፣ ጊዜው ከማለፉ በፊት ቀርበው ተገቢውን የቤት ኪራይ/ቀረጥ ክፍያ ደረሰኞች ይዘው ያሳድሱ።",
      points: [
        "ጊዜው ያለፈበት የቀድሞው የነዋሪነት መታወቂያ",
        "ቀረጥ ወይም የቤት ኪራይ የተከፈለበት የቅርብ ጊዜ ደረሰኝ",
        "ሁለት የቅርብ ጊዜ ፓስፖርት መጠን ፎቶግራፍ"
      ]
    },
    {
      id: "req-id-replace",
      category: "residency",
      subCategory: "የጠፋ/የተበላሸ",
      title: "የጠፋ ወይም የተበላሸ መታወቂያ ለመተካት",
      description: "የጠፋ ወይም የተበላሸ የነዋሪነት መታወቂያ ለመተካት ከፖሊስ መጥፋት ማረጋገጫ ደብዳቤ ማምጣት እና የአካባቢውን ታሪካዊ መዝገብ ማስፈተሽ ያስፈልጋል።",
      points: [
        "ከፖሊስ ጣቢያ የተሰጠ የመታወቂያ መጥፋት ማረጋገጫ ደብዳቤ",
        "የመመዝገቢያ ታሪካዊ መረጃዎችን የሚያረጋግጥ የአከባቢው ነዋሪዎች ምስክርነት",
        "ሁለት የቅርብ ጊዜ ፓስፖርት መጠን ፎቶግራፎች"
      ]
    },
    {
      id: "req-single",
      category: "documents",
      subCategory: "ያላገባ ማስረጃ",
      title: "ያላገባ ምስክር ወረቀት ለማግኘት ቅድመ ሁኔታዎች",
      description: "ያላገባ ምስክር ወረቀት ለአገር ውስጥ እና ለውጭ አገር አገልግሎቶች የሚውል ሲሆን ምስክሮች ባሉበት በወረዳው የሲቪል ምዝገባ ክፍል ይመቻቻል።",
      points: [
        "የነዋሪነት መታወቂያ (በወረዳው ከ6 ወር በላይ የኖሩ)",
        "ኹለት አመልካቹን በቅርብ የሚያውቁ ምስክሮች መታወቂያ ጋር በአካል መገኘት"
      ]
    },
    {
      id: "req-life",
      category: "documents",
      subCategory: "በሕይወት መኖር ማረጋገጫ",
      title: "በሕይወት የመኖር ማረጋገጫ ለማግኘት ቅድመ ሁኔታዎች",
      description: "በሕይወት የመኖር ማረጋገጫ በየዓመቱ ለጡረታ ሰብሳቢዎችና ለሌሎች ወሳኝ የሕግ አገልግሎቶች የሚቀርብ ሪፖርት ነው።",
      points: [
        "የጡረታ መታወቂያ ወይም የነዋሪነት መታወቂያ",
        "አመልካቹ በአካል ቀርቦ መገኘት አለበት (ለህሙማን ልዩ ዝግጅት ሊኖር ይችላል)",
        "አንድ የቅርብ ጊዜ ፓስፖርት መጠን ፎቶግራፍ"
      ]
    }
  ];

  const sanitizeRequirementsList = (list: any[]): any[] => {
    if (!Array.isArray(list)) return DEFAULT_PRESET_REQUIREMENTS;
    return list.map(item => {
      const isBirth = item.id === 'req-birth';
      const isMarriage = item.id === 'req-marriage';
      const isDivorce = item.id === 'req-divorce';
      const isDeath = item.id === 'req-death';
      const isAdoption = item.id === 'req-adoption';
      const isSingle = item.id === 'req-single';
      const isLife = item.id === 'req-life';
      
      let category = item.category;
      let subCategory = item.subCategory;
      let description = item.description || "";
      
      if (!category) {
        if (isBirth || isMarriage || isDivorce || isDeath || isAdoption) {
          category = 'civil';
        } else if (item.id.includes('id-') || item.id.includes('residency') || item.id.includes('renew') || item.id.includes('replace')) {
          category = 'residency';
        } else {
          category = 'documents';
        }
      }
      
      if (!subCategory) {
        if (isBirth) subCategory = 'ልደት';
        else if (isMarriage) subCategory = 'ጋብቻ';
        else if (isDivorce) subCategory = 'ፍቺ';
        else if (isDeath) subCategory = 'ሞት';
        else if (isAdoption) subCategory = 'የጉዲፈቻ';
        else if (item.id.includes('new')) subCategory = 'አዲስ መታወቂያ';
        else if (item.id.includes('renew')) subCategory = 'መታወቂያ እድሳት';
        else if (item.id.includes('replace')) subCategory = 'የጠፋ/የተበላሸ';
        else if (isSingle) subCategory = 'ያላገባ ማስረጃ';
        else if (isLife) subCategory = 'በሕይወት መኖር';
        else subCategory = item.title ? item.title.split('(')[0].trim() : 'ሌላ';
      }

      if (!description) {
        const defMatch = DEFAULT_PRESET_REQUIREMENTS.find(d => d.id === item.id);
        if (defMatch) description = defMatch.description;
      }
      
      return {
        ...item,
        category,
        subCategory,
        description
      };
    });
  };

  // Service Prerequisites state (can be written/customized by user)
  const [requirements, setRequirements] = useState<any[]>(DEFAULT_PRESET_REQUIREMENTS);

  const [activeCategory, setActiveCategory] = useState<'civil' | 'residency' | 'documents'>('civil');
  const [activeSubTab, setActiveSubTab] = useState<string>('req-birth');

  const handleCategoryChange = (cat: 'civil' | 'residency' | 'documents') => {
    setActiveCategory(cat);
    const catItems = requirements.filter((r: any) => r.category === cat);
    if (catItems.length > 0) {
      setActiveSubTab(catItems[0].id);
    }
  };

  const [editingReqId, setEditingReqId] = useState<string>('req-birth');
  const [editingReqTitle, setEditingReqTitle] = useState<string>('');
  const [editingReqPointsText, setEditingReqPointsText] = useState<string>('');
  const [editingReqDesc, setEditingReqDesc] = useState<string>('');

  // Time metrics
  const [ethDateNow, setEthDateNow] = useState('');
  const [ethTimeNow, setEthTimeNow] = useState('');

  // Search filter strings
  const [publicSearch, setPublicSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [smsPendingFilter, setSmsPendingFilter] = useState(false);
  
  // Independent filters for Form 010
  const [f10FilterServiceType, setF10FilterServiceType] = useState('all');
  const [f10FilterSerial, setF10FilterSerial] = useState('');
  const [f10FilterDate, setF10FilterDate] = useState('');

  // Independent filters for Form 011
  const [f11FilterServiceType, setF11FilterServiceType] = useState('all');
  const [f11FilterSerial, setF11FilterSerial] = useState('');
  const [f11FilterDate, setF11FilterDate] = useState('');

  // Independent filters for Form 012
  const [f12FilterServiceType, setF12FilterServiceType] = useState('all');
  const [f12FilterSerial, setF12FilterSerial] = useState('');
  const [f12FilterDate, setF12FilterDate] = useState('');

  // Accordion status states for services
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>(null);

  // New Record Form States
  // 1. New ID Item
  const [newIdName, setNewIdName] = useState('');
  const [newIdPhone, setNewIdPhone] = useState('');
  const [newIdNum, setNewIdNum] = useState('');
  const [newIdHouse, setNewIdHouse] = useState('');

  // 1.5. Online Civil Registry (portal.aacrrsa.gov.et) Integration States
  const [onlineTickets, setOnlineTickets] = useState<OnlinePortalTicket[]>([]);
  const [newPortalAppId, setNewPortalAppId] = useState('');
  const [newPortalName, setNewPortalName] = useState('');
  const [newPortalPhone, setNewPortalPhone] = useState('');
  const [newPortalServiceType, setNewPortalServiceType] = useState('የነዋሪነት ፎርማሊቲ ምዝገባ (Residency Registration)');
  const [newPortalNotes, setNewPortalNotes] = useState('');
  const [portalSearch, setPortalSearch] = useState('');
  const [portalFilterStatus, setPortalFilterStatus] = useState<string>('all');
  const [isAddingPortalTicket, setIsAddingPortalTicket] = useState(false);

  // 2. Handover modal
  const [selectedHandoverIndex, setSelectedHandoverIndex] = useState<number | null>(null);
  const [handoverSignature, setHandoverSignature] = useState('');

  // 3. SMS notification modal states
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsRecord, setSmsRecord] = useState<IDRecord | null>(null);
  const [smsText, setSmsText] = useState('');
  const [isSmsSending, setIsSmsSending] = useState(false);

  // SMS Gateway config states
  const [smsGatewayUrl, setSmsGatewayUrl] = useState('');
  const [smsGatewayApiKey, setSmsGatewayApiKey] = useState('');
  const [smsGatewaySenderId, setSmsGatewaySenderId] = useState('');
  const [smsGatewayEnabled, setSmsGatewayEnabled] = useState(false);

  // Connection testing states
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('የአዲስ አበባ ቦሌ ወረዳ 05 የአጭር መልዕክት መፈተኛ ጥሪ! የሲስተሙ ግንኙነት በተሳካ ሁኔታ ሰርቷል።');
  const [isTestingSms, setIsTestingSms] = useState(false);

  // Helper to normalize and match Ethiopian dates safely (numeric and Amharic months)
  const matchEthDates = (rowDate: string, filterDate: string): boolean => {
    if (!filterDate) return true;
    if (!rowDate) return false;
    
    const normalize = (dateStr: string) => {
      let clean = dateStr.replace(/\s+/g, '').replace(/ዓ\.ም\.?/g, '');
      const parts = clean.split('/');
      if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parts[2];
        const monthNum = parseInt(month, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 13) {
          const ethMonthsNow = [
            "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"
          ];
          month = ethMonthsNow[monthNum - 1];
        }
        return `${day}/${month}/${year}`;
      }
      return clean;
    };
    
    return normalize(rowDate).includes(normalize(filterDate));
  };

  // 3. Document Hub Generator Form
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>(DocumentType.RECOMMENDATION);
  const [docPhoto, setDocPhoto] = useState<string>('');
  const [docInputs, setDocInputs] = useState<Record<string, string>>({
    ref: 'W05/መሸ/9012/18',
    addressedTo: 'ለኢትዮጵያ ንግድ ባንክ',
    name: '',
    mother: '',
    dob: '',
    marital: 'ያላገባ',
    repName: '',
    repPoa: '',
    nation: 'አማራ',
    citizenship: 'ኢትዮጵያዊ',
    subcity: 'ቦሌ',
    woreda: '05',
    house: '',
    birthRegion: 'አዲስ አበባ',
    employment: 'የግል ስራ',
    resPeriod: 'ከ 2018 ጀምሮ',
    staffName: 'የዕለቱ ተረኛ ባለሙያ',
    fromYear: '2018',
    toYear: '2018',
    representative: '',
    date: ''
  });

  // 4. Form 010 Inputs
  const [f10PrintType, setF10PrintType] = useState('ልደት ምስክር ወረቀት');
  const [f10Qty, setF10Qty] = useState<number>(1);
  const [f10Method, setF10Method] = useState<'ሲስተም' | 'ማኑዋል'>('ሲስተም');
  const [f10From, setF10From] = useState('');
  const [f10To, setF10To] = useState('');
  const [f10Day, setF10Day] = useState('');
  const [f10Month, setF10Month] = useState('');
  const [f10Year, setF10Year] = useState('');
  const [f10Remark, setF10Remark] = useState('');

  // 5. Form 011 Inputs
  const [f11DateDay, setF11DateDay] = useState('');
  const [f11DateMonth, setF11DateMonth] = useState('');
  const [f11DateYear, setF11DateYear] = useState('');
  const [f11ServiceType, setF11ServiceType] = useState('ልደት ምዝገባ');
  const [f11Archive, setF11Archive] = useState('');
  const [f11Customer, setF11Customer] = useState('');
  const [f11Serial, setF11Serial] = useState('');
  const [f11Method, setF11Method] = useState<'ሲስተም' | 'ማኑዋል'>('ሲስተም');
  const [f11Phone, setF11Phone] = useState('');
  const [f11Signature, setF11Signature] = useState('');

  // 6. Form 012 Inputs
  const [f12PrintType, setF12PrintType] = useState('ልደት ምስክር ወረቀት');
  const [f12ReturnStatus, setF12ReturnStatus] = useState<'ያልተሰጠ' | 'የተበላሸ'>('ያልተሰጠ');
  const [f12Method, setF12Method] = useState<'ሲስተም' | 'ማኑዋል'>('ሲስተም');
  const [f12Serial, setF12Serial] = useState('');
  const [f12Day, setF12Day] = useState('');
  const [f12Month, setF12Month] = useState('');
  const [f12Year, setF12Year] = useState('');
  const [f12Reason, setF12Reason] = useState('');

  // Reports
  const [selectedReportPeriod, setSelectedReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportResult, setReportResult] = useState<string>('');

  // Signee name states for Printable Forms
  const [f10SigneeAsrekabi, setF10SigneeAsrekabi] = useState(localStorage.getItem('W05_f10SigneeAsrekabi') || '');
  const [f10SigneeTerekabiLider, setF10SigneeTerekabiLider] = useState(localStorage.getItem('W05_f10SigneeTerekabiLider') || '');
  const [f10SigneeTerekabiBalemuya, setF10SigneeTerekabiBalemuya] = useState(localStorage.getItem('W05_f10SigneeTerekabiBalemuya') || '');
  const [f10SigneeYatzedeqew, setF10SigneeYatzedeqew] = useState(localStorage.getItem('W05_f10SigneeYatzedeqew') || '');

  const [f11SigneeBalemuya, setF11SigneeBalemuya] = useState(localStorage.getItem('W05_f11SigneeBalemuya') || '');
  const [f11SigneeLider, setF11SigneeLider] = useState(localStorage.getItem('W05_f11SigneeLider') || '');
  const [f11SigneeYatzedeqew, setF11SigneeYatzedeqew] = useState(localStorage.getItem('W05_f11SigneeYatzedeqew') || '');

  const [f12SigneeBalemuya, setF12SigneeBalemuya] = useState(localStorage.getItem('W05_f12SigneeBalemuya') || '');
  const [f12SigneeLider, setF12SigneeLider] = useState(localStorage.getItem('W05_f12SigneeLider') || '');
  const [f12SigneeYatzedeqew, setF12SigneeYatzedeqew] = useState(localStorage.getItem('W05_f12SigneeYatzedeqew') || '');

  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);

  // Keep signees saved to localStorage
  useEffect(() => {
    localStorage.setItem('W05_f10SigneeAsrekabi', f10SigneeAsrekabi);
    localStorage.setItem('W05_f10SigneeTerekabiLider', f10SigneeTerekabiLider);
    localStorage.setItem('W05_f10SigneeTerekabiBalemuya', f10SigneeTerekabiBalemuya);
    localStorage.setItem('W05_f10SigneeYatzedeqew', f10SigneeYatzedeqew);
  }, [f10SigneeAsrekabi, f10SigneeTerekabiLider, f10SigneeTerekabiBalemuya, f10SigneeYatzedeqew]);

  useEffect(() => {
    localStorage.setItem('W05_f11SigneeBalemuya', f11SigneeBalemuya);
    localStorage.setItem('W05_f11SigneeLider', f11SigneeLider);
    localStorage.setItem('W05_f11SigneeYatzedeqew', f11SigneeYatzedeqew);
  }, [f11SigneeBalemuya, f11SigneeLider, f11SigneeYatzedeqew]);

  useEffect(() => {
    localStorage.setItem('W05_f12SigneeBalemuya', f12SigneeBalemuya);
    localStorage.setItem('W05_f12SigneeLider', f12SigneeLider);
    localStorage.setItem('W05_f12SigneeYatzedeqew', f12SigneeYatzedeqew);
  }, [f12SigneeBalemuya, f12SigneeLider, f12SigneeYatzedeqew]);

  const handleSyncToCloud = async () => {
    if (isFirebaseMock) {
      alert("ማሳሰቢያ: የደመና መሠረተ-ልማት ገና አልተገናኘም። እባክዎን በመጀመሪያ የ Firebase ማዋቀርን ያጠናቁ።");
      return;
    }

    const confirmSync = window.confirm("በስልክዎ/በኮምፒውተርዎ ላይ ያለውን ሁሉንም የመታወቂያ ክምችት እና ቅጾች መረጃ ወደ ማዕከላዊ ደመና (Firestore) ለመስቀል ይፈልጋሉ? ይህ በደመናው ላይ ተመሳሳይ መለያ ያላቸውን ይተካቸዋል።");
    if (!confirmSync) return;

    setIsSyncingToCloud(true);
    try {
      for (const item of idInventory) {
        await setDoc(doc(db, 'idInventory', item.id), item);
      }
      for (const item of generatedDocs) {
        await setDoc(doc(db, 'generatedDocs', item.id), item);
      }
      for (const item of form010) {
        await setDoc(doc(db, 'form010', item.id), item);
      }
      for (const item of form011) {
        await setDoc(doc(db, 'form011', item.id), item);
      }
      for (const item of form012) {
        await setDoc(doc(db, 'form012', item.id), item);
      }
      for (const item of residentDocs) {
        await setDoc(doc(db, 'residentDocuments', item.id), item);
      }
      alert("ሁሉም የአገር ውስጥ መረጃዎች ወደ ማዕከላዊ የደመና ዳታቤዝ በተሳካ ሁኔታ ተሰቅለዋል (Successfully synced all data to Cloud!)");
    } catch (error) {
      alert("መረጃዎችን ወደ ደመና ለመጫን አልተቻለም: " + (error as Error).message);
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Initialize and load state
  useEffect(() => {
    // Sync time
    const comps = getEthiopianDateComponents();
    const todayAmharic = getEthiopianDate();
    setEthDateNow(todayAmharic);
    setEthTimeNow(getEthiopianTime());
    const interval = setInterval(() => {
      setEthTimeNow(getEthiopianTime());
    }, 30000);

    // Initial inputs load dates
    setF10Day(comps.day);
    setF10Month(comps.month);
    setF10Year(comps.year);

    setF11DateDay(comps.day);
    setF11DateMonth(comps.month);
    setF11DateYear(comps.year);

    setF12Day(comps.day);
    setF12Month(comps.month);
    setF12Year(comps.year);

    setDocInputs(prev => ({
      ...prev,
      date: prev.date || todayAmharic
    }));

    // Local Storage check
    const storedIds = localStorage.getItem('W05_idInventory');
    const storedDocs = localStorage.getItem('W05_generatedDocs');
    const stored010 = localStorage.getItem('W05_form010');
    const stored011 = localStorage.getItem('W05_form011');
    const stored012 = localStorage.getItem('W05_form012');
    const storedTickets = localStorage.getItem('W05_onlineTickets');
    const storedResidentDocs = localStorage.getItem('W05_residentDocs');
    const storedRequirements = localStorage.getItem('W05_requirements');

    if (storedIds) setIdInventory(JSON.parse(storedIds));
    else {
      setIdInventory(initialIdInventory as IDRecord[]);
      localStorage.setItem('W05_idInventory', JSON.stringify(initialIdInventory));
    }

    if (storedDocs) setGeneratedDocs(JSON.parse(storedDocs));
    else {
      setGeneratedDocs(initialGeneratedDocs as GeneratedDocument[]);
      localStorage.setItem('W05_generatedDocs', JSON.stringify(initialGeneratedDocs));
    }

    if (stored010) setForm010(JSON.parse(stored010));
    else {
      setForm010(initialForm010 as Form010Record[]);
      localStorage.setItem('W05_form010', JSON.stringify(initialForm010));
    }

    if (stored011) setForm011(JSON.parse(stored011));
    else {
      setForm011(initialForm011 as Form011Record[]);
      localStorage.setItem('W05_form011', JSON.stringify(initialForm011));
    }

    if (stored012) setForm012(JSON.parse(stored012));
    else {
      setForm012(initialForm012 as Form012Record[]);
      localStorage.setItem('W05_form012', JSON.stringify(initialForm012));
    }

    if (storedTickets) setOnlineTickets(JSON.parse(storedTickets));
    else {
      setOnlineTickets([]);
      localStorage.setItem('W05_onlineTickets', JSON.stringify([]));
    }

    if (storedResidentDocs) {
      const parsed = JSON.parse(storedResidentDocs);
      setResidentDocs(parsed);
      setResDocIdNumber(getNextResDocIdNumber(parsed));
    } else {
      setResidentDocs([]);
      localStorage.setItem('W05_residentDocs', JSON.stringify([]));
    }

    if (storedRequirements) {
      try {
        setRequirements(sanitizeRequirementsList(JSON.parse(storedRequirements)));
      } catch (err) {
        console.error("Failed to parse stored requirements:", err);
      }
    }

    const storedSmsUrl = localStorage.getItem('W05_smsGatewayUrl');
    const storedSmsApiKey = localStorage.getItem('W05_smsGatewayApiKey');
    const storedSmsSenderId = localStorage.getItem('W05_smsGatewaySenderId');
    const storedSmsEnabled = localStorage.getItem('W05_smsGatewayEnabled');

    if (storedSmsUrl) setSmsGatewayUrl(storedSmsUrl);
    if (storedSmsApiKey) setSmsGatewayApiKey(storedSmsApiKey);
    if (storedSmsSenderId) setSmsGatewaySenderId(storedSmsSenderId);
    if (storedSmsEnabled) setSmsGatewayEnabled(storedSmsEnabled === 'true');

    const unsubscribes: (() => void)[] = [];

    if (!isFirebaseMock) {
      try {
        const unsubIds = onSnapshot(collection(db, 'idInventory'), (snapshot) => {
          const list: IDRecord[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as IDRecord);
          });
          setIdInventory(list);
          localStorage.setItem('W05_idInventory', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading idInventory failed:", error);
        });
        unsubscribes.push(unsubIds);

        const unsubDocs = onSnapshot(collection(db, 'generatedDocs'), (snapshot) => {
          const list: GeneratedDocument[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as GeneratedDocument);
          });
          setGeneratedDocs(list);
          localStorage.setItem('W05_generatedDocs', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading generatedDocs failed:", error);
        });
        unsubscribes.push(unsubDocs);

        const unsubF10 = onSnapshot(collection(db, 'form010'), (snapshot) => {
          const list: Form010Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form010Record);
          });
          setForm010(list);
          localStorage.setItem('W05_form010', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading form010 failed:", error);
        });
        unsubscribes.push(unsubF10);

        const unsubF11 = onSnapshot(collection(db, 'form011'), (snapshot) => {
          const list: Form011Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form011Record);
          });
          setForm011(list);
          localStorage.setItem('W05_form011', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading form011 failed:", error);
        });
        unsubscribes.push(unsubF11);

        const unsubF12 = onSnapshot(collection(db, 'form012'), (snapshot) => {
          const list: Form012Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form012Record);
          });
          setForm012(list);
          localStorage.setItem('W05_form012', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading form012 failed:", error);
        });
        unsubscribes.push(unsubF12);

        const unsubTickets = onSnapshot(collection(db, 'onlinePortalTickets'), (snapshot) => {
          const list: OnlinePortalTicket[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as OnlinePortalTicket);
          });
          setOnlineTickets(list);
          localStorage.setItem('W05_onlineTickets', JSON.stringify(list));
        }, (error) => {
          console.error("Firestore loading onlinePortalTickets failed:", error);
        });
        unsubscribes.push(unsubTickets);

        const unsubResidentDocs = onSnapshot(collection(db, 'residentDocuments'), (snapshot) => {
          const list: ResidentDocument[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as ResidentDocument);
          });
          setResidentDocs(list);
          localStorage.setItem('W05_residentDocs', JSON.stringify(list));
          setResDocIdNumber(prev => {
            if (!prev || prev.trim() === '' || prev.toLowerCase().startsWith('bw')) {
              return getNextResDocIdNumber(list);
            }
            return prev;
          });
        }, (error) => {
          console.error("Firestore loading residentDocuments failed:", error);
        });
        unsubscribes.push(unsubResidentDocs);

        // Sync custom terms/prerequisites from Firestore settings
        const unsubReqs = onSnapshot(doc(db, 'settings', 'requirements'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.list) {
              setRequirements(sanitizeRequirementsList(data.list));
              localStorage.setItem('W05_requirements', JSON.stringify(data.list));
            }
          }
        }, (error) => {
          console.error("Firestore loading requirements failed:", error);
        });
        unsubscribes.push(unsubReqs);

        // Sync SMS configuration from Firestore settings
        const unsubSms = onSnapshot(doc(db, 'settings', 'sms'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data) {
              setSmsGatewayUrl(data.smsGatewayUrl || '');
              setSmsGatewayApiKey(data.smsGatewayApiKey || '');
              setSmsGatewaySenderId(data.smsGatewaySenderId || '');
              setSmsGatewayEnabled(!!data.smsGatewayEnabled);
              localStorage.setItem('W05_smsGatewayUrl', data.smsGatewayUrl || '');
              localStorage.setItem('W05_smsGatewayApiKey', data.smsGatewayApiKey || '');
              localStorage.setItem('W05_smsGatewaySenderId', data.smsGatewaySenderId || '');
              localStorage.setItem('W05_smsGatewayEnabled', JSON.stringify(!!data.smsGatewayEnabled));
            }
          }
        }, (error) => {
          console.error("Firestore loading sms config failed:", error);
        });
        unsubscribes.push(unsubSms);

      } catch (err) {
        console.error("Error setting up onSnapshot subscriptions:", err);
      }
    }

    return () => {
      clearInterval(interval);
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Auto-generate Doc ID when entering the Resident Archive tab
  useEffect(() => {
    if (adminTab === 'residentDocs' && (!resDocIdNumber || resDocIdNumber.trim() === '')) {
      setResDocIdNumber(getNextResDocIdNumber(residentDocs));
    }
  }, [adminTab, residentDocs, resDocIdNumber]);

  // Save states helper
  const saveState = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Login handler
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'woreda05') {
      setIsAdminLoggedIn(true);
      setLoginError(false);
      setAdminPassword('');
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setSidebarOpen(false);
    setActivePortal('public');
  };

  // Sync editor inputs when chosen prerequisite changes
  useEffect(() => {
    const selected = requirements.find(r => r.id === editingReqId);
    if (selected) {
      setEditingReqTitle(selected.title);
      setEditingReqPointsText(selected.points.join('\n'));
      setEditingReqDesc(selected.description || '');
    }
  }, [editingReqId, requirements]);

  // Handler to save modified prerequisite both locally and to Cloud Firestore
  const handleSavePrerequisite = async () => {
    const updated = requirements.map(r => {
      if (r.id === editingReqId) {
        return {
          ...r,
          title: editingReqTitle,
          description: editingReqDesc,
          points: editingReqPointsText.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        };
      }
      return r;
    });

    setRequirements(updated);
    localStorage.setItem('W05_requirements', JSON.stringify(updated));

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'settings', 'requirements'), { list: updated });
        alert("የአገልግሎት ቅድመ ሁኔታዎች በተሳካ ሁኔታ በደመና (Cloud Firestore) እና locally ተቀምጠዋል!");
      } catch (err) {
        alert("በደመና ላይ ለማስቀመጥ አልተቻለም: " + (err as Error).message);
      }
    } else {
      alert("የአገልግሎት ቅድመ ሁኔታዎች በአካባቢው (locally) በተሳካ ሁኔታ ተቀምጠዋል!");
    }
  };

  // Add a new custom service requirement under a specified category (ለመጨመር)
  const handleAddNewPrerequisiteCat = async (category: 'civil' | 'residency' | 'documents') => {
    const defaultTitle = category === 'civil' ? 'አዲስ የሲቪል ምዝገባ አገልግሎት' : category === 'residency' ? 'አዲስ የነዋሪ አገልግሎት' : 'አዲስ የሰነድ ማረጋገጫ አገልግሎት';
    const subCat = prompt("እባክዎ ለአዲሱ አገልግሎት አጭር ስም/ንዑስ ክፍል ያስገቡ (ለምሳሌ 'የልጅነት ማረጋገጫ' ወይም 'ደመወዝ ማረጋገጫ'):", "");
    if (!subCat) return;

    const newService = {
      id: "req_" + Date.now().toString(),
      category: category,
      subCategory: subCat,
      title: defaultTitle + " (" + subCat + ")",
      description: "በቦሌ ወረዳ 05 ለሚሰጠው " + subCat + " አገልግሎት የሚያስፈልጉ ቅድመ ሁኔታዎችና ዝርዝር መግለጫዎች እዚህ ይጻፋሉ።",
      points: [
        "የአመልካቹ ህጋዊ መታወቂያ",
        "የሚመለከተው አካል ደብዳቤ",
        "የአገልግሎት ክፍያ ደረሰኝ"
      ]
    };

    const updated = [...requirements, newService];
    setRequirements(updated);
    localStorage.setItem('W05_requirements', JSON.stringify(updated));

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'settings', 'requirements'), { list: updated });
        alert("አዲሱ የአገልግሎት መስፈርት በተሳካ ሁኔታ ተጨምሯል!");
      } catch (err) {
        alert("በደመና ላይ ለመጨመር አልተቻለም: " + (err as Error).message);
      }
    } else {
      alert("አዲሱ የአገልግሎት መስፈርት በአካባቢው (locally) ተጨምሯል!");
    }
    setEditingReqId(newService.id);
  };

  // Delete/reduce a service requirement (ለመቀነስ)
  const handleDeletePrerequisite = async (reqId: string) => {
    if (!reqId) {
      alert("በመጀመሪያ እባክዎ ለማጥፋት የሚፈልጉትን አገልግሎት ከዝርዝሩ ውስጥ ይምረጡ!");
      return;
    }
    const toDelete = requirements.find(r => r.id === reqId);
    if (!toDelete) return;

    if (!confirm(`እርግጠኛ ነዎት "${toDelete.subCategory}" የአገልግሎት ቅድመ ሁኔታን በቋሚነት ከሲስተሙ ላይ ለመቀነስ/ለማጥፋት ይፈልጋሉ?`)) {
      return;
    }

    const updated = requirements.filter(r => r.id !== reqId);
    setRequirements(updated);
    localStorage.setItem('W05_requirements', JSON.stringify(updated));

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'settings', 'requirements'), { list: updated });
        alert("የአገልግሎት መመሪያው በተሳካ ሁኔታ ተቀንሷል/ጠፍቷል!");
      } catch (err) {
        alert("በደመና ላይ ለመቀነስ አልተቻለም: " + (err as Error).message);
      }
    } else {
      alert("የአገልግሎት መመሪያው በአካባቢው (locally) ተቀንሷል/ጠፍቷል!");
    }

    if (updated.length > 0) {
      setEditingReqId(updated[0].id);
    } else {
      setEditingReqId("");
    }
  };

  // Handler to clear all system data (wipes both local states and Cloud Firestore)
  const handleResetAllData = async () => {
    const pw = prompt("ሁሉንም መረጃ ለማጥፋት የይለፍ ቃል ያስገቡ:");
    if (pw !== 'bolew05del') {
      if (pw !== null) {
        alert("የይለፍ ቃል ልክ አይደለም!");
      }
      return;
    }
    const confirmWipe1 = window.confirm("ማስጠንቀቂያ: ሁሉንም የገቡ የድሮ መረጃዎችን (መታወቂያዎች፣ ሰነዶች፣ ፎርሞች) ሙሉ በሙሉ መደምሰስ እና ሲስተሙን በአዲስ መልክ ማስጀመር ይፈልጋሉ? ይህ ድርጊት ወደኋላ አይመለስም!");
    if (!confirmWipe1) return;

    const confirmWipe2 = window.confirm("እርግጠኛ ነዎት? በደመና (Cloud Database) ላይ ያሉ መረጃዎችም ጭምር ይፋቃሉ!");
    if (!confirmWipe2) return;

    // Clear local storage
    localStorage.removeItem('W05_idInventory');
    localStorage.removeItem('W05_generatedDocs');
    localStorage.removeItem('W05_form010');
    localStorage.removeItem('W05_form011');
    localStorage.removeItem('W05_form012');

    // Reset React state
    setIdInventory([]);
    setGeneratedDocs([]);
    setForm010([]);
    setForm011([]);
    setForm012([]);

    if (!isFirebaseMock) {
      try {
        for (const item of idInventory) {
          await deleteDoc(doc(db, 'idInventory', item.id));
        }
        for (const item of generatedDocs) {
          await deleteDoc(doc(db, 'generatedDocs', item.id));
        }
        for (const item of form010) {
          await deleteDoc(doc(db, 'form010', item.id));
        }
        for (const item of form011) {
          await deleteDoc(doc(db, 'form011', item.id));
        }
        for (const item of form012) {
          await deleteDoc(doc(db, 'form012', item.id));
        }
        alert("ሁሉንም የቀድሞ መረጃዎች በተሳካ ሁኔታ ከሲስተሙ ላይ ተፋቀዋል። አሁን አዲስ ፍሬሽ መተግበሪያ ተዘጋጅቷል!");
      } catch (error) {
        alert("በደመና ላይ የተወሰኑ መረጃዎችን ለማጥፋት ስህተት ተከስቷል: " + (error as Error).message);
      }
    } else {
      alert("ሁሉንም የቀድሞ መረጃዎች በተሳካ ሁኔታ ከኮምፒዩተርዎ/ስልክዎ ላይ ተፋቀዋል።");
    }
  };

  // Secure Cryptographic Data Backup Strategy
  const handleBackupData = () => {
    const password = prompt("ለመረጃ ቅጂው ጥበቃ የሚሆን የይለፍ ቃል ያስገቡ (Enter backup encryption password):");
    if (password === null) return; // cancelled
    if (!password.trim()) {
      alert("ልክ ያልሆነ ይለፍ ቃል! ባዶ መሆን አይችልም።");
      return;
    }

    try {
      const backupPayload = {
        idInventory,
        generatedDocs,
        form010,
        form011,
        form012,
        timestamp: new Date().toISOString(),
        ethDate: ethDateNow,
        ethTime: ethTimeNow,
        version: "W05-v1"
      };

      const plaintext = JSON.stringify(backupPayload);
      const encryptedCiphertext = encryptWithPassword(plaintext, password);

      const finalJsonFileContent = JSON.stringify({
        schema: "Woreda05_CivilRegistry_Backup",
        createdAt: new Date().toISOString(),
        ethDate: ethDateNow,
        ciphertext: encryptedCiphertext
      }, null, 2);

      const blob = new Blob([finalJsonFileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const sanitizedDate = ethDateNow.replace(/\//g, '-').replace(/\s/g, '');
      link.setAttribute("download", `Woreda05_Secure_Backup_${sanitizedDate}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("የደህንነት ቅጂው በተሳካ ሁኔታ ተመስጥሯል እና ወርዷል! (Backup successfully encrypted and downloaded!)");
    } catch (error) {
      alert("የደህንነት ቅጂ ስህተት: " + (error as Error).message);
    }
  };

  const handleRestoreData = (fileEvent: React.ChangeEvent<HTMLInputElement>) => {
    const file = fileEvent.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const backupObj = JSON.parse(fileContent);

        if (backupObj.schema !== "Woreda05_CivilRegistry_Backup" || !backupObj.ciphertext) {
          alert("ስህተት: ይህ ትክክለኛ የቀበሌ 05 የደህንነት ቅጂ ፋይል አይደለም! (Invalid backup file schema)");
          return;
        }

        const password = prompt("እባክዎ ፋይሉን ለመክፈት/ለማስፈታት የይለፍ ቃል ያስገቡ (Enter decryption password):");
        if (password === null) return;

        const decryptedPlaintext = decryptWithPassword(backupObj.ciphertext, password);
        const payload = JSON.parse(decryptedPlaintext);

        // Validation of payload structure
        if (!payload.idInventory || !payload.generatedDocs || !payload.form010) {
          alert("ስህተት: በፋይሉ ውስጥ ያሉት መረጃዎች አልተሟሉም ወይም የተበላሹ ናቸው!");
          return;
        }

        const confirmRestore = window.confirm(`ማስጠንቀቂያ: ይህንን ባክአፕ መመለስ አሁን ያሉትን መረጃዎች ጠቅላላ ያጠፋቸዋል! ለመቀጠል እርግጠኛ ነዎት?\n\nየባክአፕ ቀን: ${payload.ethDate || 'ያልታወቀ'}`);
        if (!confirmRestore) return;

        // Save back to localStorage
        localStorage.setItem('W05_idInventory', JSON.stringify(payload.idInventory));
        localStorage.setItem('W05_generatedDocs', JSON.stringify(payload.generatedDocs));
        localStorage.setItem('W05_form010', JSON.stringify(payload.form010));
        localStorage.setItem('W05_form011', JSON.stringify(payload.form011 || []));
        localStorage.setItem('W05_form012', JSON.stringify(payload.form012 || []));

        // Update states
        setIdInventory(payload.idInventory);
        setGeneratedDocs(payload.generatedDocs);
        setForm010(payload.form010);
        setForm011(payload.form011 || []);
        setForm012(payload.form012 || []);

        alert("የደህንነት ቅጂው በተሳካ ሁኔታ ተመልሷል! (Backup successfully restored!)");
      } catch (error) {
        alert("የመረጃ መፍታት ስህተት የተሳሳተ የይለፍ ቃል ወይም የተበላሸ ፋይል: " + (error as Error).message);
      }
    };
    reader.readAsText(file);
    fileEvent.target.value = '';
  };

  // Search filter computes
  const filteredPublicInventory = idInventory.filter(item => {
    const term = publicSearch.toLowerCase();
    return item.name.toLowerCase().includes(term) || item.idNumber.toLowerCase().includes(term);
  });

  const filteredAdminInventory = idInventory.filter(item => {
    const term = adminSearch.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(term) || item.idNumber.toLowerCase().includes(term) || item.houseNumber.toLowerCase().includes(term);
    if (smsPendingFilter) {
      return matchesSearch && item.status === 'ለመረከብ ዝግጁ' && !item.smsSent;
    }
    return matchesSearch;
  });

  // Database count computations
  const countReady = idInventory.filter(item => item.status === 'ለመረከብ ዝግጁ').length;
  const countDelivered = idInventory.filter(item => item.status === 'የወሰደ').length;

  const countDeliveredToday = idInventory.filter(item => item.status === 'የወሰደ' && item.pickupDate && matchEthDates(item.pickupDate, ethDateNow)).length;
  const countDeliveredWeekly = countDelivered; // representative live count calculated from total
  const countDeliveredMonthly = countDelivered;

  // 1.5. Online Civil Registry (portal.aacrrsa.gov.et) handlers
  const handleAddPortalTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPortalAppId || !newPortalName || !newPortalPhone) {
      alert("እባክዎ የማመልከቻ ቁጥር (Application ID)፣ የነዋሪውን ስም እና ስልክ ቁጥር ያስገቡ!");
      return;
    }

    const newTicket: OnlinePortalTicket = {
      id: `ticket_${Date.now()}`,
      applicationId: newPortalAppId.trim(),
      fullName: newPortalName.trim(),
      phone: newPortalPhone.trim(),
      serviceType: newPortalServiceType,
      status: 'ሰነዶች ያልተሟሉ',
      submissionDate: ethDateNow,
      notes: newPortalNotes.trim()
    };

    setIsAddingPortalTicket(true);
    try {
      if (!isFirebaseMock) {
        await setDoc(doc(db, 'onlinePortalTickets', newTicket.id), newTicket);
      } else {
        const currentLocal = [...onlineTickets, newTicket];
        setOnlineTickets(currentLocal);
        localStorage.setItem('W05_onlineTickets', JSON.stringify(currentLocal));
      }

      // Reset fields
      setNewPortalAppId('');
      setNewPortalName('');
      setNewPortalPhone('');
      setNewPortalNotes('');
      alert("የኦንላይን አገልግሎት ማመልከቻው በስኬት ተመዝግቧል!");
    } catch (err: any) {
      console.error("Failed to add portal ticket:", err);
      handleFirestoreError(err, OperationType.WRITE, `onlinePortalTickets/${newTicket.id}`);
    } finally {
      setIsAddingPortalTicket(false);
    }
  };

  const updatePortalTicketStatus = async (ticketId: string, newStatus: OnlinePortalTicket['status']) => {
    const ticket = onlineTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const updated: OnlinePortalTicket = { ...ticket, status: newStatus };

    try {
      if (!isFirebaseMock) {
        await setDoc(doc(db, 'onlinePortalTickets', ticketId), updated);
      } else {
        const updatedList = onlineTickets.map(t => t.id === ticketId ? updated : t);
        setOnlineTickets(updatedList);
        localStorage.setItem('W05_onlineTickets', JSON.stringify(updatedList));
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      handleFirestoreError(err, OperationType.WRITE, `onlinePortalTickets/${ticketId}`);
    }
  };

  const updatePortalTicketNotes = async (ticketId: string, notes: string) => {
    const ticket = onlineTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const updated: OnlinePortalTicket = { ...ticket, notes: notes };

    try {
      if (!isFirebaseMock) {
        await setDoc(doc(db, 'onlinePortalTickets', ticketId), updated);
      } else {
        const updatedList = onlineTickets.map(t => t.id === ticketId ? updated : t);
        setOnlineTickets(updatedList);
        localStorage.setItem('W05_onlineTickets', JSON.stringify(updatedList));
      }
    } catch (err: any) {
      console.error("Failed to update notes:", err);
      handleFirestoreError(err, OperationType.WRITE, `onlinePortalTickets/${ticketId}`);
    }
  };

  const deletePortalTicket = async (ticketId: string) => {
    if (!confirm("ይህንን ማመልከቻ ለመሰረዝ እርግጠኛ ነዎት?")) return;

    try {
      if (!isFirebaseMock) {
        await deleteDoc(doc(db, 'onlinePortalTickets', ticketId));
      } else {
        const remaining = onlineTickets.filter(t => t.id !== ticketId);
        setOnlineTickets(remaining);
        localStorage.setItem('W05_onlineTickets', JSON.stringify(remaining));
      }
    } catch (err: any) {
      console.error("Failed to delete ticket:", err);
      handleFirestoreError(err, OperationType.DELETE, `onlinePortalTickets/${ticketId}`);
    }
  };

  // Dedicated SMS sender for Portal Updates
  const sendPortalSmsAlert = async (ticket: OnlinePortalTicket, type: 'missing_docs' | 'approved' | 'completed') => {
    let msgText = '';
    if (type === 'missing_docs') {
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት የኮድ ${ticket.applicationId} አገልግሎት ማመልከቻዎ ዝርዝር ሰነዶች ያልተሟሉ ሆነው ተገኝተዋል። እባክዎ ተጨማሪ ማስረጃዎችን ይዘው በስራ ሰዓት በወረዳ 05 ሲቪል ማህደር ክፍል (Window 3) በአካል ይቅረቡ። አመሰግናለን!`;
    } else if (type === 'approved') {
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት ማመልከቻ (ኮድ ${ticket.applicationId}) በአግባቡ ተረጋግጦ ጸድቋል። አገልግሎትዎን ለመጨረስ በአካል መጥተው ሂደቱን እንዲያጠናቅቁ ጥሪ እናደርጋለን። አመሰግናለን!`;
    } else {
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት ማመልከቻ (ኮድ ${ticket.applicationId}) አገልግሎቱ በስኬት ተጠናቆ ተዘጋጅቷል። መጥተው መውሰድ ይችላሉ። አመሰግናለን!`;
    }

    const gatewayUrl = smsGatewayUrl || '';
    if (!gatewayUrl) {
      alert("የኤስኤምኤስ ጌትዌይ ቅንብር አልተዋቀረም! እባክዎ መጀመሪያ (Settings > ኤስኤምኤስ ጌትዌይ ቅንብሮች) ውስጥ አስተካክሉ። እዚህ በቀጥታ በስልክዎ መላኪያ መሞከር ይችላሉ።");
      window.open(`sms:${ticket.phone}?body=${encodeURIComponent(msgText)}`, '_blank');
      return;
    }

    try {
      const response = await fetch("/api/send-sms", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: gatewayUrl,
          apiKey: smsGatewayApiKey,
          sender: smsGatewaySenderId || 'BOLE-W05',
          to: ticket.phone,
          message: msgText
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        // Mark SMS as sent
        const updated: OnlinePortalTicket = {
          ...ticket,
          smsSent: true,
          smsSentDate: ethDateNow
        };
        if (!isFirebaseMock) {
          await setDoc(doc(db, 'onlinePortalTickets', ticket.id), updated);
        } else {
          const updatedList = onlineTickets.map(t => t.id === ticket.id ? updated : t);
          setOnlineTickets(updatedList);
          localStorage.setItem('W05_onlineTickets', JSON.stringify(updatedList));
        }
        alert("የኤስኤምኤስ ጥሪ መልዕክት በስኬት ተልኳል!");
      } else {
        alert(`ኤስኤምኤስ መላክ አልተሳካም፦ ${data.error || "የጌትዌይ ስህተት"}`);
      }
    } catch (err: any) {
      alert(`ኤስኤምኤስ መላክ አልተሳካም፦ ${err.message || err}`);
    }
  };

  // Add new Printed ID item
  const performIDRegistration = async (sendSmsImmediately: boolean) => {
    if (!newIdName || !newIdNum || !newIdHouse) {
      alert("እባክዎ ሁሉንም የግዴታ መረጃዎችን በአግባቡ ያስገቡ!");
      return;
    }

    if (!newIdPhone) {
      alert("የአጭር መልዕክት (SMS) ጥሪ ለመላክ የስልክ ቁጥር ማስገባት ግዴታ ነው! እባክዎ የስልክ ቁጥሩን ያስገቡ።");
      return;
    }

    // Basic Ethiopian Phone Validation (starting with 09, 07, or +251)
    const cleanPhone = newIdPhone.trim();
    const phoneRegex = /^(09|07|\+2519|\+2517)\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      alert("የስልክ ቁጥሩ ልክ አይደለም! እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ለምሳሌ፡ 09xxxxxxxx ወይም 07xxxxxxxx)።");
      return;
    }

    if (idInventory.some(x => x.idNumber.toUpperCase() === newIdNum.toUpperCase())) {
      alert("ይህ የመታወቂያ ቁጥር አስቀድሞ በሲስተሙ ውስጥ አለ!");
      return;
    }

    const newItem: IDRecord = {
      id: `ID-${Date.now().toString().slice(-4)}`,
      name: newIdName,
      phone: cleanPhone,
      idNumber: newIdNum.toUpperCase(),
      houseNumber: newIdHouse,
      status: 'ለመረከብ ዝግጁ',
      smsSent: false
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'idInventory', newItem.id), newItem);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `idInventory/${newItem.id}`);
      }
    }

    const updated = [newItem, ...idInventory];
    setIdInventory(updated);
    saveState('W05_idInventory', updated);

    // Reset fields
    setNewIdName('');
    setNewIdPhone('');
    setNewIdNum('');
    setNewIdHouse('');

    if (sendSmsImmediately) {
      alert("አዲስ መታወቂያ በተሳካ ሁኔታ ተመዝግቧል!\n\nለተገልጋዩ የኤስኤምኤስ (SMS) መልዕክት ለመላክ መቃኛው ይከፈታል።");
      openSmsModal(newItem);
    } else {
      alert("አዲስ መታወቂያ በስኬት ተመዝግቧል!\n\nኤስኤምኤስ (SMS) አሁን አልተላከም፤ ከበታቹ ካለው ዝርዝር ሰንጠረዥ በፈለጉት ጊዜ 'SMS ላክ' የሚለውን በመጫን በማንኛውም ጊዜ መላክ ይችላሉ።");
    }
  };

  const handleAddNewID = async (e: React.FormEvent) => {
    e.preventDefault();
    await performIDRegistration(true); // Default form submit behavior keeps compatibility
  };

  // Open hand over modal
  const openHandoverModal = (id: string) => {
    const idx = idInventory.findIndex(x => x.id === id);
    if (idx !== -1) {
      setSelectedHandoverIndex(idx);
      setHandoverSignature('');
    }
  };

  // Perform Hand over confirmation
  const confirmHandover = async () => {
    if (selectedHandoverIndex === null) return;
    if (!handoverSignature) {
      alert("እባክዎ መጀመሪያ በፊርማ ሰሌዳው ላይ ፊርማዎን ያስፍሩ!");
      return;
    }

    const updatedRecord = {
      ...idInventory[selectedHandoverIndex],
      status: 'የወሰደ' as const,
      pickupDate: ethDateNow,
      pickupSignature: handoverSignature
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'idInventory', updatedRecord.id), updatedRecord);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `idInventory/${updatedRecord.id}`);
      }
    }

    const updated = [...idInventory];
    updated[selectedHandoverIndex] = updatedRecord;

    setIdInventory(updated);
    saveState('W05_idInventory', updated);
    setSelectedHandoverIndex(null);
    setHandoverSignature('');
    alert("የመታወቂያ ርክክቡ በተሳካ ሁኔታ ተመዝግቧል!");
  };

  // Open SMS modal with a language-aware message template
  const openSmsModal = (item: IDRecord) => {
    setSmsRecord(item);
    let template = `ጤና ይስጥልኝ ${item.name}፣ የአዲስ አበባ ቦሌ ወረዳ 05 የነዋሪነት መታወቂያዎ ስለደረሰ በአስቸኳይ መጥተው ይውሰዱ። አመሰግናለን!`;
    
    if (currentLang === 'or') {
      template = `Akkam jirtu ${item.name} Kartaan Eenyummeessaa jiraattota Bolee Woreda 05 keessan (Lakk. ${item.idNumber}) qopha'ee jira. Maaloo ragaa dhuunfaa ykn kaardii dhalootaa keessan qabachuun foddaa 3 (Window 3) irratti dhuftanii fudhachuu dandeessu. Galatoomaa!`;
    } else if (currentLang === 'en') {
      template = `Hello ${item.name}, your Bole Woreda 05 Resident ID card (No. ${item.idNumber}) has been printed successfully. Please bring your old ID card or birth certificate to Window 3 to receive it. Thank you!`;
    }
    setSmsText(template);
    setSmsModalOpen(true);
  };

  // Send SMS notification
  const triggerSmsNotification = async () => {
    if (!smsRecord) return;
    setIsSmsSending(true);

    let gatewaySuccess = true;
    let gatewayResultLog = "";

    if (smsGatewayEnabled && smsGatewayUrl) {
      try {
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: smsGatewayUrl,
            apiKey: smsGatewayApiKey,
            sender: smsGatewaySenderId,
            to: smsRecord.phone,
            message: smsText
          })
        });

        let data = await response.json().catch(() => ({}));
        
        // Browser CORS / Direct Client Gateway fallback if backend is static host or proxy fails
        if ((!response.ok || !data.success) && smsGatewayUrl) {
          console.warn("SMS Proxy backend returned non-success or was bypassed. Attempting direct browser-to-gateway fetch...");
          try {
            const isAfroMessage = smsGatewayUrl.toLowerCase().includes('afromessage');
            let directResponse;

            if (isAfroMessage) {
              // AfroMessage supports simple GET requests
              const amUrl = new URL(smsGatewayUrl.includes('/api/') ? smsGatewayUrl : `${smsGatewayUrl.replace(/\/+$/, '')}/api/send`);
              amUrl.searchParams.set('from', smsGatewaySenderId || 'BOLE-W05');
              amUrl.searchParams.set('sender', smsGatewaySenderId || 'BOLE-W05');
              amUrl.searchParams.set('to', smsRecord.phone);
              amUrl.searchParams.set('message', smsText);
              
              const directHeaders: Record<string, string> = {};
              if (smsGatewayApiKey) {
                directHeaders['Authorization'] = `Bearer ${smsGatewayApiKey}`;
              }
              directResponse = await fetch(amUrl.toString(), {
                method: 'GET',
                headers: directHeaders,
                mode: 'cors'
              });
            } else {
              // Post to generic gateway directly
              const directHeaders: Record<string, string> = {
                'Content-Type': 'application/json'
              };
              if (smsGatewayApiKey) {
                directHeaders['Authorization'] = `Bearer ${smsGatewayApiKey}`;
                directHeaders['X-API-Key'] = smsGatewayApiKey;
              }
              directResponse = await fetch(smsGatewayUrl, {
                method: 'POST',
                headers: directHeaders,
                body: JSON.stringify({
                  to: smsRecord.phone,
                  phone: smsRecord.phone,
                  recipient: smsRecord.phone,
                  message: smsText,
                  msg: smsText,
                  text: smsText,
                  from: smsGatewaySenderId || 'BOLE-W05',
                  sender: smsGatewaySenderId || 'BOLE-W05'
                }),
                mode: 'cors'
              });
            }

            const directData = await directResponse.json().catch(() => ({}));
            if (directResponse.ok && (directData.success || directData.status === 'success' || directData.acknowledge || directData.code === 200 || directResponse.status === 200)) {
              data = {
                success: true,
                detail: `Direct client gateway succeeded! (${directResponse.status})`
              };
            } else {
              data = {
                success: false,
                error: directData.error || directData.message || `Direct client endpoint rejected (Status ${directResponse.status})`
              };
            }
          } catch (directErr: any) {
            console.error("Direct browser CORS fetch failed too:", directErr);
            // Revert back or keep error info
            data = {
              success: false,
              error: data.error || `Gateway server unreachable inside node or browser. Please review parameters.`
            };
          }
        }

        if (!response.ok && !data.success) {
          gatewaySuccess = false;
          gatewayResultLog = data.error || `Gateway returned error status ${response.status}. Detail: ${data.detail || ""}`;
        } else if (data.success) {
          gatewaySuccess = true;
          gatewayResultLog = `Gateway replied: OK. ${data.detail || ""}`;
        } else {
          gatewaySuccess = false;
          gatewayResultLog = data.error || `Proxy returned invalid body.`;
        }
      } catch (err: any) {
        gatewaySuccess = false;
        gatewayResultLog = `Network error calling Gateway proxy: ${err.message || err}`;
      }
    }

    const updatedRecord: IDRecord = {
      ...smsRecord,
      smsSent: true,
      smsSentDate: ethDateNow
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'idInventory', updatedRecord.id), updatedRecord);
      } catch (error) {
        console.error("Firebase ID SMS status update failed:", error);
      }
    }

    const updated = idInventory.map(x => x.id === smsRecord.id ? updatedRecord : x);
    setIdInventory(updated);
    saveState('W05_idInventory', updated);

    setTimeout(() => {
      setIsSmsSending(false);
      setSmsModalOpen(false);
      if (gatewaySuccess) {
        alert(`የSMS/አጭር መልዕክት ለተገልጋይ ${smsRecord.name} (ስልክ: ${smsRecord.phone}) በስኬት ተልኳል!\n\nየተላከው መልዕክት:\n"${smsText}"${gatewayResultLog ? `\n\nጌትዌይ መልስ: ${gatewayResultLog}` : ""}`);
      } else {
        alert(`⚠️ የኤስኤምኤስ መላክ ሙከራ በከፊል አልተሳካም (ጌትዌይ ስህተት)!\n\nየመታወቂያው ስራ በሲስተሙ ቢመዘገብም፣ መልዕክቱ ለተገልጋዩ አልደረሰም።\n\nምክንያት:\n${gatewayResultLog}\n\nእባክዎ በአስተዳዳሪው ክፍል የኤስኤምኤስ ጌትዌይ (SMS Gateway API) ቅንብሮችን ይፈትሹ!`);
      }
    }, 1200);
  };

  // Send SMS directly using native mobile phone SMS messaging app (+251953991956/any phone)
  const sendSmsViaDeviceNativeApp = async () => {
    if (!smsRecord) return;
    
    const updatedRecord: IDRecord = {
      ...smsRecord,
      smsSent: true,
      smsSentDate: ethDateNow
    };

    // Update in Firebase Firestore if enabled
    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'idInventory', updatedRecord.id), updatedRecord);
      } catch (error) {
        console.error("Firebase ID SMS status update failed:", error);
      }
    }

    // Update local state and localStorage
    const updated = idInventory.map(x => x.id === smsRecord.id ? updatedRecord : x);
    setIdInventory(updated);
    saveState('W05_idInventory', updated);

    // Build the SMS URI scheme
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const cleanPhone = smsRecord.phone.replace(/\s+/g, '');
    const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(smsText)}`;

    // Close the modal and open SMS app
    setSmsModalOpen(false);
    
    // Redirect browser to trigger native SMS application
    window.location.href = smsUrl;
  };

  // Save SMS GW settings
  const handleSaveSmsSettings = async () => {
    const configData = {
      smsGatewayUrl,
      smsGatewayApiKey,
      smsGatewaySenderId,
      smsGatewayEnabled,
    };
    
    localStorage.setItem('W05_smsGatewayUrl', smsGatewayUrl);
    localStorage.setItem('W05_smsGatewayApiKey', smsGatewayApiKey);
    localStorage.setItem('W05_smsGatewaySenderId', smsGatewaySenderId);
    localStorage.setItem('W05_smsGatewayEnabled', JSON.stringify(smsGatewayEnabled));

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'settings', 'sms'), configData);
        alert("የኤስኤምኤስ ጌትዌይ (SMS Gateway) ቅንብሮች በተሳካ ሁኔታ በደመና (Cloud Database) ላይ ተቀምጠዋል!");
      } catch (error) {
        console.error("Error saving SMS config to Firestore:", error);
        alert("የኤስኤምኤስ ቅንብሮችን በደመና ላይ ለማስቀመጥ ስህተት አጋጥሟል! ቢሆንም በአካባቢያዊ ማከማቻ (Local Storage) ላይ ተቀምጠዋል።");
      }
    } else {
      alert("የኤስኤምኤስ ጌትዌይ (SMS Gateway) ቅንብሮች በአካባቢያዊ ማከማቻ (Local Storage) ላይ በተሳካ ሁኔታ ተቀምጠዋል!");
    }
  };

  // Test SMS Connection
  const handleTestSmsConnection = async () => {
    if (!testPhone) {
      alert("እባክዎ የሙከራ መልዕክት የሚላክበትን ስልክ ቁጥር ያስገቡ!");
      return;
    }
    const cleanPhone = testPhone.trim();
    const phoneRegex = /^(09|07|\+2519|\+2517)\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      alert("የሙከራ ስልክ ቁጥሩ ልክ አይደለም! እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ለምሳሌ፡ 09xxxxxxxx)።");
      return;
    }

    setIsTestingSms(true);
    let gatewaySuccess = false;
    let gatewayResultLog = "";

    if (smsGatewayEnabled && smsGatewayUrl) {
      try {
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: smsGatewayUrl,
            apiKey: smsGatewayApiKey,
            sender: smsGatewaySenderId,
            to: cleanPhone,
            message: testMessage
          })
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          gatewaySuccess = true;
          gatewayResultLog = `Gateway responded setup OK. Detail: ${data.detail || ""}`;
        } else {
          gatewaySuccess = false;
          gatewayResultLog = data.error || `Gateway response failed (Status ${response.status}). Detail: ${data.detail || ""}`;
        }
      } catch (err: any) {
        gatewaySuccess = false;
        gatewayResultLog = `Network Error while calling Gateway Proxy: ${err.message || err}`;
      }
    } else {
      // Simulation mode
      gatewaySuccess = true;
      gatewayResultLog = "Simulation Mode Active. (SMS Gateway is not enabled/configured in settings). Process completed.";
    }

    setTimeout(() => {
      setIsTestingSms(false);
      if (gatewaySuccess) {
        alert(`🎉 የኤስኤምኤስ ሙከራ በተሳካ ሁኔታ ተጠናቋል!\n\nለቁጥር: ${cleanPhone}\nመልዕክት: "${testMessage}"\n\nሲስተም ምላሽ:\n${gatewayResultLog}`);
      } else {
        alert(`❌ የኤስኤምኤስ ሙከራ አልተሳካም!\n\nምክንያት:\n${gatewayResultLog}\n\nእባክዎ የጌትዌይ URL አድራሻውን ወይም የኤፒአይ ቁልፍ (API Key) ትክክለኛነት ያረጋግጡ።`);
      }
    }, 1500);
  };

  // Delete records supporting passcode security check
  const deleteIDRecord = async (id: string) => {
    const pw = prompt("ይህንን መታወቂያ ለመሰረዝ የሰራተኛውን የይለፍ ቃል ያስገቡ:");
    if (pw === 'bolew05del') {
      if (!isFirebaseMock) {
        try {
          await deleteDoc(doc(db, 'idInventory', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `idInventory/${id}`);
        }
      }
      const updated = idInventory.filter(x => x.id !== id);
      setIdInventory(updated);
      saveState('W05_idInventory', updated);
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Upload custom JPEG/PNG client photo slot for Recommendation Hub
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setDocPhoto(event.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Input changes for template
  const handleDocInputChange = (field: string, val: string) => {
    setDocInputs(prev => ({ ...prev, [field]: val }));
  };

  // Save generated document to repository
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const saveDate = docInputs.date || ethDateNow;
    const newDoc: GeneratedDocument = {
      id: `DOC-${Date.now().toString().slice(-4)}`,
      ref: docInputs.ref || 'W05/9012/18',
      type: selectedDocType,
      name: docInputs.name || 'ያልተገለጸ',
      house: docInputs.house || '-',
      date: saveDate,
      payload: { ...docInputs, date: saveDate }
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'generatedDocs', newDoc.id), newDoc);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `generatedDocs/${newDoc.id}`);
      }
    }

    const updated = [newDoc, ...generatedDocs];
    setGeneratedDocs(updated);
    saveState('W05_generatedDocs', updated);
    alert(`${selectedDocType} በሲስተሙ ማህደር ተመዝግቧል! አሁን ማተም ይችላሉ።`);
  };

  const deleteGeneratedDoc = async (id: string) => {
    const pw = prompt("ይህንን ሰነድ ከማህደሩ ለመሰረዝ የሰራተኛውን የይለፍ ቃል ያስገቡ:");
    if (pw === 'bolew05del') {
      if (!isFirebaseMock) {
        try {
          await deleteDoc(doc(db, 'generatedDocs', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `generatedDocs/${id}`);
        }
      }
      const updated = generatedDocs.filter(x => x.id !== id);
      setGeneratedDocs(updated);
      saveState('W05_generatedDocs', updated);
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Auto-fill template parameters on repository reprint click
  const loadDocToInputs = (doc: GeneratedDocument) => {
    setSelectedDocType(doc.type);
    setDocInputs(doc.payload);
    // Scroll window/target to document form area
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  // Form 010 Insertion
  const handleAddForm010 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f10From || !f10To) return;

    const newRecord: Form010Record = {
      id: `F10-${Date.now().toString().slice(-4)}`,
      type: f10PrintType,
      qty: f10Qty,
      method: f10Method,
      from: f10From,
      to: f10To,
      date: `${f10Day}/${f10Month}/${f10Year}`,
      remark: f10Remark || '-'
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form010', newRecord.id), newRecord);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `form010/${newRecord.id}`);
      }
    }

    const updated = [...form010, newRecord];
    setForm010(updated);
    saveState('W05_form010', updated);

    // Reset
    setF10From('');
    setF10To('');
    setF10Remark('');
    alert("የቅጽ 010 መረጃ በተሳካ ሁኔታ ገብቷል!");
  };

  const deleteF10Row = async (id: string) => {
    const pw = prompt("ይህንን የቅጽ 010 ረድፍ ለመሰረዝ የይለፍ ቃል ያስገቡ:");
    if (pw === 'bolew05del') {
       if (!isFirebaseMock) {
         try {
           await deleteDoc(doc(db, 'form010', id));
         } catch (error) {
           handleFirestoreError(error, OperationType.DELETE, `form010/${id}`);
         }
       }
       const updated = form010.filter(x => x.id !== id);
       setForm010(updated);
       saveState('W05_form010', updated);
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Form 011 Insertion
  const handleAddForm011 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f11Archive || !f11Customer || !f11Serial) return;

    const newRecord: Form011Record = {
      id: `F11-${Date.now().toString().slice(-4)}`,
      date: `${f11DateDay}/${f11DateMonth}/${f11DateYear}`,
      serviceType: f11ServiceType,
      archive: f11Archive,
      customer: f11Customer,
      serial: f11Serial,
      method: f11Method,
      time: ethTimeNow,
      phone: f11Phone || '-',
      signature: f11Signature
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form011', newRecord.id), newRecord);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `form011/${newRecord.id}`);
      }
    }

    const updated = [...form011, newRecord];
    setForm011(updated);
    saveState('W05_form011', updated);

    // Reset
    setF11Archive('');
    setF11Customer('');
    setF11Serial('');
    setF11Phone('');
    setF11Signature('');
    alert("የቅጽ 011 መረጃ በተሳካ ሁኔታ ገብቷል!");
  };

  const deleteF11Row = async (id: string) => {
    const pw = prompt("ይህንን የቅጽ 011 ረድፍ ለመሰረዝ የይለፍ ቃል ያስገቡ:");
    if (pw === 'bolew05del') {
       if (!isFirebaseMock) {
         try {
           await deleteDoc(doc(db, 'form011', id));
         } catch (error) {
           handleFirestoreError(error, OperationType.DELETE, `form011/${id}`);
         }
       }
       const updated = form011.filter(x => x.id !== id);
       setForm011(updated);
       saveState('W05_form011', updated);
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Form 012 Insertion
  const handleAddForm012 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f12Serial || !f12Reason) return;

    const newRecord: Form012Record = {
      id: `F12-${Date.now().toString().slice(-4)}`,
      printType: f12PrintType,
      returnStatus: f12ReturnStatus as 'ያልተሰጠ' | 'የተበላሸ',
      method: f12Method as 'ሲስተም' | 'ማኑዋል',
      serial: f12Serial,
      date: `${f12Day}/${f12Month}/${f12Year}`,
      reason: f12Reason
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form012', newRecord.id), newRecord);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `form012/${newRecord.id}`);
      }
    }

    const updated = [...form012, newRecord];
    setForm012(updated);
    saveState('W05_form012', updated);

    // Reset
    setF12Serial('');
    setF12Reason('');
    alert("የቅጽ 012 መረጃ በተሳካ ሁኔታ ገብቷል!");
  };

  const deleteF12Row = async (id: string) => {
    const pw = prompt("ይህንን የቅጽ 012 ረድፍ ለመሰረዝ የይለፍ ቃል ያስገቡ:");
    if (pw === 'bolew05del') {
       if (!isFirebaseMock) {
         try {
           await deleteDoc(doc(db, 'form012', id));
         } catch (error) {
           handleFirestoreError(error, OperationType.DELETE, `form012/${id}`);
         }
       }
       const updated = form012.filter(x => x.id !== id);
       setForm012(updated);
       saveState('W05_form012', updated);
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Resident Documents Drag, Drop & Upload handlers of multiple files (pages)
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      if (firstFile) {
        const info = extractNameAndHouseFromFilename(firstFile.name, (firstFile as any).webkitRelativePath);
        if (info.name && !resDocResidentName.trim()) {
          setResDocResidentName(info.name);
          setResDocHouseOwnerName(info.name);
        }
        if (info.houseNumber && !resDocHouseNumber.trim()) {
          setResDocHouseNumber(info.houseNumber);
        }
      }

      Array.from(files).forEach((file: any) => {
        if (file.size > 20 * 1024 * 1024) {
          alert(`የመረጡት ፋይል "${file.name}" መጠን ከ20MB ይበልጣል። እባክዎን አነስ ያለ መጠን ያለው ፋይል ይምረጡ።`);
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            let dataUrl = event.target.result as string;
            if (dataUrl.startsWith('data:image/')) {
              dataUrl = await compressImageBase64(dataUrl);
            }

            const sizeInBytes = Math.round((dataUrl.length - 'data:image/png;base64,'.length) * 3 / 4);
            const kb = sizeInBytes / 1024;
            const sizeStr = kb > 1024 ? (kb / 1024).toFixed(2) + " MB" : kb.toFixed(1) + " KB";

            const newScanned: ScannedFile = {
              id: 'scan_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              fileName: file.name,
              fileSize: sizeStr,
              contentUrl: dataUrl,
              uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`
            };
            setResDocUploadedFiles(prev => [...prev, newScanned]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstWithRelative = Array.from(files).find(f => (f as any).webkitRelativePath);
      const relativePath = firstWithRelative ? (firstWithRelative as any).webkitRelativePath : undefined;
      const info = extractNameAndHouseFromFilename(files[0].name, relativePath);
      
      if (info.name && !resDocResidentName.trim()) {
        setResDocResidentName(info.name);
        setResDocHouseOwnerName(info.name);
      }
      if (info.houseNumber && !resDocHouseNumber.trim()) {
        setResDocHouseNumber(info.houseNumber);
      }

      Array.from(files).forEach((file: any) => {
        if (file.size > 20 * 1024 * 1024) {
          alert(`የመረጡት ፋይል "${file.name}" መጠን ከ20MB ይበልጣል። እባክዎን አነስ ያለ መጠን ያለው ፋይል ይምረጡ።`);
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            let dataUrl = event.target.result as string;
            if (dataUrl.startsWith('data:image/')) {
              dataUrl = await compressImageBase64(dataUrl);
            }

            const sizeInBytes = Math.round((dataUrl.length - 'data:image/png;base64,'.length) * 3 / 4);
            const kb = sizeInBytes / 1024;
            const sizeStr = kb > 1024 ? (kb / 1024).toFixed(2) + " MB" : kb.toFixed(1) + " KB";

            const newScanned: ScannedFile = {
              id: 'scan_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              fileName: file.webkitRelativePath || file.name,
              fileSize: sizeStr,
              contentUrl: dataUrl,
              uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`
            };
            setResDocUploadedFiles(prev => [...prev, newScanned]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Helper inputs to manage dynamic members draft during registration
  const handleAddHouseholdMemberDraft = () => {
    if (!newMemberName.trim()) {
      alert("እባክዎ የቤተሰቡን/ነዋሪውን ሙሉ ስም ያስገቡ!");
      return;
    }
    const newMB: HouseholdMember = {
      id: 'memb_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      fullName: newMemberName.trim(),
      role: newMemberRole,
      idNumber: newMemberId.trim() || undefined
    };
    setResDocMembers(prev => [...prev, newMB]);
    
    // Reset helper draft input fields
    setNewMemberName('');
    setNewMemberId('');
    setNewMemberRole('ቤተሰብ');
  };

  const handleRemoveHouseholdMemberDraft = (id: string) => {
    setResDocMembers(prev => prev.filter(m => m.id !== id));
  };

  // Submit complete house record (multi-scanned files + list of residents)
  const handleUploadResidentDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resDocHouseOwnerName.trim()) {
      alert("እባክዎ የቤቱን ባለቤት/ወኪል ሙሉ ስም ያስገቡ!");
      return;
    }
    if (!resDocHouseNumber.trim()) {
      alert("እባክዎ የቤት ቁጥር ያስገቡ!");
      return;
    }
    if (resDocUploadedFiles.length === 0) {
      alert("እባክዎ ቢያንስ አንድ የተቃኘ ገጽ/ፋይል ይጫኑ!");
      return;
    }

    setIsUploadingDoc(true);
    try {
      let finalMembers = [...resDocMembers];
      // If the registered members list doesn't have the house owner, auto-add them for safety
      const hasOwnerInList = finalMembers.some(m => m.fullName.toLowerCase() === resDocHouseOwnerName.trim().toLowerCase());
      if (!hasOwnerInList) {
        finalMembers.unshift({
          id: 'memb_owner_' + Date.now(),
          fullName: resDocHouseOwnerName.trim(),
          role: 'የቤት ባለቤት'
        });
      }

      // Ensure all matching house number members from the ID Inventory are registered as family members
      if (resDocHouseNumber.trim()) {
        const matchingInventory = idInventory.filter(item => 
          item.houseNumber && item.houseNumber.trim().toLowerCase() === resDocHouseNumber.trim().toLowerCase()
        );
        matchingInventory.forEach(inv => {
          const alreadyAdded = finalMembers.some(m => m.fullName.toLowerCase() === inv.name.trim().toLowerCase());
          if (!alreadyAdded) {
            finalMembers.push({
              id: 'memb_inv_' + inv.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 100),
              fullName: inv.name.trim(),
              role: 'ቤተሰብ',
              idNumber: inv.idNumber || undefined
            });
          }
        });
      }

      const assignedDocIdNo = resDocIdNumber.trim() || getNextResDocIdNumber(residentDocs);

      const newDoc: ResidentDocument = {
        id: 'resdoc_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        houseOwnerName: resDocHouseOwnerName.trim(),
        houseNumber: resDocHouseNumber.trim(),
        docType: resDocType,
        uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`,
        notes: resDocNotes.trim() || undefined,
        uploadedBy: "የወረዳ ባለሙያ",
        files: resDocUploadedFiles,
        members: finalMembers,

        // Root fields for backwards-compatibility with search queries and older list renders:
        residentName: resDocHouseOwnerName.trim(),
        idNumber: assignedDocIdNo,
        fileName: resDocUploadedFiles[0]?.fileName || "የተቃኘ ሰነድ",
        fileSize: resDocUploadedFiles[0]?.fileSize || "ወ/0",
        contentUrl: resDocUploadedFiles[0]?.contentUrl || ""
      };

      if (!isFirebaseMock) {
        try {
          await setDoc(doc(db, 'residentDocuments', newDoc.id), newDoc);
        } catch (error) {
          console.error("Firestore Upload Error:", error);
          alert("ማስጠንቀቂያ፦ ሰነዱ በደመና (Cloud Database) ላይ አልተጫነም። ነገር ግን በኮምፒውተርዎ ላይ ታቦቱ (Local Database) ውስጥ በተሳካ ሁኔታ ተቀምጧል። ምክንያት፦ " + (error as Error).message);
        }
      }

      const updated = [newDoc, ...residentDocs];
      setResidentDocs(updated);
      saveState('W05_residentDocs', updated);

      // Reset Form State
      setResDocHouseOwnerName('');
      setResDocResidentName('');
      setResDocIdNumber(getNextResDocIdNumber(updated));
      setResDocHouseNumber('');
      setResDocType('የነዋሪነት ማስረጃ');
      setResDocUploadedFiles([]);
      setResDocMembers([]);
      setResDocNotes('');
      setResDocFileName('');
      setResDocFileSize('');
      setResDocContent('');

      alert("የቤቱ ዲጂታል ሰነድ ማህደር በተሳካ ሁኔታ ተፈጥሯል! " + finalMembers.length + " ነዋሪዎች ተመዝግበዋል።");
    } catch (err) {
      alert("ፋይሉን ማስቀመጥ አልተቻለም: " + (err as Error).message);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Delete entire house record
  const handleDeleteResidentDoc = async (id: string, name: string) => {
    const pw = prompt(`የአቶ/ወ/ሮ "${name}" ሙሉ የቤት ዲጂታል ሰነድ ማህደር ለማጥፋት እባክዎ የይለፍ ቃል ያስገቡ፡`);
    if (pw === 'bolew05del') {
      setIsUploadingDoc(true);
      try {
        if (!isFirebaseMock) {
          await deleteDoc(doc(db, 'residentDocuments', id));
        }

        const updated = residentDocs.filter(d => d.id !== id);
        setResidentDocs(updated);
        saveState('W05_residentDocs', updated);

        if (selectedViewDoc?.id === id) {
          setSelectedViewDoc(null);
        }

        alert("የቤቱ ዲጂታል ማህደር በሙሉ ከሲስተሙ ላይ ተደምስሷል!");
      } catch (err) {
        alert("ማህደሩን ማጥፋት አልተቻለም: " + (err as Error).message);
      } finally {
        setIsUploadingDoc(false);
      }
    } else if (pw !== null) {
      alert("የይለፍ ቃል ልክ አይደለም!");
    }
  };

  // Cross-reference link of a family member from physical printed IDs inventory matching the household houseNumber
  const handleLinkInventoryMemberToDoc = async (docId: string, name: string, idNumber: string) => {
    setIsUploadingDoc(true);
    try {
      const updatedDocs = residentDocs.map(docItem => {
        if (docItem.id === docId) {
          const exists = docItem.members.some(m => m.fullName.toLowerCase() === name.toLowerCase());
          if (exists) {
            return docItem;
          }
          const newMB: HouseholdMember = {
            id: 'memb_inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            fullName: name.trim(),
            role: 'ቤተሰብ',
            idNumber: idNumber || undefined
          };
          return {
            ...docItem,
            members: [...docItem.members, newMB]
          };
        }
        return docItem;
      });

      if (!isFirebaseMock) {
        const docToUpdate = updatedDocs.find(d => d.id === docId);
        if (docToUpdate) {
          const { id, ...firebaseData } = docToUpdate;
          await setDoc(doc(db, 'residentDocuments', docId), firebaseData);
        }
      }

      setResidentDocs(updatedDocs);
      saveState('W05_residentDocs', updatedDocs);
      alert(`"${name}" በተዋረድ የቤት ባለቤቱ ስር በቆንጆ የቤተሰብ ሰንጠረዥ ውስጥ በተሳካ ሁኔታ ተካቷል!`);
    } catch (err) {
      alert("ማገናኘት አልተቻለም: " + (err as Error).message);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Delete a specific scanned page/file from an existing house record
  const handleDeleteFileFromDoc = async (docId: string, fileId: string) => {
    if (window.confirm("እርግጠኛ ነዎት ይህንን የተቃኘ ገጽ ብቻ ከማህደሩ ላይ ማስወገድ ይፈልጋሉ?")) {
      const updatedDocs = residentDocs.map(docItem => {
        if (docItem.id === docId) {
          return {
            ...docItem,
            files: docItem.files.filter(f => f.id !== fileId)
          };
        }
        return docItem;
      });

      const updatedDoc = updatedDocs.find(d => d.id === docId);
      if (updatedDoc) {
        if (!isFirebaseMock) {
          try {
            await setDoc(doc(db, 'residentDocuments', docId), updatedDoc);
          } catch (e) {
            console.error("Firestore update failed:", e);
          }
        }
        setResidentDocs(updatedDocs);
        saveState('W05_residentDocs', updatedDocs);
        setSelectedViewDoc(updatedDoc); // refresh dynamic screen modal preview active states
        alert("የተመረጠው የተቃኘ ገጽ ተወግዷል!");
      }
    }
  };

  // Append new scanned files to an existing house record
  const handleAddNewFilesToDoc = async (docId: string, newFiles: ScannedFile[]) => {
    if (newFiles.length === 0) return;
    const updatedDocs = residentDocs.map(docItem => {
      if (docItem.id === docId) {
        return {
          ...docItem,
          files: [...docItem.files, ...newFiles]
        };
      }
      return docItem;
    });

    const updatedDoc = updatedDocs.find(d => d.id === docId);
    if (updatedDoc) {
      if (!isFirebaseMock) {
        try {
          await setDoc(doc(db, 'residentDocuments', docId), updatedDoc);
        } catch (e) {
          console.error("Firestore update failed:", e);
        }
      }
      setResidentDocs(updatedDocs);
      saveState('W05_residentDocs', updatedDocs);
      setSelectedViewDoc(updatedDoc); // refresh active viewer
      alert("ተጨማሪ የተቃኙ ገጾች ከተበታተኑ ፋይሎች ላይ ተያይዘዋል!");
    }
  };

  // Register an additional family member to an existing house record directly
  const handleAddNewMemberToDoc = async (docId: string, member: HouseholdMember) => {
    const updatedDocs = residentDocs.map(docItem => {
      if (docItem.id === docId) {
        return {
          ...docItem,
          members: [...docItem.members, member]
        };
      }
      return docItem;
    });

    const updatedDoc = updatedDocs.find(d => d.id === docId);
    if (updatedDoc) {
      if (!isFirebaseMock) {
        try {
          await setDoc(doc(db, 'residentDocuments', docId), updatedDoc);
        } catch (e) {
          console.error("Firestore update failed:", e);
        }
      }
      setResidentDocs(updatedDocs);
      saveState('W05_residentDocs', updatedDocs);
      setSelectedViewDoc(updatedDoc); // refresh active viewer
      alert("አዲስ ነዋሪ በቤቱ መዝገብ ውስጥ በተሳካ ሁኔታ ተመዝግቧል!");
    }
  };

  // Delete a specific family member from a house record
  const handleDeleteMemberFromDoc = async (docId: string, memberId: string) => {
    if (window.confirm("እርግጠኛ ነዎት ይህንን ነዋሪ ከዚህ ቤት መዝገብ ላይ መሰረዝ ይፈልጋሉ?")) {
      const updatedDocs = residentDocs.map(docItem => {
        if (docItem.id === docId) {
          return {
            ...docItem,
            members: docItem.members.filter(m => m.id !== memberId)
          };
        }
        return docItem;
      });

      const updatedDoc = updatedDocs.find(d => d.id === docId);
      if (updatedDoc) {
        if (!isFirebaseMock) {
          try {
            await setDoc(doc(db, 'residentDocuments', docId), updatedDoc);
          } catch (e) {
            console.error("Firestore update failed:", e);
          }
        }
        setResidentDocs(updatedDocs);
        saveState('W05_residentDocs', updatedDocs);
        setSelectedViewDoc(updatedDoc); // refresh active viewer
        alert("ነዋሪው ከቤቱ ተሰርዟል!");
      }
    }
  };

  // Filter logs logic
  const filteredForm010 = form010.filter(row => {
    const matchType = (f10FilterServiceType === 'all') || row.type.includes(f10FilterServiceType);
    const matchSerial = (f10FilterSerial === '') || row.from.toLowerCase().includes(f10FilterSerial.toLowerCase()) || row.to.toLowerCase().includes(f10FilterSerial.toLowerCase());
    const matchDate = matchEthDates(row.date, f10FilterDate);
    return matchType && matchSerial && matchDate;
  });

  const filteredForm011 = form011.filter(row => {
    const matchType = (f11FilterServiceType === 'all') || row.serviceType.toLowerCase().includes(f11FilterServiceType.toLowerCase());
    const matchSerial = (f11FilterSerial === '') || row.serial.toLowerCase().includes(f11FilterSerial.toLowerCase());
    const matchDate = matchEthDates(row.date, f11FilterDate);
    return matchType && matchSerial && matchDate;
  });

  const filteredForm012 = form012.filter(row => {
    const matchType = (f12FilterServiceType === 'all') || row.printType.toLowerCase().includes(f12FilterServiceType.toLowerCase());
    const matchSerial = (f12FilterSerial === '') || row.serial.toLowerCase().includes(f12FilterSerial.toLowerCase());
    const matchDate = matchEthDates(row.date, f12FilterDate);
    return matchType && matchSerial && matchDate;
  });

  // Generate Report function
  const triggerReport = () => {
    const docsTotal = generatedDocs.length;
    const recsCount = generatedDocs.filter(d => d.type === DocumentType.RECOMMENDATION).length;
    const resCount = generatedDocs.filter(d => d.type === DocumentType.RESIDENCY).length;
    const lifeCount = generatedDocs.filter(d => d.type === DocumentType.LIFE_STATUS).length;

    const text = `የወረዳ 05 የዕለቱ የሪፖርት ማጠቃለያ ማዕከል\nቀን: ${ethDateNow}\nሰዓት: ${ethTimeNow}\n-------------------------------------------------------------\n1. ዝርዝር ይፋዊ ሰነዶች ርክክብ:\n   - አጠቃላይ የተመነጩ ሰነዶች: ${docsTotal} ሰነዶች\n   - የመሸኛ መጠየቂያ ቅጾች: ${recsCount} ሪኮርድ\n   - የነዋሪነት ማረጋገጫ ደብዳቤዎች: ${resCount} ሪኮርድ\n   - በሕይወት የመኖር ማረጋገጫዎች: ${lifeCount} ሪኮርድ\n2. የመታወቂያ ክምችት ሁኔታ (Stock Backlog):\n   - ለመረከብ ዝግጁ የሆኑ: ${countReady} መታወቂያዎች\n   - ዛሬ የተረከቡ: ${countDeliveredToday} መታወቂያዎች\n   - ጠቅላላ የተረከቡ: ${countDelivered} መታወቂያዎች\n3. የቅጾች የዕለት መዝገብ አመላካች:\n   - ቅጽ 010 (የዕለት ህትመት ስርጭት): ${form010.length} ሪኮርዶች\n   - ቅጽ 011 (የዕለት አገልግሎት ያገኙ): ${form011.length} ሪኮርዶች\n   - ቅጽ 012 (ተመላሽና የተበላሹ): ${form012.length} ሪኮርዶች\n-------------------------------------------------------------\n* ይህ ሪፖርት በራስ-ሰር የተጠናቀረ እውነተኛ መረጃ ነው።`;
    setReportResult(text);
  };

  // Export report as Amharic CSV helper
  const exportToCSV = (formType: 'f010' | 'f011' | 'f012' | 'docs') => {
    let csvContent = "\uFEFF"; // UTF-8 BOM byte order mark to display Amharic correctly in Excel
    
    if (formType === 'f010') {
      csvContent += "ተ.ቁ,የህትመት አይነት,ብዛት,በማኑዋል,በሲስተም,ሴሪያል ከ,ሴሪያል እስከ,ቀን,ማስታወሻ\n";
      form010.forEach((row, i) => {
        csvContent += `"${i+1}","${row.type}","${row.qty}","${row.method==='ማኑዋል'?'✓':''}","${row.method==='ሲስተም'?'✓':''}","${row.from}","${row.to}","${row.date}","${row.remark}"\n`;
      });
    } else if (formType === 'f011') {
      csvContent += "ተ.ቁ,አገልግሎት የተሰጠበት ቀን,የአገልግሎት አይነት,የማህደር ቁጥር,የተገልጋይ ስም,ሴሪያል,በማኑዋል,በሲስተም,ሰዓት,ስልክ\n";
      form011.forEach((row, i) => {
        csvContent += `"${i+1}","${row.date}","${row.serviceType}","${row.archive}","${row.customer}","${row.serial}","${row.method==='ማኑዋል'?'✓':''}","${row.method==='ሲስተም'?'✓':''}","${row.time}","${row.phone}"\n`;
      });
    } else if (formType === 'f012') {
      csvContent += "ተ.ቁ,የህትመት አይነት,አገልግሎት ላይ ያልዋለ,የተበላሸ,በማኑዋል,በሲስተም,ሰሪያል ቁጥር,ቀን,የተበላሸበት ምክንያት\n";
      form012.forEach((row, i) => {
        csvContent += `"${i+1}","${row.printType}","${row.returnStatus==='ያልተሰጠ'?'✓':''}","${row.returnStatus==='የተበላሸ'?'✓':''}","${row.method==='ማኑዋል'?'✓':''}","${row.method==='ሲስተም'?'✓':''}","${row.serial}","${row.date}","${row.reason}"\n`;
      });
    } else {
      csvContent += "ተ.ቁ,የሰነድ ማጣቀሻ ቁጥር,የሰነድ አይነት,የአመልካች ስም,የቤት ቁጥር,የተመዘገበበት ቀን\n";
      generatedDocs.forEach((row, i) => {
        csvContent += `"${i+1}","${row.ref}","${row.type}","${row.name}","${row.house}","${row.date}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Woreda05_${formType}_Report_${ethDateNow.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export collected IDs only ('የወሰደ') as Excel-ready Amharic CSV
  const exportDeliveredIDsToExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM byte order mark to display Amharic correctly in Excel
    csvContent += "ተ.ቁ,የተረካቢ ሙሉ ስም,መታወቂያ ቁጥር,የቤት ቁጥር,ስልክ ቁጥር,ርክክብ የተደረገበት ቀን,የርክክብ ሁኔታ\n";
    
    const deliveredList = idInventory.filter(item => item.status === 'የወሰደ');
    
    deliveredList.forEach((row, i) => {
      const signatureStatus = row.pickupSignature ? "በፊርማ የተረጋገጠ (Signed)" : "የወሰደ/ተረክቧል (Delivered)";
      csvContent += `"${i+1}","${row.name}","${row.idNumber}","${row.houseNumber}","${row.phone}","${row.pickupDate || ethDateNow}","${signatureStatus}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Bole_Woreda05_ID_Handover_Delivered_Report_${ethDateNow.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* 1. TOP RESPONSIVE HEADER - no-print */}
      <header className="bg-white text-slate-800 shadow-md sticky top-0 z-40 no-print border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Logo Icon as in user image */}
            <img 
              src={crrsaLogo} 
              alt="CRRSA Logo" 
              className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col justify-center leading-tight">
              <div className="flex items-center space-x-2">
                <span className="text-base sm:text-2xl font-black text-[#0f384c] tracking-tight leading-none">CRRSA</span>
                <span className="bg-[#2a4d5f] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">ቦሌ ወረዳ 05</span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-[#0f384c] font-bold mt-0.5">የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት ኤጀንሲ - ቦሌ ወረዳ 05</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Cloud Database Integration Status indicator & Sync trigger */}
            <button
              onClick={async () => {
                if (isFirebaseMock) {
                  alert("አገልግሎት: የ Firebase ደመና መሠረተ-ልማት ገና አልተገናኘም። መተግበሪያው በየአካባቢው (Local) ብቻ ነው የሚሰራው። እባክዎን በቀኝ በኩል የ Firebase ግንኙነትን ያዘጋጁ።");
                } else {
                  if (isAdminLoggedIn) {
                     await handleSyncToCloud();
                  } else {
                     alert("የተገናኘ: የ Firebase ማዕከላዊ የደመና ዳታቤዝ አሁን ገቢር ነው። ሁሉም የሚገቡ አዳዲስ መረጃዎች በሁሉም ባለሙያዎች ዘንድ ወዲያውኑ ይዘመናሉ። ያሉትን ነባር መረጃዎች ወደ ደመና ለመጫን 'የባለሙያ መግቢያ' በይለፍ ቃል ገብተው 'ዳታ ስቀል' የሚለውን ምልክት ይጫኑ።");
                  }
                }
              }}
              className={`flex items-center space-x-1 px-2.5 py-2 text-[9px] font-bold rounded-xl border transition-all ${
                isFirebaseMock 
                  ? 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/60 hover:bg-emerald-100'
              }`}
              title={isFirebaseMock ? "Local Mode" : "Cloud Synchronized"}
              disabled={isSyncingToCloud}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToCloud ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">
                {isSyncingToCloud ? 'በመስቀል ላይ...' : isFirebaseMock ? 'Offline (ሎካል)' : 'Cloud Active'}
              </span>
              {isAdminLoggedIn && !isFirebaseMock && (
                <span className="bg-emerald-500 text-white text-[8px] px-1 py-0.5 rounded ml-1 font-extrabold shadow-sm animate-pulse">
                  ዳታ ስቀል (Sync)
                </span>
              )}
            </button>

            {/* Theme / Locale Indicator badge info */}
            <div className="hidden md:flex flex-col text-right text-[10px] text-slate-500 mr-1 border-r pr-3 border-slate-200">
              <span className="font-bold flex items-center text-slate-700"><Calendar className="w-3 h-3 text-[#2a4d5f] mr-1"                    {/* Status & Guide */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black">ሁኔታ (Status)</span>
                        {selectedPublicID.status === 'የወሰደ' ? (
                          <span className="px-2 py-0.5 bg-slate-600 text-white text-[8px] font-black rounded-lg">ተረክበዋል</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded-lg animate-pulse">ለመረከብ ዝግጁ</span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-300 leading-relaxed font-bold">
                        {selectedPublicID.status === 'የወሰደ' ? (
                          <p>📅 <strong>የወሰዱበት ቀን፡</strong> {selectedPublicID.pickupDate || 'ትናንትና'}</p>
                        ) : (
                          <ul className="list-disc pl-3 text-cyan-100 space-y-0.5">
                            <li>ቀዳሚ መታወቂያ ወይም የልደት ካርድ ይዘው ይምጡ</li>
                            <li>የሚያገኙበት ቦታ: <strong>መስኮት 3 (Window 3)</strong></li>
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Instant Search matches Area */}
              {publicSearch.trim() !== "" && (
                <div className="pt-3 border-t border-slate-100 gap-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold text-[#0f384c] uppercase tracking-wider">{t('searchResults')}:</span>
                    <span className="text-[10px] font-black bg-cyan-50 text-[#0f384c] border border-cyan-100 px-2.5 py-0.5 rounded-full">
                      {filteredPublicInventory.length} {t('foundCount')}
                    </span>
                  </div>

                  {filteredPublicInventory.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredPublicInventory.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedPublicID(item)}
                          className={`p-4 rounded-2xl border transition-all duration-300 shadow-sm flex flex-col justify-between gap-3 cursor-pointer ${selectedPublicID?.id === item.id ? 'ring-4 ring-cyan-400/60 bg-cyan-50/20 border-cyan-300' : item.status === 'የወሰደ' ? 'bg-slate-50/65 border-slate-200' : 'bg-emerald-50/40 border-emerald-250 hover:shadow-md hover:scale-[1.01]'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                              <p className="text-[10px] font-mono text-slate-500 mt-1">መታወቂያ ቁጥር: <span className="font-extrabold">{item.idNumber}</span></p>
                            </div>
                            {item.status === 'የወሰደ' ? (
                              <span className="text-[8px] sm:text-[9px] px-2.5 py-1 font-black bg-slate-200 text-slate-600 rounded-full select-none">
                                የተረከበ (የወሰደ)
                              </span>
                            ) : (
                              <span className="text-[8px] sm:text-[9px] px-2.5 py-1 font-black bg-emerald-600 text-white rounded-full animate-bounce select-none shadow-sm">
                                ለመውሰድ ዝግጁ!
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-100 pt-2 font-bold font-sans">
                            <span>ቤት ቁጥር: {item.houseNumber || 'ያልተገለጸ'}</span>
                            {item.status === 'የወሰደ' ? (
                              <span className="text-emerald-700">የተረከቡበት ቀን: {item.pickupDate}</span>
                            ) : (
                              <span className="text-[#0f384c] font-black bg-teal-50 px-2 py-0.5 rounded border border-teal-150/40">
                                🖱️ ዝርዝር ለመመልከት ይጫኑ
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-rose-50/50 border border-rose-100/60 rounded-2xl">
                      <p className="text-xs text-rose-800 font-extrabold leading-relaxed">
                        ⚠️ "{publicSearch}" የሚል ስም ወይም የመታወቂያ ቁጥር በስርዓቱ ውስጥ አልተገኘም።
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        እባክዎ ትክክለኛ ስም በጥቂቱ እየጻፉ ይሞክሩ (ለምሳሌ "ዮሐንስ" በሙሉ ከመጻፍ "ዮ" ብለው ይፈልጉ)።
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Requirements section was moved to top responsive hamburger menu for better mobile friendliness, showing only ID lookup and printed IDs list here */}

            {/* 3. FULL LIVE DIRECTORY LISTING AT THE BOTTOM */}
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 p-5 md:p-6 space-y-5 shadow-xs">
              
              {/* Header with status metrics */}
              <div className="border-b border-slate-150 pb-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-extrabold text-[#0a3651] text-sm md:text-base flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      ታትመው ለርክክብ የደረሱ መታወቂያዎች የቀጥታ ሙሉ ማውጫ (Printed IDs Directory)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-relaxed">
                      በወረዳው ተዘጋጅተው ለርክክብ ዝግጁ የሆኑ የሁሉንም ነዋሪዎች መታወቂያ ቀጥታ ዝርዝር ከዚህ በታች መመልከት ይችላሉ።
                    </p>
                  </div>
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-full text-[10px] sm:text-xs font-black border border-emerald-100 animate-pulse whitespace-nowrap">
                    {countReady} መታወቂያ ለመረከብ ዝግጁ
                  </span>
                </div>
              </div>

              {/* Height-constrained scroll area to preserve gorgeous UI experience on mobile screens */}
              <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[380px] overflow-y-auto shadow-inner bg-slate-50/20">
                <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                  <thead className="sticky top-0 bg-white shadow-xs z-10 border-b border-[#0a3651]/10">
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-extrabold uppercase">
                      <th className="p-3 text-left">የተገልጋይ ሙሉ ስም (Full Name)</th>
                      <th className="p-3">የመታወቂያ ቁጥር (ID Number)</th>
                      <th className="p-3">የቤት ቁጥር (House No.)</th>
                      <th className="p-3 text-center">ሁኔታ (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold bg-white">
                    {idInventory.length > 0 ? (
                      idInventory.map((item) => (
                        <tr 
                          key={item.id} 
                          className="hover:bg-slate-50 transition duration-150"
                        >
                          <td className="p-3 text-left text-[#0f384c] font-black">{item.name}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-500">{item.idNumber}</td>
                          <td className="p-3 text-slate-600 font-extrabold">{item.houseNumber}</td>
                          <td className="p-3 text-center">
                            {item.status === 'የወሰደ' ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] border border-slate-200">
                                  የተረከበ
                                </span>
                                <span className="text-[8px] text-slate-400 font-semibold mt-0.5">{item.pickupDate}</span>
                              </div>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] border border-emerald-100 font-black animate-pulse">
                                ለመረከብ ዝግጁ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 text-[10px]">
                          በማውጫው ውስጥ ምንም መረጃ የለም።
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}� ደህና መጡ!
                  </span>
                  <h2 className="text-xl md:text-3xl font-extrabold tracking-tight mt-1 text-white drop-shadow-sm">
                    መታወቂያዎ ታትሞ መድረሱን ያረጋግጡ
                  </h2>
                  <p className="text-xs sm:text-sm md:text-base text-cyan-200 font-bold max-w-xl leading-relaxed drop-shadow-sm">
                    ህትመት የደረሱ መታወቂያዎችን ሁኔታ እዚህ ማረጋገጥ ይችላሉ።
                  </p>
                </div>
                {/* Responsive counters */}
                <div className="grid grid-cols-2 gap-3 bg-teal-950/80 p-4 rounded-2xl border border-teal-700/60 w-full md:w-auto text-center">
                  <div className="px-3 py-1 bg-teal-900/40 rounded-xl">
                    <span className="text-[9px] text-teal-200 block">ለመረከብ ዝግጁ የሆኑ</span>
                    <span className="text-2xl font-black text-cyan-300">{countReady}</span>
                  </div>
                  <div className="px-3 py-1 bg-teal-900/40 rounded-xl">
                    <span className="text-[9px] text-teal-200 block">የተረከቡ (የወሰዱ)</span>
                    <span className="text-2xl font-black text-emerald-400">{countDelivered}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. HIGH-PRIORITY INTEGRATED SEARCH CONSOLE AT THE VERY TOP */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 md:p-6 space-y-4 animate-fade-in animate-scale-up-soft">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-base md:text-lg text-[#0f384c] flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0f384c] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0f384c]"></span>
                    </span>
                    {t('quickChecker')}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-relaxed">
                    {t('searchSubtext')}
                  </p>
                </div>
                {publicSearch.trim() !== "" && (
                  <button 
                    type="button"
                    onClick={() => {
                      setPublicSearch("");
                      setSelectedPublicID(null);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black rounded-xl transition-all"
                  >
                    {t('clearSearch')}
                  </button>
                )}
              </div>

              {/* Highly responsive sleek public live search box */}
              <div className="relative w-full">
                <input 
                  type="text" 
                  value={publicSearch}
                  onChange={(e) => setPublicSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full text-xs sm:text-sm p-4 pl-12 border-2 border-teal-100 focus:border-[#0f384c] rounded-2xl focus:outline-none focus:ring-4 focus:ring-slate-150/40 bg-slate-50/50 uppercase placeholder-slate-400 font-black transition-all shadow-inner"
                />
                <Search className="w-5 h-5 text-[#0f384c] absolute left-4 top-4" />
              </div>

              {/* Selected ID Detail Showcase Card right here under the search if chosen */}
              {selectedPublicID && (
                <div className="p-5 md:p-6 bg-slate-900 text-white rounded-3xl border border-teal-500/20 shadow-xl relative overflow-hidden animate-fade-in">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400 opacity-5 rounded-full blur-2xl"></div>
                  
                  <div className="flex justify-between items-start border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-400/20 text-cyan-300">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black tracking-wider uppercase text-cyan-300">የመታወቂያ ዝርዝር መረጃ እና ሁኔታ (ID Details Tracker)</h4>
                        <p className="text-[9px] text-slate-400 font-bold">የቦሌ ወረዳ 05 የሲቪል ምዝገባ እና ነዋሪነት መለያ መዝገብ</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedPublicID(null)}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black transition-all"
                    >
                      እይታውን ዝጋ (Close)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
                    {/* Core Details */}
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold block">የነዋሪው ሙሉ ስም (Full Name)</span>
                      <span className="text-sm font-black text-yellow-300">{selectedPublicID.name}</span>
                    </div>

                    {/* Technical ID */}
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold block">የመታወቂያ ቁጥር (ID Number)</span>
                      <span className="text-xs font-mono font-extrabold text-cyan-400 block bg-black/40 p-2 rounded-xl border border-white/5 mt-1">{selectedPublicID.idNumber}</span>
                    </div>

                    {/* Status & Guide */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black">ሁኔታ (Sta              {/* Advanced Admin Navigation Tabs Menu - Organized in exactly two rows with vibrant distinct gradient theme styles */}
              <div className="flex flex-col gap-2.5 no-print w-full">
                {/* Row 1: Core Records & Main Archives */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setAdminTab('residentDocs')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'residentDocs' 
                        ? 'bg-gradient-to-r from-blue-600 via-teal-600 to-teal-500 text-white hover:brightness-105 border-transparent shadow-lg shadow-blue-100/40' 
                        : 'bg-slate-50/80 hover:bg-blue-50/60 text-slate-700 hover:text-blue-900 border-slate-200/70 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <FileText className={`w-4 h-4 transition ${adminTab === 'residentDocs' ? 'text-white' : 'text-blue-600'}`} />
                    <span>ዲጂታል ሰነድ ማህደር (Resident Docs)</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAdminTab('handovers')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'handovers' 
                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-indigo-100/40' 
                        : 'bg-slate-50/80 hover:bg-indigo-50/60 text-slate-700 hover:text-indigo-900 border-slate-200/70 hover:border-indigo-200 hover:shadow-sm'
                    }`}
                  >
                    <FolderClosed className={`w-4 h-4 transition ${adminTab === 'handovers' ? 'text-white' : 'text-indigo-600'}`} />
                    <span>መታወቂያ ርክክብ (Handovers)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('docs')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'docs' 
                        ? 'bg-gradient-to-r from-emerald-600 via-emerald-550 to-teal-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-emerald-100/40 font-black' 
                        : 'bg-slate-50/80 hover:bg-emerald-50/60 text-slate-700 hover:text-emerald-900 border-slate-200/70 hover:border-emerald-200 hover:shadow-sm'
                    }`}
                  >
                    <Layers className={`w-4 h-4 transition ${adminTab === 'docs' ? 'text-white' : 'text-emerald-600'}`} />
                    <span>አጠቃላይ ሰነዶች (Docs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab('printingForms');
                    }}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'printingForms' 
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white hover:brightness-105 border-transparent shadow-lg shadow-orange-100/40 font-black' 
                        : 'bg-slate-50/80 hover:bg-orange-50/60 text-slate-705 hover:text-orange-900 border-slate-200/70 hover:border-orange-200 hover:shadow-sm'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 transition ${adminTab === 'printingForms' ? 'text-white' : 'text-orange-600'}`} />
                    <span>ህትመት ቅፆች (Print Forms)</span>
                  </button>
                </div>

                {/* Row 2: Secondary Administration & Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setAdminTab('security')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'security' 
                        ? 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white hover:brightness-105 border-transparent shadow-lg shadow-slate-300/40 font-black' 
                        : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200/70 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <Fingerprint className={`w-4 h-4 transition ${adminTab === 'security' ? 'text-white' : 'text-slate-650'}`} />
                    <span>ደህንነት (Security)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('prerequisites')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'prerequisites' 
                        ? 'bg-gradient-to-r from-teal-650 via-[#0a7e71] to-emerald-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-teal-100/40 font-black' 
                        : 'bg-slate-50/80 hover:bg-teal-50/60 text-slate-700 hover:text-teal-900 border-slate-200/70 hover:border-teal-200 hover:shadow-sm'
                    }`}
                  >
                    <BookOpen className={`w-4 h-4 transition ${adminTab === 'prerequisites' ? 'text-white' : 'text-teal-600'}`} />
                    <span>ቅድመ ሁኔታዎች (Requirements)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('smsGateway')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'smsGateway' 
                        ? 'bg-gradient-to-r from-sky-500 via-blue-550 to-indigo-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-sky-100/40 font-black' 
                        : 'bg-slate-50/80 hover:bg-sky-50/60 text-slate-700 hover:text-sky-900 border-slate-200/70 hover:border-sky-300 hover:shadow-sm'
                    }`}
                  >
                    <Smartphone className={`w-4 h-4 transition ${adminTab === 'smsGateway' ? 'text-white' : 'text-sky-600'}`} />
                    <span>ኤስኤምኤስ (SMS Gateway)</span>
                  </button>
                </div>
              </div>t-[9px] border border-emerald-100 font-black animate-pulse">
                                ለመረከብ ዝግጁ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 text-[10px]">
                          በማውጫው ውስጥ ምንም መረጃ የለም።
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN STAFF LOGIN PORTAL */}
        {activePortal === 'admin' && !isAdminLoggedIn && (
          <div className="max-w-md mx-auto my-12 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in no-print bg-[#edfafd]/10 animate-fade-in">
            <div className="h-2 bg-gradient-to-r from-teal-850 to-cyan-650"></div>
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-4 bg-teal-50 text-[#0f384c] rounded-2xl border border-teal-100">
                  <Lock className="w-8 h-8 text-teal-855 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-[#0f384c]">የባለሙያ መግቢያ (Staff Login)</h3>
                <p className="text-[10.5px] text-slate-400 font-extrabold max-w-xs mx-auto leading-relaxed">
                  የቦሌ ወረዳ 05 መታወቂያ ዲጂታል ሰነድ ማህደርና አገልግሎት አስተዳደር ውስጥ ለመግባት እባክዎ የይለፍ ቃል ያስገቡ።
                </p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4 font-sans text-xs">
                <div className="space-y-1.5 focus-within:text-teal-800">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    የይለፍ ቃል (Password)
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setLoginError(false);
                      }}
                      className={`w-full p-3 pl-4 pr-10 border rounded-2xl font-mono text-sm focus:ring-2 focus:ring-[#0f405c] focus:outline-none transition-all font-semibold ${loginError ? 'border-rose-450 bg-rose-50 text-rose-900 font-medium' : 'border-slate-200'}`}
                      placeholder="••••••••"
                      autoFocus
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-450">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  {loginError ? (
                    <p className="text-[10px] text-rose-650 font-bold animate-pulse">
                      ⚠️ ያስገቡት የይለፍ ቃል ልክ አይደለም! እባክዎ እንደገና ይሞክሩ።
                    </p>
                  ) : (
                    <p className="text-[9.5px] text-slate-450 font-bold">
                      የባለሙያ የሙከራ የይለፍ ቃል: <code className="bg-slate-100 px-1 py-0.5 rounded font-black font-mono">woreda05</code>
                    </p>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-[#0f384c] hover:bg-[#072433] active:scale-[0.98] text-white font-black py-3 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border border-transparent"
                >
                  <Unlock className="w-4 h-4 text-teal-300" />
                  <span>ግባ (Sign In)</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN STAFF DASHBOARD WORKSPACE */}
        {activePortal === 'admin' && isAdminLoggedIn && (
          <div className="space-y-6">
            {/* Admin Header / Portal Selector & Tabs Panel */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col space-y-4 no-print">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3.5 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-teal-50 text-[#0f384c] rounded-2xl border border-teal-100">
                    <ShieldCheck className="w-6 h-6 text-teal-850" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-[#0f384c] tracking-wide">የወረዳ ባለሙያ አስተዳደር ወለል (Staff Admin Portal)</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">የቦሌ ወረዳ 05 የሲቪል ምዝገባ፣ መታወቂያ ርክክብ እና ሰነዶች መቆጣጠሪያ</p>
                  </div>
                </div>
                
                {/* Full Width / Half Width Toggle of Resident Docs archive */}
                {adminTab === 'residentDocs' && (
                  <button
                    type="button"
                    onClick={() => setIsDocsFullWidth(!isDocsFullWidth)}
                    className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-150 text-[#0f384c] px-3.5 py-2 rounded-xl text-[10.5px] font-black border border-slate-200 transition duration-150 cursor-pointer animate-none"
                  >
                    {isDocsFullWidth ? (
                      <>
                        <Columns className="w-3.5 h-3.5 text-teal-600" />
                        <span>ምዝገባ ፎርም አሳይ (Split Layout)</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>маህደሩን በሙሉ ስክሪን ክፈት (Full Width)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Advanced Admin Navigation Tabs Menu - Organized in exactly two rows with vibrant distinct gradient theme styles */}
              <div className="flex flex-col gap-2.5 no-print w-full">
                {/* Row 1: Core Records & Main Archives */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setAdminTab('residentDocs')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'residentDocs' 
                        ? 'bg-gradient-to-r from-blue-600 via-teal-600 to-teal-500 text-white hover:brightness-105 border-transparent shadow-lg shadow-blue-100/40' 
                        : 'bg-slate-50/80 hover:bg-blue-55/60 text-slate-700 hover:text-blue-900 border-slate-200/70 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <FileText className={`w-4 h-4 transition ${adminTab === 'residentDocs' ? 'text-white' : 'text-blue-600'}`} />
                    <span>ዲጂታል ሰነድ ማህደር (Resident Docs)</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAdminTab('handovers')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'handovers' 
                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-indigo-100/40' 
                        : 'bg-slate-50/80 hover:bg-indigo-55/60 text-slate-700 hover:text-indigo-900 border-slate-200/70 hover:border-indigo-200 hover:shadow-sm'
                    }`}
                  >
                    <FolderClosed className={`w-4 h-4 transition ${adminTab === 'handovers' ? 'text-white' : 'text-indigo-600'}`} />
                    <span>መታወቂያ ርክክብ (Handovers)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('docs')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'docs' 
                        ? 'bg-gradient-to-r from-emerald-600 via-emerald-550 to-teal-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-emerald-100/40' 
                        : 'bg-slate-50/80 hover:bg-emerald-55/60 text-slate-700 hover:text-emerald-900 border-slate-200/70 hover:border-emerald-200 hover:shadow-sm'
                    }`}
                  >
                    <Layers className={`w-4 h-4 transition ${adminTab === 'docs' ? 'text-white' : 'text-emerald-600'}`} />
                    <span>አጠቃላይ ሰነዶች (Docs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('form010')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'form010' 
                        ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white hover:brightness-105 border-transparent shadow-lg shadow-orange-100/40' 
                        : 'bg-slate-50/80 hover:bg-orange-55/60 text-slate-700 hover:text-orange-900 border-slate-200/70 hover:border-orange-200 hover:shadow-sm'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 transition ${adminTab === 'form010' ? 'text-white' : 'text-orange-550'}`} />
                    <span>ፎርም 010 (Form 010)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('form011')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'form011' 
                        ? 'bg-gradient-to-r from-rose-500 via-rose-500 to-pink-500 text-white hover:brightness-105 border-transparent shadow-lg shadow-rose-100/40' 
                        : 'bg-slate-50/80 hover:bg-rose-55/60 text-slate-700 hover:text-rose-900 border-slate-200/70 hover:border-rose-200 hover:shadow-sm'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 transition ${adminTab === 'form011' ? 'text-white' : 'text-rose-600'}`} />
                    <span>ፎርም 011 (Form 011)</span>
                  </button>
                </div>

                {/* Row 2: Secondary Administration & Settings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setAdminTab('form012')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'form012' 
                        ? 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-605 text-white hover:brightness-105 border-transparent shadow-lg shadow-fuchsia-100/40' 
                        : 'bg-slate-50/80 hover:bg-fuchsia-55/60 text-slate-700 hover:text-fuchsia-900 border-slate-200/70 hover:border-fuchsia-200 hover:shadow-sm'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 transition ${adminTab === 'form012' ? 'text-white' : 'text-fuchsia-600'}`} />
                    <span>ፎርም 012 (Form 012)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('security')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'security' 
                        ? 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white hover:brightness-105 border-transparent shadow-lg shadow-slate-300/40' 
                        : 'bg-slate-50/80 hover:bg-slate-150 text-slate-700 hover:text-slate-900 border-slate-200/70 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <Fingerprint className={`w-4 h-4 transition ${adminTab === 'security' ? 'text-white' : 'text-slate-600'}`} />
                    <span>ደህንነት (Security)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('prerequisites')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'prerequisites' 
                        ? 'bg-gradient-to-r from-teal-650 via-[#0a7e71] to-emerald-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-teal-100/40' 
                        : 'bg-slate-50/80 hover:bg-teal-55/60 text-slate-700 hover:text-teal-900 border-slate-200/70 hover:border-teal-200 hover:shadow-sm'
                    }`}
                  >
                    <BookOpen className={`w-4 h-4 transition ${adminTab === 'prerequisites' ? 'text-white' : 'text-teal-600'}`} />
                    <span>ቅድመ ሁኔታዎች (Requirements)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('smsGateway')}
                    className={`flex items-center justify-center space-x-2 py-3 px-3.5 rounded-2xl text-[11px] font-black leading-none tracking-wide transition-all duration-200 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] border select-none ${
                      adminTab === 'smsGateway' 
                        ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 text-white hover:brightness-105 border-transparent shadow-lg shadow-sky-100/40' 
                        : 'bg-slate-50/80 hover:bg-sky-55/60 text-slate-700 hover:text-sky-900 border-slate-200/70 hover:border-sky-305 hover:shadow-sm'
                    }`}
                  >
                    <Smartphone className={`w-4 h-4 transition ${adminTab === 'smsGateway' ? 'text-white' : 'text-sky-600'}`} />
                    <span>ኤስኤምኤስ (SMS Gateway)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* active tab panel wrapper */}
            {adminTab === 'residentDocs' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Upload & Resident Registry Form */}
                {!isDocsFullWidth && (
                  <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print">
                    <h3 className="text-xs font-extrabold text-[#0f405c] border-b pb-2 flex items-center">
                      <Plus className="w-4 h-4 mr-1 text-teal-600" /> አዲስ የቤት ዲጂታል ማህደር መመዝገቢያ
                    </h3>
                    
                    <form onSubmit={handleUploadResidentDoc} className="space-y-3.5 text-xs">
                      {/* Name in Amharic & English */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-600">የቤት ባለቤት/ወኪል ሙሉ ስም</label>
                        <input 
                          type="text" 
                          required
                          value={resDocResidentName}
                          onChange={(e) => {
                            setResDocResidentName(e.target.value);
                            setResDocHouseOwnerName(e.target.value);
                          }}
                          placeholder="ሰለሞን አስቴር ወልደማርያም..."
                          className="w-full p-2.5 border border-slate-200 rounded-xl leading-none text-[11px] font-sans font-bold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        />
                      </div>

                      {/* House number and Doc Reference ID */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-600">ቤት ቁጥር (House No.)</label>
                          <input 
                            type="text" 
                            required
                            value={resDocHouseNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              setResDocHouseNumber(val);
                              
                              if (val.trim()) {
                                const matched = idInventory.filter(item => 
                                  item.houseNumber && item.houseNumber.trim().toLowerCase() === val.trim().toLowerCase()
                                );
                                if (matched.length > 0) {
                                  const autoMembers = matched.map(inv => ({
                                    id: 'memb_inv_' + inv.id + '_' + Date.now(),
                                    fullName: inv.name.trim(),
                                    role: 'ቤተሰብ' as const,
                                    idNumber: inv.idNumber || undefined
                                  }));
                                  setResDocMembers(prev => {
                                    const customMembers = prev.filter(m => !m.id.startsWith('memb_inv_'));
                                    const finalM = [...customMembers];
                                    autoMembers.forEach(am => {
                                      if (!finalM.some(m => m.fullName.toLowerCase() === am.fullName.toLowerCase())) {
                                        finalM.push(am);
                                      }
                                    });
                                    return finalM;
                                  });
                                } else {
                                  setResDocMembers(prev => prev.filter(m => !m.id.startsWith('memb_inv_')));
                                }
                              } else {
                                setResDocMembers(prev => prev.filter(m => !m.id.startsWith('memb_inv_')));
                              }
                            }}
                            placeholder="አዲስ-05-999..."
                            className="w-full p-2.5 border border-slate-200 rounded-xl leading-none text-[11.5px] font-mono font-bold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-600">ሰነድ መለያ (Doc ID/No.)</label>
                          <input 
                            type="text" 
                            value={resDocIdNumber}
                            onChange={(e) => setResDocIdNumber(e.target.value)}
                            placeholder="W05/98765"
                            className="w-full p-2.5 border border-slate-200 rounded-xl leading-none text-[11.5px] font-mono font-bold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Scanned upload box */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-600">የተቃኙ ፋይሎች ጭን (Scan Upload)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div 
                            onClick={() => document.getElementById('residentScannedFileInput')?.click()}
                            className={`border-2 border-dashed rounded-2xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1 relative min-h-[95px] ${resDocUploadedFiles.length > 0 ? 'border-teal-500 bg-teal-50/10' : 'border-slate-200 hover:border-teal-500 hover:bg-[#0f405c]/5'}`}
                          >
                            <input 
                              type="file" 
                              id="residentScannedFileInput" 
                              multiple
                              accept="application/pdf,image/*"
                              onChange={handleDocFileChange}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileSpreadsheet className="w-5 h-5 text-teal-600 mx-auto" />
                            <p className="font-extrabold text-[#0f384c] text-[10px]">ፒዲኤፍ ወይም ምስሎች ይጫኑ</p>
                            <span className="text-[7.5px] text-slate-400 block leading-tight font-medium">የተበታተኑ ፋይሎች (ገጾች) ለመጨመር</span>
                          </div>

                          <div 
                            onClick={() => document.getElementById('residentFolderInput')?.click()}
                            className="border-2 border-dashed border-amber-200 rounded-2xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10 min-h-[95px]"
                          >
                            <input 
                              type="file" 
                              id="residentFolderInput" 
                              multiple
                              {...({ webkitdirectory: "", directory: "" } as any)}
                              onChange={handleFolderUpload}
                              className="hidden" 
                            />
                            <FolderClosed className="w-5 h-5 text-amber-600 mx-auto animate-pulse" />
                            <p className="font-extrabold text-[#0f384c] text-[10px]">📁 ሙሉ ፎልደር በአንድ ላይ ጫን</p>
                            <span className="text-[7px] text-amber-800/85 block leading-tight font-sans font-bold">
                              የቤት ቁጥር እና ስም ከፎልደሩ ስም በራስ-ሰር ፈልጎ ይገጥማል!
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Draft Scanned Files Preview List */}
                      {resDocUploadedFiles.length > 0 && (
                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60 space-y-1.5 font-sans">
                          <div className="flex justify-between items-center text-[9.5px] font-bold text-[#0f405c]">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                              <span>የተጫኑ የተቃኙ ገጾች (${resDocUploadedFiles.length})</span>
                            </span>
                            <button 
                              type="button" 
                              onClick={() => setResDocUploadedFiles([])}
                              className="text-[8.5px] text-rose-600 hover:underline cursor-pointer"
                            >
                              ሁሉንም ሰርዝ
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-0.5 scrollbar-thin font-sans">
                            {resDocUploadedFiles.map((file, idx) => (
                              <div key={file.id || idx} className="flex justify-between items-center p-1.5 bg-white border border-slate-150 rounded-xl text-[9.5px]">
                                <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                                  <span className="text-[8px] font-black text-slate-400 font-sans shrink-0">ገጽ {idx + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-sans font-bold text-[#0f384c] truncate" title={file.fileName}>{file.fileName}</p>
                                    <p className="text-[7.5px] font-mono text-slate-450">መጠን፦ {file.fileSize}</p>
                                  </div>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => setResDocUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                                  className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition shrink-0 cursor-pointer"
                                  title="ገጽ አስወግድ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Household Members Registration Zone */}
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9.5px] uppercase font-bold text-[#0f405c] flex items-center gap-1">
                            <Fingerprint className="w-3.5 h-3.5 text-teal-600" />
                            <span>አብረው የሚኖሩ የቤት አባላት / ነዋሪዎች (${resDocMembers.length})</span>
                          </span>
                          {resDocMembers.length > 0 && (
                            <button 
                              type="button" 
                              onClick={() => setResDocMembers([])}
                              className="text-[8.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              አጽዳ
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 bg-white p-2 rounded-xl border border-slate-150">
                          <input 
                            type="text" 
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            placeholder="የነዋሪው ሙሉ ስም (Family/Tenant Full Name)"
                            className="w-full p-2 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                          
                          <div className="grid grid-cols-2 gap-1.5">
                            <select 
                              value={newMemberRole}
                              onChange={(e) => setNewMemberRole(e.target.value as any)}
                              className="p-1.5 border border-slate-200 rounded-lg text-[9.5px] font-bold bg-slate-50 focus:outline-none font-sans"
                            >
                              <option value="ቤተሰብ">ቤተሰብ (Family Member)</option>
                              <option value="የቤት ባለቤት">የቤት ባለቤት (Homeowner)</option>
                              <option value="ተከራይ">ተከራይ (Tenant)</option>
                              <option value="ሌላ">ሌላ (Other / Visitor)</option>
                            </select>
                            
                            <input 
                              type="text" 
                              value={newMemberId}
                              onChange={(e) => setNewMemberId(e.target.value)}
                              placeholder="መታወቂያ ቁጥር (Optional ID)"
                              className="p-1.5 border border-slate-200 rounded-lg text-[9.5px] font-mono focus:outline-none"
                            />
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              if (!newMemberName.trim()) {
                                alert("እባክዎ የቤተሰቡን/ነዋሪውን ሙሉ ስም ያስገቡ!");
                                return;
                              }
                              const newMB = {
                                id: 'memb_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                                fullName: newMemberName.trim(),
                                role: newMemberRole,
                                idNumber: newMemberId.trim() || undefined
                              };
                              setResDocMembers(prev => [...prev, newMB]);
                              setNewMemberName('');
                              setNewMemberId('');
                            }}
                            className="w-full bg-[#0f405c] hover:bg-[#072436] text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-teal-300" />
                            <span>+ ነዋሪ ዝርዝር ውስጥ አስገባ</span>
                          </button>
                        </div>

                        {resDocMembers.length > 0 ? (
                          <div className="max-h-[105px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                            {resDocMembers.map((m, idx) => {
                              let badgeStyle = "bg-sky-50 text-sky-850 border-sky-100";
                              if (m.role === 'የቤት ባለቤት') badgeStyle = "bg-blue-50 text-blue-900 border-blue-150";
                              else if (m.role === 'ተከራይ') badgeStyle = "bg-amber-50 text-amber-900 border-amber-150";
                              else if (m.role === 'ሌላ') badgeStyle = "bg-purple-50 text-purple-900 border-purple-150";

                              return (
                                <div key={m.id || idx} className="flex justify-between items-center p-1.5 bg-white border rounded-lg text-[9.5px] gap-2">
                                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-sans font-medium text-[8px] shrink-0">{idx + 1}.</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-sans font-extrabold text-[#0f384c] truncate">{m.fullName}</p>
                                      {m.idNumber && <p className="text-[7.5px] font-mono text-[#004e76]">{m.idNumber}</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[7.5px] px-1.5 py-0.5 rounded border font-bold ${badgeStyle}`}>
                                      {m.role}
                                    </span>
                                    <button 
                                      type="button" 
                                      onClick={() => setResDocMembers(prev => prev.filter(item => item.id !== m.id))}
                                      className="text-rose-500 hover:text-rose-750 p-0.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[8.5px] text-slate-400 italic text-center py-1 font-bold">
                            ቤተሰቦችን ከመታወቂያ ርክክብ በቤት ቁጥር ለማገናኘት ከዚህ በታች ያሉትን ፈጣን ማመሳሰያዎች ይጠቀሙ።
                          </p>
                        )}

                        {/* ID Inventory Cross-Reference auto matching indicator */}
                        {resDocHouseNumber.trim() !== '' && (() => {
                          const matchingInventory = idInventory.filter(item => 
                            item.houseNumber && item.houseNumber.trim().toLowerCase() === resDocHouseNumber.trim().toLowerCase()
                          );
                          const unaddedMatching = matchingInventory.filter(inv => 
                            !resDocMembers.some(m => m.fullName.toLowerCase() === inv.name.trim().toLowerCase())
                          );
                          if (unaddedMatching.length === 0) return null;

                          return (
                            <div className="p-2 bg-amber-50/75 border border-amber-200/85 rounded-xl space-y-1.5">
                              <span className="text-[8.5px] text-amber-955 font-black flex items-center gap-1">
                                🎁 ከተመዘገበው የቤት ቁጥር ጋር የሚዛመዱ ${unaddedMatching.length} መታወቂያዎች በእጅ ይገኛሉ፦
                              </span>
                              <div className="flex flex-wrap gap-1 leading-none">
                                {unaddedMatching.map(inv => (
                                  <button
                                    type="button"
                                    key={inv.id}
                                    onClick={() => {
                                      const newMB = {
                                        id: 'memb_inv_' + inv.id + '_' + Date.now(),
                                        fullName: inv.name.trim(),
                                        role: 'ቤተሰብ',
                                        idNumber: inv.idNumber || undefined
                                      };
                                      setResDocMembers(prev => [...prev, newMB]);
                                    }}
                                    className="inline-flex items-center space-x-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-sans font-bold text-[8.5px] px-1.5 py-0.5 rounded transition cursor-pointer"
                                    title="ይህንን አባል ወደ ዝርዝሩ አስገባ"
                                  >
                                    <span>+ ${inv.name}</span>
                                    {inv.idNumber && <span className="opacity-60 text-[7px] font-mono">(${inv.idNumber})</span>}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newMembers = [];
                                    unaddedMatching.forEach(inv => {
                                      const newMB = {
                                        id: 'memb_inv_' + inv.id + '_' + Date.now(),
                                        fullName: inv.name.trim(),
                                        role: 'ቤተሰብ',
                                        idNumber: inv.idNumber || undefined
                                      };
                                      newMembers.push(newMB);
                                    });
                                    setResDocMembers(prev => [...prev, ...newMembers]);
                                  }}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-[8px] px-1.5 py-0.5 rounded transition cursor-pointer shrink-0"
                                >
                                  ✓ ሁሉንም አክል (Add All)
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Brief Notes */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-650">ማስታወሻ / ማብራሪያ (Notes)</label>
                        <textarea 
                          value={resDocNotes}
                          onChange={(e) => setResDocNotes(e.target.value)}
                          placeholder="ስለ ሰነዱ ማብራሪያ ካለ..."
                          className="w-full p-2 border rounded-xl h-11 resize-none text-[10.5px] focus:ring-1 focus:ring-teal-600 focus:outline-none placeholder-slate-350 font-sans"
                        />
                      </div>

                      {/* Submit Button */}
                      <button 
                        type="submit" 
                        disabled={isUploadingDoc}
                        className="w-full bg-[#0f405c] hover:bg-[#072436] disabled:bg-slate-300 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-2 animate-none cursor-pointer"
                      >
                        {isUploadingDoc ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>እባክዎ ይጠብቁ (Uploading File...)</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-teal-300" />
                            <span>ሰነዱን ወደ ዲጂታል ማህደር አስቀምጥ</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
                

                {/* Right: Resident documents list/archive */}
                <div className={`${isDocsFullWidth ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col space-y-4`}>
                  {/* Title & Stats block */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#0f405c] flex items-center gap-1.5 pt-1">
                        <FileText className="w-4 h-4 text-teal-600" /> 
                        <span>የተቃኙ የነዋሪዎች ዲጂታል ሰነዶች ማህደር</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">በኮምፒውተርዎ ላይ የነበሩ የተቃኙ ፋይሎችን በመስቀል ከየትኛውም ቦታ በድረ-ገጽ (Online) ያግኙ!</p>
                    </div>
                    <div className="bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100 text-right leading-none sm:self-end">
                      <span className="text-[8px] text-teal-700 block uppercase font-bold tracking-wide">ጠቅላላ የተቀመጡ ሰነዶች</span>
                      <strong className="text-sm font-black text-[#0f405c] mt-0.5 inline-block">{residentDocs.length} ፋይሎች</strong>
                    </div>
                  </div>

                  {/* Filters block */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                    <div className="md:col-span-7 relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        placeholder="በነዋሪ ስም፣ በምዝገባ/ቤት ቁጥር ወይም በፋይል ስም ይፈልጉ..."
                        className="w-full bg-white pl-9 pr-4 py-2 border rounded-xl text-xs font-bold font-sans focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-5 flex gap-1.5">
                      <select 
                        value={selectedDocFilterType} 
                        onChange={(e) => setSelectedDocFilterType(e.target.value)}
                        className="w-full bg-white p-2 border rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="all">🔍 ሁሉንም ዓይነቶች አሳይ (All)</option>
                        <option value="የነዋሪነት ማስረጃ">የነዋሪነት ማስረጃ</option>
                        <option value="የልደት ሰርተፍኬት">የልደት ሰርተፍኬት</option>
                        <option value="የጋብቻ ሰርተፍኬት">የጋብቻ ሰርተፍኬት</option>
                        <option value="የቤት ውል ሰነድ">የቤት ውል ሰነድ</option>
                        <option value="የሞት ሰርተፍኬት">የሞት ሰርተፍኬት</option>
                        <option value="ሌላ አስፈላጊ ሰነድ">ሌላ አስፈላጊ ሰነድ</option>
                      </select>
                      {docSearchQuery || selectedDocFilterType !== 'all' ? (
                        <button 
                          onClick={() => {
                            setDocSearchQuery('');
                            setSelectedDocFilterType('all');
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2.5 rounded-xl text-xs font-black transition active:scale-95"
                          title="ማጣሪያዎችን አጽዳ"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Document Grid / List */}
                  <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 scrollbar-thin">
                    {(() => {
                      const listToShow = residentDocs.filter(d => {
                        const q = docSearchQuery.toLowerCase().trim();
                        if (q) {
                          const nameVal = d.houseOwnerName || d.residentName || "";
                          const matchName = nameVal.toLowerCase().includes(q);
                          const matchId = d.idNumber && d.idNumber.toLowerCase().includes(q);
                          const matchHouse = d.houseNumber && d.houseNumber.toLowerCase().includes(q);
                          const fileVal = d.fileName || (d.files && d.files[0]?.fileName) || "";
                          const matchFile = fileVal.toLowerCase().includes(q);
                          const matchNotes = d.notes && d.notes.toLowerCase().includes(q);
                          const matchMembers = d.members && d.members.some(m => m.fullName.toLowerCase().includes(q));
                          if (!matchName && !matchId && !matchHouse && !matchFile && !matchNotes && !matchMembers) return false;
                        }
                        if (selectedDocFilterType !== 'all') {
                          if (d.docType !== selectedDocFilterType) return false;
                        }
                        return true;
                      });

                      if (listToShow.length === 0) {
                        return (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2">
                            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-xs font-extrabold text-slate-500">ማህደሩ ውስጥ ምንም ዓይነት ሰነድ አልተገኘም!</p>
                            <p className="text-[10px] text-slate-400 font-medium">የሰነዶቹን ስም ወይም ማጣሪያዎች በትክክል መጻፋቸውን ያረጋግጡ።</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2 pb-5">
                          {listToShow.map((docItem) => {
                            // Badge colors
                            let badgeClass = "bg-sky-50 text-sky-800 border-sky-100";
                            if (docItem.docType === "የልደት ሰርተፍኬት") badgeClass = "bg-amber-50 text-amber-800 border-amber-100";
                            else if (docItem.docType === "የጋብቻ ሰርተፍኬት") badgeClass = "bg-pink-50 text-pink-700 border-pink-100";
                            else if (docItem.docType === "የቤት ውል ሰነድ") badgeClass = "bg-purple-50 text-purple-800 border-purple-100";
                            else if (docItem.docType === "የሞት ሰርተፍኬት") badgeClass = "bg-rose-50 text-rose-800 border-rose-100";

                            return (
                              <div 
                                key={docItem.id}
                                className="group flex flex-col md:flex-row justify-between items-start md:items-center p-3.5 bg-white hover:bg-slate-50/70 border border-slate-150 rounded-2xl transition hover:shadow-xs gap-3"
                              >
                                {/* Left Side: Details of Resident & Doc */}
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-xs font-extrabold text-[#0f384c] truncate">{docItem.houseOwnerName || docItem.residentName || "አልታወቀም"}</h4>
                                    <span className={`text-[8.5px] font-black tracking-wide px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                      {docItem.docType}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-medium">
                                    {docItem.idNumber && (
                                      <span>ምዝገባ #: <strong className="font-mono text-slate-800 font-bold">{docItem.idNumber}</strong></span>
                                    )}
                                    {docItem.houseNumber && (
                                      <span>ቤት ቁጥር: <strong className="font-mono text-slate-800 font-bold">{docItem.houseNumber}</strong></span>
                                    )}
                                    <span className="text-slate-400 font-sans">{docItem.uploadDate}</span>
                                  </div>

                                  {/* Scanned Filename detail */}
                                  <div className="flex flex-wrap gap-1.5 mt-1 font-sans">
                                    <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150 flex items-center space-x-1.5 w-fit max-w-full text-[9px] text-slate-600">
                                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                                      <span className="font-sans truncate font-bold max-w-[200px]">{docItem.fileName || (docItem.files && docItem.files[0]?.fileName) || "የተቃኘ ሰነድ.pdf"}</span>
                                      <span className="font-mono text-[8px] px-1 bg-slate-200 text-slate-600 rounded shrink-0">{docItem.fileSize || (docItem.files && docItem.files[0]?.fileSize) || "ወ/0"}</span>
                                    </div>
                                    {docItem.files && docItem.files.length > 1 && (
                                      <span className="bg-teal-50 border border-teal-100 text-[#0f405c] px-2 py-1 rounded-lg text-[9px] font-black font-sans">
                                        📄 +{docItem.files.length - 1} ተጨማሪ የተቃኙ ገጾች
                                      </span>
                                    )}
                                    {docItem.members && docItem.members.length > 0 && (
                                      <span className="bg-slate-105 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-[9px] font-black font-sans">
                                        👥 {docItem.members.length} ነዋሪዎች ምዝገባ
                                      </span>
                                    )}
                                  </div>

                                  {docItem.notes && (
                                    <p className="text-[9.5px] text-slate-500 italic font-medium max-w-xl truncate mt-1">
                                      📝 ማስታወሻ: {docItem.notes}
                                    </p>
                                  )}
                                </div>

                                {/* Right Side: Actions (Open modal or delete) */}
                                <div className="flex items-center space-x-1.5 shrink-0 sm:self-end md:self-auto no-print">
                                  <button
                                    onClick={() => setSelectedViewDoc(docItem)}
                                    className="p-2 text-[#0f405c] hover:bg-[#0f405c]/10 border border-[#0f405c]/20 bg-[#0f405c]/5 rounded-xl flex items-center space-x-1.5 transition active:scale-95 text-[10px] font-black font-sans"
                                    title="ሰነዱን በቀጥታ ኮምፒውተርዎ ላይ አሳይ (View Scanned PDF/Image)"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>ቢሮ ውስጥ ክፈት</span>
                                  </button>

                                  <a
                                    href={docItem.contentUrl}
                                    download={docItem.fileName}
                                    className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 bg-slate-50 rounded-xl flex items-center transition active:scale-95"
                                    title="ሰነዱን ወደ ኮምፒውተር ይጫኑ (Download Scanned File)"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>

                                  <button
                                    onClick={() => handleDeleteResidentDoc(docItem.id, docItem.residentName)}
                                    className="p-2 text-rose-600 hover:text-white hover:bg-rose-600 hover:border-transparent border border-rose-100 bg-rose-50/50 rounded-xl flex items-center transition active:scale-95"
                                    title="ሰነዱን ከማህደር ላይ ሰርዝ (Delete from Archive)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* A. ID HANDOVERS PANEL */}
            {adminTab === 'handovers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
                {/* Left Form: Add new ready printed ID */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                  <h3 className="text-xs font-extrabold text-teal-950 border-b pb-2 flex items-center">
                    <Plus className="w-4 h-4 mr-1 text-teal-600" /> ታትሞ የደረሰ መታወቂያ መመዝገቢያ
                  </h3>
                  
                  <form onSubmit={handleAddNewID} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">የተገልጋይ ሙሉ ስም</label>
                      <input 
                        type="text" 
                        value={newIdName}
                        onChange={(e) => setNewIdName(e.target.value)}
                        placeholder="ለምሳሌ፡ ዮናስ ታደሰ ይመኑ"
                        className="w-full p-2.5 border rounded-lg focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        ስልክ ቁጥር <span className="text-red-500 font-extrabold">* (የግዴታ - ለ SMS መላኪያ)</span>
                      </label>
                      <input 
                        type="tel" 
                        value={newIdPhone}
                        onChange={(e) => setNewIdPhone(e.target.value)}
                        placeholder="09xxxxxxxx ወይም 07xxxxxxxx"
                        className="w-full p-2.5 border rounded-lg focus:ring-1 focus:ring-teal-600 focus:outline-none font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">የመታወቂያ ቁጥር (10-12 ዲጂት)</label>
                      <input 
                        type="text" 
                        value={newIdNum}
                        onChange={(e) => setNewIdNum(e.target.value)}
                        placeholder="AA0000454117"
                        className="w-full p-2.5 border rounded-lg focus:ring-1 focus:ring-teal-600 focus:outline-none uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">የቤት ቁጥር</label>
                      <input 
                        type="text" 
                        value={newIdHouse}
                        onChange={(e) => setNewIdHouse(e.target.value)}
                        placeholder="415/ሀ"
                        className="w-full p-2.5 border rounded-lg focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        required
                      />
                    </div>
                     <div className="bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-100/70 text-[9px] font-bold leading-relaxed space-y-1">
                       <span className="text-[10px]">💡 <strong>ማሳሰቢያ (Notice):</strong></span>
                       <p className="font-extrabold text-[#78350f]">መታወቂያው እዚህ ሲመዘገብ ለተገልጋዩ "የቦሌ ወረዳ 05 የነዋሪነት መታወቂያዎ ስለደረሰ በአስቸኳይ መጥተው ይውሰዱ" የሚል አፋጣኝ የአጭር መልዕክት (SMS) ጥሪ በስልካቸው ላይ ይደርሳቸዋል። ይህም በመስሪያ ቤቱ ውስጥ የሚፈጠረውን የመታወቂያ ክምችት ይቀንሳል።</p>
                     </div>
                     
                     <div className="space-y-2 pt-1 font-sans">
                       <button 
                         type="button" 
                         onClick={() => performIDRegistration(true)}
                         className="w-full bg-teal-800 hover:bg-teal-900 border border-teal-700 text-white font-black py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
                       >
                         <Send className="w-4 h-4 text-teal-300 animate-pulse" />
                         <span>መዝግብና ወዲያውኑ SMS ላክ (Register & Send SMS)</span>
                       </button>

                       <button 
                         type="button" 
                         onClick={() => performIDRegistration(false)}
                         className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-extrabold py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
                       >
                         <FileText className="w-3.5 h-3.5 text-slate-500" />
                         <span>መረጃውን ብቻ መዝግብ (SMS ሳትልክ አስቀምጥ)</span>
                       </button>
                       <p className="text-[9px] text-slate-400 font-semibold text-center leading-relaxed">ኤስኤምኤስ በኋላ ለመላክ "መረጃውን ብቻ መዝግብ" የሚለውን ይጫኑ።</p>
                     </div>
                  </form>
                </div>

                {/* Right: Existing Inventory list & trigger delivery */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-extrabold text-teal-950">የመታወቂያዎች ርክክብ መቆጣጠሪያ ሰንጠረዥ</h3>
                      <p className="text-[9px] text-slate-400 font-semibold">የተረከቡና በእጅ የቀሩ መታወቂያዎች መከታተያ</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => setSmsPendingFilter(!smsPendingFilter)}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer focus:outline-none border ${smsPendingFilter ? 'bg-amber-600 border-amber-500 text-white shadow-amber-100' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'}`}
                        title="መልዕክት ያልተላከላቸውን ብቻ ለማሳየት ይጫኑ"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                        <span>{smsPendingFilter ? 'ያልተላከላቸው ብቻ (የበራ)' : 'ያልተላከላቸው ብቻ'}</span>
                      </button>

                      <button 
                        onClick={exportDeliveredIDsToExcel} 
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black rounded-lg transition shadow-sm flex items-center gap-1 cursor-pointer focus:outline-none border border-emerald-600"
                        title="የወሰዱ መታወቂያዎችን ሪፖርት በ Excel ያውርዱ"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> <span>🟢 የወሰዱ ብቻ (Excel)</span>
                      </button>
                      <input 
                        type="text"
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        placeholder="በስም ወይም መለያ ፈልግ..."
                        className="p-1.5 border border-slate-200 rounded-lg text-[10px] w-full sm:w-40 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-slate-50 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px] min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-500 font-semibold text-[10px]">
                          <th className="p-2.5 text-left">ሙሉ ስም (Full Name)</th>
                          <th className="p-2.5">መታወቂያ ቁጥር</th>
                          <th className="p-2.5">የቤት ቁጥር</th>
                          <th className="p-2.5">ስልክ ቁጥር</th>
                          <th className="p-2.5">ሁኔታ</th>
                          <th className="p-2.5 text-right">ድርጊት</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700">
                        {filteredAdminInventory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-left font-bold text-slate-900">{item.name}</td>
                            <td className="p-2.5 font-mono text-slate-500">{item.idNumber}</td>
                            <td className="p-2.5">{item.houseNumber}</td>
                            <td className="p-2.5 text-slate-500">{item.phone}</td>
                            <td className="p-2.5">
                              {item.status === 'የወሰደ' ? (
                                <span className="inline-block px-2 py-0.5 text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl">
                                  የወሰደ ({item.pickupDate})
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="inline-block px-2 py-0.5 text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-xl">
                                    ለመረከብ ዝግጁ
                                  </span>
                                  {item.smsSent && (
                                    <span className="inline-block px-1.5 py-0.5 text-[7px] font-extrabold bg-cyan-100 text-cyan-800 rounded animate-pulse" title={`SMS ተልኳል: ${item.smsSentDate}`}>
                                      ✉️ SMS ተልኳል
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                              {item.status === 'ለመረከብ ዝግጁ' ? (
                                <>
                                  <button 
                                    onClick={() => openHandoverModal(item.id)}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-2 py-1 rounded text-[9px] shadow-sm tracking-wide mr-1"
                                  >
                                    ርክክብ ፈጽም
                                  </button>
                                  <button 
                                    onClick={() => openSmsModal(item)}
                                    className={`px-2 py-1 rounded text-[9px] shadow-sm tracking-wide font-extrabold ${item.smsSent ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                                    title="ለነዋሪው በ SMS መታወቂያው መዘጋጀቱን አሳውቅ"
                                  >
                                    ✉️ SMS {item.smsSent ? 'ድገም' : 'ላክ'}
                                  </button>
                                </>
                              ) : item.pickupSignature ? (
                                <img src={item.pickupSignature} className="h-5 inline-block border bg-white rounded" alt="Sig" />
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">ፊርማ የለም</span>
                              )}
                              <button 
                                onClick={() => deleteIDRecord(item.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* B. OFFICIAL CORRESPONDENCE / DOCUMENT HUB */}
            {adminTab === 'docs' && (
              <div className="space-y-6">
                
                {/* Selector Header Strip and Excel report exports */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
                  <div className="max-w-md w-full space-y-1">
                    <label className="block text-xs font-bold text-teal-950">የሚሰራውን የሰነድ ወይም የደብዳቤ አይነት ይምረጡ</label>
                    <select 
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
                      className="w-full p-2.5 border-2 border-teal-600 rounded-xl text-xs bg-white font-bold text-teal-900 focus:outline-none"
                    >
                      <option value={DocumentType.RECOMMENDATION}>1. የመሸኛ አገልግሎት መጠየቂያ ቅጽ (Recommendation)</option>
                      <option value={DocumentType.RESIDENCY}>2. የነዋሪነት ማረጋገጫ ደብዳቤ (Residency Letter)</option>
                      <option value={DocumentType.LIFE_STATUS}>3. በሕይወት የመኖር ማረጋገጫ ደብዳቤ (Life Status)</option>
                    </select>
                  </div>

                  {/* Built-in quick summary reporter */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border">
                    <span className="text-[10px] font-bold text-slate-600">ሪፖርት ማጠቃለያ:</span>
                    <select 
                      value={selectedReportPeriod}
                      onChange={(e) => setSelectedReportPeriod(e.target.value as any)}
                      className="p-1 border border-slate-200 rounded text-[10px] bg-white font-bold"
                    >
                      <option value="daily">የዛሬ ቀን ሪፖርት</option>
                      <option value="weekly">ሳምንታዊ ሪፖርት</option>
                      <option value="monthly">ወርሃዊ ሪፖርት</option>
                    </select>
                    <button 
                      onClick={triggerReport}
                      className="bg-teal-800 hover:bg-teal-900 text-white font-bold px-2 py-1.5 rounded text-[10px] shadow"
                    >
                      ሪፖርት አውጣ
                    </button>
                    <button 
                      onClick={() => exportToCSV('docs')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1.5 rounded text-[10px] shadow flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" /> <span>Excel አውርድ</span>
                    </button>
                  </div>
                </div>

                {/* Display compiled report text */}
                {reportResult && (
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-[11px] font-mono leading-relaxed relative no-print">
                    <button 
                      onClick={() => setReportResult('')}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <pre className="whitespace-pre-wrap text-slate-800">{reportResult}</pre>
                  </div>
                )}

                {/* Forms grid layout: Left inputs form , Right layout letter preview */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Form inputs (no-print) */}
                  <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                    <h4 className="font-extrabold text-teal-950 border-b pb-1">የሰነድ መረጃ ሰሌዳ</h4>
                    
                    <form onSubmit={handleSaveDocument} className="space-y-3">
                      


                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500">መለያ ቁጥር (Ref No)</label>
                          <input 
                            type="text" 
                            value={docInputs.ref}
                            onChange={(e) => handleDocInputChange('ref', e.target.value)}
                            className="w-full p-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500">የቤት ቁጥር</label>
                          <input 
                            type="text" 
                            value={docInputs.house}
                            onChange={(e) => handleDocInputChange('house', e.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="ለምሳሌ፡ 921/ሀ"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">ደብዳቤው የሚላክለት አካል (To Whom)</label>
                        <input 
                          type="text" 
                          value={docInputs.addressedTo}
                          onChange={(e) => handleDocInputChange('addressedTo', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">አመልካች ሙሉ ስም (Name)</label>
                        <input 
                          type="text" 
                          value={docInputs.name}
                          onChange={(e) => handleDocInputChange('name', e.target.value)}
                          className="w-full p-2 border rounded-md"
                          placeholder="ሙሉ ስም ያስገቡ..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-sky-800">የሰነዱ ቀን (Document Date)</label>
                        <input 
                          type="text" 
                          value={docInputs.date !== undefined ? docInputs.date : ethDateNow}
                          onChange={(e) => handleDocInputChange('date', e.target.value)}
                          className="w-full p-2 border rounded-md text-[11px] font-bold text-sky-900 bg-sky-50/50"
                          placeholder="ለምሳሌ፡ 12/ታኅሣሥ/2018 ዓ.ም"
                        />
                      </div>

                      {selectedDocType === DocumentType.RECOMMENDATION && (
                        <>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500">የእናት ሙሉ ስም</label>
                            <input 
                              type="text" 
                              value={docInputs.mother}
                              onChange={(e) => handleDocInputChange('mother', e.target.value)}
                              className="w-full p-2 border rounded-md font-sans"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የትውልድ ዘመን</label>
                              <input 
                                type="text" 
                                value={docInputs.dob}
                                onChange={(e) => handleDocInputChange('dob', e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="ለምሳሌ፡ 14/08/1990"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የጋብቻ ሁኔታ</label>
                              <input 
                                type="text" 
                                value={docInputs.marital}
                                onChange={(e) => handleDocInputChange('marital', e.target.value)}
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">በተወካይ ከሆነ የተወካይ ስም</label>
                              <input 
                                type="text" 
                                value={docInputs.repName}
                                onChange={(e) => handleDocInputChange('repName', e.target.value)}
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የውክልና ቁጥር</label>
                              <input 
                                type="text" 
                                value={docInputs.repPoa}
                                onChange={(e) => handleDocInputChange('repPoa', e.target.value)}
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">ብሔር</label>
                              <input 
                                type="text" 
                                value={docInputs.nation}
                                onChange={(e) => handleDocInputChange('nation', e.target.value)}
                                className="w-full p-1.5 border rounded-md text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">ዜግነት</label>
                              <input 
                                type="text" 
                                value={docInputs.citizenship}
                                onChange={(e) => handleDocInputChange('citizenship', e.target.value)}
                                className="w-full p-1.5 border rounded-md text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የቤት ሁኔታ</label>
                              <input 
                                type="text" 
                                value={docInputs.houseStatus}
                                onChange={(e) => handleDocInputChange('houseStatus', e.target.value)}
                                className="w-full p-1.5 border rounded-md text-[11px]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የትውልድ ቦታ</label>
                              <input 
                                type="text" 
                                value={docInputs.birthRegion}
                                onChange={(e) => handleDocInputChange('birthRegion', e.target.value)}
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">የስራ ሁኔታ</label>
                              <input 
                                type="text" 
                                value={docInputs.employment}
                                onChange={(e) => handleDocInputChange('employment', e.target.value)}
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500">የኖረበት ጊዜ</label>
                            <input 
                              type="text" 
                              value={docInputs.resPeriod}
                              onChange={(e) => handleDocInputChange('resPeriod', e.target.value)}
                              className="w-full p-2 border rounded-md"
                            />
                          </div>
                        </>
                      )}

                      {selectedDocType === DocumentType.RESIDENCY && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500">መኖር የጀመሩበት ዓ/ም</label>
                            <input 
                              type="text" 
                              value={docInputs.fromYear}
                              onChange={(e) => handleDocInputChange('fromYear', e.target.value)}
                              className="w-full p-2 border rounded-md text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500">ነዋሪ የሆኑት እስከ ዓ/ም</label>
                            <input 
                              type="text" 
                              value={docInputs.toYear}
                              onChange={(e) => handleDocInputChange('toYear', e.target.value)}
                              className="w-full p-2 border rounded-md text-center"
                            />
                          </div>
                        </div>
                      )}

                      {selectedDocType === DocumentType.LIFE_STATUS && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">የተወካይ ስም (ወኪል ካለ)</label>
                          <input 
                            type="text" 
                            value={docInputs.representative}
                            onChange={(e) => handleDocInputChange('representative', e.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="የተወካይ ስም ያስገቡ..."
                          />
                        </div>
                      )}

                      <div className="space-y-1 pt-1">
                        <label className="block text-[10px] font-bold text-slate-500">የዕለቱ ባለሙያ ስም</label>
                        <input 
                          type="text" 
                          value={docInputs.staffName}
                          onChange={(e) => handleDocInputChange('staffName', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>

                      <div className="pt-2">
                        <button 
                          type="submit"
                          className="w-full bg-teal-800 hover:bg-teal-900 border border-teal-700 text-white font-extrabold py-2.5 rounded-xl transition shadow flex items-center justify-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ሰነዱን መዝግብና አውጣ</span>
                        </button>
                      </div>

                    </form>
                  </div>

                  {/* Print preview block */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="bg-slate-100 p-2.5 rounded-xl border flex justify-between items-center no-print">
                      <span className="text-[10px] text-slate-600 font-bold flex items-center">
                        <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> ሰነድ የቀጥታ ዕይታ (Live System PDF Layout Editor)
                      </span>
                      <button 
                        onClick={() => window.print()}
                        className="bg-slate-900 hover:bg-black text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] flex items-center space-x-1"
                      >
                        <Printer className="w-3.5 h-3.5" /> <span>አትም (Print Page)</span>
                      </button>
                    </div>

                    {/* Loaded Template Frame */}
                    <div className="shadow-lg border-2 border-stone-300 rounded-2xl overflow-hidden bg-white">
                      <DocumentTemplates 
                        type={selectedDocType}
                        refNum={docInputs.ref}
                        date={docInputs.date || ethDateNow}
                        photoUrl={docPhoto}
                        logo={crrsaLogo}
                        addressedTo={docInputs.addressedTo}
                        name={docInputs.name}
                        mother={docInputs.mother}
                        dob={docInputs.dob}
                        marital={docInputs.marital}
                        repName={docInputs.repName}
                        repPoa={docInputs.repPoa}
                        nation={docInputs.nation}
                        citizenship={docInputs.citizenship}
                        houseStatus={docInputs.houseStatus}
                        subcity={docInputs.subcity}
                        woreda={docInputs.woreda}
                        house={docInputs.house}
                        birthRegion={docInputs.birthRegion}
                        employment={docInputs.employment}
                        resPeriod={docInputs.resPeriod}
                        staffName={docInputs.staffName}
                        fromYear={docInputs.fromYear}
                        toYear={docInputs.toYear}
                        representative={docInputs.representative}
                      />
                    </div>
                  </div>

                </div>

                {/* Secure Repository Archiving Table list */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print mt-6">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h3 className="font-extrabold text-xs text-teal-950">የተመዘገቡ ሰነዶች ማህደር (Generated Documents Registry Bank)</h3>
                      <p className="text-[9px] text-slate-400">በሲስተሙ የተመዘገቡት ጠቅላላ ሰነዶች የወደፊት መረጃ ማረጋገጫ ፋይል። </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px] min-w-[550px]">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-500 font-semibold text-[10px]">
                          <th className="p-2 text-left">የሰነድ ቁጥር (Ref)</th>
                          <th className="p-2">የሰነድ አይነት</th>
                          <th className="p-2">የአመልካች ስም</th>
                          <th className="p-2">የቤት ቁጥር</th>
                          <th className="p-2">የተመዘገበበት ቀን</th>
                          <th className="p-2 text-right">ድርጊት</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700">
                        {generatedDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-teal-800">{doc.ref}</td>
                            <td className="p-2 text-xs text-slate-600">{doc.type}</td>
                            <td className="p-2 font-bold text-slate-900">{doc.name}</td>
                            <td className="p-2">{doc.house}</td>
                            <td className="p-2">{doc.date}</td>
                            <td className="p-2 text-right space-x-1.5 whitespace-nowrap">
                              <button 
                                onClick={() => loadDocToInputs(doc)}
                                className="text-teal-600 hover:text-teal-800 underline text-[10px] font-bold"
                              >
                                እይ/አስተካክል
                              </button>
                              <button 
                                onClick={() => deleteGeneratedDoc(doc.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* C. FORM 010 (የዕለት ህትመት ስርጭት) */}
            {adminTab === 'form010' && (
              <div className="space-y-6">
                
                {/* Search Log Bar */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center no-print text-[11px] font-bold text-teal-950">
                  <div className="flex items-center space-x-1">
                    <span>በኩነት አይነት እይ:</span>
                    <select 
                      value={f10FilterServiceType} 
                      onChange={(e) => setF10FilterServiceType(e.target.value)} 
                      className="p-1 border rounded bg-white text-[10px]"
                    >
                      <option value="all">ሁሉንም አሳይ</option>
                      <option value="ልደት">ልደት</option>
                      <option value="ጋብቻ">ጋብቻ</option>
                      <option value="ፍቺ">ፍቺ</option>
                      <option value="ሞት">ሞት</option>
                      <option value="ጉዲፈቻ">ጉዲፈቻ</option>
                      <option value="ያላገባ">ያላገባ</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በመለያ ፈልግ:</span>
                    <input 
                      type="text" 
                      value={f10FilterSerial}
                      onChange={(e) => setF10FilterSerial(e.target.value)}
                      placeholder="AA-90"
                      className="p-1 border rounded w-28 bg-white uppercase text-[10px]"
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በቀን ፈልግ:</span>
                    <input 
                      type="text" 
                      value={f10FilterDate}
                      onChange={(e) => setF10FilterDate(e.target.value)}
                      placeholder="ቀን/ወር/ዓመት"
                      className="p-1 border rounded w-28 bg-white text-[10px]"
                    />
                    {f10FilterDate && (
                      <button 
                        type="button"
                        onClick={() => setF10FilterDate('')}
                        className="text-red-500 hover:text-red-700 px-0.5 text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={() => setF10FilterDate(ethDateNow)}
                      className={`px-2 py-1 rounded text-[10px] ${f10FilterDate === ethDateNow ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      የዛሬ ብቻ
                    </button>
                    <button 
                      type="button"
                      onClick={() => setF10FilterDate('')}
                      className={`px-2 py-1 rounded text-[10px] ${f10FilterDate === '' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      ሁሉንም አሳይ
                    </button>
                  </div>
                  <button 
                    onClick={() => exportToCSV('f010')}
                    className="ml-auto bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" /> <span>Excel (ቅጽ 010) አውርድ</span>
                  </button>
                </div>

                {/* Form Inputs (010) - no print */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                  <h3 className="font-extrabold text-teal-950 border-b pb-2">ቅጽ 010 - የዕለት ህትመት ስርጭት መረጃ ማስገቢያ</h3>
                  <form onSubmit={handleAddForm010} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት አይነት</label>
                      <select 
                        value={f10PrintType} 
                        onChange={(e) => setF10PrintType(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                      >
                        <option>ልደት ምስክር ወረቀት</option>
                        <option>ጋብቻ ምስክር ወረቀት</option>
                        <option>ፍቺ ምስክር ወረቀት</option>
                        <option>ሞት ምስክር ወረቀት</option>
                        <option>ጉዲፈቻ ምስክር ወረቀት</option>
                        <option>ያላገባ ምስክር ወረቀት</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ብዛት (በቁጥር)</label>
                      <input 
                        type="number" 
                        value={f10Qty} 
                        onChange={(e) => setF10Qty(parseInt(e.target.value) || 1)} 
                        className="w-full p-2 border rounded-md"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት ዘዴ</label>
                      <select 
                        value={f10Method} 
                        onChange={(e) => setF10Method(e.target.value as any)} 
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="ሲስተም">በሲስተም (System)</option>
                        <option value="ማኑዋል">በማኑዋል (Manual)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ሴሪያል ቁጥር (ከ)</label>
                      <input 
                        type="text" 
                        value={f10From} 
                        onChange={(e) => setF10From(e.target.value)} 
                        placeholder="AA001" 
                        className="w-full p-2 border rounded-md uppercase"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ሴሪያል ቁጥር (እስከ)</label>
                      <input 
                        type="text" 
                        value={f10To} 
                        onChange={(e) => setF10To(e.target.value)} 
                        placeholder="AA100" 
                        className="w-full p-2 border rounded-md uppercase"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-teal-800 mb-1">ርክክብ ቀን (ኢትዮጵያ አቆጣጠር)</label>
                      <div className="flex space-x-1">
                        <input type="text" value={f10Day} onChange={(e) => setF10Day(e.target.value)} className="w-1/4 p-2 border rounded-md text-center text-[11px] font-bold" />
                        <select value={f10Month} onChange={(e) => setF10Month(e.target.value)} className="w-1/2 p-2 border rounded-md text-[11px] font-bold">
                          {ethMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input type="text" value={f10Year} onChange={(e) => setF10Year(e.target.value)} className="w-1/4 p-2 border rounded-md text-center text-[11px] font-bold" />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ማስታወሻ (Remarks)</label>
                      <input 
                        type="text" 
                        value={f10Remark} 
                        onChange={(e) => setF10Remark(e.target.value)} 
                        className="w-full p-2 border rounded-md" 
                        placeholder="ማስታወሻ..." 
                      />
                    </div>
                    <div className="md:col-span-4 flex justify-end">
                      <button type="submit" className="bg-teal-800 hover:bg-teal-900 text-white font-bold p-2 px-6 rounded-lg text-xs shadow">
                        ወደ ሰንጠረዥ አስገባ
                      </button>
                    </div>
                  </form>
                </div>

                {/* Printable 010 Preview layout sheet */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-neutral-300 shadow-lg text-xs text-black space-y-4 print-area max-w-4xl mx-auto">
                  <div className="text-center border-b pb-4 mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider">በአዲስ አበባ ከተማ አስተዳደር የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት ኤጀንሲ</h4>
                    <h2 className="text-base font-extrabold mt-1 text-slate-900">ቅጽ ቁጥር 010</h2>
                    <h3 className="text-xs font-bold text-slate-700">በወረዳ እና ክ/ከተማ የዕለት ህትመት ስርጭት ቅጽ</h3>
                    <div className="flex justify-between mt-3 text-[10px] font-semibold text-slate-600 px-2 leading-none">
                      <div><strong>ክፍለ ከተማ:</strong> <span className="underline">ቦሌ</span></div>
                      <div><strong>ወረዳ:</strong> <span className="underline">05</span></div>
                      <div><strong>ቀን:</strong> <span className="underline font-bold text-teal-800">{f10FilterDate || ethDateNow}</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-black text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="border border-black p-1.5" rowSpan={2}>ተ.ቁ</th>
                          <th className="border border-black p-1.5" rowSpan={2}>የህትመት አይነት</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ብዛት в ቁጥር</th>
                          <th className="border border-black p-1.5" colSpan={2}>የህትመት ዘዴ</th>
                          <th className="border border-black p-1.5" colSpan={2}>ሴሪያል ቁጥር</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ርክክብ የተደረገበት ዕለት</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ማስታወሻ</th>
                          <th className="border border-black p-1.5 no-print" rowSpan={2}>ድርጊት</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-black p-1">ማኑዋል (✓)</th>
                          <th className="border border-black p-1">ሲስተም (✓)</th>
                          <th className="border border-black p-1">ከ</th>
                          <th className="border border-black p-1">እስከ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/40 font-medium">
                        {filteredForm010.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="border border-black p-1.5">{idx + 1}</td>
                            <td className="border border-black p-1.5 text-left font-bold">{row.type}</td>
                            <td className="border border-black p-1.5 font-bold">{row.qty}</td>
                            <td className="border border-black p-1.5">{row.method === 'ማኑዋል' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5">{row.method === 'ሲስተም' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5 font-mono">{row.from}</td>
                            <td className="border border-black p-1.5 font-mono">{row.to}</td>
                            <td className="border border-black p-1.5 font-bold">{row.date}</td>
                            <td className="border border-black p-1.5 text-left text-[9px]">{row.remark}</td>
                            <td className="border border-black p-1.5 no-print">
                              <button onClick={() => deleteF10Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 pt-4 border-t border-slate-300 text-[9px] text-gray-700">
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">አስረካቢ (የህትመት ኃላፊ)</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የአስረካቢ ስም (Presenter):</span>
                        <input
                          type="text"
                          value={f10SigneeAsrekabi}
                          onChange={(e) => setF10SigneeAsrekabi(e.target.value)}
                          placeholder="የአስረካቢ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ተረካቢ (የቡድን መሪ)</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የቡድን መሪ ስም (Team Leader):</span>
                        <input
                          type="text"
                          value={f10SigneeTerekabiLider}
                          onChange={(e) => setF10SigneeTerekabiLider(e.target.value)}
                          placeholder="የቡድን መሪ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ተረካቢ (ባለሙያ)</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የባለሙያ ስም (Officer):</span>
                        <input
                          type="text"
                          value={f10SigneeTerekabiBalemuya}
                          onChange={(e) => setF10SigneeTerekabiBalemuya(e.target.value)}
                          placeholder="የባለሙያ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-teal-50/50 border-teal-100">
                      <p className="font-bold border-b pb-1 mb-1 text-red-950">ያጸደቀው (የጽ/ቤት ኃላፊ)</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-red-700 block">የኃላፊው ስም (Director):</span>
                        <input
                          type="text"
                          value={f10SigneeYatzedeqew}
                          onChange={(e) => setF10SigneeYatzedeqew(e.target.value)}
                          placeholder="የጽ/ቤት ኃላፊ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t no-print">
                    <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold flex items-center space-x-1">
                      <Printer className="w-3.5 h-3.5" /> <span>ቅጽ 010 አትም</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* D. FORM 011 (የዕለት አገልግሎት የተሰጣቸው) */}
            {adminTab === 'form011' && (
              <div className="space-y-6">
                
                 {/* Filters */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center no-print text-[11px] font-bold text-teal-950">
                  <div className="flex items-center space-x-1">
                    <span>በኩነት እይ:</span>
                    <select value={f11FilterServiceType} onChange={(e) => setF11FilterServiceType(e.target.value)} className="p-1 border rounded bg-white text-[10px]">
                      <option value="all">ሁሉንም አሳይ</option>
                      <option value="ልደት">ልደት</option>
                      <option value="ጋብቻ">ጋብቻ</option>
                      <option value="ፍቺ">ፍቺ</option>
                      <option value="ሞት">ሞት</option>
                      <option value="ጉዲፈቻ">ጉዲፈቻ</option>
                      <option value="ያላገባ">ያላገባ</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በሴሪያል ፈልግ:</span>
                    <input type="text" value={f11FilterSerial} onChange={(e) => setF11FilterSerial(e.target.value)} placeholder="B-90" className="p-1 border rounded bg-white w-24 text-[10px] uppercase" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በቀን ፈልግ:</span>
                    <input 
                      type="text" 
                      value={f11FilterDate}
                      onChange={(e) => setF11FilterDate(e.target.value)}
                      placeholder="ቀን/ወር/ዓመት"
                      className="p-1 border rounded w-28 bg-white text-[10px]"
                    />
                    {f11FilterDate && (
                      <button 
                        type="button"
                        onClick={() => setF11FilterDate('')}
                        className="text-red-500 hover:text-red-700 px-0.5 text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={() => setF11FilterDate(ethDateNow)}
                      className={`px-2 py-1 rounded text-[10px] ${f11FilterDate === ethDateNow ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      የዛሬ ብቻ
                    </button>
                    <button 
                      type="button"
                      onClick={() => setF11FilterDate('')}
                      className={`px-2 py-1 rounded text-[10px] ${f11FilterDate === '' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      ሁሉንም አሳይ
                    </button>
                  </div>
                  <button onClick={() => exportToCSV('f011')} className="ml-auto bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                    <Download className="w-3.5 h-3.5" /> <span>Excel (ቅጽ 011) አውርድ</span>
                  </button>
                </div>

                {/* Form Inputs (011) with Built-in Signature Pad */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                  <h3 className="font-extrabold text-teal-950 border-b pb-2">ቅጽ 011 - በየዕለቱ አገልግሎት የተሰጣቸው ህትመቶች መመዝገቢያ</h3>
                  
                  <form onSubmit={handleAddForm011} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-teal-800 mb-1">አገልግሎት የተሰጠበት ቀን (በኢትዮጵያ)</label>
                        <div className="flex space-x-1">
                          <input type="text" value={f11DateDay} onChange={(e) => setF11DateDay(e.target.value)} className="w-1/4 p-2 border rounded-md text-center font-bold" />
                          <select value={f11DateMonth} onChange={(e) => setF11DateMonth(e.target.value)} className="w-1/2 p-2 border rounded-md font-bold text-[11px]">
                            {ethMonths.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input type="text" value={f11DateYear} onChange={(e) => setF11DateYear(e.target.value)} className="w-1/4 p-2 border rounded-md text-center font-bold font-sans" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የአገልግሎት አይነት</label>
                        <select value={f11ServiceType} onChange={(e) => setF11ServiceType(e.target.value)} className="w-full p-2 border rounded-md">
                          <option>ልደት ምዝገባ</option>
                          <option>ጋብቻ ምዝገባ</option>
                          <option>ፍቺ ምዝገባ</option>
                          <option>ሞት ምዝገባ</option>
                          <option>ጉዲፈቻ ምዝገባ</option>
                          <option>ያላገባ ማስረጃ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የማህደር ቁጥር</label>
                        <input type="text" value={f11Archive} onChange={(e) => setF11Archive(e.target.value)} placeholder="W05/B-912" className="w-full p-2 border rounded-md" required />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የተገልጋይ ሙሉ ስም</label>
                        <input type="text" value={f11Customer} onChange={(e) => setF11Customer(e.target.value)} className="w-full p-2 border rounded-md" placeholder="እባክዎ እዚህ ይጻፉ" required />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት ሴሪያል ቁጥር</label>
                        <input type="text" value={f11Serial} onChange={(e) => setF11Serial(e.target.value)} placeholder="B-9011" className="w-full p-2 border rounded-md uppercase" required />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት ዘዴ</label>
                        <select value={f11Method} onChange={(e) => setF11Method(e.target.value as any)} className="w-full p-2 border rounded-md">
                          <option value="ሲስተም">በሲስተም (System)</option>
                          <option value="ማኑዋል">በማኑዋል (Manual)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የተሰጠበት ሰዓት (ያልተቆለፈ)</label>
                        <input type="text" value={ethTimeNow} className="w-full p-2 border rounded-md bg-slate-100 font-bold self-center" readOnly />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የተገልጋይ ስልክ ቁጥር</label>
                        <input type="text" value={f11Phone} onChange={(e) => setF11Phone(e.target.value)} className="w-full p-2 border rounded-md" placeholder="09xxxxxxxx" />
                      </div>
                    </div>

                    {/* Integrated Signature Drawing Pad inside the log */}
                    <div className="max-w-md pt-2">
                      <label className="block text-[10px] font-bold text-teal-800 mb-1">የተረካቢ ፊርማ (የማስፈረሚያ ሰሌዳ) - Mobile Touch Supported</label>
                      <SignaturePad 
                        onSave={(dataUrl) => setF11Signature(dataUrl)}
                        placeholderText="ተረካቢው እንዲፈርም እዚህ ሰሌዳ ላይ ጣትዎትን ወይም ማውዝዎን ይሳቡ (Draw signature inside this cell)"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button type="submit" className="bg-teal-800 hover:bg-teal-900 border border-teal-700 text-white font-extrabold py-2 px-6 rounded-lg text-xs shadow">
                        ወደ ቅጽ 011 ሰንጠረዥ ጨምር
                      </button>
                    </div>
                  </form>
                </div>

                {/* Printable 011 Layout sheet */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-neutral-300 shadow-lg text-xs text-black space-y-4 print-area max-w-5xl mx-auto">
                  
                  <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-base font-extrabold mt-1 text-slate-900">ቅጽ ቁጥር 011</h2>
                    <h3 className="text-xs font-bold text-slate-700">በየዕለቱ አገልግሎት የተሰጣቸው ህትመቶች መመዝገቢያ እና ሪፖርት ማድረጊያ</h3>
                    <div className="flex justify-between mt-3 text-[10px] font-semibold text-slate-600 px-2 leading-none">
                      <div><strong>ክፍለ ከተማ:</strong> <span className="underline">ቦሌ</span></div>
                      <div><strong>ወረዳ:</strong> <span className="underline">05</span></div>
                      <div><strong>ቀን:</strong> <span className="underline font-bold text-teal-800">{f11FilterDate || ethDateNow}</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-black text-[9px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="border border-black p-1" rowSpan={2}>ተ.ቁ</th>
                          <th className="border border-black p-1" rowSpan={2}>አገልግሎት የተሰጠበት ቀን</th>
                          <th className="border border-black p-1" rowSpan={2}>የአገልግሎት አይነት</th>
                          <th className="border border-black p-1" rowSpan={2}>የማህደር ቁጥር</th>
                          <th className="border border-black p-1 text-left scrollbar-none" rowSpan={2}>የተገልጋይ ስም</th>
                          <th className="border border-black p-1" rowSpan={2}>የህትመት ሴሪያል</th>
                          <th className="border border-black p-1" colSpan={2}>የህትመት አይነት</th>
                          <th className="border border-black p-1 font-sans" rowSpan={2}>የተሰጠበት ሰዓት</th>
                          <th className="border border-black p-1" colSpan={2}>የተገልጋይ መረጃ</th>
                          <th className="border border-black p-1 no-print" rowSpan={2}>ድርጊት</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-black p-1">ማኑዋል (✓)</th>
                          <th className="border border-black p-1">ሲስተም (✓)</th>
                          <th className="border border-black p-1">ስልክ </th>
                          <th className="border border-black p-1">ፊርማ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/40 font-medium">
                        {filteredForm011.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="border border-black p-1">{idx + 1}</td>
                            <td className="border border-black p-1 font-bold">{row.date}</td>
                            <td className="border border-black p-1 text-left font-bold">{row.serviceType}</td>
                            <td className="border border-black p-1 font-mono">{row.archive}</td>
                            <td className="border border-black p-1 text-left font-bold text-slate-900">{row.customer}</td>
                            <td className="border border-black p-1 font-mono font-bold text-slate-800">{row.serial}</td>
                            <td className="border border-black p-1">{row.method === 'ማኑዋል' ? '✓' : ''}</td>
                            <td className="border border-black p-1">{row.method === 'ሲስተም' ? '✓' : ''}</td>
                            <td className="border border-black p-1 font-sans font-bold">{row.time}</td>
                            <td className="border border-black p-1 font-mono">{row.phone}</td>
                            <td className="border border-black p-1 text-center font-sans">
                              {row.signature ? (
                                <img src={row.signature} className="h-6 mx-auto bg-white border" alt="Sig" />
                              ) : (
                                <span className="text-slate-400 italic text-[8px]">ፊርማ የለም</span>
                              )}
                            </td>
                            <td className="border border-black p-1 no-print">
                              <button onClick={() => deleteF11Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-300 text-[9px] text-gray-700">
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">አስረካቢ ባለሙያ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የባለሙያ ስም:</span>
                        <input
                          type="text"
                          value={f11SigneeBalemuya}
                          onChange={(e) => setF11SigneeBalemuya(e.target.value)}
                          placeholder="የባለሙያ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ያረጋገጠው ቡድን መሪ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የቡድን መሪ ስም:</span>
                        <input
                          type="text"
                          value={f11SigneeLider}
                          onChange={(e) => setF11SigneeLider(e.target.value)}
                          placeholder="የቡድን መሪ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-teal-50/50 border-teal-100">
                      <p className="font-bold border-b pb-1 mb-1 text-red-950">ያጸደቀው የጽ/ቤት ኃላፊ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-red-700 block">የኃላፊው ስም:</span>
                        <input
                          type="text"
                          value={f11SigneeYatzedeqew}
                          onChange={(e) => setF11SigneeYatzedeqew(e.target.value)}
                          placeholder="የጽ/ቤት ኃላፊ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t no-print">
                    <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold flex items-center space-x-1">
                      <Printer className="w-3.5 h-3.5" /> <span>ቅጽ 011 አትም</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* E. FORM 012 (ተመላሽና የተበላሸ) */}
            {adminTab === 'form012' && (
              <div className="space-y-6">
                
                 {/* Filters */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center no-print text-[11px] font-bold text-teal-950">
                  <div className="flex items-center space-x-1">
                    <span>በእውቅና ማጣሪያ:</span>
                    <select value={f12FilterServiceType} onChange={(e) => setF12FilterServiceType(e.target.value)} className="p-1 border rounded bg-white text-[10px]">
                      <option value="all">ሁሉንም አሳይ</option>
                      <option value="ልደት">ልደት</option>
                      <option value="ጋብቻ">ጋብቻ</option>
                      <option value="ፍቺ">ፍቺ</option>
                      <option value="ሞት">ሞት</option>
                      <option value="ጉዲፈቻ">ጉዲፈቻ</option>
                      <option value="ያላገባ">ያላገባ</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በመለያ:</span>
                    <input type="text" value={f12FilterSerial} onChange={(e) => setF12FilterSerial(e.target.value)} placeholder="M-50" className="p-1 border rounded bg-white w-24 text-[10px] uppercase" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በቀን ፈልግ:</span>
                    <input 
                      type="text" 
                      value={f12FilterDate}
                      onChange={(e) => setF12FilterDate(e.target.value)}
                      placeholder="ቀን/ወር/ዓመት"
                      className="p-1 border rounded w-28 bg-white text-[10px]"
                    />
                    {f12FilterDate && (
                      <button 
                        type="button"
                        onClick={() => setF12FilterDate('')}
                        className="text-red-500 hover:text-red-700 px-0.5 text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={() => setF12FilterDate(ethDateNow)}
                      className={`px-2 py-1 rounded text-[10px] ${f12FilterDate === ethDateNow ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      የዛሬ ብቻ
                    </button>
                    <button 
                      type="button"
                      onClick={() => setF12FilterDate('')}
                      className={`px-2 py-1 rounded text-[10px] ${f12FilterDate === '' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      ሁሉንም አሳይ
                    </button>
                  </div>
                  <button onClick={() => exportToCSV('f012')} className="ml-auto bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                    <Download className="w-3.5 h-3.5" /> <span>Excel (ቅጽ 012) አውርድ</span>
                  </button>
                </div>

                {/* Form Inputs (012) - no print */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                  <h3 className="font-extrabold text-teal-950 border-b pb-2">ቅጽ 012 - አገልግሎት ያልተሰጠበትና የተበላሸ ህትመት ተመላሽ ማድረጊያ</h3>
                  
                  <form onSubmit={handleAddForm012} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት አይነት</label>
                      <select value={f12PrintType} onChange={(e) => setF12PrintType(e.target.value)} className="w-full p-2 border rounded-md">
                        <option>ልደት ምስክር ወረቀት</option>
                        <option>ጋብቻ ምስክር ወረቀት</option>
                        <option>ፍቺ ምስክር ወረቀት</option>
                        <option>ሞት ምስክር ወረቀት</option>
                        <option>ጉዲፈቻ ምስክር ወረቀት</option>
                        <option>ያላገባ ምስክር ወረቀት</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የተመላሽ አይነት</label>
                      <select value={f12ReturnStatus} onChange={(e) => setF12ReturnStatus(e.target.value as any)} className="w-full p-2 border rounded-md">
                        <option value="ያልተሰጠ">አገልግሎት ላይ ያልዋለ</option>
                        <option value="የተበላሸ">የተበላሸ (Damaged)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት ዘዴ</label>
                      <select value={f12Method} onChange={(e) => setF12Method(e.target.value as any)} className="w-full p-2 border rounded-md">
                        <option value="ሲስተም">በሲስተም (System)</option>
                        <option value="ማኑዋል">በማኑዋል (Manual)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ሴሪያል ቁጥር</label>
                      <input type="text" value={f12Serial} onChange={(e) => setF12Serial(e.target.value)} placeholder="B-9912" className="w-full p-2 border rounded-md uppercase" required />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-teal-800 mb-1">ርክክብ የተደረገበት ቀን</label>
                      <div className="flex space-x-1">
                        <input type="text" value={f12Day} onChange={(e) => setF12Day(e.target.value)} className="w-1/4 p-2 border rounded-md text-center font-bold" />
                        <select value={f12Month} onChange={(e) => setF12Month(e.target.value)} className="w-1/2 p-2 border rounded-md font-bold text-[11px]">
                          {ethMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input type="text" value={f12Year} onChange={(e) => setF12Year(e.target.value)} className="w-1/4 p-2 border rounded-md text-center font-bold font-sans" />
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የተበላሸበት / ያልተሰጠበት ምክንያት</label>
                      <input type="text" value={f12Reason} onChange={(e) => setF12Reason(e.target.value)} className="w-full p-2 border rounded-md" placeholder="እባክዎ የተበላሸበትን ትክክለኛ ምክንያት ይጻፉ" required />
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <button type="submit" className="bg-teal-800 hover:bg-teal-900 text-white font-bold p-2 px-6 rounded-lg text-xs shadow">
                        ወደ ሰንጠረዥ አስገባ
                      </button>
                    </div>
                  </form>
                </div>

                {/* Printable 012 Layout sheet */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-neutral-300 shadow-lg text-xs text-black space-y-4 print-area max-w-5xl mx-auto">
                  
                  <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-base font-extrabold mt-1 text-slate-900">ቅጽ ቁጥር 012</h2>
                    <h3 className="text-xs font-bold text-slate-700">በየዕለቱ አገልግሎት ያልተሰጠበት እና የተበላሸ ህትመት ተመላሽ ማድረጊያ ቅጽ</h3>
                    <div className="flex justify-between mt-3 text-[10px] font-semibold text-slate-600 px-2 leading-none">
                      <div><strong>ክፍለ ከተማ:</strong> <span className="underline">ቦሌ</span></div>
                      <div><strong>ወረዳ:</strong> <span className="underline">05</span></div>
                      <div><strong>ቀን:</strong> <span className="underline font-bold text-teal-800">{f12FilterDate || ethDateNow}</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-black text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="border border-black p-1.5" rowSpan={2}>ተ.ቁ</th>
                          <th className="border border-black p-1.5" rowSpan={2}>የህትመት አይነት</th>
                          <th className="border border-black p-1.5" colSpan={2}>የተመላሽ ሁኔታ</th>
                          <th className="border border-black p-1.5" colSpan={2}>የህትመት ዘዴ</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ሴሪያል ቁጥር</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ርክክብ የተደረገበት ዕለት</th>
                          <th className="border border-black p-1.5 text-left" rowSpan={2}>የተበላሸበት ምክንያት</th>
                          <th className="border border-black p-1.5 no-print" rowSpan={2}>ድርጊት</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-black p-1">አገልግሎት ላይ ያልዋለ (✓)</th>
                          <th className="border border-black p-1">የተበላሸ (✓)</th>
                          <th className="border border-black p-1">ማኑዋል (✓)</th>
                          <th className="border border-black p-1">ሲስተም (✓)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/40 font-medium">
                        {filteredForm012.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="border border-black p-1.5">{idx + 1}</td>
                            <td className="border border-black p-1.5 text-left font-bold">{row.printType}</td>
                            <td className="border border-black p-1.5">{row.returnStatus === 'ያልተሰጠ' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5">{row.returnStatus === 'የተበላሸ' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5">{row.method === 'ማኑዋል' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5">{row.method === 'ሲስተም' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5 font-mono font-bold">{row.serial}</td>
                            <td className="border border-black p-1.5 font-bold">{row.date}</td>
                            <td className="border border-black p-1.5 text-left text-[9px]">{row.reason}</td>
                            <td className="border border-black p-1.5 no-print">
                              <button onClick={() => deleteF12Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-300 text-[9px] text-gray-700">
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">አስረካቢ ባለሙያ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የባለሙያ ስም:</span>
                        <input
                          type="text"
                          value={f12SigneeBalemuya}
                          onChange={(e) => setF12SigneeBalemuya(e.target.value)}
                          placeholder="የባለሙያ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ተረካቢ ቡድን መሪ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የቡድን መሪ ስም:</span>
                        <input
                          type="text"
                          value={f12SigneeLider}
                          onChange={(e) => setF12SigneeLider(e.target.value)}
                          placeholder="የቡድን መሪ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                    <div className="border p-2 rounded bg-teal-50/50 border-teal-100">
                      <p className="font-bold border-b pb-1 mb-1 text-red-950">ያጸደቀው የጽ/ቤት ኃላፊ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-red-700 block">የኃላፊው ስም:</span>
                        <input
                          type="text"
                          value={f12SigneeYatzedeqew}
                          onChange={(e) => setF12SigneeYatzedeqew(e.target.value)}
                          placeholder="የጽ/ቤት ኃላፊ ስም ያስገቡ..."
                          className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-teal-700 focus:outline-none p-0.5 text-[10px] text-slate-800 font-bold"
                        />
                        <p className="pt-1">ፊርማ: _______________</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t no-print">
                    <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold flex items-center space-x-1">
                      <Printer className="w-3.5 h-3.5" /> <span>ቅጽ 012 አትም</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* F. SECURITY & BACKUP PANEL */}
            {adminTab === 'security' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
                
                {/* 1. Backup Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center ring-4 ring-teal-50">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">የመረጃ ደህንነት ቅጂ ማውረጃ (Backup & Encrypt System Data)</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 font-sans">
                        ሁሉንም የወረዳ 05 መረጃዎችን (የመታወቂያ ክምችት፣ የሰነዶች መዝገብ፣ እና የቅጽ 010, 011 እና 012 ሪከርዶችን) በአንድ ላይ በማጣመር በጠንካራ የሚስጥር ቁልፍ (Passphrase) የይለፍ ቃል የተመሰጠረ የJSON ፋይል ለመፍጠር ይህንን ቁልፍ ይጫኑ። ይህ ፋይል አሁን ካለው የደመና ወይም የአካባቢ ሰሌዳ ውጭ በደህንነት ለማስቀመጥ ያገለግላል።
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase font-sans">የደህንነት ቅጂ ጥቅል ማጠቃለያ (Included datasets)</span>
                      <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>የመታወቂያዎች ርክክብ መዝገብ ({idInventory.length} ሪኮርድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>የተመነጩ ህጋዊ ደብዳቤዎችና መሸኛዎች ({generatedDocs.length} ሰነድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>ቅጽ 010 የዕለት ህትመት ስርጭት መረጃ ({form010.length} ሪኮርድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>ቅጽ 011 የዕለት አገልግሎት ያገኙ ተጠቃሚዎች ({form011.length} ሪኮርድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>ቅጽ 012 ተመላሽና የተበላሹ ህትመቶች ({form012.length} ሪኮርድ)</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button 
                      onClick={handleBackupData}
                      className="w-full bg-teal-800 hover:bg-teal-900 border border-teal-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs"
                    >
                      <Download className="w-4 h-4" /> <span>መረጃውን በይለፍ ቃል አስልተህ አውርድ (Backup Data)</span>
                    </button>
                    <span className="text-[9px] text-slate-400 text-center block mt-2 font-medium">አውቶማቲክ ከፍተኛ የAES-XOR የደህንነት መቆለፊያ ይተገበራል።</span>
                  </div>
                </div>

                {/* 2. Restore Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between space-y-5 font-sans">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center ring-4 ring-amber-50">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">የመረጃ ደህንነት ቅጂ መመለሻ (Decrypt & Restore Data)</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        ቀደም ሲል የተወሰደ የደህንነት ቅጂ ፋይል (.json) ወደ ሲስተሙ ለመጫን እና አሁን ያለውን መረጃ በሙሉ ለመተካት/ለመመለስ ይህንን ያድርጉ። ፋይሉን ለመፍታት በሚያደርጉት ሙከራ ወቅት ፋይሉ የተመሰጠረበት የመጀመሪያው የይለፍ ቃል ማስገባት ይጠበቅብዎታል።
                      </p>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold block mb-1">ድርብ ማስጠንቀቂያ (Critical override alert)</span>
                        <p className="text-[11px] leading-relaxed font-medium">
                          ፋይሉን መመለስ አሁን በኮምፒውተርዎ ላይ ያለውን ማንኛውንም አዲስ መረጃ ደምስሶ በባክአፕ ፋይሉ ላይ ባለው የቀድሞ መረጃ ሙሉ በሙሉ ይተካዋል! እባክዎ ከመመለስዎ በፊት እርግጠኛ ይሁኑ።
                        </p>
                      </div>
                    </div>

                    {/* Drag and Drop File Input Area */}
                    <div className="relative border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-6 transition text-center cursor-pointer bg-slate-50 group">
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleRestoreData}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-2 pointer-events-none">
                        <Download className="w-8 h-8 text-slate-400 mx-auto group-hover:text-teal-600 transition" />
                        <div className="text-xs font-bold text-slate-700">የባክአፕ ፋይሉን እዚህ ይጎትቱ ወይም ይጫኑ</div>
                        <div className="text-[10px] text-slate-400">የተገደበ ቅርጸት፡ .json (ይለፍ ቃል የተጫነበት)</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 leading-relaxed text-center font-medium">
                    ማስታወሻ፡ ፋይሉን መፍታት ከተሳካ በኋላ የሲስተሙ መረጃዎች ሁሉ ወዲያውኑ ይሻሻላሉ።
                  </div>
                </div>

              </div>
            )}

            {/* G. CIVIL PREREQUISITES AND RESET SYSTEM PANEL */}
            {adminTab === 'prerequisites' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print font-sans">
                
                {/* Left side list of services grouped by categories */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block font-extrabold uppercase">የአገልግሎቶች ዝርዝር (Services list)</span>
                  </div>
                  
                  {/* Group 1: የሲቪል ምዝገባ */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center bg-teal-50 px-2.5 py-1.5 rounded-xl text-teal-850">
                      <span className="text-[9px] font-black uppercase">የሲቪል ምዝገባ (Civil)</span>
                      <button 
                        type="button" 
                        onClick={() => handleAddNewPrerequisiteCat('civil')}
                        className="text-[9px] font-black bg-white hover:bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg border border-teal-200 transition"
                        title="አዲስ የሲቪል ምዝገባ አገልግሎት ጨምር"
                      >
                        + ጨምር (Add)
                      </button>
                    </div>
                    <div className="space-y-1 pt-1.5">
                      {requirements.filter(r => r.category === 'civil').map((req) => (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setEditingReqId(req.id)}
                          className={`w-full text-left p-3 rounded-xl font-bold flex justify-between items-center transition ${editingReqId === req.id ? 'bg-[#0a3651] text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                        >
                          <span className="text-[10px] truncate">{req.subCategory}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Group 2: የነዋሪ አገልግሎት */}
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between items-center bg-slate-100 px-2.5 py-1.5 rounded-xl text-slate-800">
                      <span className="text-[9px] font-black uppercase">የነዋሪ አገልግሎት (Resident)</span>
                      <button 
                        type="button" 
                        onClick={() => handleAddNewPrerequisiteCat('residency')}
                        className="text-[9px] font-black bg-white hover:bg-slate-200 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-300 transition"
                        title="አዲስ የነዋሪ አገልግሎት ጨምር"
                      >
                        + ጨምር (Add)
                      </button>
                    </div>
                    <div className="space-y-1 pt-1.5">
                      {requirements.filter(r => r.category === 'residency').map((req) => (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setEditingReqId(req.id)}
                          className={`w-full text-left p-3 rounded-xl font-bold flex justify-between items-center transition ${editingReqId === req.id ? 'bg-[#0a3651] text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                        >
                          <span className="text-[10px] truncate">{req.subCategory}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Group 3: የሰነድ ማረጋገጫ */}
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between items-center bg-indigo-50 px-2.5 py-1.5 rounded-xl text-indigo-900">
                      <span className="text-[9px] font-black uppercase">የሰነድ ማረጋገጫ (Verify)</span>
                      <button 
                        type="button" 
                        onClick={() => handleAddNewPrerequisiteCat('documents')}
                        className="text-[9px] font-black bg-white hover:bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-lg border border-indigo-200 transition"
                        title="አዲስ የሰነድ ማረጋገጫ አገልግሎት ጨምር"
                      >
                        + ጨምር (Add)
                      </button>
                    </div>
                    <div className="space-y-1 pt-1.5">
                      {requirements.filter(r => r.category === 'documents').map((req) => (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setEditingReqId(req.id)}
                          className={`w-full text-left p-3 rounded-xl font-bold flex justify-between items-center transition ${editingReqId === req.id ? 'bg-[#0a3651] text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                        >
                          <span className="text-[10px] truncate">{req.subCategory}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right side form editor */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5 font-semibold">
                  <div className="pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-[#0a3651] uppercase tracking-widest block font-extrabold">የተመረጠው አገልግሎት ቅድመ ሁኔታዎች ማስተካከያ (Prerequisite Editor)</span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {requirements.find(r => r.id === editingReqId)?.title || "አገልግሎት ማስተካከያ"}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-xs font-semibold">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase text-slate-400 font-bold">የአገልግሎት ስም/ራስጌ (Service Title Header)</label>
                      <input 
                        type="text"
                        value={editingReqTitle}
                        onChange={(e) => setEditingReqTitle(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-sans focus:outline-none focus:ring-2 focus:ring-teal-700 focus:bg-white text-xs font-bold"
                        placeholder="የአገልግሎቱ ርዕስ..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase text-slate-400 font-bold">የተብራራ ማብራሪያ መግለጫ (Detailed Explanation Paragraph)</label>
                      <textarea
                        value={editingReqDesc}
                        onChange={(e) => setEditingReqDesc(e.target.value)}
                        rows={3}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-sans focus:outline-none focus:ring-2 focus:ring-teal-700 focus:bg-white text-xs leading-relaxed font-semibold font-bold"
                        placeholder="ለአመልካቹ የሚያስፈልገውን የአገልግሎት አይነት ሁኔታዎችና መግለጫዎች እዚህ ይጻፉ..."
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] uppercase text-slate-400 font-bold">ያስገዳጅ ቅድመ-ሁኔታዎች ዝርዝር (Requirements Points List)</label>
                        <span className="text-[9px] text-[#0a3651] font-bold">በእያንዳንዱ መስመር ላይ አንድ መስፈርት ብቻ ይጻፉ (One requirement per line)</span>
                      </div>
                      <textarea
                        value={editingReqPointsText}
                        onChange={(e) => setEditingReqPointsText(e.target.value)}
                        rows={6}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-sans focus:outline-none focus:ring-2 focus:ring-teal-700 focus:bg-white text-xs leading-relaxed font-semibold font-bold"
                        placeholder="መስፈርት 1&#10;መስፈርት 2&#10;መስፈርት 3..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
                    {editingReqId ? (
                      <button 
                        type="button"
                        onClick={() => handleDeletePrerequisite(editingReqId)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2 px-4 rounded-xl transition text-xs flex items-center space-x-1.5 border border-rose-200"
                        title="ይህንን የአገልግሎት መስፈርት ይቀንሱ / ይሰርዙ"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 
                        <span>ይህንን አገልግሎት ይቀንሱ (Delete)</span>
                      </button>
                    ) : <div></div>}
                    <button 
                      type="button"
                      onClick={handleSavePrerequisite}
                      className="bg-[#0f405c] hover:bg-[#072436] text-white font-extrabold py-2.5 px-6 rounded-xl shadow-md transition text-xs flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" /> <span>የአገልግሎቱን ቅድመ ሁኔታ አስቀምጥ (Save Prerequisite)</span>
                    </button>
                  </div>

                  {/* Wipe All Data Panel inside settings */}
                  <div className="mt-8 pt-6 border-t border-rose-100 space-y-4 bg-rose-50/40 p-5 rounded-2xl border border-rose-100">
                    <div className="flex items-start space-x-3">
                      <div className="p-2.5 bg-rose-50 rounded-xl text-rose-750">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-rose-950">ሲስተሙን ሙሉ በሙሉ በአዲስ መልክ ማስጀመር (Reset / Wipe All Records)</h4>
                        <p className="text-[10px] text-rose-600 mt-1 leading-relaxed font-sans">
                          ይህንን ቁልፍ በመጫን በሲስተሙ ውስጥ ከዚህ በፊት የገቡትን ሁሉንም የመታወቂያ በርክክብ፣ የሰነዶች፣ የቅጽ 010፣ የቅጽ 011 እና 012 የድሮ መረጃዎችን በሙሉ መደምሰስ ይችላሉ። ይህ በኮምፒውተርዎ ላይ ያለውንም ሆነ በደመና (Cloud Database) ያሉትን መረጃዎች ጠርጎ በማጥፋት እስከዛሬ የገቡ ዳታዎች ጠፍተው ስራውን በአዲስ መልክ ከዛሬ ጀምრო ለማካሄድ ዝግጁ ያደርገዋል።
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleResetAllData}
                        className="bg-rose-700 hover:bg-rose-800 text-white border border-rose-640 font-extrabold py-2 px-4 rounded-xl shadow-sm transition text-[10px] uppercase tracking-wider block"
                      >
                        ሁሉንም የቀድሞ መረጃዎች አጥፋ (Wipe All Records)
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* H. SMS GATEWAY CONFIGURATION PANEL */}
            {adminTab === 'smsGateway' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print font-sans">
                
                {/* Left side: Config form */}
                <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
                  <div className="flex items-center space-x-3 border-b pb-3">
                    <div className="p-2 bg-cyan-50 rounded-xl text-cyan-800">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-[#0f384c] tracking-wider">የኤስኤምኤስ ጌትዌይ ቅንብሮች (SMS Gateway Config)</h3>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">የኤስኤምኤስ መላኪያ ኤፒአይ እና የደህንነት ቁልፍ ማዋቀሪያ</p>
                    </div>
                  </div>

                  {/* Dynamic Presets Selection Grid */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">ፈጣን የጌትዌይ ምርጫዎች (Quick Gateway Presets)</span>
                    <p className="text-[9px] text-slate-400 font-bold leading-normal mb-1">አገልግሎት ሰጪዎን ለመምረጥ አንዱን ይጫኑ፤ ቅንብሮቹ በራስ-ሰር ይሞላሉ።</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSmsGatewayUrl("https://api.afromessage.com/api/v1/send");
                          setSmsGatewaySenderId(""); // Leave sender ID blank for default
                          setSmsGatewayEnabled(true);
                          alert("የ AfroMessage ቅድመ-ማዋቀሪያ ተመርጧል!\n\nማሳሰቢያ፦ AfroMessage ላይ 'Identifiers' ካልሰራዎት ወይም በ Ethio Telecom በኩል ገና ካልጸደቀ፣ 'ላኪ መታወቂያ' (Sender ID) የሚለውን ባዶ አድርገው ይተውት። ሲስተሙ በራስ-ሰር የ AfroMessage ነባሪ የላኪ መለያዎችን ይጠቀማል።");
                        }}
                        className="py-2 px-1.5 border border-slate-200 hover:border-cyan-600 rounded-xl text-center bg-white transition active:scale-95 shadow-sm cursor-pointer animate-none"
                      >
                        <span className="block text-[10px] font-black text-slate-800">AfroMessage</span>
                        <span className="text-[8px] text-cyan-600 block font-bold leading-none mt-1">Default ID Option</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSmsGatewayUrl("https://api.hahusms.com/v1/sms/send");
                          setSmsGatewaySenderId("");
                          setSmsGatewayEnabled(true);
                          alert("የ HahuSMS ቅድመ-ማዋቀሪያ ተመርጧል!\n\nእባክዎ የራስዎን የ HahuSMS API Token ያስገቡ።");
                        }}
                        className="py-2 px-1.5 border border-slate-200 hover:border-cyan-600 rounded-xl text-center bg-white transition active:scale-95 shadow-sm cursor-pointer animate-none"
                      >
                        <span className="block text-[10px] font-black text-slate-800">HahuSMS</span>
                        <span className="text-[8px] text-teal-600 block font-bold leading-none mt-1">Ethiopian Gateway</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSmsGatewayUrl("http://192.168.1.100:8080/send");
                          setSmsGatewaySenderId("");
                          setSmsGatewayApiKey("");
                          setSmsGatewayEnabled(true);
                          alert("የአንድሮይድ ስልክ ጌትዌይ ቅድመ-ማዋቀሪያ ተመርጧል!\n\nይህ አማራጭ ምንም ዓይነት የሰነድ ምዝገባ አያስፈልገውም፣ 100% ነፃ ነው። ስልክዎ ላይ 'SMS Gateway' መተግበሪያ በመጫን የሚሰጠዎትን የ IP አድራሻ 'የጌትዌይ URL አድራሻ' በሚለው ላይ ይተኩ።");
                        }}
                        className="py-2 px-1.5 border border-slate-200 hover:border-cyan-600 rounded-xl text-center bg-white transition active:scale-95 shadow-sm cursor-pointer animate-none"
                      >
                        <span className="block text-[10px] font-black text-slate-800">አንድሮይድ ስልክ (SIM)</span>
                        <span className="text-[8px] text-emerald-600 block font-bold leading-none mt-1">100% Free / Immediate</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">የኤስኤምኤስ አገልግሎትን አንቃ (Enable SMS Notifications)</span>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">አገልግሎቱን በማብራት መታወቂያ ሲመዘገብ ለተገልጋይ ኤስኤምኤስ እንዲሄድ ያደርጋሉ።</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={smsGatewayEnabled} 
                          onChange={(e) => setSmsGatewayEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-700 font-sans"></div>
                      </label>
                    </div>

                    {/* API Endpoint */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">የጌትዌይ URL አድራሻ (Gateway API Endpoint URL)</label>
                      <input 
                        type="url" 
                        value={smsGatewayUrl} 
                        onChange={(e) => setSmsGatewayUrl(e.target.value)} 
                        className="w-full p-2.5 border rounded-xl font-mono text-xs focus:ring-2 focus:ring-cyan-600 focus:outline-none text-slate-800 font-bold" 
                        placeholder="https://api.yourgateway.com/v1/sms/send"
                        disabled={!smsGatewayEnabled}
                      />
                      <p className="text-[9px] text-slate-400 font-bold leading-normal">የኢትዮ ቴሌኮም (Ethio Telecom) ወይም ሌላ የኤስኤምኤስ አገልግሎት ሰጪ ጌትዌይ API URL።</p>
                    </div>

                    {/* API Key */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">የኤፒአይ የደህንነት ቁልፍ (API Key / Authorization Token)</label>
                       <div className="relative">
                         <input 
                           type="password" 
                           value={smsGatewayApiKey} 
                           onChange={(e) => setSmsGatewayApiKey(e.target.value)} 
                           className="w-full p-2.5 border rounded-xl font-mono text-xs focus:ring-2 focus:ring-cyan-600 focus:outline-none pr-10 text-slate-800 font-bold" 
                           placeholder="••••••••••••••••••••••••••••••••"
                           disabled={!smsGatewayEnabled}
                         />
                         <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-450 pointer-events-none">
                           <Lock className="w-3.5 h-3.5 text-slate-400" />
                         </div>
                       </div>
                      <p className="text-[9px] text-slate-400 font-bold leading-normal">ግንኙነቱን ለመፍቀድ የሚያገለግል የ Bearer ቶከን ወይም ኤፒአይ ኪይ። (ስልክ ከተጠቀሙ ባዶ ይተውት)</p>
                    </div>

                    {/* Sender ID */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">ላኪ መታወቂያ (Sender ID / Alpha Sender)</label>
                      <input 
                        type="text" 
                        value={smsGatewaySenderId} 
                        onChange={(e) => setSmsGatewaySenderId(e.target.value)} 
                        className="w-full p-2.5 border rounded-xl font-bold text-xs focus:ring-2 focus:ring-cyan-600 focus:outline-none text-slate-800" 
                        placeholder="BOLE-W05"
                        disabled={!smsGatewayEnabled}
                      />
                      <p className="text-[9px] text-slate-400 font-bold leading-normal">አጭር የፊደል ላኪ ስም (ለምሳሌ BOLE-W05 ወይም ባዶ ይተውት)።</p>
                    </div>

                    <div className="pt-3 flex justify-end">
                      <button 
                        type="button" 
                        onClick={handleSaveSmsSettings}
                        className="bg-cyan-800 hover:bg-cyan-900 border border-cyan-700 text-white font-black py-2.5 px-6 rounded-xl shadow-md transition text-xs flex items-center space-x-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-cyan-300" />
                        <span>የጌትዌይ ቅንብሮችን አስቀምጥ (Save Settings)</span>
                      </button>
                    </div>

                  </div>
                </div>

                {/* Right side: Test Tool & Workaround Documentation Cards */}
                <div className="lg:col-span-6 space-y-6">
                  {/* Test Box */}
                  <div className="bg-slate-50 rounded-2xl p-6 shadow-none border border-slate-200/80 space-y-4">
                    <div className="flex items-center space-x-3 border-b pb-3 border-slate-200">
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-800">
                        <MessageSquare className="w-5 h-5 text-emerald-800" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-[#0f384c] tracking-wider">የኤስኤምኤስ ግንኙነት መፈተኛ (SMS Connection Test tool)</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">የገባው የጌትዌይ URL በትክክል መስራቱን ያረጋግጡ</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Test Number */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">የሙከራ መቀበያ ስልክ ቁጥር (Test Mobile Number)</label>
                        <input 
                          type="tel" 
                          value={testPhone} 
                          onChange={(e) => setTestPhone(e.target.value)} 
                          className="w-full p-2.5 border rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-bold text-slate-800" 
                          placeholder="09xxxxxxxx" 
                        />
                      </div>

                      {/* Test Message */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">የሙከራ መልዕክት ይዘት (Test Message Content)</label>
                        <textarea 
                          value={testMessage} 
                          onChange={(e) => setTestMessage(e.target.value)} 
                          rows={3} 
                          className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-bold text-slate-800" 
                          placeholder="የሙከራ የስልክ መልዕክት..." 
                        />
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-slate-200 text-[10px] text-slate-600 leading-relaxed font-bold space-y-1.5">
                        <span className="font-extrabold text-[#0f384c]">🔍 የጌትዌይ የጥሪ ሁኔታ (Gateway Call flow):</span>
                        <p className="text-slate-500 font-medium">1. የኤስኤምኤስ ጌትዌይ በርቶ ከሆነ፣ ሲስተሙ በ POST ዘዴ ለ URL አድራሻው ቀጥተኛ ጥያቄ ያቀር巴ል።</p>
                        <p className="text-slate-500 font-medium">2. የጌትዌይ አገልግሎቱ ካልበራ (Disabled)፣ ሲስተሙ በራስ-ሰር <strong>የሙከራ ምሳሌያዊ ሁነታ (Simulation Mode)</strong> በመጠቀም ስኬታማ ጥያቄዎችን ይፈትሻል።</p>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button 
                          type="button" 
                          onClick={handleTestSmsConnection}
                          disabled={isTestingSms}
                          className="bg-emerald-800 hover:bg-emerald-950 border border-emerald-700 text-white font-black py-2.5 px-6 rounded-xl shadow-md transition text-xs flex items-center space-x-2 cursor-pointer animate-none"
                        >
                          {isTestingSms ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                              <span>በመላክ ላይ...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 text-emerald-300" />
                              <span>የሙከራ SMS ላክ (Send Test SMS)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Amharic step-by-step documentation for Identifiers and Android Gateway workarounds */}
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 rounded-2xl p-6 border border-amber-200/80 space-y-4">
                    <div className="flex items-center space-x-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0" />
                      <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">⚠️ በፈቃድ/በአይደንቲፋየር (Identifiers) ለተቸገሩ የቀረቡ አማራጮች</h4>
                    </div>
                    
                    <div className="text-[11px] text-amber-950 leading-relaxed space-y-3 font-bold">
                      
                      <div className="border-b border-amber-200/60 pb-3">
                        <span className="block text-xs font-extrabold text-[#0f384c]">አማራጭ ፩፦ በ AfroMessage ያለ 'Identifier' (ላኪ ስም) መላክ</span>
                        <p className="text-[10px] text-slate-700 font-medium mt-1 font-sans">
                          AfroMessage ላይ የእርስዎ የላኪ ስም (Brand/Identifier) በ Ethio Telecom በኩል ገና ካልጸደቀ መተግበሪያው ላይ <strong className="text-black bg-amber-200/40 px-1 py-0.5 rounded">ላኪ መታወቂያ (Sender ID) የሚለውን ክፍል ሙሉ በሙሉ ባዶ ይተውት!</strong> ባዶ ሲሆን AfroMessage በራሱ በኩል የተፈቀደለትን የሲስተሙን ነባሪ የላኪ ስም (ለምሳሌ፦ <span className="font-mono">"AfroMessage"</span> ወይም <span className="font-mono">"Verify"</span>) በራስ-ሰር በመጠቀም መልዕክቱ ወዲያውኑ ለተገልጋዩ እንዲደርስ ያደርጋል።
                        </p>
                      </div>

                      <div>
                        <span className="block text-xs font-extrabold text-[#0f384c] flex items-center space-x-1.5">
                          <span>አማራጭ ፪፦ በአንድሮይድ ስልክ (Android Mobile) የኤስኤምኤስ ጌትዌይ መጠቀም 🌟</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full">ምርጥ ምርጫ</span>
                        </span>
                        
                        <div className="text-[10px] text-slate-750 font-medium mt-1.5 space-y-2 font-sans">
                          <p className="font-sans leading-relaxed">
                            <strong>ለምን ይመረጣል?</strong> <br />
                            ፩. ምንም ዓይነት የንግድ ፈቃድ ወይም ከ Ethio Telecom ጋር ውል ማሰር አያስፈልገውም። በአስር ደቂቃ ውስጥ በነፃ መጀመር ይችላሉ። <br />
                            ፪. መልዕክቱ የሚሄደው በእርስዎ ስልክ ቁጥር ስለሆነ ተገልጋዩ እራሱ ማን እንደላከለት ስልክ ቁጥሩን በግልጽ ያያል። ደውሎም ሊያናግርዎት ይችላል። <br />
                            ፫. ክፍያው ልክ እንደ መደበኛ መልዕክት ሲሆን፣ የ Ethio Telecom የአጭር መልዕክት ጥቅል (SMS bundle — ለምሳሌ ለወር የሚሆን 1,000 ኤስኤምኤስ በጥቂት ብር) በመግዛት እጅግ በጣም ርካሽ በሆነ ዋጋ መጠቀም ይችላሉ።
                          </p>
                          <div className="bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/50 space-y-1">
                            <span className="block font-black text-amber-950 text-[10px]">የአጠቃቀም መመሪያ፦</span>
                            <ol className="list-decimal pl-4 space-y-1 text-slate-750 font-medium text-[9.5px]">
                              <li>አንድ የቆየ ወይም ትርፍ አንድሮይድ ስልክ በመውሰድ የ Ethio Telecom ሲም ካርድ ያስገቡበት። ጥቅል ስማርት ኤስኤምኤስ ይግዙ።</li>
                              <li>በስልኩ ላይ ከ Google Play Store ወይም F-Droid ላይ ነባሪ የኤስኤምኤስ ጌትዌይ መተግበሪያ ይጫኑ (ለምሳሌ፦ <strong className="text-black">"Akiage SMS Gateway"</strong>, <strong className="text-black">"SMS Gateway API"</strong> ወይም <strong className="text-black">"SmsGateway.me"</strong>)።</li>
                              <li>መተግበሪያውን ከፍተው የ <strong className="text-black">"Start Server"</strong> ቁልፍን ይጫኑ። መተግበሪያው የአይፒ አድራሻ ይሰጥዎታል (ለምሳሌ፦ <span className="font-mono bg-white px-1">http://192.168.1.15:8080/send</span>)።</li>
                              <li>ያንን አድራሻ እዚህ በስተግራ በኩል <strong className="text-[#0f384c]">"የጌትዌይ URL አድራሻ"</strong> በሚለው ውስጥ ያስገቡ። የኤፒአይ ደህንነት ቁልፉን (API Key) እና ላኪ መታወቂያውን (Sender ID) ባዶ አድርገው ያስቀምጡ።</li>
                              <li>ስልክዎ እና ይህ ኮምፒውተር በአንድ የዋይፋይ (WiFi) ኔትወርክ ወይም የስልክ ሆትስፖት (Hotspot) መገናኘታቸውን ያረጋግጡና "የጌትዌይ ቅንብሮችን አስቀምጥ"ን ተጭነው በ "የሙከራ SMS ላክ" ይፈትሹ!</li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-amber-250/50 pt-2.5">
                        <span className="block text-xs font-extrabold text-amber-900 flex items-center space-x-1.5">
                          <span>አማራጭ ፫፦ ከቢሮ ውጭ ሲሆኑ ወይም በተመሳሳይ ዋይፋይ (Wi-Fi) ካልሆኑ እንዴት ይሰራል? ✈️</span>
                          <span className="bg-amber-200 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded-full">የርቀት ስራ</span>
                        </span>
                        <div className="text-[10px] text-slate-755 font-medium mt-1.5 space-y-2 font-sans">
                          <p className="font-sans leading-relaxed">
                            ቢሮ ውስጥ ካልሆኑ፣ ለእረፍት ከወጡ፣ ወይም በተለያዩ ቦታዎች ሆነው ባለሙያዎች መታወቂያ ሲመዘግቡ መልዕክት ወዲያው መላክ እንዲቻል የሚከተሉትን <strong>ሁለት ቀላል የርቀት መንገዶች</strong> መጠቀም ይችላሉ፦
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-slate-750 font-medium text-[9.5px]">
                            <li>
                              <strong className="text-[#0f384c]">ዘዴ ሀ) በደመና ላይ የሚሰሩ የስልክ ኤስኤምኤስ ጌትዌይ መተግበሪያዎችን መጠቀም (Cloud-linked SMS Apps)፦</strong> <br />
                              ከተመሳሳይ ዋይፋይ ውልጭ ከየትኛውም የዓለም ክፍል ለመስራት በስልክዎ ላይ በደመና (Cloud Interface) የሚሰሩ የጌትዌይ መተግበሪያዎችን ጭኖ መጠቀም ይችላሉ (ለምሳሌ፦ <strong className="text-black">"SMS Gateway.me"</strong> ወይም <strong className="text-black">"SmsSync"</strong>)። <br />
                              እነዚህ መተግበሪያዎች ስልክዎ መደበኛ የሞባይል ኢንተርኔት ዳታ (3G/4G) እስካለው ድረስ ስልክዎ ኪስዎ ውስጥ ሆኖ እንኳን ከሲስተማችን የሚላከውን መልዕክት ተቀብለው ለተገልጋዩ ይልካሉ! በዋይፋይ መገደብ አይኖርብዎትም።
                            </li>
                            <li className="mt-1.5">
                              <strong className="text-[#0f384c]">ዘዴ ለ) AfroMessage ያለ 'Identifier' (ላኪ ስም) መጠቀም (100% አስተማማኝ እና ከስልክ ነፃ)፦</strong> <br />
                              ይህ ዘዴ ስልክዎ እንዲበራ ወይም ዋይፋይ እንዲኖረው ጨርሶ <strong>አያስፈልገውም!</strong> <br />
                              በ AfroMessage ላይ የራስዎ የላኪ ስም (Identifier) እስኪጸድቅ ድረስ በሲስተሙ ላይ <strong className="text-black">የላኪ መታወቂያ (Sender ID) ባዶ አድርገው ይተውት።</strong> በዚህ ጊዜ ሲስተሙ የ AfroMessage ነባሪ የላኪ ስም በመጠቀም ከደመና 24 ሰዓት በቋሚነት ያለምንም ዋይፋይ ገደብ ይሰራል!
                            </li>
                          </ul>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* ============================================== */}
      {/* 4. MODALS (NO-PRINT) */}
      {/* ============================================== */}
      {/* ============================================== */}
      {/* 4. MODALS (NO-PRINT) */}
      {/* ============================================== */}
      {/* Scanned Resident Document View Modal */}
      {selectedViewDoc !== null && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full h-[88vh] overflow-hidden border border-slate-100 flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#0f405c] text-white px-5 py-3.5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3 truncate">
                <div className="p-2 bg-white/10 rounded-xl shrink-0">
                  <FileText className="w-5 h-5 text-teal-300 animate-pulse" />
                </div>
                <div className="truncate text-left">
                  <h3 className="text-[10px] uppercase font-bold tracking-wider text-teal-300">የተቃኘ የነዋሪነት ሰነድ ምልከታና ማህደር ማስተካከያ (Visual Scan Studio)</h3>
                  <p className="text-sm font-black text-white truncate max-w-[280px] sm:max-w-md">ባለቤት፦ {selectedViewDoc.houseOwnerName || selectedViewDoc.residentName || "ያልተሰየመ"}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedViewDoc(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xs font-black shrink-0 cursor-pointer"
                title="ዝጋ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Split view (Left: Rich Interactive Scan viewer, Right: Metadata & Members Registry) */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
              
              {/* Left Pane: Interactive document container (Zoom, Rotate, Carousel) */}
              <div className="md:col-span-7 bg-slate-100 h-full p-4 flex flex-col justify-between relative overflow-hidden min-h-[350px] md:min-h-0 border-r border-slate-200">
                {(() => {
                  // Resolve pages array (backwards compatible with single root files)
                  const pageFiles: ScannedFile[] = (selectedViewDoc.files && selectedViewDoc.files.length > 0)
                    ? selectedViewDoc.files
                    : [{
                        id: 'fallback_root_page',
                        fileName: selectedViewDoc.fileName || 'ሰነድ.pdf',
                        fileSize: selectedViewDoc.fileSize || 'W/0',
                        contentUrl: selectedViewDoc.contentUrl || '',
                        uploadDate: selectedViewDoc.uploadDate
                      }];

                  if (pageFiles.length === 0 || !pageFiles[0]?.contentUrl) {
                    return (
                      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white rounded-2xl border text-center my-auto">
                        <AlertTriangle className="w-10 h-10 text-amber-500 mb-2 animate-bounce-short" />
                        <h4 className="text-xs font-extrabold text-slate-800">የተጫነ ፋይል አልተገኘም!</h4>
                        <p className="text-[10px] text-slate-450 mt-1">ይህ መዝገብ ባዶ ነው። እባክዎ ከታች ያለውን ቁልፍ ተጠቅመው የተቃኘ ገጽ ያስገቡ።</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Active File Navigation & Toolstrip header bar */}
                      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap justify-between items-center gap-2 mb-3 z-10 w-full shrink-0">
                        {/* Page Indicators */}
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] font-extrabold text-teal-900 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"></span>
                            ጠቅላላ ገጾች፦ <strong className="text-[11px] font-sans">{pageFiles.length}</strong>
                          </span>
                        </div>

                        {/* Interactive visibility controls (Zoom & Rotate) */}
                        <div className="flex items-center space-x-1 text-slate-700 font-sans">
                          <span className="text-[9px] font-bold text-slate-400 mr-1">ሁሉንም አጉላ፦</span>
                          <button
                            type="button"
                            onClick={() => setResDocZoom(prev => Math.max(0.4, prev - 0.2))}
                            className="p-1 w-7 h-7 bg-slate-50 hover:bg-slate-150 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0"
                            title="Zoom Out (ትንሽ አድርግ)"
                          >
                            ➖
                          </button>
                          <span className="text-[9.5px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 tracking-tighter shrink-0">
                            {Math.round(resDocZoom * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setResDocZoom(prev => Math.min(3.0, prev + 0.2))}
                            className="p-1 w-7 h-7 bg-slate-50 hover:bg-slate-150 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0"
                            title="Zoom In (ከትልቅ አድርግ)"
                          >
                            ➕
                          </button>
                          <button
                            type="button"
                            onClick={() => setResDocRotate(prev => (prev + 90) % 360)}
                            className="p-1 w-7 h-7 bg-slate-50 hover:bg-slate-150 rounded-lg text-xs transition flex items-center justify-center shrink-0"
                            title="Rotate Right (በ90 ዲግሪ አሽከርክር)"
                          >
                            🔄
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResDocZoom(1);
                              setResDocRotate(0);
                            }}
                            className="p-1 px-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-bold transition shrink-0"
                            title="Reset Layout Settings"
                          >
                            ↩ Reset
                          </button>
                        </div>
                      </div>

                      {/* Display Viewport: Unified Scroll Viewport of All Pages */}
                      <div className="flex-1 w-full overflow-y-auto space-y-4 p-3 bg-slate-250/30 rounded-2xl border border-slate-300/40 custom-scrollbar relative min-h-[300px] max-h-[58vh]">
                        {pageFiles.map((fileObj, idx) => {
                          const fileUrl = fileObj.contentUrl;
                          const isPdf = fileUrl?.startsWith('data:application/pdf') || fileObj.fileName?.toLowerCase().endsWith('.pdf');
                          const isImage = fileUrl?.startsWith('data:image/');

                          return (
                            <div 
                              key={fileObj.id || idx} 
                              id={`doc-page-view-${idx}`}
                              className="bg-white p-3 rounded-2xl border border-slate-150 shadow-xs space-y-2 text-left"
                            >
                              {/* individual Page Header */}
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="text-left font-sans flex items-center truncate max-w-[70%]">
                                  <span className="inline-flex items-center justify-center bg-[#0f405c] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full mr-2 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-[#0f384c] truncate" title={fileObj.fileName}>
                                    {fileObj.fileName}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 ml-2 bg-slate-100 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                                    {fileObj.fileSize}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`እርግጠኛ ነዎት ገጽ ${idx + 1} ("${fileObj.fileName}") ከማህደሩ ውስጥ ማጥፋት ይፈልጋሉ?`)) {
                                      handleDeleteFileFromDoc(selectedViewDoc.id, fileObj.id);
                                    }
                                  }}
                                  className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-100 hover:border-rose-600 text-[9px] font-black px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>ሰርዝ</span>
                                </button>
                              </div>

                              {/* Media Render */}
                              <div className="w-full bg-slate-50/50 rounded-xl overflow-hidden flex items-center justify-center relative p-1 border border-slate-200/60 min-h-[160px]">
                                {isPdf ? (
                                  <div className="w-full h-[520px] relative overflow-hidden" style={{ transform: `scale(${resDocZoom}) rotate(${resDocRotate}deg)`, transition: 'transform 0.15s ease-out' }}>
                                    <iframe 
                                      src={fileUrl} 
                                      className="w-full h-full rounded-lg border border-slate-200 bg-white" 
                                      title={fileObj.fileName}
                                    ></iframe>
                                    {resDocZoom !== 1 && (
                                      <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[8px] font-bold px-2 py-0.5 rounded font-sans">
                                        Zoom is managed inside browser toolbar.
                                      </span>
                                    )}
                                  </div>
                                ) : isImage ? (
                                  <div className="w-full overflow-auto flex items-center justify-center p-2 custom-scrollbar">
                                    <img 
                                      src={fileUrl} 
                                      style={{ transform: `scale(${resDocZoom}) rotate(${resDocRotate}deg)`, transition: 'transform 0.15s ease-out' }}
                                      className="max-w-full max-h-[750px] object-contain rounded-lg shadow-sm border border-slate-200" 
                                      referrerPolicy="no-referrer" 
                                      alt={fileObj.fileName} 
                                    />
                                  </div>
                                ) : (
                                  <div className="p-6 bg-white rounded-2xl border shadow-xs max-w-sm text-center">
                                    <FileSpreadsheet className="w-8 h-8 text-teal-850 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-slate-800">ቅድመ-ዕይታ መክፈት አልተቻለም (Unsupported format)</p>
                                    <p className="text-[9px] text-slate-500 font-bold mt-1">ፋይል፡ {fileObj.fileName}</p>
                                    <a 
                                      href={fileUrl} 
                                      download={fileObj.fileName} 
                                      className="inline-flex mt-2 bg-[#0f405c] hover:bg-[#072436] text-white px-3 py-1.5 rounded-lg text-[9px] font-black shadow-xs transition items-center space-x-1"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>ሰነዱን ያውርዱ (Download)</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Thumbnail Strip Gallery & Actions to Append Files */}
                      <div className="mt-2.5 space-y-2 shrink-0 w-full">
                        {/* Interactive Page list thumbnails strip if multiple pages are present */}
                        {pageFiles.length > 1 && (
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 leading-none">
                            <span className="text-[8px] font-black text-slate-400 block uppercase mb-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>ፈጣን ዝላይ (ለመዝለል ጠቅ ያድርጉ)፦</span>
                            </span>
                            <div className="flex space-x-1.5 overflow-x-auto py-1 scrollbar-thin">
                              {pageFiles.map((file, idx) => (
                                <button
                                  key={file.id || idx}
                                  type="button"
                                  onClick={() => {
                                    document.getElementById(`doc-page-view-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }}
                                  className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-slate-200/80 hover:border-amber-300 rounded-lg text-[9.5px] font-bold text-slate-700 hover:text-amber-950 font-sans flex items-center gap-1 transition shrink-0 cursor-pointer"
                                  title={`ወደ ገጽ ${idx + 1} ዝለል`}
                                >
                                  📄 ገጽ {idx + 1}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Direct Drag & Select zone inside the Modal to append more disjointed pages */}
                        <div className="bg-teal-50/40 p-2.5 rounded-2xl border border-dashed border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                          <div className="flex items-center space-x-2">
                            <span className="p-1.5 bg-teal-100 border border-teal-200 rounded-lg text-teal-800">
                              <Plus className="w-3.5 h-3.5 animate-pulse" />
                            </span>
                            <div>
                              <h5 className="text-[9.5px] text-teal-950 font-extrabold leading-normal">የተበታተኑ ገጾችን እዚህ አያይዝ (Append Scan Page)</h5>
                              <p className="text-[8px] text-slate-450 font-bold font-sans">ይህንን ቤት የሚመለከቱ አዳዲስ የተቃኙ ወረቀቶች/ካርታዎችን በማጣመር አንድ ላይ ያስቀምጡ።</p>
                            </div>
                          </div>
                          
                          <input 
                            type="file" 
                            id="appendModalPageInput" 
                            multiple
                            accept="application/pdf,image/*"
                            className="hidden" 
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                const tempScans: ScannedFile[] = [];
                                Array.from(files).forEach((file: any) => {
                                  if (file.size > 20 * 1024 * 1024) {
                                    alert(`ፋይል "${file.name}" መጠን ከ20MB ይበልጣል።`);
                                    return;
                                  }
                                  const kb = file.size / 1024;
                                  const sizeStr = kb > 1024 ? (kb / 1024).toFixed(2) + " MB" : kb.toFixed(1) + " KB";
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if (ev.target?.result) {
                                      const newScanned: ScannedFile = {
                                        id: 'scan_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                                        fileName: file.name,
                                        fileSize: sizeStr,
                                        contentUrl: ev.target.result as string,
                                        uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`
                                      };
                                      tempScans.push(newScanned);
                                      if (tempScans.length === files.length) {
                                        handleAddNewFilesToDoc(selectedViewDoc.id, tempScans);
                                      }
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                });
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => document.getElementById('appendModalPageInput')?.click()}
                            className="bg-teal-700 hover:bg-[#0f405c] text-white font-extrabold text-[9px] px-3.5 py-2 rounded-xl cursor-pointer shadow-sm active:scale-95 transition whitespace-nowrap"
                          >
                            + የተበታተነ ፋይል አያይዝ
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Right Pane: Document details, Notes, and Detailed Household Members Registry */}
              <div className="md:col-span-5 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 h-full overflow-y-auto bg-slate-50/50">
                <div className="space-y-4">
                  {/* Badge & Print Action */}
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="inline-block px-3 py-1 bg-teal-100 border border-teal-200 text-teal-900 text-[10px] font-black rounded-full tracking-wide">
                      🏷️ {selectedViewDoc.docType}
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400 font-mono">ID: {selectedViewDoc.id.substring(0, 8)}...</span>
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-3 border-b pb-3.5 text-xs">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">የቤት ባለቤት ሙሉ ስም፡</span>
                      <strong className="text-sm font-black text-[#0f384c]">{selectedViewDoc.houseOwnerName || selectedViewDoc.residentName}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">የቤት ምዝገባ ቁጥር (Reg No.)</span>
                        <strong className="text-xs font-black text-slate-800 font-mono bg-white border border-slate-150 px-2 py-1 rounded inline-block mt-0.5">{selectedViewDoc.idNumber || "የለውም"}</strong>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">የቤት ቁጥር (House No.)</span>
                        <strong className="text-xs font-black text-[#0f405c] font-mono bg-amber-50 border border-amber-150 px-2 py-1 rounded inline-block mt-0.5">{selectedViewDoc.houseNumber || "የለውም"}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      <div>
                        <span className="text-slate-400 block font-bold text-[8.5px] uppercase">የተመዘገበበት ቀን</span>
                        <span className="text-slate-700 font-medium font-sans">{selectedViewDoc.uploadDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[8.5px] uppercase">የመዘገበው አካል</span>
                        <span className="text-slate-700 font-extrabold text-[#0f405c]">{selectedViewDoc.uploadedBy || "ወረዳ 05 ባለሙያ"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Interactive Household Members Zone (Supports lists of over 20+ members) */}
                  <div className="space-y-2 border-b bg-[#0f405c]/5 p-3 rounded-2xl border border-[#0f405c]/10 pb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black text-[#0f405c] flex items-center gap-1">
                        <Fingerprint className="w-4 h-4 text-teal-600 animate-pulse" />
                        <span>የቤት ውስጥ ነዋሪዎች ሰንጠረዥ ({selectedViewDoc.members?.length || 0} አባላት)</span>
                      </span>
                    </div>

                    {/* Clerk search inside internal modal panel for households with 20+ members */}
                    <div className="relative mt-2">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="በዚህ ቤት ቁጥር ያሉ ነዋሪዎችን እዚህ ይፈልጉ..."
                        value={resDocMemberSearch}
                        onChange={(e) => setResDocMemberSearch(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.8 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-800 font-bold placeholder-slate-350"
                      />
                    </div>

                    {/* Scrollable member register viewport */}
                    {(() => {
                      const baseMembers = selectedViewDoc.members || [];
                      const filteredMembers = baseMembers.filter(m => 
                        m.fullName.toLowerCase().includes(resDocMemberSearch.toLowerCase().trim())
                      );

                      if (baseMembers.length === 0) {
                        return (
                          <div className="text-center py-4 bg-white/75 rounded-xl border border-slate-150 text-[9px] text-slate-400 italic">
                            በዚህ ቤት ስር እስካሁን የተመዘገበ አብሮ ነዋሪ የለም። በአንድ ሰው ቤት ውስጥ ከ20 ሰው በላይ ቢኖርም ከታች ያለውን ፎርም በመጠቀም መመዝገብ ይችላሉ።
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-1 max-h-[145px] overflow-y-auto pr-0.5 scrollbar-thin">
                          {filteredMembers.map((m, idx) => {
                            let bStyle = "bg-sky-50 text-sky-850 border-sky-100";
                            if (m.role === 'የቤት ባለቤት') bStyle = "bg-blue-50 text-blue-900 border-blue-150";
                            else if (m.role === 'ተከራይ') bStyle = "bg-amber-50 text-amber-900 border-amber-150";
                            else if (m.role === 'ሌላ') bStyle = "bg-purple-50 text-purple-900 border-purple-150";

                            return (
                              <div key={m.id || idx} className="flex justify-between items-center p-1.5 bg-white border border-slate-150/80 rounded-xl text-[9.5px] hover:bg-slate-50 transition gap-2">
                                <div className="min-w-0 flex-1 flex items-center space-x-1.5">
                                  <span className="text-[8px] font-black text-slate-400 font-sans">{idx + 1}.</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-sans font-black text-slate-800 truncate" title={m.fullName}>{m.fullName}</p>
                                    {m.idNumber && <p className="text-[7.5px] font-mono text-slate-400">መታወቂያ፡ {m.idNumber}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5 shrink-0">
                                  <span className={`text-[7.5px] px-2 py-0.5 rounded-full border font-bold ${bStyle}`}>
                                    {m.role}
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteMemberFromDoc(selectedViewDoc.id, m.id)}
                                    className="text-rose-500 hover:text-white hover:bg-rose-600 p-1 rounded-lg transition"
                                    title="ነዋሪውን አስወግድ"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {filteredMembers.length === 0 && (
                            <p className="text-[9px] text-center text-slate-400 italic py-2">ምንም የሚዛመድ ነዋሪ አልተገኘም!</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Inline helper form to QUICK-ADD a member inside the modal */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 mt-2 space-y-1.5">
                      <span className="text-[8.5px] font-extrabold text-[#0f405c] uppercase block">👥 አዲስ የቤት አባል መመዝገቢያ</span>
                      <div className="grid grid-cols-1 gap-1.5 font-sans">
                        <input 
                          type="text" 
                          placeholder="የተጨማሪ ነዋሪው ሙሉ ስሪት..."
                          value={modalNewMemberName}
                          onChange={(e) => setModalNewMemberName(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg text-[9.5px] font-bold focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-800"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={modalNewMemberRole}
                            onChange={(e) => setModalNewMemberRole(e.target.value as any)}
                            className="p-1.5 border border-slate-200 rounded-lg text-[9px] font-bold bg-slate-50 focus:outline-none font-sans"
                          >
                            <option value="ቤተሰብ">ቤተሰብ (Family)</option>
                            <option value="የቤት ባለቤት">የቤት ባለቤት (Owner)</option>
                            <option value="ተከራይ">ተከራይ (Tenant)</option>
                            <option value="ሌላ">ሌላ (Other)</option>
                          </select>
                          <input 
                            type="text" 
                            placeholder="የነዋሪነት ID"
                            value={modalNewMemberId}
                            onChange={(e) => setModalNewMemberId(e.target.value)}
                            className="p-1.5 border border-slate-200 rounded-lg text-[9px] font-mono focus:outline-none"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            if (!modalNewMemberName.trim()) {
                              alert("እባክዎ መጀመሪያ የነዋሪውን ሙሉ ስም ያስገቡ!");
                              return;
                            }
                            const mb: HouseholdMember = {
                              id: 'memb_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                              fullName: modalNewMemberName.trim(),
                              role: modalNewMemberRole,
                              idNumber: modalNewMemberId.trim() || undefined
                            };
                            handleAddNewMemberToDoc(selectedViewDoc.id, mb);
                            setModalNewMemberName('');
                            setModalNewMemberId('');
                          }}
                          className="w-full bg-teal-800 hover:bg-teal-950 text-white py-1 text-[9.5px] font-extrabold rounded-lg flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-teal-300" />
                          <span>አባል ወደ መዝገቡ ጨምር (Add)</span>
                        </button>
                      </div>
                    </div>

                    {/* Cross-reference from the Daily printed ID records for unmatched family members */}
                    {(() => {
                      const houseNo = selectedViewDoc.houseNumber || '';
                      if (!houseNo) return null;
                      const matchingInventory = idInventory.filter(item => 
                        item.houseNumber && item.houseNumber.trim().toLowerCase() === houseNo.trim().toLowerCase()
                      );
                      const baseMembers = selectedViewDoc.members || [];
                      const unaddedMatching = matchingInventory.filter(inv => 
                        !baseMembers.some(m => m.fullName.toLowerCase() === inv.name.trim().toLowerCase())
                      );
                      if (unaddedMatching.length === 0) return null;
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-1 text-left">
                          <span className="text-[8.5px] font-black text-amber-900 block uppercase flex items-center gap-1">
                            <Fingerprint className="w-3.5 h-3.5 text-amber-700 animate-pulse shrink-0" />
                            <span>በቀኑ ርክክብ መዝገብ የተገኙ ተጨማሪ የቤት አባላት ({unaddedMatching.length})፦</span>
                          </span>
                          <div className="flex flex-wrap gap-1 leading-none py-1">
                            {unaddedMatching.map((inv) => (
                              <button
                                type="button"
                                key={inv.id}
                                onClick={() => {
                                  const mb: HouseholdMember = {
                                    id: 'memb_inv_' + inv.id + '_' + Date.now(),
                                    fullName: inv.name.trim(),
                                    role: 'ቤተሰብ',
                                    idNumber: inv.idNumber || undefined
                                  };
                                  handleAddNewMemberToDoc(selectedViewDoc.id, mb);
                                }}
                                className="inline-flex items-center space-x-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-sans font-bold text-[8px] px-1.5 py-0.5 rounded transition cursor-pointer"
                                title="ይህንን አባል በመዝገቡ ውስጥ አስመዝግብ"
                              >
                                <span>+ {inv.name}</span>
                                {inv.idNumber && <span className="opacity-60 text-[6.5px] font-mono">({inv.idNumber})</span>}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={async () => {
                                let currentMembers = [...baseMembers];
                                unaddedMatching.forEach(inv => {
                                  const mb: HouseholdMember = {
                                    id: 'memb_inv_' + inv.id + '_' + Date.now(),
                                    fullName: inv.name.trim(),
                                    role: 'ቤተሰብ',
                                    idNumber: inv.idNumber || undefined
                                  };
                                  currentMembers.push(mb);
                                });
                                const updatedDocs = residentDocs.map(docItem => {
                                  if (docItem.id === selectedViewDoc.id) {
                                    return {
                                      ...docItem,
                                      members: currentMembers
                                    };
                                  }
                                  return docItem;
                                });
                                const updatedDoc = updatedDocs.find(d => d.id === selectedViewDoc.id);
                                if (updatedDoc) {
                                  if (!isFirebaseMock) {
                                    try {
                                      await setDoc(doc(db, 'residentDocuments', selectedViewDoc.id), updatedDoc);
                                    } catch (e) {
                                      console.error("Firestore update failed:", e);
                                    }
                                  }
                                  setResidentDocs(updatedDocs);
                                  saveState('W05_residentDocs', updatedDocs);
                                  setSelectedViewDoc(updatedDoc);
                                  alert("ሁሉም የተገኙ አባላት በተሳካ ሁኔታ ተመዝግበዋል!");
                                }
                              }}
                              className="bg-amber-700 hover:bg-amber-800 text-white font-black text-[8px] px-2 py-0.5 rounded transition cursor-pointer shrink-0"
                            >
                              ✓ ሁሉንም አክል (Add All)
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Notes panel */}
                  {selectedViewDoc.notes && (
                    <div className="space-y-1">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-450 font-black">ማስታወሻ / የተጨማሪ መረጃ መግለጫ</span>
                      <p className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 font-medium text-[10px] leading-relaxed text-slate-600 italic">
                        "{selectedViewDoc.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer secure guidelines and close */}
                <div className="space-y-2.5 pt-3.5 border-t border-slate-200 mt-4 no-print text-[9px] text-slate-400 leading-normal font-sans tracking-tight">
                  <p className="font-extrabold text-slate-450">
                    🔒 ጥንቃቄ፦ የነዋሪዎች የተቃኙ ወረቀቶች በደመና (Cloud Database) ላይ የተቀመጡ ምስጢራዊ የሲቪል ህጋዊ መረጃዎች በመሆናቸው ለሌላ ሰው እንዳያሳዩ በጥብቅ የተከለከለ ነው።
                  </p>

                  <div className="flex space-x-2 pt-1 font-extrabold text-xs shrink-0 self-end">
                    <a
                      href={selectedViewDoc.contentUrl}
                      download={selectedViewDoc.fileName}
                      className="flex-1 bg-[#0f405c] hover:bg-[#072436] text-white font-extrabold py-2 px-4 rounded-xl shadow-md transition items-center justify-center space-x-2 flex text-center cursor-pointer font-sans text-[10.5px]"
                    >
                      <Download className="w-4 h-4 text-teal-300" />
                      <span>ፋይል አውርድ</span>
                    </a>
                    <button
                      onClick={() => setSelectedViewDoc(null)}
                      className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-755 font-extrabold rounded-xl transition cursor-pointer text-[10.5px]"
                    >
                      ዝጋ
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Electronic ID Pickup Confirmation Drawer Signature Pad modal */}
      {selectedHandoverIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-teal-600/20">
            
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-teal-900">የመታወቂያ ርክክብ እና ፊርማ ማረጋገጫ</h3>
              <button 
                onClick={() => setSelectedHandoverIndex(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p>
                የተገልጋይ ስም: <strong className="text-slate-900 font-bold">{idInventory[selectedHandoverIndex].name}</strong><br />
                የመታወቂያ ቁጥር: <strong className="font-mono">{idInventory[selectedHandoverIndex].idNumber}</strong>
              </p>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500">ርክክብ የተደረገበት ቀን</label>
                <input 
                  type="text" 
                  value={ethDateNow} 
                  className="w-full p-2 border rounded bg-slate-50 font-bold" 
                  readOnly 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-teal-800 mb-1">የተረካቢ/የወሰደው ሰው ፊርማ (Draw Signature)</label>
                <SignaturePad 
                  onSave={(dataUrl) => setHandoverSignature(dataUrl)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t text-xs font-bold">
              <button 
                onClick={() => setSelectedHandoverIndex(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                ሰርዝ
              </button>
              <button 
                onClick={confirmHandover}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl shadow-md transition"
              >
                ይጸድቅ (የወሰደ)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SMS Notification Modal (በ SMS ለማሳወቅ) */}
      {smsModalOpen && smsRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-150 flex flex-col">
            {/* Modal Header */}
            <div className="bg-cyan-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">ለነዋሪው አጭር የSMS መልዕክት መላኪያ</h3>
                  <p className="text-[10px] text-slate-300 font-bold mt-0.5">የቦሌ ወረዳ 05 የዲጂታል SMS ማሳወቂያ መድረክ (SMS Center)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xs font-black"
                title="ዝጋ"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>ተቀባይ (Resident):</span>
                  <span className="text-cyan-900 font-black">{smsRecord.name}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>የስልክ ቁጥር:</span>
                  <span className="font-mono text-cyan-900 font-black">{smsRecord.phone}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>የመታወቂያ ቁጥር:</span>
                  <span className="font-mono text-cyan-900 font-black">{smsRecord.idNumber}</span>
                </div>
              </div>

              {/* Language Preset Toggles */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase text-slate-400 font-black tracking-wider">ቋንቋ ምረጥ (Message Language Presets)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const template = `ጤና ይስጥልኝ ${smsRecord.name}፣ የቦሌ ወረዳ 05 የነዋሪ መታወቂያዎ (ቁጥር ${smsRecord.idNumber}) ታትሞ ተዘጋጅቷል። እባክዎ ቀዳሚ መታወቂያዎን ወይም የልደት ካርድዎን በመያዝ በስራ ሰዓት በአካል መጥተው ከምድብ መስኮት 3 (Window 3) ላይ ይረከቡ። አመሰግናለን!`;
                      setSmsText(template);
                    }}
                    className="py-2 px-3 bg-slate-55 hover:bg-slate-100 text-slate-800 text-[10px] font-black rounded-xl border border-slate-200 transition"
                  >
                    🇪🇹 አማርኛ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const template = `Akkam jirtu ${smsRecord.name} Kartaan Eenyummeessaa jiraattota Bolee Woreda 05 keessan (Lakk. ${smsRecord.idNumber}) qopha'ee jira. Maaloo ragaa dhuunfaa ykn kaardii dhalootaa keessan qabachuun foddaa 3 (Window 3) irratti dhuftanii fudhachuu dandeessu. Galatoomaa!`;
                      setSmsText(template);
                    }}
                    className="py-2 px-3 bg-slate-55 hover:bg-slate-100 text-slate-800 text-[10px] font-black rounded-xl border border-slate-200 transition"
                  >
                    🇪🇹 Afaan Oromoo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const template = `Hello ${smsRecord.name}, your Bole Woreda 05 Resident ID card (No. ${smsRecord.idNumber}) has been printed successfully. Please bring your old ID card or birth certificate to Window 3 to receive it. Thank you!`;
                      setSmsText(template);
                    }}
                    className="py-2 px-3 bg-slate-55 hover:bg-slate-100 text-slate-800 text-[10px] font-black rounded-xl border border-slate-200 transition"
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>

              {/* Message Input Box */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] uppercase text-slate-400 font-black tracking-wider">አጭር መልዕክት (SMS Body Content)</label>
                  <span className="text-[9px] text-slate-400 font-extrabold">{smsText.length} ፊደላት (chars)</span>
                </div>
                <textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  rows={5}
                  className="w-full text-xs p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white leading-relaxed font-bold font-sans"
                  placeholder="የ SMS መልዕክት እዚህ ይጻፉ..."
                  maxLength={400}
                />
              </div>

              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-100/50 text-[10px] leading-relaxed flex flex-col space-y-2">
                <div className="flex items-center space-x-2 font-black text-emerald-900">
                  <span className="text-sm">📱</span>
                  <span>የስልክ መላኪያ መረጃ (Direct Device SMS Guidance)</span>
                </div>
                <p className="font-bold text-slate-700">
                  የስራ ስልክ ቁጥርዎን <strong className="text-emerald-950 font-black underline bg-emerald-100 px-1 rounded font-mono">+251953991956</strong> በመጠቀም ያለምንም ክፍያ በቀጥታ በእርስዎ ሞባይል ላይ ኤስኤምኤስ ለመላክ <strong className="text-emerald-900 font-extrabold">"በስልክ ቀጥታ ላክ"</strong> የሚለውን ቁልፍ ይጫኑ። ሲስተሙ በራስ-ሰር መታወቂያውን የኤስኤምኤስ ተልኳል ምልክት ያደርጋል።
                </p>
                <div className="pt-1.5 border-t border-emerald-200/50 text-slate-500 font-bold">
                  በቴሌኮም በይነመረብ ጌትዌይ (Cloud Gateway API) ለመላክ ደግሞ ሌላኛውን ቁልፍ መጠቀም ይችላሉ።
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-black py-2.5 px-4 rounded-2xl text-[11px] transition cursor-pointer"
                disabled={isSmsSending}
              >
                ሰርዝ (Cancel)
              </button>
              
              <div className="flex items-center gap-2">
                {/* 1. Direct device SMS launcher */}
                <button
                  type="button"
                  onClick={sendSmsViaDeviceNativeApp}
                  disabled={isSmsSending || !smsText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white font-black py-2.5 px-4 rounded-2xl text-[11px] transition flex items-center space-x-1.5 shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-100" />
                  <span>በስልክ ቀጥታ ላክ (Send via Phone)</span>
                </button>

                {/* 2. Standard Cloud Gateway SMS executor */}
                <button
                  type="button"
                  onClick={triggerSmsNotification}
                  disabled={isSmsSending || !smsText.trim()}
                  className="bg-cyan-800 hover:bg-cyan-900 border border-cyan-700 text-white font-black py-2.5 px-4 rounded-2xl text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSmsSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>ጌትዌይ በመላክ ላይ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-cyan-200" />
                      <span>በጌትዌይ ላክ (Via API)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Service Requirements & Terms Overlay Modal */}
      {showRequirementsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100">
            {/* Header */}
            <div className="bg-[#0f384c] text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <FileText className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">ለአገልግሎቶች የሚያስፈልጉ መስፈርቶች እና ቅድመ ሁኔታዎች</h3>
                  <p className="text-[10px] text-slate-300 font-bold mt-0.5">የቦሌ ወረዳ 05 የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት መመሪያ ማህደር</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRequirementsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xs font-black"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Content Tabs area */}
            <div className="flex-grow p-5 overflow-y-auto space-y-5 font-sans">
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-100 text-xs font-bold leading-relaxed">
                ℹ️ <strong>መመሪያ፡</strong> በዚህ ክፍል በወረዳ 05 ለሚሰጡ ሁሉም የሲቪል ምዝገባ፣ የነዋሪነት መታወቂያ እና የሰነድ ማረጋገጫ አገልግሎቶች የሚጠየቁ ቅድመ ሁኔታዎችንና የሚያስፈልጉ ሰነዶችን በዝርዝር ማግኘት ይችላሉ። እባክዎ ቀድመው አስፈላጊ ሰነዶችን አያይዘው ይቅረቡ።
              </div>

              {/* Grid of Preset Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.map((item) => (
                  <div key={item.id} className="p-4 border border-slate-150 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition duration-200 space-y-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0f384c]" />
                      <span className="text-xs font-black text-[#0f384c]">{item.title}</span>
                    </div>

                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                      {item.description}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">ያስገዳጅ ሰነዶች ዝርዝር (Required docs):</p>
                      <div className="space-y-1">
                        {item.points.map((pt: string, index: number) => (
                          <div key={index} className="flex items-start space-x-1.5 text-[10px] text-slate-700 font-bold">
                            <span className="text-teal-600 font-black">✓</span>
                            <span>{pt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-between items-center sm:text-xs text-[10px] font-bold text-slate-500 shrink-0">
              <span>የጥሪ ማዕከል: 8065 / 7533</span>
              <button 
                type="button"
                onClick={() => setShowRequirementsModal(false)}
                className="bg-[#0f405c] hover:bg-[#072436] text-white font-extrabold py-2 px-5 rounded-xl text-xs transition"
              >
                ዝጋ (Close Window)
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 5. FOOTER SECTION - no print */}
      <footer className="bg-gradient-to-r from-teal-950 to-teal-900 text-slate-300 py-6 mt-12 text-xs no-print border-t border-teal-700">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-extrabold text-white">የቦሌ ወረዳ 05 የዲጅታል አገልግሎት ስርዓት - CRRSA</p>
            <p className="text-slate-400">© 2018 ዓ.ም ሁሉም መብቱ በህግ የተጠበቀ ነው። Digital Civil Registration Registry Suite</p>
            <p className="text-slate-400 text-[11px] font-semibold">መለሰ ስርዓት (Melese Sirat)</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-slate-400 font-medium items-center">
            <span>የጥሪ ማዕከል: <strong>7533</strong></span>
            <span>|</span>
            <span>ድረ-ገጽ: <strong>aacrrsa.gov.et</strong></span>
            <span>|</span>
            <span>ኢሜይል: <strong>info@aacrrsa.gov.et</strong></span>
          </div>
        </div>
      </footer>

    </div>
  );
}
