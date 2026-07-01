import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { 
  Search, FileText, CheckCircle2, Calendar, Clock, Lock, Unlock, LogOut, 
  Printer, Download, AlertTriangle, Menu, X, Plus, Trash2, ShieldCheck, 
  Languages, RefreshCw, Eye, ChevronRight, Check, FileSpreadsheet,
  ChevronDown, MessageSquare, Send, Smartphone, Camera, Sparkles, Globe, Folder, FolderClosed,
  Columns, Maximize2, Layers, BookOpen, Activity
} from 'lucide-react';

import { 
  IDRecord, GeneratedDocument, Form010Record, Form011Record, Form012Record, DocumentType, OnlinePortalTicket, ResidentDocument,
  ScannedFile, HouseholdMember, AuditLog
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

// 🚥 Custom glowing LED styling mapper for each service prerequisite type 🚥
const getServiceLedStyle = (reqId: string) => {
  const styles: Record<string, {
    bg: string;
    border: string;
    text: string;
    accent: string;
    glow: string;
    ledDot: string;
    ledGlowColor: string;
    shadow: string;
    emoji: string;
    nameAm: string;
  }> = {
    'req-birth': {
      bg: 'bg-cyan-50/40',
      border: 'border-cyan-200/90',
      text: 'text-cyan-950',
      accent: 'text-cyan-700',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
      ledDot: 'bg-cyan-500 shadow-cyan-400/90',
      ledGlowColor: 'rgba(6, 182, 212, 0.95)',
      shadow: '0 0 10px rgba(6, 182, 212, 0.6)',
      emoji: '👶',
      nameAm: 'የልደት ምዝገባ'
    },
    'req-marriage': {
      bg: 'bg-emerald-50/40',
      border: 'border-emerald-200/90',
      text: 'text-emerald-950',
      accent: 'text-emerald-700',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      ledDot: 'bg-emerald-500 shadow-emerald-400/90',
      ledGlowColor: 'rgba(16, 185, 129, 0.95)',
      shadow: '0 0 10px rgba(16, 185, 129, 0.6)',
      emoji: '💍',
      nameAm: 'የጋብቻ ምዝገባ'
    },
    'req-divorce': {
      bg: 'bg-rose-50/40',
      border: 'border-rose-200/90',
      text: 'text-rose-950',
      accent: 'text-rose-700',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
      ledDot: 'bg-rose-500 shadow-rose-400/90',
      ledGlowColor: 'rgba(244, 63, 94, 0.95)',
      shadow: '0 0 10px rgba(244, 63, 94, 0.6)',
      emoji: '💔',
      nameAm: 'የፍቺ ምዝገባ'
    },
    'req-death': {
      bg: 'bg-amber-50/40',
      border: 'border-amber-200/90',
      text: 'text-amber-950',
      accent: 'text-amber-700',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      ledDot: 'bg-amber-500 shadow-amber-400/90',
      ledGlowColor: 'rgba(245, 158, 11, 0.95)',
      shadow: '0 0 10px rgba(245, 158, 11, 0.6)',
      emoji: '🕊️',
      nameAm: 'የሞት ምዝገባ'
    },
    'req-adoption': {
      bg: 'bg-fuchsia-50/40',
      border: 'border-fuchsia-200/90',
      text: 'text-fuchsia-950',
      accent: 'text-fuchsia-700',
      glow: 'shadow-[0_0_20px_rgba(217,70,239,0.15)]',
      ledDot: 'bg-fuchsia-500 shadow-fuchsia-400/90',
      ledGlowColor: 'rgba(217, 70, 239, 0.95)',
      shadow: '0 0 10px rgba(217, 70, 239, 0.6)',
      emoji: '👪',
      nameAm: 'የጉዲፈቻ ምዝገባ'
    },
    'req-id-new': {
      bg: 'bg-sky-50/40',
      border: 'border-sky-200/90',
      text: 'text-sky-950',
      accent: 'text-sky-700',
      glow: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]',
      ledDot: 'bg-sky-500 shadow-sky-400/90',
      ledGlowColor: 'rgba(14, 165, 233, 0.95)',
      shadow: '0 0 10px rgba(14, 165, 233, 0.6)',
      emoji: '🏠',
      nameAm: 'አዲስ የነዋሪነት መታወቂያ'
    },
    'req-id-renew': {
      bg: 'bg-indigo-50/40',
      border: 'border-indigo-200/90',
      text: 'text-indigo-950',
      accent: 'text-indigo-700',
      glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
      ledDot: 'bg-indigo-500 shadow-indigo-400/90',
      ledGlowColor: 'rgba(99, 102, 241, 0.95)',
      shadow: '0 0 10px rgba(99, 102, 241, 0.6)',
      emoji: '🔄',
      nameAm: 'የነዋሪነት መታወቂያ እድሳት'
    },
    'req-id-replace': {
      bg: 'bg-orange-50/40',
      border: 'border-orange-200/90',
      text: 'text-orange-950',
      accent: 'text-orange-700',
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]',
      ledDot: 'bg-orange-500 shadow-orange-400/90',
      ledGlowColor: 'rgba(249, 115, 22, 0.95)',
      shadow: '0 0 10px rgba(249, 115, 22, 0.6)',
      emoji: '⚠️',
      nameAm: 'የጠፋ/የተበላሸ መታወቂያ'
    },
    'req-single': {
      bg: 'bg-blue-50/40',
      border: 'border-blue-200/90',
      text: 'text-blue-950',
      accent: 'text-blue-700',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
      ledDot: 'bg-blue-500 shadow-blue-400/90',
      ledGlowColor: 'rgba(59, 130, 246, 0.95)',
      shadow: '0 0 10px rgba(59, 130, 246, 0.6)',
      emoji: '📜',
      nameAm: 'ያላገባ ምስክር ወረቀት'
    },
    'req-life': {
      bg: 'bg-teal-50/40',
      border: 'border-teal-200/90',
      text: 'text-teal-950',
      accent: 'text-teal-700',
      glow: 'shadow-[0_0_20px_rgba(20,184,166,0.15)]',
      ledDot: 'bg-teal-500 shadow-teal-400/90',
      ledGlowColor: 'rgba(20, 184, 166, 0.95)',
      shadow: '0 0 10px rgba(20, 184, 166, 0.6)',
      emoji: '👤',
      nameAm: 'በሕይወት መኖር ማረጋገጫ'
    }
  };

  return styles[reqId] || {
    bg: 'bg-slate-50/40',
    border: 'border-slate-200/90',
    text: 'text-slate-950',
    accent: 'text-slate-700',
    glow: 'shadow-[0_0_20px_rgba(100,116,139,0.12)]',
    ledDot: 'bg-slate-500 shadow-slate-400/90',
    ledGlowColor: 'rgba(100, 116, 139, 0.95)',
    shadow: '0 0 10px rgba(100, 116, 139, 0.6)',
    emoji: '📋',
    nameAm: 'ሌላ አገልግሎት'
  };
};

