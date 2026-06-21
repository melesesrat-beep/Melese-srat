// Ethiopian Date Utility and Mock Seeding Helpers

export const ethMonths = [
  "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"
];

// Returns Ethiopian Date String like "13/10/2018 ዓ.ም"
export function getEthiopianDateFromGregorian(gDate: Date): string {
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
  
  return `${eDay}/${eMonth}/${eYear} ዓ.ም`;
}

// Returns Ethiopian Date String like "10/10/2018 ዓ.ም"
export function getEthiopianDate(): string {
  const now = new Date();
  
  // Align date boundary with Ethiopian Local Time (EAT is UTC+3)
  // This ensures that when the system registers a date, it matches Ethiopian time context.
  const localTime = now.getTime();
  const localOffset = now.getTimezoneOffset() * 60000;
  const utcTime = localTime + localOffset;
  const eatTime = utcTime + (3 * 3600000); // EAT is UTC+3
  const eatDate = new Date(eatTime);
  
  return getEthiopianDateFromGregorian(eatDate);
}

// Returns Ethiopian Date Components for seeding dropdown selections
export function getEthiopianDateComponents() {
  const dateStr = getEthiopianDate(); // e.g. "10/10/2018 ዓ.ም"
  const parts = dateStr.replace(" ዓ.ም", "").split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return {
      day: String(day),
      month: ethMonths[monthIndex] || ethMonths[0],
      year: `${year} ዓ.ም`
    };
  }
  return {
    day: "10",
    month: "ሰኔ",
    year: "2018 ዓ.ም"
  };
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
export const initialIdInventory: any[] = [];

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

