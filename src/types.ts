export enum DocumentType {
  RECOMMENDATION = 'የመሸኛ መጠየቂያ ቅጽ',
  RESIDENCY = 'የነዋሪነት ማረጋገጫ ደብዳቤ',
  LIFE_STATUS = 'በሕይወት የመኖር ማረጋገጫ ደብዳቤ'
}

export interface IDRecord {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  houseNumber: string;
  status: 'ለመረከብ ዝግጁ' | 'የወሰደ';
  pickupDate?: string;
  pickupSignature?: string;
  smsSent?: boolean;
  smsSentDate?: string;
  registrationDate?: string;
  woreda?: string;
}

export interface GeneratedDocument {
  id: string;
  ref: string;
  type: DocumentType;
  name: string;
  house: string;
  date: string;
  payload: Record<string, string>;
  woreda?: string;
}

export interface Form010Record {
  id: string;
  type: string;
  qty: number;
  method: 'ሲስተም' | 'ማኑዋል';
  from: string;
  to: string;
  date: string;
  remark: string;
  woreda?: string;
  handoverType?: 'የክፍለከተማ መረካከቢያ' | 'የወረዳ መረካከቢያ';
  signature?: string;
}

export interface Form011Record {
  id: string;
  date: string;
  serviceType: string;
  archive: string;
  customer: string;
  serial: string;
  method: 'ሲስተም' | 'ማኑዋል';
  time: string;
  phone: string;
  signature?: string;
  woreda?: string;
}

export interface Form012Record {
  id: string;
  printType: string;
  returnStatus: 'ያልተሰጠ' | 'የተበላሸ';
  method: 'ሲስተም' | 'ማኑዋል';
  serial: string;
  date: string;
  reason: string;
  woreda?: string;
  signature?: string;
}

export interface OnlinePortalTicket {
  id: string;
  applicationId: string;
  fullName: string;
  phone: string;
  serviceType: string;
  status: 'ሰነዶች ያልተሟሉ' | 'ተረጋግጧል / የተፈቀደ' | 'የተጠናቀቀ' | 'ውድቅ የተደረገ';
  submissionDate: string;
  notes?: string;
  smsSent?: boolean;
  smsSentDate?: string;
  woreda?: string;
}

export interface ScannedFile {
  id: string;
  fileName: string;
  fileSize: string;
  contentUrl: string; // Base64 data URI
  uploadDate: string;
}

export interface HouseholdMember {
  id: string;
  fullName: string;
  role: 'የቤት ባለቤት' | 'ቤተሰብ' | 'ተከራይ' | 'ሌላ';
  idNumber?: string;
}

export interface ResidentDocument {
  id: string;
  houseOwnerName: string;
  houseNumber: string;
  docType: string;
  uploadDate: string;
  notes?: string;
  uploadedBy?: string;
  files: ScannedFile[];
  members: HouseholdMember[];
  woreda?: string;

  // For compatibility with single-page legacy records or other access patterns
  residentName?: string;
  idNumber?: string;
  fileName?: string;
  fileSize?: string;
  contentUrl?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  woreda: string;
  action: string;
  operator: string;
  details: string;
}