const generateCursiveSignature = (name: string, fontName: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (fontName !== 'cursive') {
      const linkId = 'sig-font-' + fontName.replace(/\s+/g, '-');
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}&display=swap`;
        document.head.appendChild(link);
      }
    }

    ctx.font = `32px "${fontName}", "Brush Script MT", "Dancing Script", cursive`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-0.05);
    ctx.fillText(name, 0, 0);
    
    return canvas.toDataURL('image/png');
  }
  return '';
};

export default function App() {
  // Navigation & UI States
  const [activePortal, setActivePortal] = useState<'public' | 'admin'>('public');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [adminTab, setAdminTab] = useState<'handovers' | 'docs' | 'form010' | 'form011' | 'form012' | 'security' | 'prerequisites' | 'smsGateway' | 'residentDocs' | 'printingForms' | 'audit'>('handovers');
  const [activePrintForm, setActivePrintForm] = useState<'form010' | 'form011' | 'form012'>('form010');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  // New Language, dropdown, and custom menus states
  const [currentLang, setCurrentLang] = useState<'am' | 'or' | 'en'>('am');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [selectedPublicID, setSelectedPublicID] = useState<any | null>(null);
  const [selectedPublicReqId, setSelectedPublicReqId] = useState<string>('');
  
  // 🕒 Auto-rotate state management for Service Prerequisites (Default: 5 minutes = 300 seconds)
  const [rotateSecondsLeft, setRotateSecondsLeft] = useState<number>(300);
  const [autoRotateInterval, setAutoRotateInterval] = useState<number>(300); // 300s = 5m
  const [isAutoRotatePaused, setIsAutoRotatePaused] = useState<boolean>(false);

  // Handle manual requirement change, reset countdown, and pause auto-rotation to allow reading
  const handleManualReqSelect = (reqId: string) => {
    setSelectedPublicReqId(reqId);
    setRotateSecondsLeft(autoRotateInterval);
    setIsAutoRotatePaused(true); // Pause auto-rotation so they can read comfortably in peace
  };

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

  // Database States loaded from local storage (Multi-Woreda Aware)
  const [allIdInventory, setAllIdInventory] = useState<IDRecord[]>([]);
  const [allGeneratedDocs, setAllGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [allForm010, setAllForm010] = useState<Form010Record[]>([]);
  const [allForm011, setAllForm011] = useState<Form011Record[]>([]);
  const [allForm012, setAllForm012] = useState<Form012Record[]>([]);
  const [allResidentDocs, setAllResidentDocs] = useState<ResidentDocument[]>([]);
  const [allOnlineTickets, setAllOnlineTickets] = useState<OnlinePortalTicket[]>([]);

  // Multi-Woreda Scope Selector & State
  const [selectedWoreda, setSelectedWoreda] = useState<string>(() => {
    return localStorage.getItem('W05_selectedWoreda') || 'ቦሌ ወረዳ 05';
  });
  const [woredaDropdownOpen, setWoredaDropdownOpen] = useState(false);
  const [woredaList, setWoredaList] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('W05_woredaList');
      return stored ? JSON.parse(stored) : ['ቦሌ ወረዳ 05', 'ቦሌ ወረዳ 03', 'የካ ወረዳ 11', 'ቂርቆስ ወረዳ 02'];
    } catch {
      return ['ቦሌ ወረዳ 05', 'ቦሌ ወረዳ 03', 'የካ ወረዳ 11', 'ቂርቆስ ወረዳ 02'];
    }
  });

  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('all');
  const [auditWoredaFilter, setAuditWoredaFilter] = useState('current');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Specific Ethiopian Date Range Filters for Forms Audit (010, 011, 012)
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditDayFrom, setAuditDayFrom] = useState('');
  const [auditMonthFrom, setAuditMonthFrom] = useState('');
  const [auditYearFrom, setAuditYearFrom] = useState('');
  const [auditDayTo, setAuditDayTo] = useState('');
  const [auditMonthTo, setAuditMonthTo] = useState('');
  const [auditYearTo, setAuditYearTo] = useState('');
  const [auditViewMode, setAuditViewMode] = useState<'summary' | 'detailed'>('summary');

  useEffect(() => {
    localStorage.setItem('W05_selectedWoreda', selectedWoreda);
  }, [selectedWoreda]);

  const logAuditAction = async (action: string, details: string) => {
    const operatorName = localStorage.getItem('W05_activeStaffName') || 'የዕለቱ ተረኛ ባለሙያ';
    const ethTime = getEthiopianTime();
    const ethDate = getEthiopianDate();
    const newLog: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: `${ethDate} ${ethTime}`,
      woreda: selectedWoreda,
      action,
      operator: operatorName,
      details
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
      } catch (error) {
        console.error("Failed to log audit action:", error);
      }
    } else {
      setAuditLogs(prev => {
        const updated = [newLog, ...prev];
        localStorage.setItem('W05_auditLogs', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Filtered computed views
  const idInventory = allIdInventory.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const generatedDocs = allGeneratedDocs.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const form010 = allForm010.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const form011 = allForm011.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const form012 = allForm012.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const residentDocs = allResidentDocs.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
  const onlineTickets = allOnlineTickets.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);

  const filteredAuditLogs = auditLogs.filter(log => {
    // Woreda Filter
    if (auditWoredaFilter === 'current' && log.woreda !== selectedWoreda) {
      return false;
    }
    
    // Category Filter
    if (auditCategoryFilter !== 'all') {
      const act = log.action.toLowerCase();
      const det = log.details.toLowerCase();
      if (auditCategoryFilter === 'handovers') {
        const matches = act.includes('ርክክብ') || act.includes('መታወቂያ') || act.includes('id') || act.includes('hand') || act.includes('pickup');
        if (!matches) return false;
      } else if (auditCategoryFilter === 'docs') {
        const matches = act.includes('ሰነድ') || act.includes('ደብዳቤ') || act.includes('doc') || act.includes('ቅፅ') || act.includes('form');
        if (!matches) return false;
      } else if (auditCategoryFilter === 'profile') {
        const matches = act.includes('ነዋሪ') || act.includes('profile') || act.includes('member') || act.includes('resident');
        if (!matches) return false;
      } else if (auditCategoryFilter === 'security') {
        const matches = act.includes('ደህንነት') || act.includes('መግቢያ') || act.includes('መውጫ') || act.includes('login') || act.includes('logout') || act.includes('backup') || act.includes('restore') || act.includes('reset');
        if (!matches) return false;
      }
    }
    
    // Search Term
    if (auditSearch.trim()) {
      const term = auditSearch.toLowerCase();
      return (
        log.action.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        log.operator.toLowerCase().includes(term) ||
        log.timestamp.toLowerCase().includes(term) ||
        (log.woreda && log.woreda.toLowerCase().includes(term))
      );
    }
    
    return true;
  });

  // Setters to automatically update the raw state safely preserving other Woredas
  const setIdInventory = (updatedOrCb: IDRecord[] | ((prev: IDRecord[]) => IDRecord[])) => {
    setAllIdInventory(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      return [...updatedWithWoreda, ...otherWoredas];
    });
  };

  const setGeneratedDocs = (updatedOrCb: GeneratedDocument[] | ((prev: GeneratedDocument[]) => GeneratedDocument[])) => {
    setAllGeneratedDocs(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      const merged = [...updatedWithWoreda, ...otherWoredas];
      localStorage.setItem('W05_generatedDocs', JSON.stringify(merged));
      return merged;
    });
  };

  const setForm010 = (updatedOrCb: Form010Record[] | ((prev: Form010Record[]) => Form010Record[])) => {
    setAllForm010(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      const merged = [...updatedWithWoreda, ...otherWoredas];
      localStorage.setItem('W05_form010', JSON.stringify(merged));
      return merged;
    });
  };

  const setForm011 = (updatedOrCb: Form011Record[] | ((prev: Form011Record[]) => Form011Record[])) => {
    setAllForm011(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      const merged = [...updatedWithWoreda, ...otherWoredas];
      localStorage.setItem('W05_form011', JSON.stringify(merged));
      return merged;
    });
  };

  const setForm012 = (updatedOrCb: Form012Record[] | ((prev: Form012Record[]) => Form012Record[])) => {
    setAllForm012(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወบริการ 05') !== selectedWoreda);
      const merged = [...updatedWithWoreda, ...otherWoredas];
      localStorage.setItem('W05_form012', JSON.stringify(merged));
      return merged;
    });
  };

  const setResidentDocs = (updatedOrCb: ResidentDocument[] | ((prev: ResidentDocument[]) => ResidentDocument[])) => {
    setAllResidentDocs(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      const merged = [...updatedWithWoreda, ...otherWoredas];
      localStorage.setItem('W05_residentDocs', JSON.stringify(merged));
      return merged;
    });
  };

  const setOnlineTickets = (updatedOrCb: OnlinePortalTicket[] | ((prev: OnlinePortalTicket[]) => OnlinePortalTicket[])) => {
    setAllOnlineTickets(prev => {
      const activeItems = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda);
      const updated = typeof updatedOrCb === 'function' ? updatedOrCb(activeItems) : updatedOrCb;
      const updatedWithWoreda = updated.map(item => ({ ...item, woreda: item.woreda || selectedWoreda }));
      const otherWoredas = prev.filter(item => (item.woreda || 'ቦሌ ወረዳ 05') !== selectedWoreda);
      return [...updatedWithWoreda, ...otherWoredas];
    });
  };

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
  const [publicDateSearch, setPublicDateSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminDateSearch, setAdminDateSearch] = useState('');
  const [smsPendingFilter, setSmsPendingFilter] = useState(false);
  const [deliveredFilter, setDeliveredFilter] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('day');
  
  // Independent filters for Form 010
  const [f10FilterServiceType, setF10FilterServiceType] = useState('all');
  const [f10FilterSerial, setF10FilterSerial] = useState('');
  const [f10FilterDate, setF10FilterDate] = useState('');
  const [f10FilterHandoverType, setF10FilterHandoverType] = useState<'all' | 'የክፍለከተማ መረካከቢያ' | 'የወረዳ መረካከቢያ'>('all');

  // Independent filters for Form 011
  const [f11FilterServiceType, setF11FilterServiceType] = useState('all');
  const [f11FilterSerial, setF11FilterSerial] = useState('');
  const [f11FilterDate, setF11FilterDate] = useState('');

  // Independent filters for Form 012
  const [f12FilterServiceType, setF12FilterServiceType] = useState('all');
  const [f12FilterSerial, setF12FilterSerial] = useState('');
  const [f12FilterDate, setF12FilterDate] = useState('');

  // Independent filters for Audit Panel Date Range
  const [auditFilterFromDay, setAuditFilterFromDay] = useState('');
  const [auditFilterFromMonth, setAuditFilterFromMonth] = useState('መስከረም');
  const [auditFilterFromYear, setAuditFilterFromYear] = useState('');
  const [auditFilterToDay, setAuditFilterToDay] = useState('');
  const [auditFilterToMonth, setAuditFilterToMonth] = useState('መስከረም');
  const [auditFilterToYear, setAuditFilterToYear] = useState('');

  // Accordion status states for services
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>(null);

  // New Record Form States
  // 1. New ID Item
  const [newIdName, setNewIdName] = useState('');
  const [newIdPhone, setNewIdPhone] = useState('');
  const [newIdNum, setNewIdNum] = useState('');
  const [newIdHouse, setNewIdHouse] = useState('');

  // 1.5. Online Civil Registry (portal.aacrrsa.gov.et) Integration States
  // onlineTickets is now declared dynamically as a filtered view of allOnlineTickets
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
      let clean = dateStr.replace(/\s+/g, '').replace(/ዓ\.ም\.?/g, '').toLowerCase();
      const parts = clean.split('/');
      const ethMonthsNow = [
        "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"
      ];
      if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parts[2];
        const monthNum = parseInt(month, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 13) {
          month = ethMonthsNow[monthNum - 1];
        }
        return `${day}${month}${year}`;
      } else if (parts.length === 2) {
        let part0 = parts[0];
        let part1 = parts[1];
        const p0Num = parseInt(part0, 10);
        const p1Num = parseInt(part1, 10);
        if (!isNaN(p1Num) && p1Num >= 1 && p1Num <= 13 && part1.length <= 2) {
          part1 = ethMonthsNow[p1Num - 1];
          return `${part0}${part1}`;
        } else if (!isNaN(p0Num) && p0Num >= 1 && p0Num <= 13 && part0.length <= 2 && !isNaN(p1Num) && p1Num > 13) {
          part0 = ethMonthsNow[p0Num - 1];
          return `${part0}${part1}`;
        }
      }
      return clean;
    };
    
    return normalize(rowDate).includes(normalize(filterDate));
  };

  // Helper to parse Ethiopian date string into a comparable numeric value
  const parseEthDateToNumeric = (dateStr: string): number | null => {
    if (!dateStr) return null;
    let clean = dateStr.trim().replace(/\s+/g, ' ');
    
    let day = 1;
    let monthIndex = 0; // 0-based
    let year = 2016;

    const ethMonthsNow = [
      "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"
    ];

    if (clean.includes('/')) {
      const parts = clean.split(' ')[0].split('/');
      if (parts.length >= 3) {
        day = parseInt(parts[0], 10) || 1;
        const mStr = parts[1];
        const yearPart = parts[2];
        year = parseInt(yearPart, 10) || 2016;
        
        const mNum = parseInt(mStr, 10);
        if (!isNaN(mNum) && mNum >= 1 && mNum <= 13) {
          monthIndex = mNum - 1;
        } else {
          const foundIdx = ethMonthsNow.findIndex(m => mStr.includes(m));
          if (foundIdx !== -1) {
            monthIndex = foundIdx;
          }
        }
      }
    } else {
      const parts = clean.split(' ');
      if (parts.length >= 3) {
        day = parseInt(parts[0], 10) || 1;
        const mStr = parts[1];
        const yearPart = parts[2];
        year = parseInt(yearPart, 10) || 2016;

        const foundIdx = ethMonthsNow.findIndex(m => mStr.includes(m));
        if (foundIdx !== -1) {
          monthIndex = foundIdx;
        } else {
          const mNum = parseInt(mStr, 10);
          if (!isNaN(mNum) && mNum >= 1 && mNum <= 13) {
            monthIndex = mNum - 1;
          }
        }
      }
    }

    return year * 10000 + (monthIndex + 1) * 100 + day;
  };

  // Helper to check if row date falls within Ethiopian from-to range
  const isDateWithinRange = (dateStr: string, fromDateStr: string, toDateStr: string): boolean => {
    const rowVal = parseEthDateToNumeric(dateStr);
    if (!rowVal) return false;

    if (fromDateStr) {
      const fromVal = parseEthDateToNumeric(fromDateStr);
      if (fromVal && rowVal < fromVal) return false;
    }

    if (toDateStr) {
      const toVal = parseEthDateToNumeric(toDateStr);
      if (toVal && rowVal > toVal) return false;
    }

    return true;
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
  const [f10HandoverType, setF10HandoverType] = useState<'የክፍለከተማ መረካከቢያ' | 'የወረዳ መረካከቢያ'>('የክፍለከተማ መረካከቢያ');

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
  const [f10Signature, setF10Signature] = useState('');
  const [f12Signature, setF12Signature] = useState('');
  const [activeSignatureRecord, setActiveSignatureRecord] = useState<{ type: 'f10' | 'f11' | 'f12'; id: string; name: string } | null>(null);

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

    if (storedIds) setAllIdInventory(JSON.parse(storedIds));
    else {
      setAllIdInventory(initialIdInventory as IDRecord[]);
      localStorage.setItem('W05_idInventory', JSON.stringify(initialIdInventory));
    }

    if (storedDocs) setAllGeneratedDocs(JSON.parse(storedDocs));
    else {
      setAllGeneratedDocs(initialGeneratedDocs as GeneratedDocument[]);
      localStorage.setItem('W05_generatedDocs', JSON.stringify(initialGeneratedDocs));
    }

    if (stored010) setAllForm010(JSON.parse(stored010));
    else {
      setAllForm010(initialForm010 as Form010Record[]);
      localStorage.setItem('W05_form010', JSON.stringify(initialForm010));
    }

    if (stored011) setAllForm011(JSON.parse(stored011));
    else {
      setAllForm011(initialForm011 as Form011Record[]);
      localStorage.setItem('W05_form011', JSON.stringify(initialForm011));
    }

    if (stored012) setAllForm012(JSON.parse(stored012));
    else {
      setAllForm012(initialForm012 as Form012Record[]);
      localStorage.setItem('W05_form012', JSON.stringify(initialForm012));
    }

    if (storedTickets) setAllOnlineTickets(JSON.parse(storedTickets));
    else {
      setAllOnlineTickets([]);
      localStorage.setItem('W05_onlineTickets', JSON.stringify([]));
    }

    if (storedResidentDocs) {
      const parsed = JSON.parse(storedResidentDocs);
      setAllResidentDocs(parsed);
      setResDocIdNumber(getNextResDocIdNumber(parsed.filter((item: any) => (item.woreda || 'ቦሌ ወረዳ 05') === selectedWoreda)));
    } else {
      setAllResidentDocs([]);
      localStorage.setItem('W05_residentDocs', JSON.stringify([]));
    }

    if (storedRequirements) {
      try {
        setRequirements(sanitizeRequirementsList(JSON.parse(storedRequirements)));
      } catch (err) {
        console.error("Failed to parse stored requirements:", err);
      }
    }

    const storedAuditLogs = localStorage.getItem('W05_auditLogs');
    if (storedAuditLogs) {
      try {
        setAuditLogs(JSON.parse(storedAuditLogs));
      } catch (err) {
        console.error("Failed to parse stored audit logs:", err);
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
          setAllIdInventory(list);
          localStorage.setItem('W05_idInventory', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'idInventory');
        });
        unsubscribes.push(unsubIds);

        const unsubDocs = onSnapshot(collection(db, 'generatedDocs'), (snapshot) => {
          const list: GeneratedDocument[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as GeneratedDocument);
          });
          setAllGeneratedDocs(list);
          localStorage.setItem('W05_generatedDocs', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'generatedDocs');
        });
        unsubscribes.push(unsubDocs);

        const unsubF10 = onSnapshot(collection(db, 'form010'), (snapshot) => {
          const list: Form010Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form010Record);
          });
          setAllForm010(list);
          localStorage.setItem('W05_form010', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'form010');
        });
        unsubscribes.push(unsubF10);

        const unsubF11 = onSnapshot(collection(db, 'form011'), (snapshot) => {
          const list: Form011Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form011Record);
          });
          setAllForm011(list);
          localStorage.setItem('W05_form011', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'form011');
        });
        unsubscribes.push(unsubF11);

        const unsubF12 = onSnapshot(collection(db, 'form012'), (snapshot) => {
          const list: Form012Record[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as Form012Record);
          });
          setAllForm012(list);
          localStorage.setItem('W05_form012', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'form012');
        });
        unsubscribes.push(unsubF12);

        const unsubTickets = onSnapshot(collection(db, 'onlinePortalTickets'), (snapshot) => {
          const list: OnlinePortalTicket[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as OnlinePortalTicket);
          });
          setAllOnlineTickets(list);
          localStorage.setItem('W05_onlineTickets', JSON.stringify(list));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'onlinePortalTickets');
        });
        unsubscribes.push(unsubTickets);

        const unsubResidentDocs = onSnapshot(collection(db, 'residentDocuments'), (snapshot) => {
          const list: ResidentDocument[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as ResidentDocument);
          });
          setAllResidentDocs(list);
          localStorage.setItem('W05_residentDocs', JSON.stringify(list));
          setResDocIdNumber(prev => {
            if (!prev || prev.trim() === '' || prev.toLowerCase().startsWith('bw')) {
              return getNextResDocIdNumber(list);
            }
            return prev;
          });
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'residentDocuments');
        });
        unsubscribes.push(unsubResidentDocs);

        const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
          const list: AuditLog[] = [];
          snapshot.forEach(doc => {
            list.push(doc.data() as AuditLog);
          });
          list.sort((a, b) => b.id.localeCompare(a.id));
          setAuditLogs(list);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'auditLogs');
        });
        unsubscribes.push(unsubAudit);

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
          handleFirestoreError(error, OperationType.GET, 'settings/requirements');
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
          handleFirestoreError(error, OperationType.GET, 'settings/sms');
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

  // 🕒 Auto-rotate Service Prerequisites Manual randomly every 5 minutes (runs silently in the background)
  useEffect(() => {
    if (activePortal !== 'public' || isAutoRotatePaused) return;

    const timer = setInterval(() => {
      setRotateSecondsLeft((prev) => {
        if (prev <= 1) {
          // Select a random service prerequisite different from the current one (if available)
          if (requirements && requirements.length > 1) {
            const currentReqId = selectedPublicReqId || requirements[0].id;
            const currentIndex = requirements.findIndex(r => r.id === currentReqId);
            let randomIndex = currentIndex;
            // Prevent choosing the exact same index again to make the change dynamic
            let attempts = 0;
            while (randomIndex === currentIndex && attempts < 10) {
              randomIndex = Math.floor(Math.random() * requirements.length);
              attempts++;
            }
            const nextId = requirements[randomIndex]?.id || requirements[0].id;
            setSelectedPublicReqId(nextId);
          } else if (requirements && requirements.length === 1) {
            setSelectedPublicReqId(requirements[0].id);
          }
          return autoRotateInterval; // reset to selected interval
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activePortal, selectedPublicReqId, requirements, autoRotateInterval, isAutoRotatePaused]);

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

  // Recovered and Restored Resident Documents & Form handlers
  const handleUploadResidentDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resDocResidentName.trim()) {
      alert("እባክዎ የነዋሪውን ሙሉ ስም ያስገቡ!");
      return;
    }
    if (!resDocHouseNumber.trim()) {
      alert("እባክዎ የቤት ቁጥር ያስገቡ!");
      return;
    }

    setIsUploadingDoc(true);

    const newDocId = "resdoc_" + Date.now();
    const newDoc: ResidentDocument = {
      id: newDocId,
      residentName: resDocResidentName.trim(),
      houseOwnerName: resDocResidentName.trim(),
      houseNumber: resDocHouseNumber.trim(),
      idNumber: resDocIdNumber.trim() || ("W05/RES-" + Math.floor(Math.random() * 100000)),
      docType: resDocType,
      fileName: resDocFileName || "ሰነድ.pdf",
      fileSize: resDocFileSize || "542 KB",
      contentUrl: resDocContent || "/assets/scanned_doc_placeholder.pdf",
      uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`,
      uploadedBy: "ወረዳ 05 ባለሙያ",
      notes: resDocNotes.trim(),
      members: [...resDocMembers],
      files: resDocUploadedFiles.length > 0 ? resDocUploadedFiles : [
        {
          id: "page1_" + Date.now(),
          fileName: resDocFileName || "ሰነድ.pdf",
          fileSize: resDocFileSize || "542 KB",
          contentUrl: resDocContent || "/assets/scanned_doc_placeholder.pdf",
          uploadDate: `${getEthiopianDate()} ${getEthiopianTime()}`
        }
      ],
      woreda: selectedWoreda
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'residentDocuments', newDocId), newDoc);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `residentDocuments/${newDocId}`);
      }
    }

    setResidentDocs(prev => [newDoc, ...prev]);
    logAuditAction('አዲስ የቤት ዲጂታል ማህደር መመዝገብ (New Resident Doc)', `አዲስ የቤት ዲጂታል ማህደር ለባለቤት [${resDocResidentName}] ቤት ቁጥር [${resDocHouseNumber}] በተሳካ ሁኔታ ተመዝግቧል።`);

    // Reset inputs
    setResDocResidentName('');
    setResDocHouseOwnerName('');
    setResDocHouseNumber('');
    setResDocIdNumber('');
    setResDocFileName('');
    setResDocFileSize('');
    setResDocContent('');
    setResDocNotes('');
    setResDocMembers([]);
    setResDocUploadedFiles([]);

    setIsUploadingDoc(false);
    alert("የነዋሪነት ዲጂታል ማህደር በተሳካ ሁኔታ ተመዝግቧል!");
  };

  const handleDeleteResidentDoc = async (id: string, name?: string) => {
    if (!confirm(`እባክዎ እርግጠኛ ይሁኑ! [${name || 'ይህ ሰነድ'}] ን ከማህደሩ ውስጥ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?`)) {
      return;
    }

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'residentDocuments', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `residentDocuments/${id}`);
      }
    }

    setResidentDocs(prev => prev.filter(docItem => docItem.id !== id));
    logAuditAction('ሰነድ ማጥፋት (Delete Resident Doc)', `የቤት ዲጂታል ማህደር ሰነድ [${name || ''}] (መለያ፡ ${id}) በተሳካ ሁኔታ ጠፍቷል።`);
    alert("የዲጂታል ማህደር ሰነድ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const deleteIDRecord = async (id: string) => {
    if (!confirm("እባክዎ እርግጠኛ ይሁኑ! ይህንን የመታወቂያ መዝገብ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?")) {
      return;
    }
    const recordToDelete = idInventory.find(x => x.id === id);

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'idInventory', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `idInventory/${id}`);
      }
    }

    const updated = idInventory.filter(item => item.id !== id);
    setIdInventory(updated);
    saveState('W05_idInventory', updated);
    logAuditAction('መታወቂያ መዝገብ ማጥፋት (Delete ID Record)', `የመታወቂያ ርክክብ መዝገብ ለባለቤት [${recordToDelete?.name || ''}] (መለያ፡ ${id}) ጠፍቷል።`);
    alert("የመታወቂያ መዝገብ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docInputs.name || !docInputs.name.trim()) {
      alert("እባክዎ የአመልካቹን ሙሉ ስም ያስገቡ!");
      return;
    }
    if (!docInputs.ref || !docInputs.ref.trim()) {
      alert("እባክዎ የሰነድ መግለጫ መለያ ቁጥር (Ref No) ያስገቡ!");
      return;
    }

    const newDocId = "doc_" + Date.now();
    const newDoc: GeneratedDocument = {
      id: newDocId,
      ref: docInputs.ref.trim(),
      type: selectedDocType,
      name: docInputs.name.trim(),
      house: docInputs.house || "",
      date: docInputs.date || ethDateNow,
      payload: { ...docInputs },
      woreda: selectedWoreda
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'generatedDocuments', newDocId), newDoc);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `generatedDocuments/${newDocId}`);
      }
    }

    setGeneratedDocs(prev => [newDoc, ...prev]);
    logAuditAction('ሰነድ ማመንጨት (Document Generated)', `አዲስ [${selectedDocType}] ለተቀባይ [${docInputs.name}] በቁጥር [${docInputs.ref}] በተሳካ ሁኔታ ተመስርቶ ተቀምጧል።`);
    alert(`${selectedDocType} በሲስተሙ ማህደር ተመዝግቧል! አሁን ማተም ይችላሉ።`);
  };

  const handleDocInputChange = (field: string, value: string) => {
    setDocInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const loadDocToInputs = (doc: GeneratedDocument) => {
    setSelectedDocType(doc.type);
    setDocInputs({
      ...doc.payload
    });
    alert(`የሰነድ መረጃ [${doc.name}] ለለውጥ/ለህትመት ዝግጁ ሆኗል።`);
  };

  const deleteGeneratedDoc = async (id: string) => {
    if (!confirm("እባክዎ እርግጠኛ ይሁኑ! ይህንን የተመነጨ ሰነድ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?")) {
      return;
    }
    const docToDelete = generatedDocs.find(x => x.id === id);

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'generatedDocuments', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `generatedDocuments/${id}`);
      }
    }

    setGeneratedDocs(prev => prev.filter(docItem => docItem.id !== id));
    logAuditAction('የሰነድ ማጥፋት (Delete Generated Doc)', `የተመነጨው ሰነድ [${docToDelete?.name || ''}] (መለያ፡ ${id}) በተሳካ ሁኔታ ተሰርዟል።`);
    alert("ሰነዱ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleAddForm010 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f10From.trim() || !f10To.trim()) {
      alert("እባክዎ የሴሪያል ቁጥሮችን ያስገቡ!");
      return;
    }
    const dateStr = (f10Day && f10Month && f10Year) ? `${f10Day} ${f10Month} ${f10Year}` : ethDateNow;
    const newRecord: Form010Record = {
      id: "f10_" + Date.now(),
      type: f10PrintType,
      qty: f10Qty,
      method: f10Method,
      from: f10From.toUpperCase().trim(),
      to: f10To.toUpperCase().trim(),
      date: dateStr,
      remark: f10Remark.trim(),
      woreda: selectedWoreda,
      handoverType: f10HandoverType,
      signature: f10Signature || undefined
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form010', newRecord.id), newRecord);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `form010/${newRecord.id}`);
      }
    }

    setForm010(prev => [...prev, newRecord]);
    logAuditAction('ቅፅ 010 ምዝገባ (Form 010 Add)', `አዲስ የዕለት ህትመት [${f10PrintType}] (ብዛት: ${f10Qty}, ሴሪያል፡ ከ ${f10From} እስከ ${f10To}) በተሳካ ሁኔታ ተመዝግቧል።`);

    // Reset inputs
    setF10From('');
    setF10To('');
    setF10Remark('');
    setF10Signature('');
    setF10Qty(1);

    alert("የቅፅ 010 መረጃ በተሳካ ሁኔታ ተመዝግቧል!");
  };

  const deleteF10Row = async (id: string) => {
    if (!confirm("እባክዎ እርግጠኛ ይሁኑ! ይህንን የቅፅ 010 መዝገብ ማጥፋት ይፈልጋሉ?")) {
      return;
    }
    const recordToDelete = form010.find(x => x.id === id);

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'form010', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `form010/${id}`);
      }
    }

    setForm010(prev => prev.filter(row => row.id !== id));
    logAuditAction('ቅፅ 010 ማጥፋት (Form 010 Delete)', `የቅፅ 010 መዝገብ [${recordToDelete?.type || ''}] (ሴሪያል፡ ${recordToDelete?.from || ''}-${recordToDelete?.to || ''}) ተሰርዟል።`);
    alert("የቅፅ 010 መዝገብ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleAddForm011 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f11Customer.trim() || !f11Serial.trim()) {
      alert("እባክዎ የተገልጋይ ስምና ሴሪያል ቁጥር ያስገቡ!");
      return;
    }
    const dateStr = (f11DateDay && f11DateMonth && f11DateYear) ? `${f11DateDay} ${f11DateMonth} ${f11DateYear}` : ethDateNow;
    const newRecord: Form011Record = {
      id: "f11_" + Date.now(),
      date: dateStr,
      serviceType: f11ServiceType,
      archive: f11Archive.trim(),
      customer: f11Customer.trim(),
      serial: f11Serial.toUpperCase().trim(),
      method: f11Method,
      time: getEthiopianTime(),
      phone: f11Phone.trim(),
      signature: f11Signature || undefined,
      woreda: selectedWoreda
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form011', newRecord.id), newRecord);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `form011/${newRecord.id}`);
      }
    }

    setForm011(prev => [...prev, newRecord]);
    logAuditAction('ቅፅ 011 ምዝገባ (Form 011 Add)', `አዲስ የዕለት አገልግሎት [${f11ServiceType}] (ተገልጋይ: ${f11Customer}, ሴሪያል: ${f11Serial}) በተሳካ ሁኔታ ተመዝግቧል።`);

    // Reset inputs
    setF11Archive('');
    setF11Customer('');
    setF11Serial('');
    setF11Phone('');
    setF11Signature('');

    alert("የቅፅ 011 መረጃ በተሳካ ሁኔታ ተመዝግቧል!");
  };

  const deleteF11Row = async (id: string) => {
    if (!confirm("እባክዎ እርግጠኛ ይሁኑ! ይህንን የቅፅ 011 መዝገብ ማጥፋት ይፈልጋሉ?")) {
      return;
    }
    const recordToDelete = form011.find(x => x.id === id);

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'form011', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `form011/${id}`);
      }
    }

    setForm011(prev => prev.filter(row => row.id !== id));
    logAuditAction('ቅፅ 011 ማጥፋት (Form 011 Delete)', `የቅፅ 011 መዝገብ [${recordToDelete?.serviceType || ''}] (ተገልጋይ: ${recordToDelete?.customer || ''}, ሴሪያል: ${recordToDelete?.serial || ''}) ተሰርዟል።`);
    alert("የቅፅ 011 መዝገብ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleAddForm012 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f12Serial.trim()) {
      alert("እባክዎ የሴሪያል ቁጥር ያስገቡ!");
      return;
    }
    const dateStr = (f12Day && f12Month && f12Year) ? `${f12Day} ${f12Month} ${f12Year}` : ethDateNow;
    const newRecord: Form012Record = {
      id: "f12_" + Date.now(),
      printType: f12PrintType,
      returnStatus: f12ReturnStatus,
      method: f12Method,
      serial: f12Serial.toUpperCase().trim(),
      date: dateStr,
      reason: f12Reason.trim(),
      woreda: selectedWoreda,
      signature: f12Signature || undefined
    };

    if (!isFirebaseMock) {
      try {
        await setDoc(doc(db, 'form012', newRecord.id), newRecord);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `form012/${newRecord.id}`);
      }
    }

    setForm012(prev => [...prev, newRecord]);
    logAuditAction('ቅፅ 012 ምዝገባ (Form 012 Add)', `የተበላሸ/ያልተሰጠ [${f12PrintType}] (ሁኔታ: ${f12ReturnStatus}, ሴሪያል: ${f12Serial}) በተሳካ ሁኔታ ተመዝግቧል።`);

    // Reset inputs
    setF12Serial('');
    setF12Reason('');
    setF12Signature('');

    alert("የቅፅ 012 መረጃ በተሳካ ሁኔታ ተመዝግቧል!");
  };

  const deleteF12Row = async (id: string) => {
    if (!confirm("እባክዎ እርግጠኛ ይሁኑ! ይህንን የቅፅ 012 መዝገብ ማጥፋት ይፈልጋሉ?")) {
      return;
    }
    const recordToDelete = form012.find(x => x.id === id);

    if (!isFirebaseMock) {
      try {
        await deleteDoc(doc(db, 'form012', id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `form012/${id}`);
      }
    }

    setForm012(prev => prev.filter(row => row.id !== id));
    logAuditAction('ቅፅ 012 ማጥፋት (Form 012 Delete)', `የቅፅ 012 መዝገብ [${recordToDelete?.printType || ''}] (ሴሪያል: ${recordToDelete?.serial || ''}) ተሰርዟል።`);
    alert("የቅፅ 012 መዝገብ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleUpdateRecordSignature = async (type: 'f10' | 'f11' | 'f12', id: string, signatureDataUrl: string) => {
    if (type === 'f10') {
      const record = form010.find(x => x.id === id);
      if (record) {
        const updated = { ...record, signature: signatureDataUrl };
        if (!isFirebaseMock) {
          try {
            await setDoc(doc(db, 'form010', id), updated);
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, `form010/${id}`);
          }
        }
        setForm010(prev => prev.map(x => x.id === id ? updated : x));
        logAuditAction('ቅፅ 010 ፊርማ ማሻሻያ (Form 010 Signature Update)', `ለቅፅ 010 መዝገብ (ሴሪያል: ${record.from}-${record.to}) ፊርማ በተሳካ ሁኔታ ተቀምጧል።`);
      }
    } else if (type === 'f11') {
      const record = form011.find(x => x.id === id);
      if (record) {
        const updated = { ...record, signature: signatureDataUrl };
        if (!isFirebaseMock) {
          try {
            await setDoc(doc(db, 'form011', id), updated);
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, `form011/${id}`);
          }
        }
        setForm011(prev => prev.map(x => x.id === id ? updated : x));
        logAuditAction('ቅፅ 011 ፊርማ ማሻሻያ (Form 011 Signature Update)', `ለቅፅ 011 መዝገብ (ተገልጋይ: ${record.customer}, ሴሪያል: ${record.serial}) ፊርማ በተሳካ ሁኔታ ተቀምጧል።`);
      }
    } else if (type === 'f12') {
      const record = form012.find(x => x.id === id);
      if (record) {
        const updated = { ...record, signature: signatureDataUrl };
        if (!isFirebaseMock) {
          try {
            await setDoc(doc(db, 'form012', id), updated);
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, `form012/${id}`);
          }
        }
        setForm012(prev => prev.map(x => x.id === id ? updated : x));
        logAuditAction('ቅፅ 012 ፊርማ ማሻሻያ (Form 012 Signature Update)', `ለቅፅ 012 መዝገብ (ሴሪያል: ${record.serial}) ፊርማ በተሳካ ሁኔታ ተቀምጧል።`);
      }
    }
    setActiveSignatureRecord(null);
    alert("ፊርማው በተሳካ ሁኔታ ተቀምጧል!");
  };

  const handleDeleteFileFromDoc = async (docId: string, fileId: string) => {
    setResidentDocs(prev => {
      const updated = prev.map(docItem => {
        if (docItem.id === docId) {
          const updatedDoc = {
            ...docItem,
            files: docItem.files.filter(f => f.id !== fileId)
          };
          if (!isFirebaseMock) {
            setDoc(doc(db, 'residentDocuments', docId), updatedDoc).catch(err => {
              console.error("Firestore update failed:", err);
            });
          }
          setSelectedViewDoc(updatedDoc);
          return updatedDoc;
        }
        return docItem;
      });
      return updated;
    });
    alert("ፋይሉ በተሳካ ሁኔታ ተሰርዟል!");
  };

  const handleDeleteMemberFromDoc = async (docId: string, memberId: string) => {
    setResidentDocs(prev => {
      const updated = prev.map(docItem => {
        if (docItem.id === docId) {
          const updatedDoc = {
            ...docItem,
            members: docItem.members.filter(m => m.id !== memberId)
          };
          if (!isFirebaseMock) {
            setDoc(doc(db, 'residentDocuments', docId), updatedDoc).catch(err => {
              console.error("Firestore update failed:", err);
            });
          }
          setSelectedViewDoc(updatedDoc);
          return updatedDoc;
        }
        return docItem;
      });
      return updated;
    });
    alert("ነዋሪው በተሳካ ሁኔታ ተወግዷል!");
  };

  const handleAddNewMemberToDoc = async (docId: string, newMember: HouseholdMember) => {
    setResidentDocs(prev => {
      const updated = prev.map(docItem => {
        if (docItem.id === docId) {
          const updatedDoc = {
            ...docItem,
            members: [...(docItem.members || []), newMember]
          };
          if (!isFirebaseMock) {
            setDoc(doc(db, 'residentDocuments', docId), updatedDoc).catch(err => {
              console.error("Firestore update failed:", err);
            });
          }
          setSelectedViewDoc(updatedDoc);
          return updatedDoc;
        }
        return docItem;
      });
      return updated;
    });
    alert("አባል በተሳካ ሁኔታ ተጨምሯል!");
  };

  // Login handler
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'woreda05') {
      setIsAdminLoggedIn(true);
      setLoginError(false);
      setAdminPassword('');
      logAuditAction('ባለሙያ መግባት (Staff Login)', `የወረዳ 05 ባለሙያ በተሳካ ሁኔታ ወደ ሲስተሙ ገብቷል።`);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    logAuditAction('ባለሙያ መውጣት (Staff Logout)', `የወረዳ 05 ባለሙያ ከሲስተሙ ወጥቷል።`);
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
    logAuditAction('የቅድመ ሁኔታ ማሻሻል (Edit Prerequisite)', `የአገልግሎት ቅድመ ሁኔታ [${editingReqTitle}] በተሳካ ሁኔታ ተሻሽሏል።`);

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
    logAuditAction('አዲስ ቅድመ ሁኔታ ማከል (Add Prerequisite)', `አዲስ የአገልግሎት ቅድመ ሁኔታ ሰነድ [${newService.title}] ታክሏል።`);

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
    logAuditAction('ቅድመ ሁኔታ ማጥፋት (Delete Prerequisite)', `የአገልግሎት ቅድመ ሁኔታ [${toDelete.title}] ተሰርዟል።`);

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

    logAuditAction('ሲስተም ማጽዳት (System Reset)', 'ባለሙያው የደህንነት የይለፍ ቃል ተጠቅሞ ሁሉንም ሲስተም መረጃዎች ሙሉ በሙሉ አጥፍቷል።');

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
      
      logAuditAction('የባክአፕ ማውረድ (Backup Data)', 'ባለሙያው የመረጃ ደህንነት ቅጂ በምስጠራ ቁልፍ በተሳካ ሁኔታ አውርዷል።');
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

        logAuditAction('የባክአፕ መመለስ (Restore Data)', `ባለሙያው በዕለቱ የደህንነት ቅጂ ፋይል [${file.name}] መረጃዎችን በተሳካ ሁኔታ መልሷል።`);
        alert("የደህንነት ቅጂው በተሳካ ሁኔታ ተመልሷል! (Backup successfully restored!)");
      } catch (error) {
        alert("የመረጃ መፍታት ስህተት የተሳሳተ የይለፍ ቃል ወይም የተበላሸ ፋይል: " + (error as Error).message);
      }
    };
    reader.readAsText(file);
    fileEvent.target.value = '';
  };

  // Search filter computes and sorts (newly added IDs starting with 'ID-' or higher IDs are placed first)
  const filteredPublicInventory = idInventory.filter(item => {
    const term = publicSearch.toLowerCase().trim();
    const dateTerm = publicDateSearch.toLowerCase().trim();
    
    if (term !== '') {
      const matchesSearch = item.name.toLowerCase().includes(term) || 
                            item.idNumber.toLowerCase().includes(term) ||
                            (item.houseNumber && item.houseNumber.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    
    if (dateTerm !== '') {
      const regDate = item.registrationDate || item.smsSentDate || '';
      if (!matchEthDates(regDate, dateTerm)) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const isANew = a.id.startsWith('ID-');
    const isBNew = b.id.startsWith('ID-');
    if (isANew && !isBNew) return -1;
    if (!isANew && isBNew) return 1;
    return b.id.localeCompare(a.id);
  });

  const filteredAdminInventory = idInventory.filter(item => {
    const term = adminSearch.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(term) || item.idNumber.toLowerCase().includes(term) || item.houseNumber.toLowerCase().includes(term);
    if (!matchesSearch) return false;
    
    if (adminDateSearch.trim() !== '') {
      const regDate = item.registrationDate || item.smsSentDate || '';
      if (!matchEthDates(regDate, adminDateSearch)) {
        return false;
      }
    }

    if (smsPendingFilter) {
      return item.status === 'ለመረከብ ዝግጁ' && !item.smsSent;
    }
    if (deliveredFilter) {
      return item.status === 'የወሰደ';
    }
    return true;
  });

  // Database count computations
  const countReady = idInventory.filter(item => item.status === 'ለመረከብ ዝግጁ').length;
  const countDelivered = idInventory.filter(item => item.status === 'የወሰደ').length;

  const uniqueRegDates = useMemo(() => {
    return Array.from(
      new Set(
        idInventory
          .map(item => item.registrationDate || item.smsSentDate)
          .filter((d): d is string => !!d && d.trim() !== '')
      )
    ).sort();
  }, [idInventory]);

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
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት የኮድ ${ticket.applicationId} አገልግሎት ማመልከቻዎ ዝርዝር ሰነዶች ያልተሟሉ ሆነው ተገኝተዋል። እባክዎ ተጨማሪ ማስረጃዎችን ይዘው በስራ ሰዓት በወረዳ 05 ሲቪል ማህደር ክፍል (Window 3) በአካል ይቅረቡ። እናመሰግናለን!`;
    } else if (type === 'approved') {
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት ማመልከቻ (ኮድ ${ticket.applicationId}) በአግባቡ ተረጋግጦ ጸድቋል። አገልግሎትዎን ለመጨረስ በአካል መጥተው ሂደቱን እንዲያጠናቅቁ ጥሪ እናደርጋለን። እናመሰግናለን!`;
    } else {
      msgText = `ጤና ይስጥልኝ ${ticket.fullName}፣ በ portal.aacrrsa.gov.et ያመለከቱት ማመልከቻ (ኮድ ${ticket.applicationId}) አገልግሎቱ በስኬት ተጠናቆ ተዘጋጅቷል። መጥተው መውሰድ ይችላሉ። እናመሰግናለን!`;
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
      smsSent: false,
      registrationDate: ethDateNow
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
    logAuditAction('አዲስ መታወቂያ መመዝገብ (New ID Registered)', `አዲስ መታወቂያ ለተቀባይ [${newItem.name}] የመታወቂያ ቁጥር [${newItem.idNumber}] በተሳካ ሁኔታ ተመዝግቧል።`);

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
    logAuditAction('መታወቂያ ማስረከብ (ID Handed Over)', `መታወቂያ ለነዋሪው [${updatedRecord.name}] መታወቂያ ቁጥር [${updatedRecord.idNumber}] በፊርማ በተሳካ ሁኔታ ተረክቧል።`);
    setSelectedHandoverIndex(null);
    setHandoverSignature('');
    alert("የመታወቂያ ርክክቡ በተሳካ ሁኔታ ተመዝግቧል!");
  };

  // Open SMS modal with a language-aware message template
  const openSmsModal = (item: IDRecord) => {
    setSmsRecord(item);
    let template = `${item.name} ወረዳ 05 መታወቂያዎ ደርሷል መጥተው ይውሰዱ`;
    
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
    logAuditAction('SMS መላክ በጌትዌይ (Send Gateway SMS)', `የSMS መልዕክት ለነዋሪ [${smsRecord.name}] (ስልክ: ${smsRecord.phone}) በጌትዌይ በተሳካ ሁኔታ ተልኳል።`);

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
    logAuditAction('SMS መላክ በስልክ (Send Native SMS)', `የSMS መልዕክት ለነዋሪ [${smsRecord.name}] (ስልክ: ${smsRecord.phone}) በስልኩ መተግበሪያ በኩል ተልኳል።`);

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
    logAuditAction('የኤስኤምኤስ ቅንጅቶች (SMS Gateway settings)', `ባለሙያው የኤስኤምኤስ መላኪያ ጌትዌይ ቅንጅቶችን አሻሽሏል። (ሁኔታ: ${smsGatewayEnabled ? 'የበራ/Active' : 'የጠፋ/Inactive'})`);

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
          gatewayResultLog = `ጌትዌይ መልስ: ${data.detail || "መልዕክት በተሳካ ሁኔታ ተልኳል!"}`;
          alert(`የኤስኤምኤስ ሙከራ ስኬታማ ነው! ${gatewayResultLog}`);
        } else {
          gatewaySuccess = false;
          gatewayResultLog = data.error || `የጌትዌይ ምላሽ አልተሳካም (Status ${response.status}).`;
          alert(`የኤስኤምኤስ ሙከራ አልተሳካም: ${gatewayResultLog}`);
        }
      } catch (err: any) {
        gatewaySuccess = false;
        gatewayResultLog = `ኔትወርክ ስህተት: ${err.message || err}`;
        alert(`ኔትወርክ ስህተት አጋጥሟል: ${gatewayResultLog}`);
      }
    } else {
      // Simulation mode
      gatewaySuccess = true;
      gatewayResultLog = "የማስመሰል ሁኔታ (Simulation Mode) ነቅቷል። (የኤስኤምኤስ ጌትዌይ በቅንብሮች ውስጥ አልበራም)። መልዕክቱ እንደተላከ ተቆጥሯል።";
      alert(gatewayResultLog);
    }

    logAuditAction('የኤስኤምኤስ መሞከሪያ (Test SMS Connection)', `ባለሙያው የኤስኤምኤስ ሙከራ ለስልክ [${cleanPhone}] አድርጓል። ውጤት: ${gatewaySuccess ? 'የተሳካ' : 'ያልተሳካ'} - ${gatewayResultLog}`);
    setIsTestingSms(false);
  };



  // Filter logs logic
  const filteredForm010 = form010.filter(row => {
    const matchType = (f10FilterServiceType === 'all') || row.type.includes(f10FilterServiceType);
    const matchSerial = (f10FilterSerial === '') || row.from.toLowerCase().includes(f10FilterSerial.toLowerCase()) || row.to.toLowerCase().includes(f10FilterSerial.toLowerCase());
    const matchDate = matchEthDates(row.date, f10FilterDate);
    const matchHandover = (f10FilterHandoverType === 'all') || (row.handoverType === f10FilterHandoverType) || (!row.handoverType && f10FilterHandoverType === 'የክፍለከተማ መረካከቢያ');
    return matchType && matchSerial && matchDate && matchHandover;
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

    const text = `የወረዳ 05 የዕለቱ የሪፖርት ማጠቃለያ ማዕከል\nቀን: ${ethDateNow}\nሰዓት: ${ethTimeNow}\n-------------------------------------------------------------\n1. ዝርዝር ይፋዊ ሰነዶች ርክክብ:\n   - አጠቃላይ የተመነጩ ሰነዶች: ${docsTotal} ሰነዶች\n   - የመሸኛ መጠየቂያ ቅጾች: ${recsCount} ሪኮርድ\n   - የነዋሪነት ማረጋገጫ ደብዳቤዎች: ${resCount} ሪኮርድ\n   - በሕይወት የመኖር ማረጋገጫዎች: ${lifeCount} ሪኮርድ\n2. የመታወቂያ ክምችት ሁኔታ (Stock Backlog):\n   - ለመረከብ ዝግጁ የሆኑ: ${countReady} መታወቂያዎች\n   - ዛሬ የተረከቡ: ${countDeliveredToday} መታወቂያዎች\n   - ጠቅላላ የተረከቡ: ${countDelivered} መታወቂያዎች\n3. የቅፆች የዕለት መዝገብ አመላካች:\n   - ቅፅ 010 (የዕለት ህትመት ስርጭት): ${form010.length} ሪኮርዶች\n   - ቅፅ 011 (የዕለት አገልግሎት ያገኙ): ${form011.length} ሪኮርዶች\n   - ቅፅ 012 (ተመላሽና የተበላሹ): ${form012.length} ሪኮርዶች\n-------------------------------------------------------------\n* ይህ ሪፖርት በራስ-ሰር የተጠናቀረ እውነተኛ መረጃ ነው።`;
    setReportResult(text);
  };


  // Modern Audit Report Printing Helper
  const handlePrintAuditReport = () => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const title = `የሰነድ ቁጥጥር እና የኦዲት መከታተያ ሪፖርት - ${selectedWoreda}`;
    const subtitle = `የቦሌ ክፍለ ከተማ ወረዳ 05 አስተዳደር የኦዲት መረጃዎች ማጠቃለያ`;

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    // Apply from-to date filters if active
    const fromStr = (auditFilterFromDay && auditFilterFromMonth && auditFilterFromYear) ? `${auditFilterFromDay}/${auditFilterFromMonth}/${auditFilterFromYear}` : '';
    const toStr = (auditFilterToDay && auditFilterToMonth && auditFilterToYear) ? `${auditFilterToDay}/${auditFilterToMonth}/${auditFilterToYear}` : '';

    const hasDateFilter = !!fromStr || !!toStr;

    const activeIdInventory = hasDateFilter
      ? idInventory.filter(x => {
          const d = x.pickupDate || x.registrationDate || '';
          return d ? isDateWithinRange(d, fromStr, toStr) : true;
        })
      : idInventory;

    const activeForm010 = hasDateFilter
      ? form010.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
      : form010;

    const activeForm011 = hasDateFilter
      ? form011.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
      : form011;

    const activeForm012 = hasDateFilter
      ? form012.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
      : form012;

    const totalFromSubCity = activeIdInventory.length;
    const readyNotPicked = activeIdInventory.filter(x => x.status === 'ለመረከብ ዝግጁ').length;
    const pickedUp = activeIdInventory.filter(x => x.status === 'የወሰደ').length;
    const auditMatch = totalFromSubCity === (readyNotPicked + pickedUp);

    // Form 010 Sub-city Grouped
    const form010SubCityGrouped = activeForm010
      .filter(record => !record.handoverType || record.handoverType === 'የክፍለከተማ መረካከቢያ')
      .reduce((acc, record) => {
        const type = record.type || 'ያልታወቀ';
        if (!acc[type]) {
          acc[type] = { type, ranges: [] as { from: string; to: string }[], totalQty: 0 };
        }
        acc[type].ranges.push({ from: record.from, to: record.to });
        acc[type].totalQty += Number(record.qty || 0);
        return acc;
      }, {} as Record<string, { type: string; ranges: { from: string; to: string }[]; totalQty: number }>);

    // Form 010 Woreda Grouped
    const form010WoredaGrouped = activeForm010
      .filter(record => record.handoverType === 'የወረዳ መረካከቢያ')
      .reduce((acc, record) => {
        const type = record.type || 'ያልታወቀ';
        if (!acc[type]) {
          acc[type] = { type, ranges: [] as { from: string; to: string }[], totalQty: 0 };
        }
        acc[type].ranges.push({ from: record.from, to: record.to });
        acc[type].totalQty += Number(record.qty || 0);
        return acc;
      }, {} as Record<string, { type: string; ranges: { from: string; to: string }[]; totalQty: number }>);

    // Form 011 Grouped
    const form011Grouped = activeForm011.reduce((acc, record) => {
      const type = record.serviceType || 'ያልታወቀ';
      if (!acc[type]) {
        acc[type] = { type, records: [] as typeof record[] };
      }
      acc[type].records.push(record);
      return acc;
    }, {} as Record<string, { type: string; records: typeof form011 }>);

    // Form 012 Grouped
    const form012Grouped = activeForm012.reduce((acc, record) => {
      const type = record.printType || 'ያልታወቀ';
      if (!acc[type]) {
        acc[type] = { type, records: [] as typeof record[] };
      }
      acc[type].records.push(record);
      return acc;
    }, {} as Record<string, { type: string; records: typeof form012 }>);

    // Build Form 010 Rows HTML (Sub-city)
    let f010SubCityRows = '';
    const f010SubCityList = Object.values(form010SubCityGrouped) as any[];
    if (f010SubCityList.length === 0) {
      f010SubCityRows = `<tr><td colspan="4" style="text-align: center; padding: 12px; font-style: italic; color: #888;">ምንም የተመዘገበ የክፍለከተማ መረካከቢያ መረጃ የለም (No data)</td></tr>`;
    } else {
      f010SubCityList.forEach((group: any, idx) => {
        const rangesStr = group.ranges.map((r: any) => `ከ ${r.from} እስከ ${r.to}`).join(', ');
        f010SubCityRows += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${group.type}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-family: monospace;">${rangesStr}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-family: monospace;">${group.totalQty}</td>
          </tr>
        `;
      });
    }

    // Build Form 010 Rows HTML (Woreda)
    let f010WoredaRows = '';
    const f010WoredaList = Object.values(form010WoredaGrouped) as any[];
    if (f010WoredaList.length === 0) {
      f010WoredaRows = `<tr><td colspan="4" style="text-align: center; padding: 12px; font-style: italic; color: #888;">ምንም የተመዘገበ የወረዳ መረካከቢያ መረጃ የለም (No data)</td></tr>`;
    } else {
      f010WoredaList.forEach((group: any, idx) => {
        const rangesStr = group.ranges.map((r: any) => `ከ ${r.from} እስከ ${r.to}`).join(', ');
        f010WoredaRows += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${group.type}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-family: monospace;">${rangesStr}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-family: monospace;">${group.totalQty}</td>
          </tr>
        `;
      });
    }

    // Build Form 011 Rows HTML
    let f011Rows = '';
    const f011List = Object.values(form011Grouped) as any[];
    if (f011List.length === 0) {
      f011Rows = `<tr><td colspan="4" style="text-align: center; padding: 12px; font-style: italic; color: #888;">ምንም የተመዘገበ የቅፅ 011 መረጃ የለም (No data)</td></tr>`;
    } else {
      f011List.forEach((group: any, idx) => {
        const serials = group.records.map((r: any) => r.serial).filter(Boolean);
        const sorted = [...serials].sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });
        const fromSerial = sorted[0] || '-';
        const toSerial = sorted[sorted.length - 1] || '-';
        const totalCount = group.records.length;

        f011Rows += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${group.type}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-family: monospace;">ከ ${fromSerial} እስከ ${toSerial}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-family: monospace;">${totalCount}</td>
          </tr>
        `;
      });
    }

    // Build Form 012 Rows HTML
    let f012Rows = '';
    const f012List = Object.values(form012Grouped) as any[];
    if (f012List.length === 0) {
      f012Rows = `<tr><td colspan="4" style="text-align: center; padding: 12px; font-style: italic; color: #888;">ምንም የተመዘገበ የቅፅ 012 መረጃ የለም (No data)</td></tr>`;
    } else {
      f012List.forEach((group: any, idx) => {
        const serials = group.records.map((r: any) => r.serial).filter(Boolean);
        const sorted = [...serials].sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });
        const fromSerial = sorted[0] || '-';
        const toSerial = sorted[sorted.length - 1] || '-';
        const totalCount = group.records.length;

        f012Rows += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${group.type}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-family: monospace;">ከ ${fromSerial} እስከ ${toSerial}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-family: monospace;">${totalCount}</td>
          </tr>
        `;
      });
    }

    // Build detailed tables for the printed report
    let idDetailRows = '';
    if (activeIdInventory.length === 0) {
      idDetailRows = `<tr><td colspan="6" style="text-align: center; padding: 10px; font-style: italic; color: #888;">ምንም ዝርዝር መረጃ የለም (No data)</td></tr>`;
    } else {
      activeIdInventory.forEach((row, idx) => {
        idDetailRows += `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${row.registrationDate || '-'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: #0f405c;">${row.pickupDate || 'ያልተወሰደ'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.name}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-family: monospace;">${row.idNumber}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${row.status}</td>
          </tr>
        `;
      });
    }

    let f010DetailRows = '';
    if (activeForm010.length === 0) {
      f010DetailRows = `<tr><td colspan="7" style="text-align: center; padding: 10px; font-style: italic; color: #888;">ምንም ዝርዝር መረጃ የለም (No data)</td></tr>`;
    } else {
      activeForm010.forEach((row, idx) => {
        f010DetailRows += `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: #0f405c;">${row.date}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.handoverType || 'የክፍለከተማ መረካከቢያ'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.type}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-family: monospace;">${row.from} - ${row.to}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${row.qty}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${row.remark || '-'}</td>
          </tr>
        `;
      });
    }

    let f011DetailRows = '';
    if (activeForm011.length === 0) {
      f011DetailRows = `<tr><td colspan="7" style="text-align: center; padding: 10px; font-style: italic; color: #888;">ምንም ዝርዝር መረጃ የለም (No data)</td></tr>`;
    } else {
      activeForm011.forEach((row, idx) => {
        f011DetailRows += `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: #0f405c;">${row.date}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.serviceType}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${row.customer}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-family: monospace;">${row.serial}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-family: monospace;">${row.archive}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${row.method}</td>
          </tr>
        `;
      });
    }

    let f012DetailRows = '';
    if (activeForm012.length === 0) {
      f012DetailRows = `<tr><td colspan="6" style="text-align: center; padding: 10px; font-style: italic; color: #888;">ምንም ዝርዝር መረጃ የለም (No data)</td></tr>`;
    } else {
      activeForm012.forEach((row, idx) => {
        f012DetailRows += `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: #0f405c;">${row.date}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.printType}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-family: monospace;">${row.serial}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${row.returnStatus}</td>
            <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${row.reason}</td>
          </tr>
        `;
      });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #333; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #0f405c; padding-bottom: 15px; }
          .header h1 { margin: 0; font-size: 20px; color: #0f405c; }
          .header h2 { margin: 5px 0 0 0; font-size: 14px; color: #555; }
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 11px; background: #f9f9f9; padding: 10px 15px; border-radius: 6px; border: 1px solid #eee; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; border-left: 4px solid #0f405c; padding-left: 8px; margin-bottom: 12px; color: #0f405c; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
          th { background-color: #f0f5f7; color: #0f405c; padding: 10px; border: 1px solid #ddd; font-weight: bold; text-align: left; }
          td { padding: 8px 10px; border: 1px solid #ddd; }
          .reconciliation-box { background: #e6f4ea; border: 1px solid #34a853; border-radius: 8px; padding: 15px; margin-bottom: 25px; }
          .reconciliation-box h3 { margin: 0 0 10px 0; font-size: 12px; color: #137333; display: flex; align-items: center; }
          .reconciliation-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px; }
          .reconciliation-card { background: white; padding: 10px; border-radius: 4px; border: 1px solid #ceead6; text-align: center; }
          .reconciliation-card span { display: block; font-size: 10px; color: #666; font-weight: bold; }
          .reconciliation-card strong { font-size: 16px; color: #111; }
          .footer { text-align: center; margin-top: 50px; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
          @media print {
            body { margin: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <h2>${subtitle}</h2>
        </div>

        <div class="meta-info">
          <div><strong>ወረዳ:</strong> ${selectedWoreda}</div>
          <div><strong>ሪፖርት ያወጣው:</strong> የወረዳ 05 አስተዳዳሪ</div>
          <div>
            <strong>ቀን:</strong> ${ethDateNow} (${ethTimeNow})
            ${hasDateFilter ? `<br/><span style="color:#c2410c; font-weight:bold; font-size:10px;">የኦዲት መፈለጊያ ክልል፡ ከ ${fromStr || 'ማንኛውም'} እስከ ${toStr || 'ማንኛውም'}</span>` : ''}
          </div>
        </div>

        <!-- 1. ID HANDOVER AUDIT SUMMARY ONLY -->
        <div class="section">
          <div class="section-title">ክፍል 1፡ የመታወቂያ ርክክብ ኦዲት ማጠቃለያ (ID Handover Audit Summary)</div>
          <div class="reconciliation-box">
            <h3>✅ የመታወቂያ ክምችት ኦዲት ማረጋገጫ (ID Stock Audit Verification)</h3>
            <div style="font-size: 11px; color: #137333; font-weight: bold; margin-bottom: 12px;">
              የኦዲት ሁኔታ: ${auditMatch ? '✓ ሙሉ በሙሉ የተሳካ (ሁሉም ቁጥሮች ተጣጥመዋል)' : '⚠ ልዩነት አለ (እባክዎ መዝገቡን ያጣሩ)'}
            </div>
            <div class="reconciliation-grid">
              <div class="reconciliation-card">
                <span>አጠቃላይ ከክፍለ ከተማ የመጡ</span>
                <strong>${totalFromSubCity}</strong>
              </div>
              <div class="reconciliation-card">
                <span>ምዝገባ እንዳለቀ ያልወሰዱ</span>
                <strong>${readyNotPicked}</strong>
              </div>
              <div class="reconciliation-card">
                <span>የወሰዱ (ርክክብ የተጠናቀቀ)</span>
                <strong>${pickedUp}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- 2ሀ. FORM 010 AUDIT - SUB-CITY -->
        <div class="section">
          <div class="section-title">ክፍል 2ሀ፡ ከክፍለ ከተማ የተረከብናቸው ቅፆች ኦዲት (ቅፅ 010 - የክፍለከተማ መረካከቢያ)</div>
          <h4 style="font-size: 11px; font-weight: bold; margin: 5px 0; color: #0f405c;">📊 የክፍለከተማ መረካከቢያ ማጠቃለያ ሰንጠረዥ (Grouped Summary)</h4>
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">ተ.ቁ</th>
                <th>የኩነት አይነት (Event Type)</th>
                <th style="text-align: center;">የሰሪያል ቁጥር ክልል (Serial Range From-To)</th>
                <th style="width: 120px; text-align: center;">ድምር ብዛት (Sum Qty)</th>
              </tr>
            </thead>
            <tbody>
              ${f010SubCityRows}
            </tbody>
          </table>
        </div>

        <!-- 2ለ. FORM 010 AUDIT - WOREDA -->
        <div class="section">
          <div class="section-title">ክፍል 2ለ፡ በወረዳ የተረከብናቸው/ያሰራጨናቸው ቅፆች ኦዲት (ቅፅ 010 - የወረዳ መረካከቢያ)</div>
          <h4 style="font-size: 11px; font-weight: bold; margin: 5px 0; color: #0f405c;">📊 የወረዳ መረካከቢያ ማጠቃለያ ሰንጠረዥ (Grouped Summary)</h4>
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">ተ.ቁ</th>
                <th>የኩነት አይነት (Event Type)</th>
                <th style="text-align: center;">የሰሪያል ቁጥር ክልል (Serial Range From-To)</th>
                <th style="width: 120px; text-align: center;">ድምር ብዛት (Sum Qty)</th>
              </tr>
            </thead>
            <tbody>
              ${f010WoredaRows}
            </tbody>
          </table>
        </div>

        <!-- FORM 010 DETAILED DAILY HANDOVER RECORDS (BOTH TYPES) -->
        <div class="section">
          <div class="section-title">የቅፅ 010 ዝርዝር ርክክብ መዝገቦች (Detailed Daily Handover Records - All Types)</div>
          <table>
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="width: 40px; text-align: center; padding: 6px;">ተ.ቁ</th>
                <th style="padding: 6px;">የተረካከቡበት ቀን</th>
                <th style="padding: 6px;">የመረካከቢያ ዓይነት</th>
                <th style="padding: 6px;">የህትመት አይነት</th>
                <th style="padding: 6px; text-align: center;">ሴሪያል ክልል</th>
                <th style="padding: 6px; text-align: center;">ብዛት</th>
                <th style="padding: 6px;">ማስታወሻ</th>
              </tr>
            </thead>
            <tbody>
              ${f010DetailRows}
            </tbody>
          </table>
        </div>

        <!-- 3. FORM 011 AUDIT -->
        <div class="section">
          <div class="section-title">ክፍል 3፡ በወረዳ አገልግሎት የተሰጠባቸው ቅፆች ኦዲት (ቅፅ 011)</div>
          <h4 style="font-size: 11px; font-weight: bold; margin: 5px 0; color: #0f405c;">📊 የማጠቃለያ ሰንጠረዥ (Grouped Summary)</h4>
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">ተ.ቁ</th>
                <th>የኩነት አይነት (Event Type)</th>
                <th style="text-align: center;">የሴሪያል ቁጥር ክልል (Serial Range From-To)</th>
                <th style="width: 120px; text-align: center;">ድምር ብዛት (Sum Qty)</th>
              </tr>
            </thead>
            <tbody>
              ${f011Rows}
            </tbody>
          </table>

          <h4 style="font-size: 11px; font-weight: bold; margin: 15px 0 5px 0; color: #444;">📋 የቅፅ 011 ዝርዝር የአገልግሎት መዝገቦች (Detailed Service Log)</h4>
          <table>
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="width: 40px; text-align: center; padding: 6px;">ተ.ቁ</th>
                <th style="padding: 6px;">የተሰጠበት ቀን</th>
                <th style="padding: 6px;">የአገልግሎት አይነት</th>
                <th style="padding: 6px;">የተገልጋይ ስም</th>
                <th style="padding: 6px; text-align: center;">ሴሪያል ቁጥር</th>
                <th style="padding: 6px; text-align: center;">አቃፊ/አርካይቭ</th>
                <th style="padding: 6px;">ዘዴ</th>
              </tr>
            </thead>
            <tbody>
              ${f011DetailRows}
            </tbody>
          </table>
        </div>

        <!-- 4. FORM 012 AUDIT -->
        <div class="section">
          <div class="section-title">ክፍል 4፡ የባከኑና ያልተሰጡ ቅፆች ኦዲት (ቅፅ 012)</div>
          <h4 style="font-size: 11px; font-weight: bold; margin: 5px 0; color: #0f405c;">📊 የማጠቃለያ ሰንጠረዥ (Grouped Summary)</h4>
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">ተ.ቁ</th>
                <th>የኩነት አይነት (Event Type)</th>
                <th style="text-align: center;">የሴሪያል ቁጥር ክልል (Serial Range From-To)</th>
                <th style="width: 120px; text-align: center;">ድምር ብዛት (Sum Qty)</th>
              </tr>
            </thead>
            <tbody>
              ${f012Rows}
            </tbody>
          </table>

          <h4 style="font-size: 11px; font-weight: bold; margin: 15px 0 5px 0; color: #444;">🗑 የቅፅ 012 ዝርዝር የባከኑና ተመላሽ ቅጾች መዝገቦች (Detailed Spoiled/Returned Records)</h4>
          <table>
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="width: 40px; text-align: center; padding: 6px;">ተ.ቁ</th>
                <th style="padding: 6px;">የተበላሸበት/የተመለሰበት ቀን</th>
                <th style="padding: 6px;">የህትመት አይነት</th>
                <th style="padding: 6px; text-align: center;">ሴሪያል ቁጥር</th>
                <th style="padding: 6px; text-align: center;">ሁኔታ</th>
                <th style="padding: 6px;">የተበላሸበት/ያልተሰጠበት ምክንያት</th>
              </tr>
            </thead>
            <tbody>
              ${f012DetailRows}
            </tbody>
          </table>
        </div>

        <div class="footer">
          ይህ ሰነድ በቦሌ ወረዳ 05 የነዋሪዎች መታወቂያ ዲጂታል ማህደር በራስ-ሰር የተፈጠረ እውነተኛ የኦዲት መከታተያ ሪፖርት ነው።
        </div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      document.body.removeChild(printFrame);
    }, 500);
  };

  // Export report as Amharic CSV helper
  const exportToCSV = (formType: 'f010' | 'f011' | 'f012' | 'docs' | 'audit') => {
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
    } else if (formType === 'audit') {
      csvContent += "ተ.ቁ,ሰዓትና ቀን,ወረዳ,የድርጊቱ አይነት,የባለሙያ ስም,ዝርዝር መግለጫ\n";
      filteredAuditLogs.forEach((row, i) => {
        csvContent += `"${i+1}","${row.timestamp}","${row.woreda || ''}","${row.action}","${row.operator}","${row.details}"\n`;
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

  // Export active entries in the ID handover table as Excel-ready Amharic CSV
  const exportCurrentTableToExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM byte order mark to display Amharic correctly in Excel
    csvContent += "ተ.ቁ,ሙሉ ስም,መታወቂያ ቁጥር,የቤት ቁጥር,ስልክ ቁጥር,የመታወቂያ ሁኔታ,ርክክብ ወይም መልዕክት የተደረገበት ቀን,ምልክት (Signature)\n";
    
    filteredAdminInventory.forEach((row, i) => {
      const signatureStatus = row.pickupSignature ? "በፊርማ የተረጋገጠ" : (row.status === 'የወሰደ' ? "ተረክቧል (የወሰደ)" : "በእጅ የሚገኝ / ለመረከብ ዝግጁ");
      const statusLabel = row.status === 'የወሰደ' ? 'የወሰደ' : 'ለመረከብ ዝግጁ';
      const eventDate = row.status === 'የወሰደ' ? (row.pickupDate || '-') : (row.smsSentDate || '-');
      csvContent += `"${i+1}","${row.name}","${row.idNumber}","${row.houseNumber}","${row.phone}","${statusLabel}","${eventDate}","${signatureStatus}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    let fileName = `Bole_Woreda05_ID_Handover_All_Report_${ethDateNow.replace(/\//g, '-')}.csv`;
    if (smsPendingFilter) {
      fileName = `Bole_Woreda05_ID_SMS_Pending_Report_${ethDateNow.replace(/\//g, '-')}.csv`;
    } else if (deliveredFilter) {
      fileName = `Bole_Woreda05_ID_Delivered_Report_${ethDateNow.replace(/\//g, '-')}.csv`;
    }
    
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isPickupInPeriod = (pickupDateStr: string | undefined, period: 'day' | 'week' | 'month') => {
    if (!pickupDateStr) return false;
    
    const cleanDate = pickupDateStr.trim();
    const parts = cleanDate.split(' ');
    if (parts.length < 3) return false;
    
    const pDay = parseInt(parts[0], 10);
    const pMonth = parts[1];
    const pYear = parts[2];
    
    const nowParts = ethDateNow.split(' ');
    if (nowParts.length < 3) return false;
    const nDay = parseInt(nowParts[0], 10);
    const nMonth = nowParts[1];
    const nYear = nowParts[2];
    
    if (pYear !== nYear) return false;
    
    if (period === 'day') {
      return pDay === nDay && pMonth === nMonth;
    }
    
    if (period === 'month') {
      return pMonth === nMonth;
    }
    
    if (period === 'week') {
      if (pMonth === nMonth) {
        const diff = nDay - pDay;
        return diff >= 0 && diff < 7;
      }
      
      const pMonthIdx = ethMonths.indexOf(pMonth);
      const nMonthIdx = ethMonths.indexOf(nMonth);
      
      if (pMonthIdx !== -1 && nMonthIdx !== -1) {
        if (nMonthIdx - pMonthIdx === 1 || (nMonthIdx === 0 && pMonthIdx === 12)) {
          const daysInPrevMonth = pMonth === 'ጳጉሜን' ? 6 : 30;
          const diff = (nDay + daysInPrevMonth) - pDay;
          return diff >= 0 && diff < 7;
        }
      }
    }
    
    return false;
  };

  const deliveredInPeriod = idInventory.filter(item => 
    item.status === 'የወሰደ' && isPickupInPeriod(item.pickupDate, reportPeriod)
  );

  const countDailySig = idInventory.filter(item => item.status === 'የወሰደ' && isPickupInPeriod(item.pickupDate, 'day')).length;
  const countWeeklySig = idInventory.filter(item => item.status === 'የወሰደ' && isPickupInPeriod(item.pickupDate, 'week')).length;
  const countMonthlySig = idInventory.filter(item => item.status === 'የወሰደ' && isPickupInPeriod(item.pickupDate, 'month')).length;

  const downloadHandoverPDF = () => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const periodLabel = reportPeriod === 'day' ? 'የዛሬ (Daily)' : reportPeriod === 'week' ? 'የዚህ ሳምንት (Weekly)' : 'የዚህ ወር (Monthly)';
    const title = `የሲቪል ምዝገባ እና የነዋሪነት አገልግሎት ኤጀንሲ - ቦሌ ወረዳ 05`;
    const subtitle = `${periodLabel} የመታወቂያ ርክክብ ሪፖርት ማጠቃለያ`;

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #0f405c; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-size: 20px; color: #0f405c; margin: 0; font-weight: 800; }
            .header h2 { font-size: 15px; color: #0284c7; margin: 8px 0 0 0; font-weight: 700; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .meta-table td { border: none; padding: 4px 0; font-size: 12px; font-weight: bold; }
            table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            table.data-table th { background-color: #0f405c; color: white; padding: 12px 10px; font-weight: 800; text-align: left; border: 1px solid #0f405c; }
            table.data-table td { border: 1px solid #e2e8f0; padding: 10px; font-weight: 600; color: #334155; }
            table.data-table tr:nth-child(even) { background-color: #f8fafc; }
            .sig-img { height: 35px; max-width: 120px; object-fit: contain; }
            .signatures-row { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig-col { border-top: 1.5px solid #64748b; width: 220px; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; color: #475569; }
            .footer { margin-top: 60px; border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <h2>${subtitle}</h2>
          </div>
          <table class="meta-table">
            <tr>
              <td>ሪፖርት የወጣበት ቀን: <span style="color:#0f405c;">${ethDateNow}</span></td>
              <td style="text-align: right;">ጠቅላላ ርክክቦች ብዛት: <span style="color:#16a34a;">${deliveredInPeriod.length} ነዋሪዎች</span></td>
            </tr>
            <tr>
              <td>አውጪው ክፍል: የነዋሪዎች መታወቂያ አገልግሎት ክፍል</td>
              <td style="text-align: right;">የሪፖርቱ ሁኔታ: በስርዓቱ የተረጋገጠ ✓</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">ተ.ቁ</th>
                <th>የነዋሪው ሙሉ ስም (Full Name)</th>
                <th>የመታወቂያ ቁጥር (ID Number)</th>
                <th>የቤት ቁጥር (House No.)</th>
                <th>የተረከበበት ቀን (Date)</th>
                <th style="width: 150px; text-align: center;">የተረካቢ ፊርማ (Signature)</th>
              </tr>
            </thead>
            <tbody>
              ${deliveredInPeriod.length > 0 ? 
                deliveredInPeriod.map((item, idx) => `
                  <tr>
                    <td style="text-align: center; font-weight: 800;">${idx + 1}</td>
                    <td style="font-weight: 800; color: #0f405c;">${item.name}</td>
                    <td style="font-family: monospace; font-size: 11.5px;">${item.idNumber}</td>
                    <td>${item.houseNumber || 'ያልተገለጸ'}</td>
                    <td>${item.pickupDate || '-'}</td>
                    <td style="text-align: center;">
                      ${item.pickupSignature ? `<img class="sig-img" src="${item.pickupSignature}" />` : '<span style="color: #ef4444; font-size: 10px;">ፊርማ የለም</span>'}
                    </td>
                  </tr>
                `).join('') 
                : '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8; font-weight: bold;">በተጠቀሰው የጊዜ ገደብ ውስጥ የተረከበ ነዋሪ የለም።</td></tr>'
              }
            </tbody>
          </table>

          <div class="signatures-row">
            <div class="sig-col">ያዘጋጀው ባለሙያ ፊርማ</div>
            <div class="sig-col">የመረጃ ዴስክ ኃላፊ ፊርማ</div>
          </div>

          <div class="footer">
            ይህ ሰነድ በቦሌ ወረዳ 05 የነዋሪዎች መታወቂያ ዲጂታል ማህደር በራስ-ሰር የተፈጠረ ህጋዊ ሪፖርት ነው።
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      document.body.removeChild(printFrame);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* HEADER SECTION - Beautiful pure white header matching the uploaded image completely */}
      <header className="bg-white border-b border-slate-200/90 shadow-xs no-print py-4.5 px-4 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Left Side: Brand Logo and Title */}
          <div className="flex items-center gap-2.5 sm:gap-4.5">
            <img 
              src={crrsaLogo} 
              alt="CRRSA Logo" 
              className="h-12 sm:h-16 md:h-[68px] object-contain shrink-0 select-none cursor-pointer transition-transform duration-250 active:scale-95" 
              onClick={() => { setActivePortal('public'); setSelectedPublicID(null); }}
              referrerPolicy="no-referrer" 
            />
            <div className="h-9 sm:h-11 w-[1.5px] bg-slate-200 shrink-0"></div>
            <div className="flex flex-col text-left justify-center">
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setWoredaDropdownOpen(!woredaDropdownOpen)}
                  className="text-xs sm:text-base md:text-lg font-black text-[#0c334d] tracking-tight leading-tight flex items-center gap-1.5 hover:text-[#0284c7] transition-colors duration-200 cursor-pointer"
                >
                  AACRRS {selectedWoreda} ፅ/ቤት
                  <ChevronDown className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                </button>
                {woredaDropdownOpen && (
                  <div className="absolute left-0 mt-2.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden font-bold py-1.5 text-slate-800 animate-fade-in no-print">
                    <div className="px-3.5 py-1.5 border-b border-slate-100 text-[9.5px] text-slate-400 uppercase tracking-wider">
                      ወረዳ ቀይር (Switch District)
                    </div>
                    {woredaList.map((woreda) => (
                      <button
                        key={woreda}
                        type="button"
                        onClick={() => {
                          setSelectedWoreda(woreda);
                          setWoredaDropdownOpen(false);
                          logAuditAction('የወረዳ መቀየር (District Switch)', `የሚሰራበት ወረዳ ወደ ${woreda} ተቀይሯል።`);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-xs transition-colors duration-150 flex items-center justify-between ${selectedWoreda === woreda ? 'text-sky-600 bg-sky-50/50' : 'text-slate-700'}`}
                      >
                        <span>{woreda}</span>
                        {selectedWoreda === woreda && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                      </button>
                    ))}
                    
                    {/* Inline Form to add a custom new woreda */}
                    <div className="border-t border-slate-100 p-2.5 mt-1.5 space-y-1.5 bg-slate-50/50">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">አዲስ ወረዳ ጨምር (Add Woreda)</div>
                      <div className="flex gap-1.5">
                        <input 
                          id="newWoredaInput"
                          type="text" 
                          placeholder="ምሳሌ፦ ልደታ ወረዳ 08" 
                          className="w-full text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-normal text-slate-800"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.currentTarget;
                              const val = input.value.trim();
                              if (val) {
                                if (!woredaList.includes(val)) {
                                  const updated = [...woredaList, val];
                                  setWoredaList(updated);
                                  localStorage.setItem('W05_woredaList', JSON.stringify(updated));
                                  setSelectedWoreda(val);
                                  logAuditAction('አዲስ ወረዳ መመዝገብ (Register Woreda)', `አዲስ የሰነድ መቆጣጠሪያ ወረዳ [${val}] ተመዝግቧል።`);
                                }
                                input.value = '';
                                setWoredaDropdownOpen(false);
                              }
                            }
                          }}
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const input = document.getElementById('newWoredaInput') as HTMLInputElement;
                            const val = input?.value?.trim();
                            if (val) {
                              if (!woredaList.includes(val)) {
                                const updated = [...woredaList, val];
                                setWoredaList(updated);
                                localStorage.setItem('W05_woredaList', JSON.stringify(updated));
                                setSelectedWoreda(val);
                                logAuditAction('አዲስ ወረዳ መመዝገብ (Register Woreda)', `አዲስ የሰነድ መቆጣጠሪያ ወረዳ [${val}] ተመዝግቧል።`);
                              }
                              input.value = '';
                              setWoredaDropdownOpen(false);
                            }
                          }}
                          className="px-2 py-1 bg-[#0c334d] hover:bg-[#072132] text-white rounded-md text-[9px] font-bold shrink-0 cursor-pointer transition"
                        >
                          ጨምር
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-500 font-bold mt-0.5 sm:mt-1">
                {currentLang === 'am' ? `የ${selectedWoreda} የዲጂታል ስርዓት` :
                 currentLang === 'or' ? `Sirna Diijiitaalaa Bulchiinsa ${selectedWoreda}` :
                 `${selectedWoreda} Digital System`}
              </span>
            </div>
          </div>

          {/* Right Side: Navigation & Actions Controls (Matches Image Exactly) */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* Language Selection Button (Styled like the dark greyish/blueish button in image) */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="px-3.5 py-2.5 bg-[#2d5165] hover:bg-[#234050] border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-xs"
              >
                <span className="text-base select-none">
                  {currentLang === 'en' ? '🇺🇸' : '🇪🇹'}
                </span>
                <span className="hidden sm:inline">
                  {currentLang === 'am' ? 'አማርኛ' : currentLang === 'or' ? 'Aor' : 'English'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-sky-200/90" />
              </button>
              
              {langDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white border border-slate-150 rounded-xl shadow-lg z-50 overflow-hidden font-bold py-1 text-slate-800 animate-fade-in">
                  <button 
                    type="button"
                    onClick={() => { setCurrentLang('am'); setLangDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs transition block"
                  >
                    🇪🇹 አማርኛ
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setCurrentLang('or'); setLangDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs transition block"
                  >
                    🇪🇹 Afaan Oromoo
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setCurrentLang('en'); setLangDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs transition block"
                  >
                    🇺🇸 English
                  </button>
                </div>
              )}
            </div>

            {/* Login Button (Deep blue, solid color, styled like the "Login" button in image) */}
            <button
              type="button"
              onClick={() => {
                if (activePortal === 'public') {
                  setActivePortal('admin');
                } else {
                  setActivePortal('public');
                  setSelectedPublicID(null);
                }
              }}
              className="px-5.5 py-2.5 bg-[#0c334d] hover:bg-[#072132] text-white text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 shadow-sm cursor-pointer border border-[#0c334d] active:scale-97"
            >
              {activePortal === 'admin' ? (currentLang === 'am' ? 'ውጣ' : 'Logout') : 'Login'}
            </button>

            {/* Hamburger Menu (White, thin border, dark blue icon matching image) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHamburgerMenuOpen(!hamburgerMenuOpen)}
                className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-[#0f384c] rounded-xl transition-all duration-200 cursor-pointer shadow-3xs"
              >
                {hamburgerMenuOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
              </button>

              {/* Responsive Dropdown Menu for Hamburger */}
              {hamburgerMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-fade-in font-bold text-slate-800">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-[11px] text-slate-400 uppercase tracking-wider">ፈጣን አማራጮች (Quick Links)</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <button 
                      onClick={() => { setActivePortal('public'); setHamburgerMenuOpen(false); }}
                      className="w-full text-left p-2 hover:bg-sky-50 rounded-lg text-[#0f384c] flex items-center gap-2"
                    >
                      🗣️ የህዝብ መረጃ መግቢያ (Public Portal)
                    </button>
                    <button 
                      onClick={() => { setActivePortal('admin'); setHamburgerMenuOpen(false); }}
                      className="w-full text-left p-2 hover:bg-sky-50 rounded-lg text-[#0f384c] flex items-center gap-2"
                    >
                      💼 የባለሙያ መግቢያ (Expert Portal)
                    </button>
                    <a 
                      href="#id-directory" 
                      onClick={() => setHamburgerMenuOpen(false)}
                      className="w-full text-left p-2 hover:bg-sky-50 rounded-lg text-slate-700 flex items-center gap-2 block"
                    >
                      🏠 የታተሙ መታወቂያዎች ማውጫ
                    </a>
                  </div>
                  <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100 text-[9.5px] text-amber-900 leading-normal">
                    <strong>💡 ማሳሰቢያ፡</strong> ማንኛውም የአገልግሎት ጥያቄ ወይም ቅሬታ ሲኖርዎት በስራ ሰዓት በስልክ ቁጥር <strong>8484</strong> ይደውሉልን።
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* 🚥 Custom Multicolored LED Sequential Running Light Ticker (Enhanced, Wider, and highly readable) 🚥 */}
      <div className="w-full bg-[#030610] border-y-2 border-slate-900 py-3 px-3 no-print flex flex-col items-center justify-center space-y-2.5 relative shadow-xl overflow-hidden select-none">
        
        {/* Upper LED Color Dot Row (Sequential Left to Right Wave) */}
        <div className="w-full flex justify-between items-center max-w-6xl overflow-hidden px-2 gap-1.5">
          {Array.from({ length: 36 }).map((_, i) => {
            const colors = [
              'bg-rose-500 shadow-rose-500/90 text-rose-400',
              'bg-amber-400 shadow-amber-400/90 text-amber-300',
              'bg-emerald-400 shadow-emerald-400/90 text-emerald-350',
              'bg-cyan-400 shadow-cyan-400/90 text-cyan-300',
              'bg-fuchsia-500 shadow-fuchsia-500/90 text-fuchsia-400',
              'bg-sky-400 shadow-sky-400/90 text-sky-300'
            ];
            const colorClass = colors[i % colors.length];
            const delay = Math.abs(18 - (i % 36)) * 0.04;
            return (
              <div 
                key={`led-top-${i}`} 
                className={`w-2 h-2 rounded-full shrink-0 shadow-xs transition-all duration-300 ${colorClass}`}
                style={{
                  animation: 'led-bg-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>

        {/* Scrolling LED Digital Text Marquee Banner (Taller, wider, and extremely clear/readable text) */}
        <div className="w-full max-w-6xl overflow-hidden relative h-11 flex items-center justify-center bg-[#070e1b] rounded-xl border-2 border-slate-700 shadow-md px-4">
          <div 
            className="whitespace-nowrap font-black text-sm sm:text-base md:text-lg tracking-[0.2em] text-center select-none"
            style={{
              animation: 'led-scroll-left-right 22s ease-in-out infinite, led-color-pulse 6s ease-in-out infinite'
            }}
          >
            🌟 እንኳን ደህና መጡ! • AACRRS {selectedWoreda} ፅ/ቤት የዲጂታል ስርዓት • CRRSA {selectedWoreda} Digital System • 🌟
          </div>
        </div>

        {/* Lower Opposite Flow LED Color Dot Row (Sequential Right to Left Wave) */}
        <div className="w-full flex justify-between items-center max-w-6xl overflow-hidden px-2 gap-1.5">
          {Array.from({ length: 36 }).map((_, i) => {
            const colors = [
              'bg-cyan-400 shadow-cyan-400/90 text-cyan-300',
              'bg-emerald-400 shadow-emerald-400/90 text-emerald-350',
              'bg-amber-400 shadow-amber-400/90 text-amber-300',
              'bg-rose-500 shadow-rose-500/90 text-rose-400',
              'bg-sky-400 shadow-sky-400/90 text-sky-300',
              'bg-fuchsia-500 shadow-fuchsia-500/90 text-fuchsia-400'
            ];
            const colorClass = colors[i % colors.length];
            const delay = Math.abs((i % 36) - 18) * 0.04;
            return (
              <div 
                key={`led-bottom-${i}`} 
                className={`w-2 h-2 rounded-full shrink-0 shadow-xs transition-all duration-300 ${colorClass}`}
                style={{
                  animation: 'led-bg-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>

      </div>

      {/* Main Container Stage wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-5 md:p-6 space-y-6 bg-white">
        
        {activePortal === 'public' && (
          <>
            <div className="w-full space-y-4">
              
              {/* Headline & Counters Dashboard Header */}
              <div className="bg-sky-50 rounded-2xl border border-sky-100/80 p-4.5 space-y-3 shadow-3xs">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-black tracking-tight text-[#0284c7] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                      መታወቂያዎ ታትሞ መድረሱን ያረጋግጡ
                    </h2>
                    <p className="text-[10px] sm:text-[11.5px] text-sky-800 font-extrabold max-w-xl leading-relaxed mt-0.5">
                      መታወቂያዎ ታትሞ መድረሱን ለማረጋገጥ ስምዎን ወይም የመታወቂያ ቁጥርዎን ከታች ባለው መፈለጊያ ሳጥን ውስጥ ያስገቡ።
                    </p>
                  </div>
                  
                  {/* Compact responsive counters */}
                  <div className="grid grid-cols-2 gap-2 bg-white/90 backdrop-blur-xs p-2 rounded-xl border border-sky-200/30 w-full md:w-auto text-center shrink-0">
                    <div className="px-2.5 py-1 bg-sky-50 rounded-lg border border-sky-100/50">
                      <span className="text-[8px] text-sky-600 font-black block leading-none mb-0.5">ለመረከብ ዝግጁ</span>
                      <span className="text-base font-black text-sky-900 leading-none">{countReady}</span>
                    </div>
                    <div className="px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-100/50">
                      <span className="text-[8px] text-emerald-600 font-black block leading-none mb-0.5">የወሰዱ (የተረከቡ)</span>
                      <span className="text-base font-black text-emerald-600 leading-none">{countDelivered}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Interactive Search Input Console */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-xs text-[#0f384c] flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {t('quickChecker')}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      스ምዎን (ለምሳሌ "ዮሴፍ") ወይም የመታወቂያ ቁጥርዎን ያስገቡ።
                    </p>
                  </div>
                  {(publicSearch.trim() !== "" || publicDateSearch.trim() !== "") && (
                    <button 
                      type="button"
                      onClick={() => {
                        setPublicSearch("");
                        setPublicDateSearch("");
                        setSelectedPublicID(null);
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-750 text-[10px] font-black rounded-lg transition-all"
                    >
                      {t('clearSearch')}
                    </button>
                  )}
                </div>

                {/* Sleek live search box and date filter */}
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={publicSearch}
                      onChange={(e) => setPublicSearch(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="w-full text-xs sm:text-sm p-3.5 pl-11 border-2 border-teal-50 focus:border-[#0f384c] rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100/30 bg-slate-50/50 uppercase placeholder-slate-400 font-black transition-all shadow-inner"
                    />
                    <Search className="w-4 h-4 text-[#0f384c] absolute left-4 top-4" />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 lg:w-[420px]">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={publicDateSearch}
                        onChange={(e) => setPublicDateSearch(e.target.value)}
                        placeholder="በምዝገባ ቀን (ቀን ወር ዓ.ም)..."
                        className="w-full text-xs p-3.5 pl-9 border-2 border-teal-50 focus:border-[#0f384c] rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100/30 bg-slate-50/50 placeholder-slate-400 font-black transition-all shadow-inner"
                        title="ለምሳሌ፡ 26 ሰኔ 2018"
                      />
                      <Calendar className="w-3.5 h-3.5 text-[#0f384c] absolute left-3 top-4" />
                    </div>
                    
                    {uniqueRegDates.length > 0 && (
                      <select
                        value={publicDateSearch}
                        onChange={(e) => setPublicDateSearch(e.target.value)}
                        className="text-xs p-3 border-2 border-teal-50 focus:border-[#0f384c] rounded-xl focus:outline-none bg-slate-50/50 font-bold max-w-full sm:max-w-[200px]"
                      >
                        <option value="">-- ቀንን ምረጥ (Date) --</option>
                        {uniqueRegDates.map((dateVal) => (
                          <option key={dateVal} value={dateVal}>{dateVal}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Active Selected ID Card Pickup details */}
                {selectedPublicID && (
                  <div className="bg-emerald-50/70 text-emerald-950 p-4 rounded-xl border border-emerald-100 space-y-3 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-emerald-200/50 pb-2">
                      <span className="text-[9.5px] font-black uppercase text-emerald-800 tracking-wider">የተገኘ የመታወቂያ ዝርዝር (Selected ID Details):</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedPublicID(null)}
                        className="text-xs font-black text-rose-700 hover:text-rose-900 bg-white shadow-3xs w-5 h-5 rounded-full flex items-center justify-center border border-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold">የተገልጋይ ሙሉ ስም (Full Name)</p>
                        <p className="font-black text-slate-800 text-xs sm:text-sm">{selectedPublicID.name}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold">የመታወቂያ ቁጥር (ID Number)</p>
                        <p className="font-black text-slate-800 font-mono text-xs">{selectedPublicID.idNumber}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold">የቤት ቁጥር (House No.)</p>
                        <p className="font-black text-slate-800 text-xs">{selectedPublicID.houseNumber || 'ያልተገለጸ'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold">የመታወቂያ ሁኔታ (Status)</p>
                        {selectedPublicID.status === 'የወሰደ' ? (
                          <span className="inline-flex px-2 py-0.5 bg-slate-200 text-slate-700 text-[9.5px] rounded-full font-black">
                            ✔ የተረከበ ({selectedPublicID.pickupDate})
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 bg-emerald-600 text-white text-[9.5px] rounded-full font-black animate-pulse shadow-sm">
                            ⭐ ለመውሰድ ዝግጁ
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {selectedPublicID.status === 'የወሰደ' && (
                      <div className="bg-white/90 p-3 rounded-lg border border-emerald-100 text-[10px] leading-relaxed font-bold mt-2 shadow-3xs">
                        <p className="text-slate-600">📅 ይህ መታወቂያ ቀደም ሲል በ <span className="text-slate-900 border-b border-slate-200 font-extrabold">{selectedPublicID.pickupDate || 'ትናንትና'}</span> ተረክበው ወስደዋል። እናመሰግናለን!</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Display list of search matches */}
                {(publicSearch.trim() !== "" || publicDateSearch.trim() !== "") && (
                  <div className="pt-2 space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                      <span className="text-[10px] font-black text-[#0f384c] uppercase tracking-wider">{t('searchResults')}:</span>
                      <span className="text-[10.5px] font-black bg-white text-[#0f384c] border border-cyan-150 px-2.5 py-0.5 rounded-full shadow-3xs">
                        {filteredPublicInventory.length} {t('foundCount')}
                      </span>
                    </div>

                    {filteredPublicInventory.length > 0 ? (
                      <div className="space-y-4">
                        {/* 1. Ready Section */}
                        {filteredPublicInventory.some(item => item.status !== 'የወሰደ') && (
                          <div className="space-y-2">
                            <h4 className="text-[10.5px] font-extrabold text-emerald-800 flex items-center gap-1.5 px-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                              ለመውሰድ ዝግጁ የሆኑ (ያልተረከቡ)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                              {filteredPublicInventory.filter(item => item.status !== 'የወሰደ').map((item) => (
                                <div 
                                  key={item.id} 
                                  onClick={() => setSelectedPublicID(item)}
                                  className={`p-3.5 rounded-xl border transition-all duration-300 shadow-sm flex flex-col justify-between gap-2.5 cursor-pointer ${selectedPublicID?.id === item.id ? 'ring-3 ring-cyan-400 bg-cyan-50/10 border-cyan-300' : 'bg-emerald-50/20 border-emerald-100 hover:shadow-md hover:scale-[1.01]'}`}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                                      <p className="text-[9.5px] font-mono text-slate-500 mt-0.5">መታወቂያ ቁጥር: <span className="font-extrabold">{item.idNumber}</span></p>
                                      {(item.registrationDate || item.smsSentDate) && (
                                        <p className="text-[9px] text-teal-850 font-bold mt-1 flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-teal-600" />
                                          <span>የደረሰበት ቀን: {item.registrationDate || item.smsSentDate}</span>
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-[8px] px-1.5 py-0.5 font-black bg-emerald-600 text-white rounded-md animate-pulse shadow-sm">
                                      ዝግጁ!
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[9.5px] text-slate-500 border-t border-slate-100 pt-2 font-bold">
                                    <span>ቤት ቁጥር: {item.houseNumber || 'ያልተገለጸ'}</span>
                                    <span className="text-[#0f384c] font-black bg-teal-50/80 px-2 py-0.5 rounded border border-teal-100/50">
                                      ዝርዝር ለመመልከት ይጫኑ
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Collected Section */}
                        {filteredPublicInventory.some(item => item.status === 'የወሰደ') && (
                          <div className="space-y-2">
                            <h4 className="text-[10.5px] font-extrabold text-slate-600 flex items-center gap-1.5 px-1 border-t pt-2.5 border-slate-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span>
                              ተረክበው የወሰዱ (ቀደም ሲል የተሰጡ)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                              {filteredPublicInventory.filter(item => item.status === 'የወሰደ').map((item) => (
                                <div 
                                  key={item.id} 
                                  onClick={() => setSelectedPublicID(item)}
                                  className={`p-3.5 rounded-xl border transition-all duration-300 shadow-sm flex flex-col justify-between gap-2.5 cursor-pointer ${selectedPublicID?.id === item.id ? 'ring-3 ring-cyan-400 bg-cyan-50/10 border-cyan-300' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'}`}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                                      <p className="text-[9.5px] font-mono text-slate-500 mt-0.5">መታወቂያ ቁጥር: <span className="font-extrabold">{item.idNumber}</span></p>
                                      {(item.registrationDate || item.smsSentDate) && (
                                        <p className="text-[9px] text-teal-850 font-bold mt-1 flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-teal-600" />
                                          <span>የደረሰበት ቀን: {item.registrationDate || item.smsSentDate}</span>
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-[8px] px-1.5 py-0.5 font-black bg-slate-200 text-slate-600 rounded-md">
                                      የወሰዱ
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[9.5px] text-slate-500 border-t border-slate-100 pt-2 font-bold">
                                    <span>ቤት ቁጥር: {item.houseNumber || 'ያልተገለጸ'}</span>
                                    <span className="text-emerald-700">የተረከቡት: {item.pickupDate}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-rose-50/40 border border-rose-100/60 rounded-xl">
                        <p className="text-xs text-rose-800 font-extrabold leading-relaxed">
                          ⚠️ "{publicSearch}" የሚል ስም ወይም የመታወቂያ ቁጥር በስርዓቱ ውስጥ አልተገኘም።
                        </p>
                        <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">
                          እባክዎ በትክክል መፃፉን ያረጋግጡ (ለምሳሌ ስምዎን ሙሉ ወይም የተወሰነ ፊደላትን በማስገባት ይፈልጉ)።
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. SIDE-BY-SIDE SECTION: PREREQUISITES MANUAL & PRINTED IDS DIRECTORY GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch pt-2">
              
              {/* Left Column (Prerequisites & Selected Service Requirements Viewer) */}
              <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden flex flex-col h-full transition-all duration-300">
                {/* Header Box (Exclusive LED Marquee Ticker in Light Blue with White Text) */}
                <div className="bg-[#f0f9ff] border-b border-sky-100 p-3 shrink-0">
                  <div className="w-full bg-[#071e3d] border-2 border-[#0284c7] rounded-xl py-2 px-3.5 overflow-hidden select-none shadow-md">
                    <div className="whitespace-nowrap overflow-hidden relative w-full flex items-center justify-center">
                      <div 
                        className="whitespace-nowrap font-black text-xs sm:text-xs tracking-wider text-white uppercase"
                        style={{
                          textShadow: '1px 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(255, 255, 255, 0.85)',
                          animation: 'led-scroll-left-right 18s ease-in-out infinite'
                        }}
                      >
                        🌟 የአገልግሎቶች ቅድመ ሁኔታ ማኑዋል • የቦሌ ወረዳ 05 አገልግሎት መመሪያ ማህደር 🌟
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4.5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">

                    {/* Manual Override dropdown selector & background rotation status */}
                    <div className="bg-[#edfafd]/50 p-3.5 rounded-2xl border border-slate-200/85 shadow-3xs space-y-2.5">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5">
                        <label className="block text-[9.5px] font-black uppercase text-slate-500 tracking-wider">
                          እጅን በራስዎ መምረጥ ከፈለጉ (Or Choose Service Manually):
                        </label>
                        
                        {/* Status badge & Resume trigger */}
                        <div className="flex items-center gap-2">
                          {isAutoRotatePaused ? (
                            <button
                              type="button"
                              onClick={() => {
                                setIsAutoRotatePaused(false);
                                setRotateSecondsLeft(autoRotateInterval);
                              }}
                              className="text-[9.5px] font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                              title="በየ 5 ደቂቃው በራሱ እንዲለዋወጥ መልሰው ያስጀምሩ"
                            >
                              <span>🔄 ራስ-ሰር ቅያሬን አስጀምር (Resume)</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                              <span>ራስ-ሰር ቅያሬ ላይ ነው</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <select 
                        value={selectedPublicReqId || (requirements[0]?.id || '')}
                        onChange={(e) => handleManualReqSelect(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#0f405c] focus:outline-none transition-all font-bold text-slate-800 cursor-pointer shadow-3xs"
                      >
                        {requirements.map((req) => {
                          let displayName = req.subCategory || req.title;
                          if (req.id === 'req-birth') displayName = '👶 የልደት ምዝገባ';
                          else if (req.id === 'req-marriage') displayName = '💍 የጋብቻ ምዝገባ';
                          else if (req.id === 'req-adoption') displayName = '👪 የጉዲፈቻ ምዝገባ';
                          else if (req.id === 'req-death') displayName = '🕊️ የሞት ምዝገባ';
                          else if (req.id === 'req-divorce') displayName = '💔 የፍቺ ምዝገባ';
                          else if (req.id === 'req-single') displayName = '📜 ያላገባ (ያለገባ) ምስክር ወረቀት';
                          else if (req.id === 'req-life') displayName = '👤 በሕይወት መኖር ማረጋገጫ';
                          else if (req.id === 'req-id-new') displayName = '🏠 አዲስ የነዋሪነት መታወቂያ';
                          else if (req.id === 'req-id-renew') displayName = '🔄 የነዋሪነት መታወቂያ እድሳት';
                          else if (req.id === 'req-id-replace') displayName = '⚠️ የጠፋ/የተበላሸ መታወቂያ መተኪያ';
                          else {
                            const prefix = req.category === 'civil' ? '📋 ' : req.category === 'residency' ? '🏠 ' : '📄 ';
                            displayName = `${prefix}${req.subCategory || req.title}`;
                          }
                          return (
                            <option key={req.id} value={req.id} className="font-bold py-1">
                              {displayName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Prerequisite Details View */}
                    {(() => {
                      const reqToShow = requirements.find(r => r.id === selectedPublicReqId) || requirements[0];
                      if (!reqToShow) {
                        return (
                          <div className="p-4 text-center text-slate-400 text-[10px] bg-slate-50/50 rounded-xl">
                            ምንም የተቀመጡ የአገልግሎት መረጃዎች አልተገኙም።
                          </div>
                        );
                      }
                      
                      // Fetch the custom LED styling for this active service
                      const ledStyle = getServiceLedStyle(reqToShow.id);

                      return (
                        <div className="space-y-3.5 animate-fade-in">
                          {/* Inner container with service specific theme and active glow */}
                          <div className={`p-4 border rounded-2xl transition-all duration-300 space-y-3.5 shadow-sm hover:shadow-md ${ledStyle.bg} ${ledStyle.border} ${ledStyle.glow}`}>
                            
                            {/* Service Category Badge & LED Dot Indicator */}
                            <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg select-none">{ledStyle.emoji}</span>
                                <span className="text-xs font-black text-slate-900">{reqToShow.title}</span>
                              </div>
                              {/* Pulsing LED light styled with custom service color */}
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${ledStyle.ledDot} animate-pulse shrink-0`}></span>
                                <span className="text-[8.5px] font-extrabold text-slate-500 uppercase tracking-widest">{ledStyle.nameAm}</span>
                              </div>
                            </div>

                            {/* 🚥 EXCLUSIVE LOCAL DIGITAL LED TICKER FOR THIS SERVICE 🚥 */}
                            <div className="w-full bg-[#0a0f1d] border-2 border-slate-800 rounded-xl py-2.5 px-3 overflow-hidden select-none shadow-md">
                              <div className="whitespace-nowrap overflow-hidden relative w-full flex items-center justify-center">
                                <div 
                                  className="whitespace-nowrap font-mono font-bold text-[10.5px] sm:text-xs tracking-wider uppercase"
                                  style={{
                                    color: '#ffffff',
                                    textShadow: '1px 1px 1px rgba(0,0,0,0.95), 0 0 3px ' + (ledStyle.ledGlowColor || 'rgba(56, 189, 248, 0.95)'),
                                    animation: 'led-scroll-left-right 14s ease-in-out infinite'
                                  }}
                                >
                                  ⭐ {ledStyle.emoji} {reqToShow.title} ⭐
                                </div>
                              </div>
                            </div>

                            {/* Description text block */}
                            <p className="text-[11px] text-slate-700 font-bold leading-relaxed px-1">
                              {reqToShow.description}
                            </p>

                            {/* Bullet requirements */}
                            <div className="space-y-2 pt-1 px-1">
                              <p className="text-[9.5px] uppercase tracking-wider text-slate-500 font-black">📋 የሚያስፈልጉ ሰነዶች (Required Documents):</p>
                              <div className="space-y-1.5 max-h-[155px] overflow-y-auto pr-1">
                                {reqToShow.points && reqToShow.points.length > 0 ? (
                                  reqToShow.points.map((pt: string, idx: number) => (
                                    <div key={idx} className="flex items-start space-x-2.5 text-[10px] text-slate-700 font-bold bg-white/80 hover:bg-white p-2.5 rounded-xl border border-slate-150/60 shadow-3xs transition">
                                      <span className={`text-xs font-black select-none ${ledStyle.accent}`}>✓</span>
                                      <span>{pt}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[9.5px] text-slate-400 font-bold italic">ምንም አስገዳጅ ሰነድ አልተገለጸም።</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Quick Tip notice always at the bottom of the left column */}
                  <div className="bg-amber-50/80 text-amber-900 text-[9.5px] p-2.5 rounded-xl border border-amber-150/30 font-bold flex items-start gap-1.5 leading-tight shadow-3xs mt-2">
                    <span className="text-xs select-none leading-none">💡</span>
                    <div>
                      <strong>ጠቃሚ መረጃ፡</strong> ሰነዶችን ወደ መስሪያ ቤቱ ይዘው ከመምጣትዎ በፊት የቀረቡትን መስፈርቶች ማሟላትዎን ያረጋግጡ።
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (PUBLIC LIVE PRINTED IDS DIRECTORY INVENTORY LISTING) */}
              <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden flex flex-col h-full">
                {/* Header Box (Exclusive LED Marquee Ticker in Light Blue with White Text) */}
                <div className="bg-[#f0f9ff] border-b border-sky-100 p-3 shrink-0">
                  <div className="w-full bg-[#071e3d] border-2 border-[#0284c7] rounded-xl py-2 px-3.5 overflow-hidden select-none shadow-md">
                    <div className="whitespace-nowrap overflow-hidden relative w-full flex items-center justify-center">
                      <div 
                        className="whitespace-nowrap font-black text-xs sm:text-xs tracking-wider text-white uppercase"
                        style={{
                          textShadow: '1px 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(255, 255, 255, 0.85)',
                          animation: 'led-scroll-left-right 18s ease-in-out infinite'
                        }}
                      >
                        🌟 ታትመው ለርክክብ የደረሱ መታወቂያዎች የቀጥታ ሙሉ ማውጫ (Printed IDs Directory) 🌟
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4.5 space-y-3.5 flex flex-col flex-1">
                  {/* Header with status metrics */}
                  <div className="border-b border-slate-100 pb-2.5 shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h3 className="font-extrabold text-[#0a3651] text-xs sm:text-xs flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          የቀጥታ መረጃ ቋት (Live Directory Database)
                        </h3>
                        <p className="text-[9px] text-slate-450 font-bold mt-0.5 leading-relaxed">
                          በወረዳው ተዘጋጅተው ለርክክብ ዝግጁ የሆኑ የነዋሪዎች መታወቂያ ቀጥታ ዝርዝር።
                        </p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-855 rounded-full text-[9px] font-black border border-emerald-100/55 whitespace-nowrap">
                        {countReady} ለመረከብ ዝግጁ
                      </span>
                    </div>
                  </div>

                  {/* Height-flexible scroll area that stretches perfectly with left column */}
                  <div className="overflow-x-auto border border-slate-100 rounded-xl flex-grow overflow-y-auto shadow-inner bg-slate-50/10 min-h-[300px] max-h-[415px]">
                  <table className="w-full text-left border-collapse text-xs min-w-[320px]">
                    <thead className="sticky top-0 bg-white shadow-xs z-10 border-b border-[#0a3651]/5">
                      <tr className="bg-slate-50 text-slate-500 text-[9px] font-extrabold uppercase">
                        <th className="p-2.5 text-left">የተገልጋይ ስም (Full Name)</th>
                        <th className="p-2.5">የመታወቂያ ቁጥር (ID)</th>
                        <th className="p-2.5">ቤት ቁጥር (House)</th>
                        <th className="p-2.5 text-center">ሁኔታ (Status)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold bg-white text-[11px]">
                      {(() => {
                        const sortedPublicList = [...idInventory].sort((a, b) => {
                          const isANew = a.id.startsWith('ID-');
                          const isBNew = b.id.startsWith('ID-');
                          if (isANew && !isBNew) return -1;
                          if (!isANew && isBNew) return 1;
                          return b.id.localeCompare(a.id);
                        });
                        return sortedPublicList.length > 0 ? (
                          sortedPublicList.map((item) => (
                            <tr 
                              key={item.id} 
                              onClick={() => {
                                setSelectedPublicID(item);
                                // Scroll up smoothly to see selected details in the checker
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`hover:bg-slate-50/55 cursor-pointer transition duration-150 ${selectedPublicID?.id === item.id ? 'bg-cyan-50/15' : ''}`}
                            >
                              <td className="p-2.5 text-left text-[#0f384c] font-black">{item.name}</td>
                              <td className="p-2.5 font-mono text-[9px] text-slate-450">{item.idNumber}</td>
                              <td className="p-2.5 text-slate-550 font-extrabold">{item.houseNumber}</td>
                              <td className="p-2.5 text-center">
                                {item.status === 'የወሰደ' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[8.5px] border border-slate-200">
                                      የተረከበ
                                    </span>
                                    <span className="text-[7.5px] text-slate-400 font-semibold mt-0.5">{item.pickupDate}</span>
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[8.5px] border border-emerald-100 font-black">
                                    ለመረከብ ዝግጁ
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-400 text-[9.5px]">
                              በማውጫው ውስጥ ምንም መረጃ የለም።
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
              {/* Exclusive LED Marquee Ticker Header Block */}
              <div className="bg-[#f0f9ff] border border-sky-100 rounded-2xl p-3 shrink-0">
                <div className="w-full bg-[#071e3d] border-2 border-[#0284c7] rounded-xl py-2 px-3.5 overflow-hidden select-none shadow-md flex items-center justify-between gap-3">
                  <div className="shrink-0 p-1 bg-white/15 rounded-lg border border-white/20">
                    <ShieldCheck className="w-4.5 h-4.5 text-white animate-pulse" />
                  </div>
                  <div className="whitespace-nowrap overflow-hidden relative w-full flex-1">
                    <div 
                      className="whitespace-nowrap font-black text-xs sm:text-xs tracking-wider text-white uppercase"
                      style={{
                        textShadow: '1px 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(255, 255, 255, 0.85)',
                        animation: 'led-scroll-left-right 20s ease-in-out infinite'
                      }}
                    >
                      🌟 የወረዳ ባለሙያ አስተዳደር ወለል (Staff Admin Portal) • የቦሌ ወረዳ 05 የሲቪል ምዝገባ፣ መታወቂያ ርክክብ እና ሰነዶች መቆጣጠሪያ 🌟
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 bg-sky-950/40 border border-white/10 px-2 py-0.5 rounded-full text-[8.5px] font-black text-sky-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>ACTIVE STAFF SESSION</span>
                  </div>
                </div>
              </div>

              {/* Advanced Admin Navigation Tabs Menu - Organized in elegant horizontal grid layout with elevated fonts */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 w-full no-print">
                   <button
                     type="button"
                     onClick={() => setAdminTab('handovers')}
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                       adminTab === 'handovers' 
                         ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.03]' 
                         : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <FolderClosed className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'handovers' ? 'text-teal-300 scale-110' : 'text-indigo-600'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                       መታወቂያ ርክክብ
                       <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">Handovers</span>
                     </span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setAdminTab('docs')}
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                       adminTab === 'docs' 
                         ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100 scale-[1.03]' 
                         : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <Layers className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'docs' ? 'text-amber-300 scale-110' : 'text-emerald-600'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                       አጠቃላይ ሰነዶች
                       <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">Docs</span>
                     </span>
                   </button>

                   {/* Elegant Dropdown for Forms 010, 011, 012 */}
                   <div 
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center relative min-h-[92px] ${
                       ['form010', 'form011', 'form012'].includes(adminTab)
                         ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-100 scale-[1.03]' 
                         : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <FileSpreadsheet className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${['form010', 'form011', 'form012'].includes(adminTab) ? 'text-teal-200 scale-110' : 'text-teal-600'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px] mb-1.5">
                       {adminTab === 'form010' ? 'ቅፅ 010' : adminTab === 'form011' ? 'ቅፅ 011' : adminTab === 'form012' ? 'ቅፅ 012' : 'ቅፆች (Forms)'}
                     </span>
                     <select
                       value={['form010', 'form011', 'form012'].includes(adminTab) ? adminTab : ''}
                       onChange={(e) => {
                         if (e.target.value) {
                           setAdminTab(e.target.value as any);
                         }
                       }}
                       className={`text-[11px] font-black rounded-xl py-1 px-2.5 focus:outline-none cursor-pointer w-full text-center max-w-[140px] border appearance-none transition-all ${
                         ['form010', 'form011', 'form012'].includes(adminTab)
                           ? 'bg-teal-800 text-white border-teal-500 hover:bg-teal-900'
                           : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                       }`}
                       style={{ textAlignLast: 'center' }}
                     >
                       <option value="" disabled className="text-slate-800 bg-white">ቅፅ ይምረጡ...</option>
                       <option value="form010" className="text-slate-800 bg-white font-bold">ቅፅ 010 (ስርጭት)</option>
                       <option value="form011" className="text-slate-800 bg-white font-bold">ቅፅ 011 (አገልግሎት)</option>
                       <option value="form012" className="text-slate-800 bg-white font-bold">ቅፅ 012 (ተመላሽ)</option>
                     </select>
                   </div>

                   <button
                     type="button"
                     onClick={() => setAdminTab('security')}
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                       adminTab === 'security' 
                         ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-100 scale-[1.03]' 
                         : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <ShieldCheck className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'security' ? 'text-emerald-400 scale-110' : 'text-slate-600'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                       ደህንነት
                       <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">Security</span>
                     </span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setAdminTab('prerequisites')}
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                       adminTab === 'prerequisites' 
                         ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-100 scale-[1.03]' 
                         : 'bg-white hover:bg-teal-50 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <BookOpen className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'prerequisites' ? 'text-teal-200 scale-110' : 'text-teal-600'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                       ቅድመ ሁኔታዎች
                       <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">Requirements</span>
                     </span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setAdminTab('audit')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                        adminTab === 'audit' 
                          ? 'bg-[#b91c1c] text-white border-[#b91c1c] shadow-lg shadow-rose-100 scale-[1.03]' 
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Layers className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'audit' ? 'text-rose-200 scale-110' : 'text-[#b91c1c]'}`} />
                      <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                        የኦዲት መከታተያ
                        <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">Audit Trail Log</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminTab('smsGateway')}
                     className={`flex flex-col items-center justify-center p-4 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all duration-300 border text-center active:scale-[0.97] cursor-pointer min-h-[92px] ${
                       adminTab === 'smsGateway' 
                         ? 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-100 scale-[1.03]' 
                         : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200 hover:border-slate-300'
                     }`}
                   >
                     <Smartphone className={`w-5.5 h-5.5 mb-1.5 shrink-0 transition-transform duration-300 ${adminTab === 'smsGateway' ? 'text-sky-100 scale-110' : 'text-sky-500'}`} />
                     <span className="leading-tight block font-extrabold text-[12.5px] sm:text-[14px]">
                       ኤስኤምኤስ
                       <span className="text-[9.5px] opacity-85 font-black block font-sans mt-0.5">SMS Gateway</span>
                     </span>
                   </button>
              </div>
            </div>

            {/* active tab panel wrapper */}
            {false && adminTab === 'residentDocs' && (
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

                      {/* Display list of added household members */}
                      <div className="space-y-1.5">
                        {resDocMembers.length > 0 ? (
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto border p-2 rounded-xl bg-slate-50/50">
                            <p className="text-[10px] font-black text-slate-600">አባሎች ({resDocMembers.length})</p>
                            {resDocMembers.map((m, idx) => {
                              let badgeStyle = "bg-slate-50 text-slate-900 border-slate-150";
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
                                    {docItem.files && docItem.files.length > 0 && (
                                      <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150 flex items-center space-x-1.5 w-fit max-w-full text-[9px] text-slate-600">
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                                        <span className="font-sans truncate font-bold max-w-[200px]">{docItem.fileName || (docItem.files && docItem.files[0]?.fileName) || "የተቃኘ ሰነድ.pdf"}</span>
                                        <span className="font-mono text-[8px] px-1 bg-slate-200 text-slate-600 rounded shrink-0">{docItem.fileSize || (docItem.files && docItem.files[0]?.fileSize) || "ወ/0"}</span>
                                      </div>
                                    )}
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

                                  {docItem.files && docItem.files.length > 0 && (
                                    <a
                                      href={docItem.contentUrl}
                                      download={docItem.fileName}
                                      className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 bg-slate-50 rounded-xl flex items-center transition active:scale-95"
                                      title="ሰነዱን ወደ ኮምፒውተር ይጫኑ (Download Scanned File)"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  )}

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
                {/* Left Side Container */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Left Form: Add new ready printed ID */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
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
                         <p className="font-extrabold text-[#78350f]">መታወቂያው እዚህ ሲመዘገብ ለተገልጋዩ "[ስም] ወረዳ 05 መታወቂያዎ ደርሷል መጥተው ይውሰዱ" የሚል አጭር መልዕክት (SMS) ጥሪ በስልካቸው ላይ ይደርሳቸዋል። ይህም በመስሪያ ቤቱ ውስጥ የሚፈጠረውን የመታወቂያ ክምችት ይቀንሳል።</p>
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

                  {/* 📋 የርክክብ የፊርማ ሪፖርት ማዕከል (Signature Report Center) */}
                  <div className="bg-gradient-to-b from-white to-slate-50 rounded-3xl p-6 shadow-md border-2 border-teal-150/80 space-y-5">
                    
                    {/* Header Banner - Highly Professional & Stylish */}
                    <div className="bg-gradient-to-r from-teal-50 to-cyan-50/70 p-4 rounded-2xl border border-teal-100/50 space-y-1">
                      <h3 className="text-[15px] sm:text-[16px] font-black text-teal-950 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-teal-600 animate-pulse" /> የርክክብ ሪፖርት ማዕከል
                      </h3>
                      <p className="text-[11px] text-teal-700 font-extrabold uppercase tracking-wider">የቦሌ ወረዳ 05 መታወቂያ ርክክብ ማረጋገጫ</p>
                    </div>

                    {/* Report Period Selector Cards - Horizontal, compact, distinctive colors */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                      {/* 1. Daily Report Card */}
                      <div
                        onClick={() => setReportPeriod('day')}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-between gap-1.5 text-center relative overflow-hidden group ${
                          reportPeriod === 'day' 
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-sm shadow-emerald-100/50' 
                            : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-700 hover:bg-emerald-50/20 shadow-3xs'
                        }`}
                      >
                        <span className="text-base sm:text-lg">📅</span>
                        <h4 className="text-[11px] sm:text-xs font-black transition-colors leading-tight">የቀን (Daily)</h4>
                        <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 font-black rounded-lg shrink-0 ${
                          reportPeriod === 'day' 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {countDailySig} ርክክብ
                        </span>
                      </div>

                      {/* 2. Weekly Report Card */}
                      <div
                        onClick={() => setReportPeriod('week')}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-between gap-1.5 text-center relative overflow-hidden group ${
                          reportPeriod === 'week' 
                            ? 'bg-sky-50 border-sky-600 text-sky-950 shadow-sm shadow-sky-100/50' 
                            : 'bg-white border-slate-200 hover:border-sky-300 text-slate-700 hover:bg-sky-50/20 shadow-3xs'
                        }`}
                      >
                        <span className="text-base sm:text-lg">🗓️</span>
                        <h4 className="text-[11px] sm:text-xs font-black transition-colors leading-tight">የሳምንት (Weekly)</h4>
                        <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 font-black rounded-lg shrink-0 ${
                          reportPeriod === 'week' 
                            ? 'bg-sky-600 text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {countWeeklySig} ርክክብ
                        </span>
                      </div>

                      {/* 3. Monthly Report Card */}
                      <div
                        onClick={() => setReportPeriod('month')}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-between gap-1.5 text-center relative overflow-hidden group ${
                          reportPeriod === 'month' 
                            ? 'bg-purple-50 border-purple-600 text-purple-950 shadow-sm shadow-purple-100/50' 
                            : 'bg-white border-slate-200 hover:border-purple-300 text-slate-700 hover:bg-purple-50/20 shadow-3xs'
                        }`}
                      >
                        <span className="text-base sm:text-lg">📊</span>
                        <h4 className="text-[11px] sm:text-xs font-black transition-colors leading-tight">የወር (Monthly)</h4>
                        <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 font-black rounded-lg shrink-0 ${
                          reportPeriod === 'month' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {countMonthlySig} ርክክብ
                        </span>
                      </div>
                    </div>

                    {/* Statistics Display Badges */}
                    <div className="bg-white border-2 border-teal-50/80 rounded-2xl p-3.5 flex justify-between items-center shadow-xs">
                      <span className="text-[11.5px] font-black text-slate-750">በአሁኑ ሰነድ ውስጥ የሚገኙ፦</span>
                      <span className="font-mono bg-emerald-50 text-emerald-950 text-xs font-black px-3.5 py-1 border border-emerald-200 rounded-full shadow-2xs">
                        {deliveredInPeriod.length} ተረካቢዎች
                      </span>
                    </div>

                    {deliveredInPeriod.length > 0 ? (
                      <div className="space-y-4">
                        {/* List container with custom slick styling and subtle borders */}
                        <div className="max-h-[200px] overflow-y-auto pr-1 space-y-2 border border-slate-200/60 rounded-xl p-2 bg-white/50 shadow-inner">
                          {deliveredInPeriod.map((item, idx) => (
                            <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-teal-50/20 border border-slate-200/80 text-[11px] transition-colors duration-200 shadow-3xs">
                              <div>
                                <p className="font-black text-slate-800">{idx + 1}. {item.name}</p>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">{item.idNumber} | {item.houseNumber ? `ቤት ቁጥር ${item.houseNumber}` : 'ቤት አልተገለጸም'}</p>
                              </div>
                              {item.pickupSignature ? (
                                <img src={item.pickupSignature} className="h-8 w-16 object-contain bg-white border border-slate-200 rounded-lg shadow-2xs p-0.5 mix-blend-multiply transition-transform hover:scale-110" alt="signature" />
                              ) : (
                                <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">ያልተፈረመ</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Print / Download Button - Prominent & Beautiful with Hover Animations */}
                        <button
                          type="button"
                          onClick={downloadHandoverPDF}
                          className="w-full bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-700 hover:to-teal-800 text-white font-black py-3 px-4 rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer text-[11.5px]"
                        >
                          <Download className="w-4 h-4 animate-bounce" />
                          <span>የሪፖርት ማጠቃለያ በ PDF አውርድ (A4 Print)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
                        <p className="text-xs text-slate-500 font-extrabold leading-relaxed">ለተመረጠው የጊዜ ገደብ የተረከበ ነዋሪ የለም።</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Existing Inventory list & trigger delivery */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-md border-2 border-teal-100/90 space-y-6">
                  {/* Premium Heading Section with Left Accent Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-50 to-cyan-50/50 p-5 rounded-2xl border border-teal-100/50">
                    <div className="flex items-center space-x-3.5">
                      <div className="h-12 w-2 bg-teal-600 rounded-full"></div>
                      <div>
                        <h3 className="text-[17px] md:text-[19px] font-black text-teal-950 tracking-tight leading-snug">
                          የተረከቡና በእጅ የቀሩ መታወቂያዎች መከታተያ
                        </h3>
                        <p className="text-[11.5px] text-teal-700 font-bold mt-0.5">
                          የመታወቂያዎች ርክክብ መቆጣጠሪያ ሰንጠረዥ • ID Handover Management Hub
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={exportCurrentTableToExcel} 
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-[11px] font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer focus:outline-none hover:scale-[1.02] active:scale-[0.98]"
                        title="የሚታዩትን መረጃዎች በ Excel ያውርዱ"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> <span>📥 Excel አውርድ</span>
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters Segment - Highly visible, spacious, with beautiful borders and colors */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-3">
                      
                      {/* Search Input Box - Prominent & Beautiful */}
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-teal-600" />
                        </div>
                        <input 
                          type="text"
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          placeholder="የነዋሪ ስም ወይም መለያ ቁጥር እዚህ ይፈልጉ..."
                          className="pl-10.5 pr-4 py-3.5 border-2 border-slate-200 focus:border-teal-600 rounded-xl text-[13.5px] w-full focus:outline-none focus:ring-4 focus:ring-teal-100 bg-white font-extrabold text-slate-800 placeholder-slate-400 shadow-xs transition-all"
                        />
                      </div>

                      {/* Date Filter Input Box */}
                      <div className="relative w-full lg:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Calendar className="h-5 w-5 text-cyan-600" />
                        </div>
                        <input 
                          type="text"
                          value={adminDateSearch}
                          onChange={(e) => setAdminDateSearch(e.target.value)}
                          placeholder="በምዝገባ ቀን (ቀን ወር ዓ.ም)..."
                          className="pl-10.5 pr-4 py-3.5 border-2 border-slate-200 focus:border-cyan-600 rounded-xl text-[12.5px] w-full focus:outline-none focus:ring-4 focus:ring-cyan-100 bg-white font-bold text-slate-800 placeholder-slate-400 shadow-xs transition-all"
                          title="ለምሳሌ፡ 26 ሰኔ 2018"
                        />
                      </div>

                    </div>

                    {/* Filter Status Pills - Vibrant, rounded, and attractive */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-black text-slate-500 uppercase mr-1">ፈጣን ማጣሪያዎች:</span>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          setSmsPendingFilter(!smsPendingFilter);
                          setDeliveredFilter(false);
                        }}
                        className={`px-3.5 py-2 text-[11px] font-black rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer focus:outline-none border ${smsPendingFilter ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100 scale-[1.02]' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200 hover:border-amber-300'}`}
                        title="መልዕክት ያልተላከላቸውን ብቻ ለማሳየት ይጫኑ"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>{smsPendingFilter ? 'ያልተላከላቸው ብቻ (የበራ)' : 'ያልተላከላቸው ብቻ'}</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          setDeliveredFilter(!deliveredFilter);
                          setSmsPendingFilter(false);
                        }}
                        className={`px-3.5 py-2 text-[11px] font-black rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer focus:outline-none border ${deliveredFilter ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 scale-[1.02]' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200 hover:border-emerald-300'}`}
                        title="የወሰዱ መታወቂያዎችን ብቻ ለማሳየት ይጫኑ"
                      >
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{deliveredFilter ? 'የወሰዱ ብቻ (የበራ)' : 'የወሰዱ ብቻ'}</span>
                      </button>

                      {/* Reset filter button shown if any filter is active */}
                      {(smsPendingFilter || deliveredFilter || adminSearch || adminDateSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSmsPendingFilter(false);
                            setDeliveredFilter(false);
                            setAdminSearch('');
                            setAdminDateSearch('');
                          }}
                          className="px-3 py-1.5 text-[10.5px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-all hover:scale-[1.02]"
                        >
                          ሁሉንም አፅዳ (Reset Filters)
                        </button>
                      )}
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
                          <th className="p-2.5">የምዝገባ ቀን</th>
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
                            <td className="p-2.5 text-slate-500 font-semibold">{item.registrationDate || 'ያልተገለጸ'}</td>
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
                      <option value={DocumentType.RECOMMENDATION}>1. የመሸኛ አገልግሎት መጠየቂያ ቅፅ (Recommendation)</option>
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
                    <span>በመረካከቢያ ዓይነት እይ:</span>
                    <select 
                      value={f10FilterHandoverType} 
                      onChange={(e) => setF10FilterHandoverType(e.target.value as any)} 
                      className="p-1 border rounded bg-white text-[10px]"
                    >
                      <option value="all">ሁሉንም አሳይ</option>
                      <option value="የክፍለከተማ መረካከቢያ">የክፍለከተማ መረካከቢያ</option>
                      <option value="የወረዳ መረካከቢያ">የወረዳ መረካከቢያ</option>
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
                    <Download className="w-3.5 h-3.5" /> <span>Excel (ቅፅ 010) አውርድ</span>
                  </button>
                </div>

                {/* Form Inputs (010) - no print */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                  <h3 className="font-extrabold text-teal-950 border-b pb-2">ቅፅ 010 - የዕለት ህትመት ስርጭት መረጃ ማስገቢያ</h3>
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
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">የመረካከቢያ ዓይነት (Handover Type)</label>
                      <select 
                        value={f10HandoverType} 
                        onChange={(e) => setF10HandoverType(e.target.value as any)} 
                        className="w-full p-2 border rounded-md font-bold text-teal-900"
                      >
                        <option value="የክፍለከተማ መረካከቢያ">የክፍለከተማ መረካከቢያ (ከክፍለ ከተማ)</option>
                        <option value="የወረዳ መረካከቢያ">የወረዳ መረካከቢያ (ከወረዳ)</option>
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
                    <h2 className="text-base font-extrabold mt-1 text-slate-900">ቅፅ ቁጥር 010</h2>
                    <h3 className="text-xs font-bold text-slate-700">በወረዳ እና ክ/ከተማ የዕለት ህትመት ስርጭት ቅፅ</h3>
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
                          <th className="border border-black p-1.5" rowSpan={2}>የመረካከቢያ ዓይነት</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ብዛት в ቁጥር</th>
                          <th className="border border-black p-1.5" colSpan={2}>የህትመት ዘዴ</th>
                          <th className="border border-black p-1.5" colSpan={2}>ሴሪያል ቁጥር</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ርክክብ የተደረገበት ዕለት</th>
                          <th className="border border-black p-1.5" rowSpan={2}>ተረካቢ ፊርማ</th>
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
                            <td className="border border-black p-1.5 font-bold text-teal-800">{row.handoverType || 'የክፍለከተማ መረካከቢያ'}</td>
                            <td className="border border-black p-1.5 font-bold">{row.qty}</td>
                            <td className="border border-black p-1.5">{row.method === 'ማኑዋል' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5">{row.method === 'ሲስተም' ? '✓' : ''}</td>
                            <td className="border border-black p-1.5 font-mono">{row.from}</td>
                            <td className="border border-black p-1.5 font-mono">{row.to}</td>
                            <td className="border border-black p-1.5 font-bold">{row.date}</td>
                            <td className="border border-black p-1.5 text-center">
                              {row.signature ? (
                                <img src={row.signature} className="h-6 mx-auto bg-white border" alt="Sig" />
                              ) : (
                                <span className="text-slate-400 italic text-[8px]">ፊርማ የለም</span>
                              )}
                            </td>
                            <td className="border border-black p-1.5 text-left text-[9px]">{row.remark}</td>
                            <td className="border border-black p-1.5 no-print">
                              <div className="flex flex-col gap-1 items-center">
                                <button onClick={() => deleteF10Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                                <button 
                                  type="button" 
                                  onClick={() => setActiveSignatureRecord({ type: 'f10', id: row.id, name: row.type })} 
                                  className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                                >
                                  ፊርማ አስቀምጥ
                                </button>
                              </div>
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
                      <Printer className="w-3.5 h-3.5" /> <span>ቅፅ 010 አትም</span>
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
                    <Download className="w-3.5 h-3.5" /> <span>Excel (ቅፅ 011) አውርድ</span>
                  </button>
                </div>

                {/* Form Inputs (011) with Built-in Signature Pad */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 no-print text-xs">
                  <h3 className="font-extrabold text-teal-950 border-b pb-2">ቅፅ 011 - በየዕለቱ አገልግሎት የተሰጣቸው ህትመቶች መመዝገቢያ</h3>
                  
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
                        ወደ ቅፅ 011 ሰንጠረዥ ጨምር
                      </button>
                    </div>
                  </form>
                </div>

                {/* Printable 011 Layout sheet */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-neutral-300 shadow-lg text-xs text-black space-y-4 print-area max-w-5xl mx-auto">
                  
                  <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-base font-extrabold mt-1 text-slate-900">ቅፅ ቁጥር 011</h2>
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
                              <div className="flex flex-col gap-1 items-center">
                                <button type="button" onClick={() => deleteF11Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                                <button 
                                  type="button" 
                                  onClick={() => setActiveSignatureRecord({ type: 'f11', id: row.id, name: row.customer })} 
                                  className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                                >
                                  ፊርማ አስቀምጥ
                                </button>
                              </div>
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
                    <button type="button" onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold flex items-center space-x-1">
                      <Printer className="w-3.5 h-3.5" /> <span>ቅፅ 011 አትም</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

            {adminTab === 'form012' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 no-print">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-red-50 rounded-2xl text-red-800">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">ቅፅ 012 - ተመላሽና የተበላሹ ህትመቶች መዝገብ (Form 012 Ledger)</h3>
                      <p className="text-xs text-slate-500 mt-1">በወረዳ 05 የተበላሹ፣ ተመላሽ የተደረጉ ወይም ያልተሰጡ ምስክር ወረቀቶችና የህትመት ሰነዶች ዝርዝር መዝገብ መከታተያ</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-xl">
                    የምዝገባ ቀን: <span className="font-sans font-bold text-slate-800">{ethDateNow}</span>
                  </div>
                </div>

                {/* Search / Filter Section */}
                <div className="bg-stone-50/50 border border-slate-100 p-4 rounded-2xl text-xs font-bold text-slate-700 flex flex-wrap items-center gap-4 no-print shadow-sm">
                  <div className="flex items-center space-x-1">
                    <span>በኩነት እይ:</span>
                    <select value={f12FilterServiceType} onChange={(e) => setF12FilterServiceType(e.target.value)} className="p-1 border rounded bg-white text-[10px]">
                      <option value="all">ሁሉንም አሳይ</option>
                      <option value="ልደት">ልደት</option>
                      <option value="ጋብቻ">ጋብቻ</option>
                      <option value="ፍቺ">ፍቺ</option>
                      <option value="ሞት">ሞት</option>
                      <option value="ጉዲ">ጉዲፈቻ</option>
                      <option value="ያላገባ">ያላገባ</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>በሴሪያል ፈልግ:</span>
                    <input type="text" value={f12FilterSerial} onChange={(e) => setF12FilterSerial(e.target.value)} placeholder="ሴሪያል..." className="p-1 border rounded bg-white w-24 text-[10px] uppercase" />
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
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-black px-2 py-1 rounded text-[9px] transition"
                    >
                      የዛሬ ብቻ አሳይ
                    </button>
                    {(f12FilterServiceType !== 'all' || f12FilterSerial || f12FilterDate) && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setF12FilterServiceType('all');
                          setF12FilterSerial('');
                          setF12FilterDate('');
                        }} 
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-2 py-1 rounded text-[9px] transition"
                      >
                        ማጣሪያ አጽዳ ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Add Entry Form */}
                <div className="bg-[#fefcfb] border border-[#fbf3ec] p-5 rounded-2xl no-print shadow-sm">
                  <h4 className="text-xs font-black text-[#5c3e0f] mb-3 flex items-center space-x-1.5 uppercase">
                    <span>✦ አዲስ የቅፅ 012 ተመላሽ/የተበላሸ ህትመት መዝገብ ማስገቢያ</span>
                  </h4>
                  <form onSubmit={handleAddForm012} className="space-y-4 text-xs font-semibold">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">ምስክር ወረቀት አይነት (Print Type)</label>
                        <select
                          value={f12PrintType}
                          onChange={(e) => setF12PrintType(e.target.value)}
                          className="w-full p-2 border rounded-md bg-white font-bold"
                        >
                          <option value="ልደት ምስክር ወረቀት">ልደት ምስክር ወረቀት</option>
                          <option value="ጋብቻ ምስክር ወረቀት">ጋብቻ ምስክር ወረቀት</option>
                          <option value="ፍቺ ምስክር ወረቀት">ፍቺ ምስክር ወረቀት</option>
                          <option value="ሞት ምስክር ወረቀት">ሞት ምስክር ወረቀት</option>
                          <option value="ጉዲፈቻ ምስክር ወረቀት">ጉዲፈቻ ምስክር ወረቀት</option>
                          <option value="ያላገባ ምስክር ወረቀት">ያላገባ ምስክር ወረቀት</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">ሁኔታ (Status)</label>
                        <select
                          value={f12ReturnStatus}
                          onChange={(e) => setF12ReturnStatus(e.target.value as any)}
                          className="w-full p-2 border rounded-md bg-white font-bold"
                        >
                          <option value="ያልተሰጠ">ያልተሰጠ (Returned)</option>
                          <option value="የተበላሸ">የተበላሸ (Spoiled)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የህትመት ዘዴ (Print Method)</label>
                        <div className="flex space-x-2 mt-1">
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" name="f12_method" checked={f12Method === 'ሲስተም'} onChange={() => setF12Method('ሲስተም')} className="text-teal-800" />
                            <span>ሲስተም</span>
                          </label>
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" name="f12_method" checked={f12Method === 'ማኑዋል'} onChange={() => setF12Method('ማኑዋል')} className="text-teal-800" />
                            <span>ማኑዋል</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የምስክር ወረቀቱ ሴሪያል ቁጥር (Serial No)</label>
                        <input
                          type="text"
                          value={f12Serial}
                          onChange={(e) => setF12Serial(e.target.value)}
                          className="w-full p-2 border rounded-md uppercase font-mono font-bold"
                          placeholder="A-12345"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የዕለቱ ቀን (Ethiopian Date)</label>
                        <div className="flex space-x-2">
                          <input type="text" placeholder="ቀን" value={f12Day} onChange={(e) => setF12Day(e.target.value)} className="w-1/4 p-2 border rounded-md text-center text-[11px] font-bold" />
                          <select value={f12Month} onChange={(e) => setF12Month(e.target.value)} className="w-2/4 p-2 border rounded-md text-center text-[11px] font-bold bg-white">
                            <option value="">ወር ይምረጡ</option>
                            {['መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዚያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <input type="text" placeholder="ዓመት" value={f12Year} onChange={(e) => setF12Year(e.target.value)} className="w-1/4 p-2 border rounded-md text-center text-[11px] font-bold" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">የተበላሸበት / የተመለሰበት ምክንያት (Reason / Remark)</label>
                        <input
                          type="text"
                          value={f12Reason}
                          onChange={(e) => setF12Reason(e.target.value)}
                          className="w-full p-2 border rounded-md"
                          placeholder="ምክንያቱን እዚህ ይግለጹ..."
                        />
                      </div>
                    </div>

                    {/* Integrated Signature Drawing Pad */}
                    <div className="max-w-md pt-2">
                      <label className="block text-[10px] font-bold text-teal-800 mb-1">የባለሙያ/የሱፐርቫይዘር ፊርማ (የማስፈረሚያ ሰሌዳ) - Mobile Touch Supported</label>
                      <SignaturePad 
                        onSave={(dataUrl) => setF12Signature(dataUrl)}
                        placeholderText="ያረጋገጠው ባለሙያ እንዲፈርም እዚህ ሰሌዳ ላይ ይሳቡ (Draw signature inside this cell)"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button type="submit" className="bg-[#8c2d19] hover:bg-[#6e2211] text-white font-extrabold py-2 px-6 rounded-lg text-xs shadow-md transition">
                        ወደ ቅፅ 012 ሰንጠረዥ ጨምር
                      </button>
                    </div>
                  </form>
                </div>

                {/* Printable Form Container */}
                <div className="border-4 border-double border-black p-4 bg-white shadow-lg relative print-section font-serif rounded-xl">
                  {/* Decorative Ethiopian Corner Borders for Printable layout */}
                  <div className="absolute top-1 left-1 border-t-2 border-l-2 border-stone-800 w-4 h-4 no-print"></div>
                  <div className="absolute top-1 right-1 border-t-2 border-r-2 border-stone-800 w-4 h-4 no-print"></div>
                  <div className="absolute bottom-1 left-1 border-b-2 border-l-2 border-stone-800 w-4 h-4 no-print"></div>
                  <div className="absolute bottom-1 right-1 border-b-2 border-r-2 border-stone-800 w-4 h-4 no-print"></div>

                  <div className="text-center space-y-2 pb-3 border-b-2 border-black/80">
                    <h1 className="text-sm font-black text-slate-900 tracking-wide">በአዲስ አበባ ከተማ አስተዳደር የአስገዳጅ ምዝገባና የነዋሪነት አገልግሎት ኤጀንሲ</h1>
                    <h2 className="text-xs font-black text-slate-800">የቦሌ ክፍለ ከተማ ወረዳ 05 አስተዳደር ጽሕፈት ቤት</h2>
                    <div className="bg-stone-900 text-white font-sans text-[10px] font-extrabold tracking-widest uppercase inline-block px-4 py-1.5 rounded-full mt-1.5 print:bg-black print:text-white print:px-6">
                      ቅፅ ቁጥር 012 - ተመላሽና የተበላሹ ህትመቶች መዝገብ
                    </div>
                    <p className="text-[10px] text-gray-600 font-sans font-bold no-print">ይህ መዝገብ በየዕለቱ የሚበላሹ ወይም ጥቅም ላይ ሳይውሉ የሚቀሩ ምስክር ወረቀቶችን ለመቆጣጠር ያገለግላል።</p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold py-2 font-sans text-slate-800 border-b border-stone-200">
                    <div>ወረዳ: <span className="underline decoration-indigo-800 font-bold">ወረዳ 05</span></div>
                    <div>መረካከቢያ ቀን/ዕለት: <span className="underline decoration-indigo-800 font-bold">{ethDateNow}</span></div>
                    <div>ጠቅላላ የተበላሹ/ተመላሾች: <span className="underline font-bold text-red-700">{filteredForm012.length} ህትመቶች</span></div>
                  </div>

                  <div className="overflow-x-auto pt-3">
                    <table className="w-full text-center border-collapse border-2 border-black text-[9px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-900">
                          <th className="border border-black p-1" rowSpan={2}>ተ.ቁ</th>
                          <th className="border border-black p-1" rowSpan={2}>የምዝገባ ቀን</th>
                          <th className="border border-black p-1" rowSpan={2}>የምስክር ወረቀቱ ዓይነት</th>
                          <th className="border border-black p-1" colSpan={2}>የመመለስ ሁኔታ</th>
                          <th className="border border-black p-1" colSpan={2}>የህትመት ዘዴ</th>
                          <th className="border border-black p-1" rowSpan={2}>የምስክር ወረቀቱ ሴሪያል</th>
                          <th className="border border-black p-1" rowSpan={2}>የተበላሸበት/የተመለሰበት ምክንያት</th>
                          <th className="border border-black p-1" rowSpan={2}>አረጋጋጭ ፊርማ</th>
                          <th className="border border-black p-1 no-print" rowSpan={2}>ድርጊት</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <th className="border border-black p-1">ያልተሰጠ (✓)</th>
                          <th className="border border-black p-1">የተበላሸ (✓)</th>
                          <th className="border border-black p-1">ማኑዋል (✓)</th>
                          <th className="border border-black p-1">ሲስተም (✓)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/40 font-medium">
                        {filteredForm012.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-4 text-center text-slate-400 italic font-sans text-[10px]">በዚህ ሪፖርት ውስጥ የተመዘገበ መረጃ የለም።</td>
                          </tr>
                        ) : (
                          filteredForm012.map((row, idx) => (
                            <tr key={row.id}>
                              <td className="border border-black p-1 font-mono">{idx + 1}</td>
                              <td className="border border-black p-1 font-bold">{row.date}</td>
                              <td className="border border-black p-1 text-left font-bold text-slate-800">{row.printType}</td>
                              <td className="border border-black p-1 font-bold">{row.returnStatus === 'ያልተሰጠ' ? '✓' : ''}</td>
                              <td className="border border-black p-1 font-bold">{row.returnStatus === 'የተበላሸ' ? '✓' : ''}</td>
                              <td className="border border-black p-1">{row.method === 'ማኑዋል' ? '✓' : ''}</td>
                              <td className="border border-black p-1">{row.method === 'ሲስተም' ? '✓' : ''}</td>
                              <td className="border border-black p-1 font-mono font-bold text-slate-900">{row.serial}</td>
                              <td className="border border-black p-1 text-left font-sans text-[10px] max-w-[150px] truncate" title={row.reason}>{row.reason || '-'}</td>
                              <td className="border border-black p-1 text-center font-sans">
                                {row.signature ? (
                                  <img src={row.signature} className="h-6 mx-auto bg-white border" alt="Sig" />
                                ) : (
                                  <span className="text-slate-400 italic text-[8px]">ፊርማ የለም</span>
                                )}
                              </td>
                              <td className="border border-black p-1 no-print">
                                <div className="flex flex-col gap-1 items-center">
                                  <button type="button" onClick={() => deleteF12Row(row.id)} className="text-red-600 hover:text-red-800 font-bold">ሰርዝ</button>
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveSignatureRecord({ type: 'f12', id: row.id, name: row.serial })} 
                                    className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                                  >
                                    ፊርማ አስቀምጥ
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-300 text-[9px] text-gray-700">
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ያረጋገጠው ባለሙያ</p>
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
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ያረጋገጠው የቡድን መሪ</p>
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
                    <div className="border p-2 rounded bg-stone-50">
                      <p className="font-bold border-b pb-1 mb-1 text-slate-900">ያጸደቀው የጽ/ቤት ኃላፊ</p>
                      <div className="space-y-1 mt-1">
                        <span className="no-print text-[8px] text-gray-400 block">የኃላፊው ስም:</span>
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
                    <button type="button" onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold flex items-center space-x-1">
                      <Printer className="w-3.5 h-3.5" /> <span>ቅፅ 012 አትም</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* G2. SERVICE PREREQUISITES TAB */}
            {adminTab === 'prerequisites' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6 font-sans">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-teal-50 rounded-xl text-teal-800">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">የአገልግሎት ማስፈጸሚያ ቅድመ ሁኔታዎች ማስተካከያ</h3>
                      <p className="text-xs text-slate-500 mt-1">በወረዳ 05 ለሚሰጡ የሲቪል፣ የነዋሪነት እና የሰነድ አገልግሎቶች አስፈላጊ መስፈርቶችን ያስተካክሉ</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddNewPrerequisiteCat('civil')}
                      className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>+ አዲስ ሲቪል ምዝገባ አክል</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNewPrerequisiteCat('residency')}
                      className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>+ አዲስ የነዋሪነት አክል</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNewPrerequisiteCat('documents')}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>+ አዲስ የሰነድ አክል</span>
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4 text-xs font-semibold">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase text-slate-400 font-bold">ለማስተካከል የሚፈልጉትን አገልግሎት ይምረጡ (Select Service to Customize)</label>
                      <select
                        value={editingReqId}
                        onChange={(e) => setEditingReqId(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- አገልግሎት ይምረጡ --</option>
                        {requirements.map((r) => (
                          <option key={r.id} value={r.id}>
                            [{r.category === 'civil' ? 'ሲቪል' : r.category === 'residency' ? 'ነዋሪነት' : 'ሰነድ'}] {r.subCategory || r.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase text-slate-400 font-bold">የአገልግሎቱ ርዕስ (Service Display Title)</label>
                      <input
                        type="text"
                        value={editingReqTitle}
                        onChange={(e) => setEditingReqTitle(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none text-xs"
                        placeholder="የአገልግሎት ማስፈጸሚያ ርዕስ እዚህ ይጻፉ..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase text-slate-400 font-bold">የአገልግሎቱ አጭር መግለጫ (Service Description)</label>
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
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2 px-4 rounded-xl transition text-xs flex items-center space-x-1.5 border border-rose-200 cursor-pointer"
                      title="ይህንን የአገልግሎት መስፈርት ይቀንሱ / ይሰርዙ"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 
                      <span>ይህንን አገልግሎት ይቀንሱ (Delete)</span>
                    </button>
                  ) : <div></div>}
                  <button 
                    type="button"
                    onClick={handleSavePrerequisite}
                    className="bg-[#0f405c] hover:bg-[#072436] text-white font-extrabold py-2.5 px-6 rounded-xl shadow-md transition text-xs flex items-center space-x-2 cursor-pointer"
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
                        ይህንን ቁልፍ በመጫን በሲስተሙ ውስጥ ከዚህ በፊት የገቡትን ሁሉንም የመታወቂያ በርክክብ፣ የሰነዶች፣ የቅፅ 010፣ የቅፅ 011 እና 012 የድሮ መረጃዎችን በሙሉ መደምሰስ ይችላሉ። ይህ በኮምፒውተርዎ ላይ ያለውንም ሆነ በደመና (Cloud Database) ያሉትን መረጃዎች ጠርጎ በማጥፋት እስከዛሬ የገቡ ዳታዎች ጠፍተው ስራውን በአዲስ መልክ ከዛሬ ጀምሮ ለማካሄድ ዝግጁ ያደርገዋል።
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetAllData}
                      className="bg-rose-700 hover:bg-rose-800 text-white border border-rose-640 font-extrabold py-2 px-4 rounded-xl shadow-sm transition text-[10px] uppercase tracking-wider block cursor-pointer"
                    >
                      ሁሉንም የቀድሞ መረጃዎች አጥፋ (Wipe All Records)
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* G. SECURITY AND DATA MANAGEMENT */}
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
                        ሁሉንም የወረዳ 05 መረጃዎችን (የመታወቂያ ክምችት፣ የሰነዶች መዝገብ፣ እና የቅፅ 010, 011 እና 012 ሪከርዶችን) በአንድ ላይ በማጣመር በጠንካራ የሚስጥር ቁልፍ (Passphrase) የይለፍ ቃል የተመሰጠረ የJSON ፋይል ለመፍጠር ይህንን ቁልፍ ይጫኑ። ይህ ፋይል አሁን ካለው የደመና ወይም የአካባቢ ሰሌዳ ውጭ በደህንነት ለማስቀመጥ ያገለግላል።
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
                          <span>ቅፅ 010 የዕለት ህትመት ስርጭት መረጃ ({form010.length} ሪኮርድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>ቅፅ 011 የዕለት አገልግሎት ያገኙ ተጠቃሚዎች ({form011.length} ሪኮርድ)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>ቅፅ 012 ተመላሽና የተበላሹ ህትመቶች ({form012.length} ሪኮርድ)</span>
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
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs cursor-pointer text-center">
                      <RefreshCw className="w-4 h-4" />
                      <span>የደህንነት ቅጂ ፋይል ምረጥ (Upload Backup File)</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleRestoreData} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

              </div>
            )}

            {/* AUDIT TRAIL LOG PANEL */}
            {adminTab === 'audit' && (() => {
              const fromStr = (auditFilterFromDay && auditFilterFromMonth && auditFilterFromYear) ? `${auditFilterFromDay}/${auditFilterFromMonth}/${auditFilterFromYear}` : '';
              const toStr = (auditFilterToDay && auditFilterToMonth && auditFilterToYear) ? `${auditFilterToDay}/${auditFilterToMonth}/${auditFilterToYear}` : '';

              const hasDateFilter = !!fromStr || !!toStr;

              // Filter by date range if specified
              const activeIdInventory = hasDateFilter
                ? idInventory.filter(x => {
                    const d = x.pickupDate || x.registrationDate || '';
                    return d ? isDateWithinRange(d, fromStr, toStr) : true;
                  })
                : idInventory;

              const activeForm010 = hasDateFilter
                ? form010.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
                : form010;

              const activeForm011 = hasDateFilter
                ? form011.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
                : form011;

              const activeForm012 = hasDateFilter
                ? form012.filter(x => x.date && isDateWithinRange(x.date, fromStr, toStr))
                : form012;

              // Precompute the values
              const totalFromSubCity = activeIdInventory.length;
              const readyNotPicked = activeIdInventory.filter(x => x.status === 'ለመረከብ ዝግጁ').length;
              const pickedUp = activeIdInventory.filter(x => x.status === 'የወሰደ').length;
              const auditMatch = totalFromSubCity === (readyNotPicked + pickedUp);

              // Form 010 Subcity Grouped (from Sub-city)
              const form010SubCityGrouped = activeForm010
                .filter(record => !record.handoverType || record.handoverType === 'የክፍለከተማ መረካከቢያ')
                .reduce((acc, record) => {
                  const type = record.type || 'ያልታወቀ';
                  if (!acc[type]) {
                    acc[type] = { type, ranges: [] as { from: string; to: string }[], totalQty: 0 };
                  }
                  acc[type].ranges.push({ from: record.from, to: record.to });
                  acc[type].totalQty += Number(record.qty || 0);
                  return acc;
                }, {} as Record<string, { type: string; ranges: { from: string; to: string }[]; totalQty: number }>);

              // Form 010 Woreda Grouped (from Woreda)
              const form010WoredaGrouped = activeForm010
                .filter(record => record.handoverType === 'የወረዳ መረካከቢያ')
                .reduce((acc, record) => {
                  const type = record.type || 'ያልታወቀ';
                  if (!acc[type]) {
                    acc[type] = { type, ranges: [] as { from: string; to: string }[], totalQty: 0 };
                  }
                  acc[type].ranges.push({ from: record.from, to: record.to });
                  acc[type].totalQty += Number(record.qty || 0);
                  return acc;
                }, {} as Record<string, { type: string; ranges: { from: string; to: string }[]; totalQty: number }>);

              // Form 011 Grouped
              const form011Grouped = activeForm011.reduce((acc, record) => {
                const type = record.serviceType || 'ያልታወቀ';
                if (!acc[type]) {
                  acc[type] = { type, records: [] as typeof record[] };
                }
                acc[type].records.push(record);
                return acc;
              }, {} as Record<string, { type: string; records: typeof form011 }>);

              // Form 012 Grouped
              const form012Grouped = activeForm012.reduce((acc, record) => {
                const type = record.printType || 'ያልታወቀ';
                if (!acc[type]) {
                  acc[type] = { type, records: [] as typeof record[] };
                }
                acc[type].records.push(record);
                return acc;
              }, {} as Record<string, { type: string; records: typeof form012 }>);

              return (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6 no-print font-sans animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-rose-50 rounded-xl text-rose-800">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">የሰነድ ቁጥጥር እና የኦዲት መከታተያ ማዕከል</h3>
                        <p className="text-xs text-slate-500 mt-1">በቦሌ ክፍለ ከተማ ወረዳ 05 አስተዳደር የኦዲት መረጃዎች ማጠቃለያ</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handlePrintAuditReport}
                      className="bg-slate-950 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center space-x-2 transition cursor-pointer shadow-sm shadow-slate-200"
                    >
                      <Printer className="w-4 h-4" />
                      <span>የኦዲት ሪፖርት አትም / በPDF አውርድ</span>
                    </button>
                  </div>

                  {/* DATE RANGE FILTER PANEL */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-xs font-semibold">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-slate-200">
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5 uppercase tracking-wider">
                          📅 የኦዲት መረጃዎች መፈለጊያ (የቀን ክልል ማጣሪያ)
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">የመታወቂያ ርክክብ እና የቅጾች መረጃን ከተወሰነ ቀን እስከ የተወሰነ ቀን ድረስ መርጠው ይፈልጉ</p>
                      </div>
                      {hasDateFilter && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                          ✓ የቀን ማጣሪያ ነቅቷል
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* From Date */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">ከቀን (Start Date - Ethiopian):</label>
                        <div className="flex space-x-1.5">
                          <input 
                            type="text" 
                            placeholder="ቀን" 
                            value={auditFilterFromDay} 
                            onChange={(e) => setAuditFilterFromDay(e.target.value)} 
                            className="w-1/4 p-2 bg-white border border-slate-300 rounded-xl text-center text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          />
                          <select 
                            value={auditFilterFromMonth} 
                            onChange={(e) => setAuditFilterFromMonth(e.target.value)} 
                            className="w-1/2 p-2 bg-white border border-slate-300 rounded-xl text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          >
                            <option value="">-- ወር ይምረጡ --</option>
                            {ethMonths.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input 
                            type="text" 
                            placeholder="ዓ.ም" 
                            value={auditFilterFromYear} 
                            onChange={(e) => setAuditFilterFromYear(e.target.value)} 
                            className="w-1/4 p-2 bg-white border border-slate-300 rounded-xl text-center text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          />
                        </div>
                      </div>

                      {/* To Date */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">እስከ ቀን (End Date - Ethiopian):</label>
                        <div className="flex space-x-1.5">
                          <input 
                            type="text" 
                            placeholder="ቀን" 
                            value={auditFilterToDay} 
                            onChange={(e) => setAuditFilterToDay(e.target.value)} 
                            className="w-1/4 p-2 bg-white border border-slate-300 rounded-xl text-center text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          />
                          <select 
                            value={auditFilterToMonth} 
                            onChange={(e) => setAuditFilterToMonth(e.target.value)} 
                            className="w-1/2 p-2 bg-white border border-slate-300 rounded-xl text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          >
                            <option value="">-- ወር ይምረጡ --</option>
                            {ethMonths.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input 
                            type="text" 
                            placeholder="ዓ.ም" 
                            value={auditFilterToYear} 
                            onChange={(e) => setAuditFilterToYear(e.target.value)} 
                            className="w-1/4 p-2 bg-white border border-slate-300 rounded-xl text-center text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
                      <button 
                        type="button"
                        onClick={() => {
                          const todayComps = ethDateNow.split('/');
                          if (todayComps.length === 3) {
                            setAuditFilterFromDay(todayComps[0]);
                            setAuditFilterFromMonth(todayComps[1]);
                            setAuditFilterFromYear(todayComps[2]);
                            setAuditFilterToDay(todayComps[0]);
                            setAuditFilterToMonth(todayComps[1]);
                            setAuditFilterToYear(todayComps[2]);
                          } else {
                            alert("የዛሬውን ቀን ማግኘት አልተቻለም።");
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black shadow-sm cursor-pointer transition"
                      >
                        የዛሬ ብቻ (Today Only)
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setAuditFilterFromDay('');
                          setAuditFilterFromMonth('መስከረም');
                          setAuditFilterFromYear('');
                          setAuditFilterToDay('');
                          setAuditFilterToMonth('መስከረም');
                          setAuditFilterToYear('');
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl text-[10px] font-black shadow-sm cursor-pointer transition"
                      >
                        ✕ ማጣሪያውን አጽዳ (Clear Filter)
                      </button>
                    </div>
                  </div>

                  {/* 1. ID HANDOVER AUDIT */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span className="text-lg">🪪</span> ክፍል 1፡ የመታወቂያ ርክክብ ኦዲት
                      </h4>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                        auditMatch 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {auditMatch ? '✓ የቁጥር ኦዲት ይስማማል' : '⚠ የኦዲት ልዩነት ተገኝቷል'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Total ID backlogs */}
                      <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-100">
                        <span className="text-[10px] text-sky-800 font-extrabold block uppercase tracking-wider">አጠቃላይ ከክፍለ ከተማ የመጡ</span>
                        <span className="text-2xl font-black text-sky-950 mt-1 block">{totalFromSubCity}</span>
                      </div>
                      {/* Ready for pickup */}
                      <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-100">
                        <span className="text-[10px] text-amber-800 font-extrabold block uppercase tracking-wider">ምዝገባ እንዳለቀ ያልወሰዱ</span>
                        <span className="text-2xl font-black text-amber-950 mt-1 block">{readyNotPicked}</span>
                      </div>
                      {/* Picked up */}
                      <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 font-extrabold block uppercase tracking-wider">የወሰዱ</span>
                        <span className="text-2xl font-black text-emerald-950 mt-1 block">{pickedUp}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-between">
                      <span>ቀመር ማረጋገጫ፡ አጠቃላይ የመጡ ({totalFromSubCity}) = ያልወሰዱ ({readyNotPicked}) + የወሰዱ ({pickedUp})</span>
                      <span className={auditMatch ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>
                        {auditMatch ? "✓ እኩልነት ይገጥማል" : "⚠ እኩልነት አይገጥምም (እባክዎ መረጃዎችን ያጣሩ)"}
                      </span>
                    </div>
                  </div>

                  {/* 2. FORM 010 AUDIT */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-6">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 border-b pb-2 flex items-center gap-1.5">
                        <span className="text-lg">📦</span> ክፍል 2ሀ፡ ከክፍለ ከተማ የተረከብናቸው ቅፆች ኦዲት (ቅፅ 010 - የክፍለከተማ መረካከቢያ)
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 font-bold">ይህ ክፍል በቀጥታ ከክፍለ ከተማ የተረከብናቸውን የህትመት ቅፆች አጠቃላይ መረጃ ያሳያል።</p>
                      
                      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white mt-2">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                              <th className="p-3 text-[11px] font-black uppercase text-center w-12">ተ.ቁ</th>
                              <th className="p-3 text-[11px] font-black uppercase">የኩነት አይነት (Event Type)</th>
                              <th className="p-3 text-[11px] font-black uppercase text-center">የሰሪያል ቁጥር ክልል (Serial Range From-To)</th>
                              <th className="p-3 text-[11px] font-black uppercase text-center w-40">ድምር በቁጥር (Sum Qty)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-xs">
                            {Object.values(form010SubCityGrouped).length > 0 ? (
                              (Object.values(form010SubCityGrouped) as any[]).map((group: any, idx: number) => {
                                const rangesStr = group.ranges.map((r: any) => `ከ ${r.from} እስከ ${r.to}`).join(', ');
                                return (
                                  <tr key={group.type} className="hover:bg-slate-50/50 transition font-sans">
                                    <td className="p-3 text-slate-400 text-center font-mono font-bold">{idx + 1}</td>
                                    <td className="p-3 text-slate-800 font-black">{group.type}</td>
                                    <td className="p-3 text-slate-600 text-center font-mono font-bold">{rangesStr}</td>
                                    <td className="p-3 text-slate-900 text-center font-mono font-black text-sm bg-slate-50/50">{group.totalQty}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">
                                  ምንም የተመዘገበ የክፍለከተማ መረካከቢያ መረጃ የለም።
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-slate-900 border-b pb-2 flex items-center gap-1.5">
                        <span className="text-lg">📦</span> ክፍል 2ለ፡ በወረዳ የተረከብናቸው/ያሰራጨናቸው ቅፆች ኦዲት (ቅፅ 010 - የወረዳ መረካከቢያ)
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 font-bold">ይህ ክፍል በወረዳ ደረጃ ርክክብ የተደረገባቸውን እና የተከፋፈሉትን የህትመት ቅፆች አጠቃላይ መረጃ ያሳያል።</p>
                      
                      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white mt-2">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                              <th className="p-3 text-[11px] font-black uppercase text-center w-12">ተ.ቁ</th>
                              <th className="p-3 text-[11px] font-black uppercase">የኩነት አይነት (Event Type)</th>
                              <th className="p-3 text-[11px] font-black uppercase text-center">የሰሪያል ቁጥር ክልል (Serial Range From-To)</th>
                              <th className="p-3 text-[11px] font-black uppercase text-center w-40">ድምር በቁጥር (Sum Qty)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-xs">
                            {Object.values(form010WoredaGrouped).length > 0 ? (
                              (Object.values(form010WoredaGrouped) as any[]).map((group: any, idx: number) => {
                                const rangesStr = group.ranges.map((r: any) => `ከ ${r.from} እስከ ${r.to}`).join(', ');
                                return (
                                  <tr key={group.type} className="hover:bg-slate-50/50 transition font-sans">
                                    <td className="p-3 text-slate-400 text-center font-mono font-bold">{idx + 1}</td>
                                    <td className="p-3 text-slate-800 font-black">{group.type}</td>
                                    <td className="p-3 text-slate-600 text-center font-mono font-bold">{rangesStr}</td>
                                    <td className="p-3 text-slate-900 text-center font-mono font-black text-sm bg-slate-50/50">{group.totalQty}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">
                                  ምንም የተመዘገበ የወረዳ መረካከቢያ መረጃ የለም።
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 3. FORM 011 AUDIT */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="text-sm font-black text-slate-900 border-b pb-2 flex items-center gap-1.5">
                      <span className="text-lg">📋</span> ክፍል 3፡ በወረዳ አገልግሎት የተሰጠባቸው ቅፆች ኦዲት (ቅፅ 011)
                    </h4>
                    
                    <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                            <th className="p-3 text-[11px] font-black uppercase text-center w-12">ተ.ቁ</th>
                            <th className="p-3 text-[11px] font-black uppercase">የኩነት አይነት (Event Type)</th>
                            <th className="p-3 text-[11px] font-black uppercase text-center">የሴሪያል ቁጥር ክልል (Serial Range From-To)</th>
                            <th className="p-3 text-[11px] font-black uppercase text-center w-40">ድምር በቁጥር (Sum Qty)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {Object.values(form011Grouped).length > 0 ? (
                            (Object.values(form011Grouped) as any[]).map((group: any, idx: number) => {
                              const serials = group.records.map((r: any) => r.serial).filter(Boolean);
                              const sorted = [...serials].sort((a, b) => {
                                const numA = parseInt(a, 10);
                                const numB = parseInt(b, 10);
                                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                                return a.localeCompare(b);
                              });
                              const fromSerial = sorted[0] || '-';
                              const toSerial = sorted[sorted.length - 1] || '-';
                              const totalCount = group.records.length;

                              return (
                                <tr key={group.type} className="hover:bg-slate-50/50 transition font-sans">
                                  <td className="p-3 text-slate-400 text-center font-mono font-bold">{idx + 1}</td>
                                  <td className="p-3 text-slate-800 font-black">{group.type}</td>
                                  <td className="p-3 text-slate-600 text-center font-mono font-bold">ከ {fromSerial} እስከ {toSerial}</td>
                                  <td className="p-3 text-slate-900 text-center font-mono font-black text-sm bg-slate-50/50">{totalCount}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">
                                ምንም የተመዘገበ የቅፅ 011 መረጃ የለም።
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. FORM 012 AUDIT */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="text-sm font-black text-slate-900 border-b pb-2 flex items-center gap-1.5">
                      <span className="text-lg">🗑</span> ክፍል 4፡ የባከኑና ያልተሰጡ ቅፆች ኦዲት (ቅፅ 012)
                    </h4>
                    
                    <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-700">
                            <th className="p-3 text-[11px] font-black uppercase text-center w-12">ተ.ቁ</th>
                            <th className="p-3 text-[11px] font-black uppercase">የኩነት አይነት (Event Type)</th>
                            <th className="p-3 text-[11px] font-black uppercase text-center">የሰሪያል ቁጥር ክልል (Serial Range From-To)</th>
                            <th className="p-3 text-[11px] font-black uppercase text-center w-40">ድምር በቁጥር (Sum Qty)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {Object.values(form012Grouped).length > 0 ? (
                            (Object.values(form012Grouped) as any[]).map((group: any, idx: number) => {
                              const serials = group.records.map((r: any) => r.serial).filter(Boolean);
                              const sorted = [...serials].sort((a, b) => {
                                const numA = parseInt(a, 10);
                                const numB = parseInt(b, 10);
                                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                                return a.localeCompare(b);
                              });
                              const fromSerial = sorted[0] || '-';
                              const toSerial = sorted[sorted.length - 1] || '-';
                              const totalCount = group.records.length;

                              return (
                                <tr key={group.type} className="hover:bg-slate-50/50 transition font-sans">
                                  <td className="p-3 text-slate-400 text-center font-mono font-bold">{idx + 1}</td>
                                  <td className="p-3 text-slate-800 font-black">{group.type}</td>
                                  <td className="p-3 text-slate-600 text-center font-mono font-bold">ከ {fromSerial} እስከ {toSerial}</td>
                                  <td className="p-3 text-slate-900 text-center font-mono font-black text-sm bg-slate-50/50">{totalCount}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">
                                ምንም የተመዘገበ የቅፅ 012 መረጃ የለም።
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              );
            })()}

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


      {/* ============================================== */}
      {/* 4. MODALS (NO-PRINT) */}
      {/* ============================================== */}
      {/* ============================================== */}
      {/* 4. MODALS (NO-PRINT) */}
      {/* ============================================== */}
      {/* Scanned Resident Document View Modal */}
      {selectedViewDoc !== null && (() => {
        const hasScanFiles = !!(selectedViewDoc.files && selectedViewDoc.files.length > 0 && selectedViewDoc.files.some(f => f.contentUrl));
        const pageFiles = selectedViewDoc.files || [];
        return (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 no-print">
            <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full h-[88vh] overflow-hidden border border-slate-100 flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#0f405c] text-white px-5 py-3.5 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-2 bg-white/10 rounded-xl shrink-0">
                    <FileText className="w-5 h-5 text-teal-300 animate-pulse" />
                  </div>
                  <div className="truncate text-left">
                    <h3 className="text-[10px] uppercase font-bold tracking-wider text-teal-300">የምዝገባ ማህደር መረጃዎችና አባላት (Registry Profile View)</h3>
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

              {/* Modal Body: Custom conditional layout depending on file scan status */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
                
                {/* Left Pane: Interactive document container (Zoom, Rotate, Carousel) */}
                {hasScanFiles && (
                  <div className="md:col-span-7 bg-slate-100 h-full p-4 flex flex-col justify-between relative overflow-hidden min-h-[350px] md:min-h-0 border-r border-slate-200">
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

                    {/* Thumbnail Strip Gallery & Actions */}
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
                    </div>
                  </div>
                )}

                {/* Right Pane: Document details, Notes, and Detailed Household Members Registry */}
                <div className={`${hasScanFiles ? 'md:col-span-5 border-l border-slate-100' : 'md:col-span-12 max-w-4xl mx-auto w-full'} p-5 flex flex-col justify-between border-t md:border-t-0 h-full overflow-y-auto bg-slate-50/50`}>
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
                        <Layers className="w-4 h-4 text-teal-600" />
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
                            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
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
        );
      })()}

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
                      const template = `ጤና ይስጥልኝ ${smsRecord.name}፣ የቦሌ ወረዳ 05 የነዋሪ መታወቂያዎ (ቁጥር ${smsRecord.idNumber}) ታትሞ ተዘጋጅቷል። እባክዎ ቀዳሚ መታወቂያዎን ወይም የልደት ካርድዎን በመያዝ በስራ ሰዓት በአካል መጥተው ከምድብ መስኮት 3 (Window 3) ላይ ይረከቡ። እናመሰግናለን!`;
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

      {/* Full Digital Transition & Proposal Modal */}
      <ProposalModal isOpen={showProposalModal} onClose={() => setShowProposalModal(false)} />

      {/* ፊርማ አስቀምጥ/ቀይር Modal */}
      {activeSignatureRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-150 flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="bg-teal-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">ዲጂታል ፊርማ አስቀምጥ / ማረጋገጫ</h3>
                  <p className="text-[10px] text-slate-300 font-bold mt-0.5">ለቅፅ {activeSignatureRecord.type === 'f10' ? '010' : activeSignatureRecord.type === 'f11' ? '011' : '012'} መዝገብ (የመታወቂያ/የሰነድ ማረጋገጫ ፊርማ)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveSignatureRecord(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xs font-black"
                title="ዝጋ"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto font-sans text-left">
              {/* Option Switcher State */}
              {(() => {
                const [sigTab, setSigTab] = useState<'draw' | 'generate' | 'upload'>('draw');
                const [genName, setGenName] = useState(activeSignatureRecord.name || '');
                const [genFont, setGenFont] = useState('Great Vibes');
                const [uploadSrc, setUploadSrc] = useState('');

                const handleDrawSave = (dataUrl: string) => {
                  handleUpdateRecordSignature(activeSignatureRecord.type, activeSignatureRecord.id, dataUrl);
                };

                const handleGenerateSave = () => {
                  if (!genName.trim()) {
                    alert("እባክዎ መጀመሪያ ስም ያስገቡ!");
                    return;
                  }
                  const dataUrl = generateCursiveSignature(genName.trim(), genFont);
                  handleUpdateRecordSignature(activeSignatureRecord.type, activeSignatureRecord.id, dataUrl);
                };

                const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        setUploadSrc(event.target.result as string);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                };

                const handleUploadSave = () => {
                  if (!uploadSrc) {
                    alert("እባክዎ መጀመሪያ የምስል ፋይል ይምረጡ!");
                    return;
                  }
                  handleUpdateRecordSignature(activeSignatureRecord.type, activeSignatureRecord.id, uploadSrc);
                };

                return (
                  <div className="space-y-4">
                    {/* Tab Selection */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-[10px] sm:text-[11px] font-extrabold text-slate-600">
                      <button
                        type="button"
                        onClick={() => setSigTab('draw')}
                        className={`py-2 px-1 rounded-lg text-center transition ${sigTab === 'draw' ? 'bg-white text-teal-900 shadow-sm font-black' : 'hover:bg-slate-50'}`}
                      >
                        ✍️ በእጅ ይፈረሙ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigTab('generate')}
                        className={`py-2 px-1 rounded-lg text-center transition ${sigTab === 'generate' ? 'bg-white text-teal-900 shadow-sm font-black' : 'hover:bg-slate-50'}`}
                      >
                        ⚙️ በስም ማመንጫ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigTab('upload')}
                        className={`py-2 px-1 rounded-lg text-center transition ${sigTab === 'upload' ? 'bg-white text-teal-900 shadow-sm font-black' : 'hover:bg-slate-50'}`}
                      >
                        📁 ምስል ይጫኑ
                      </button>
                    </div>

                    {/* Tab contents */}
                    {sigTab === 'draw' && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                          ከታች ባለው የማስፈረሚያ ሰሌዳ ላይ ጣትዎን ወይም ማውዝዎን በመጠቀም ትክክለኛውን ፊርማ መፈረም ይችላሉ።
                        </p>
                        <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50">
                          <SignaturePad 
                            onSave={handleDrawSave}
                            placeholderText="እባክዎን ፊርማዎን እዚህ ሰሌዳ ውስጥ ይሳሉ ከዚያም 'ፊርማ አስቀምጥ' የሚለውን ይጫኑ..."
                          />
                        </div>
                      </div>
                    )}

                    {sigTab === 'generate' && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                          መፈረም የከበደዎት ከሆነ ስሙን በማስገባት ዲጂታል የሚፈስ (Cursive) ፊርማ በራስ-ሰር ማመንጨት ይችላሉ።
                        </p>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">ፊርማ የሚደረግበት ስም (Signee Name)</label>
                            <input
                              type="text"
                              value={genName}
                              onChange={(e) => setGenName(e.target.value)}
                              placeholder="የፈራሚውን ስም ያስገቡ..."
                              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-700 focus:outline-none font-bold text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">የፊርማው ቅርጸት ስታይል (Font Style)</label>
                            <select
                              value={genFont}
                              onChange={(e) => setGenFont(e.target.value)}
                              className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs bg-white focus:outline-none"
                            >
                              <option value="Great Vibes">ስታይል 1 (Great Vibes)</option>
                              <option value="Caveat">ስታይል 2 (Caveat)</option>
                              <option value="Sacramento">ስታይል 3 (Sacramento)</option>
                              <option value="cursive">ስታይል 4 (Cursive Font)</option>
                            </select>
                          </div>

                          {/* Previews the generated canvas signature */}
                          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-center min-h-[110px]">
                            {genName.trim() ? (
                              <div className="text-center">
                                <span className="block text-[8px] text-slate-400 font-bold mb-1">የማሳያ ቅድመ እይታ (Live Preview)</span>
                                <img 
                                  src={generateCursiveSignature(genName, genFont)} 
                                  className="mx-auto bg-white border border-dashed border-teal-300 rounded-xl p-2 shadow-sm h-14" 
                                  alt="Generated Signature" 
                                />
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">ስም ሲያስገቡ የፊርማው ቅድመ እይታ እዚህ ይታያል</span>
                            )}
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={handleGenerateSave}
                              className="bg-teal-800 hover:bg-teal-950 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer"
                            >
                              ✓ የተፈጠረውን ፊርማ አስቀምጥ
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {sigTab === 'upload' && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                          ከዚህ ቀደም በወረቀት ላይ የተፈረመ ወይም የተቃኘ የፊርማ ምስል ፋይል በቀጥታ ከኮምፒውተርዎ ላይ መጫን ይችላሉ።
                        </p>

                        <div className="space-y-3">
                          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center bg-slate-50 hover:bg-slate-100/50 transition relative">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="space-y-1">
                              <span className="text-lg">📁</span>
                              <p className="text-xs font-bold text-slate-700">የፊርማ ምስል እዚህ ይጫኑ</p>
                              <p className="text-[9px] text-slate-400">PNG, JPG ወይም JPEG (ፋይሉ ከ 1MB በታች መሆን አለበት)</p>
                            </div>
                          </div>

                          {uploadSrc && (
                            <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col items-center">
                              <span className="text-[8px] text-slate-400 font-bold mb-2">የተጫነው ፊርማ ቅድመ እይታ</span>
                              <img src={uploadSrc} className="max-h-16 bg-white border rounded p-1" alt="Uploaded sig preview" />
                            </div>
                          )}

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleUploadSave}
                              className="bg-teal-800 hover:bg-teal-950 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer"
                              disabled={!uploadSrc}
                            >
                              ✓ የተጫነውን ፊርማ አስቀምጥ
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveSignatureRecord(null)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold py-2 px-5 rounded-xl text-xs transition active:scale-95"
              >
                ዝጋ (Close)
              </button>
            </div>
          </div>
        </div>
      )}


      </main>


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
