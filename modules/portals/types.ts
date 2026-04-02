/** Supported judicial portal identifiers */
export type PortalId = 'mev' | 'eje';

/** A judicial case (expediente) */
export interface Case {
  id: string;
  portal: PortalId;
  caseNumber: string;
  title: string; // carátula
  court: string; // juzgado
  fuero: string;
  portalUrl: string;
  lastMovementDate?: string;
  lastMovementDesc?: string;
  /** MEV-specific metadata */
  metadata?: CaseMetadata;
}

/** Portal-specific case metadata */
export interface CaseMetadata {
  nidCausa?: string; // Internal MEV case ID
  pidJuzgado?: string; // Internal MEV court ID
  set?: string; // Search set name
  sesion?: string; // Session/fuero name
  fechaInicio?: string;
  estadoPortal?: string;
  numeroReceptoria?: string;
}

/** A single movement within a case */
export interface Movement {
  date: string;
  type: string;
  description: string;
  hasDocuments: boolean;
  documentUrls: string[];
}

/** A bookmark (saved case) */
export interface Bookmark extends Case {
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** A monitored case */
export interface Monitor {
  id: string;
  portal: PortalId;
  caseNumber: string;
  title: string;
  court: string;
  portalUrl: string;
  isActive: boolean;
  lastScanAt?: string;
  lastKnownMovementDate?: string;
  lastKnownMovementCount: number;
  /** MEV internal case ID (needed for direct URL construction) */
  nidCausa?: string;
  /** MEV internal court ID */
  pidJuzgado?: string;
}

/** A movement alert (notification of new movement) */
export interface MovementAlert {
  id: string;
  monitorId: string;
  movementDate: string;
  movementType?: string;
  movementDescription: string;
  isRead: boolean;
  createdAt: string;
}

/** Encrypted credential blob stored in chrome.storage.local */
export interface EncryptedCredential {
  iv: string; // base64 encoded 12-byte IV
  ciphertext: string; // base64 encoded AES-GCM ciphertext
  salt: string; // base64 encoded 16-byte salt
}

/** Portal credentials (decrypted) */
export interface PortalCredentials {
  username: string;
  password: string;
}
