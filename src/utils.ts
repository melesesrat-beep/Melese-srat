// Ethiopian Date Utility and Mock Seeding Helpers

export const ethMonths = [
  "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"
];

// Returns Ethiopian Date components from Gregorian
export function getEthiopianDateComponentsFromGregorian(gDate: Date) {
  const gYear = gDate.getFullYear();
  const gMonth = gDate.getMonth() + 1;
  const gDay = gDate.getDate();

  // Create a UTC date representation to count exact days safely
  const targetUtc = Date.UTC(gYear, gMonth - 1, gDay);
  const epochUtc = Date.UTC(1969, 8, 11); // መስከረም 1, 1962 EC (Sept 11, 1969)
  
  let diffDays = Math.round((targetUtc - epochUtc) / 86400000);
  let eYear = 1962;
  
  while (true) {
    const isLeap = (eYear % 4 === 3);
    const daysInYear = isLeap ? 366 : 365;
    
    if (diffDays >= daysInYear) {
      diffDays -= daysInYear;
      eYear++;
    } else if (diffDays < 0) {
      eYear--;
      const prevLeap = (eYear % 4 === 3);
      const prevDaysInYear = prevLeap ? 366 : 365;
      diffDays += prevDaysInYear;
    } else {
      break;
    }
  }
  
  const eMonth = Math.floor(diffDays / 30) + 1;
  const eDay = (diffDays % 30) + 1;
  
  return { eDay, eMonth, eYear };
}

// Helper to get EAT Date
function getEatDate() {
  const now = new Date();
  const localTime = now.getTime();
  const localOffset = now.getTimezoneOffset() * 60000;
  const utcTime = localTime + localOffset;
  const eatTime = utcTime + (3 * 3600000); // EAT is UTC+3
  return new Date(eatTime);
}

// Returns Ethiopian Date String like "10 ጥቅምት 2018 ዓ.ም"
export function getEthiopianDate(): string {
  const { eDay, eMonth, eYear } = getEthiopianDateComponentsFromGregorian(getEatDate());
  return `${eDay} ${ethMonths[eMonth - 1]} ${eYear} ዓ.ም`;
}

// Returns Ethiopian Date Components for seeding dropdown selections
export function getEthiopianDateComponents() {
  const { eDay, eMonth, eYear } = getEthiopianDateComponentsFromGregorian(getEatDate());
  return {
    day: String(eDay),
    month: ethMonths[eMonth - 1] || ethMonths[0],
    year: `${eYear} ዓ.ም`
  };
}

// Returns Ethiopian Date in numeric format "10/10/2018 ዓ.ም"
export function getEthiopianDateNumeric(): string {
  const { eDay, eMonth, eYear } = getEthiopianDateComponentsFromGregorian(getEatDate());
  return `${eDay}/${eMonth}/${eYear} ዓ.ም`;
}

// Returns Ethiopian Time String like "ቀን 6:15 ሰዓት"
export function getEthiopianTime(): string {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let period = "";
  
  let ethHours = hours - 6;
  if (ethHours < 0) {
    ethHours += 24;
  }
  
  if (ethHours >= 0 && ethHours < 6) {
    period = "ማታ"; 
  } else if (ethHours >= 6 && ethHours < 12) {
    period = "ቀን";
  } else if (ethHours >= 12 && ethHours < 18) {
    period = "ማታ";
  } else {
    period = "ሌሊት";
  }
  
  let displayHours = ethHours % 12;
  if (displayHours === 0) displayHours = 12;
  
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${period} ${displayHours}:${displayMinutes} ሰዓት`;
}

// Initial mockup seed data for Woreda 05 system
export const initialIdInventory: any[] = [
  {
    id: "id-1",
    name: "ዮናስ አበበ ከበደ",
    phone: "0911223344",
    idNumber: "W05/ID-8891/18",
    houseNumber: "502",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 12/2018",
    smsSent: false
  },
  {
    id: "id-2",
    name: "ሄለን አስፋው ታደሰ",
    phone: "0912345678",
    idNumber: "W05/ID-8892/18",
    houseNumber: "108/B",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 14/2018",
    smsSent: false
  },
  {
    id: "id-3",
    name: "መሐመድ አሊ ዑስማን",
    phone: "0915998877",
    idNumber: "W05/ID-8893/18",
    houseNumber: "1244",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 15/2018",
    smsSent: false
  },
  {
    id: "id-4",
    name: "ሳምራዊት ግርማ ወልዴ",
    phone: "0920445566",
    idNumber: "W05/ID-8894/18",
    houseNumber: "904",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 16/2018",
    smsSent: false
  },
  {
    id: "id-5",
    name: "ዳንኤል በቀለ ቶሎሳ",
    phone: "0930112233",
    idNumber: "W05/ID-8895/18",
    houseNumber: "411/C",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 18/2018",
    smsSent: false
  },
  {
    id: "id-6",
    name: "ራሔል ተሾመ ገብሬ",
    phone: "0911776655",
    idNumber: "W05/ID-8896/18",
    houseNumber: "122",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 19/2018",
    smsSent: false
  },
  {
    id: "id-7",
    name: "ኪያ ቶላ ደረጄ",
    phone: "0944889900",
    idNumber: "W05/ID-8897/18",
    houseNumber: "088",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 20/2018",
    smsSent: false
  },
  {
    id: "id-8",
    name: "ፋቱማ አህመድ ሙስጠፋ",
    phone: "0913224466",
    idNumber: "W05/ID-8898/18",
    houseNumber: "703",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 22/2018",
    smsSent: false
  },
  {
    id: "id-9",
    name: "ዮሴፍ ሰለሞን ኃይሌ",
    phone: "0911550011",
    idNumber: "W05/ID-8899/18",
    houseNumber: "145",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 23/2018",
    smsSent: false
  },
  {
    id: "id-10",
    name: "ትዕግስት አስናቀ በየነ",
    phone: "0911883399",
    idNumber: "W05/ID-8900/18",
    houseNumber: "312/A",
    status: "ለመረከብ ዝግጁ",
    registrationDate: "ሰኔ 25/2018",
    smsSent: false
  }
];

export const initialGeneratedDocs: any[] = [];

export const initialForm010: any[] = [];

export const initialForm011: any[] = [];

export const initialForm012: any[] = [];

/**
 * Encrypts a plaintext string using a passphrase via standard XOR-based byte-stream shuffling.
 */
export function encryptWithPassword(plaintext: string, key: string): string {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(plaintext);
  const keyEncoder = new TextEncoder();
  const rawKeyBytes = keyEncoder.encode(key || "default_w05_key");
  
  // Stretch key bytes to match dataBytes length or at least 256
  const keyBytes = new Uint8Array(Math.max(256, rawKeyBytes.length));
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = rawKeyBytes[i % rawKeyBytes.length] ^ (i & 0xFF);
  }
  
  const encryptedBytes = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    const k = keyBytes[(i + 17) % keyBytes.length];
    encryptedBytes[i] = dataBytes[i] ^ k ^ (i % 256);
  }
  
  // Convert bytes to Base64 safely
  let binary = "";
  const len = encryptedBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(encryptedBytes[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts a base64 encoded ciphertext string using the passphrase.
 */
export function decryptWithPassword(ciphertext: string, key: string): string {
  try {
    const binary = atob(ciphertext);
    const encryptedBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      encryptedBytes[i] = binary.charCodeAt(i);
    }
    
    const keyEncoder = new TextEncoder();
    const rawKeyBytes = keyEncoder.encode(key || "default_w05_key");
    
    const keyBytes = new Uint8Array(Math.max(256, rawKeyBytes.length));
    for (let i = 0; i < keyBytes.length; i++) {
      keyBytes[i] = rawKeyBytes[i % rawKeyBytes.length] ^ (i & 0xFF);
    }
    
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      const k = keyBytes[(i + 17) % keyBytes.length];
      decryptedBytes[i] = encryptedBytes[i] ^ k ^ (i % 256);
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
  } catch (err) {
    throw new Error("የይለፍ ቃሉ የተሳሳተ ነው ወይም የፋይሉ መረጃ ተቀይሯል!");
  }
}

