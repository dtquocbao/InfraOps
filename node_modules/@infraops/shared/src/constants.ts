export const APP_NAME = 'InfraOps AI';
export const COMPANY_NAME = 'Meridian Grid Services';

export const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  IOT_PROCESSING: 'iot-processing',
  EVALUATION: 'evaluation',
  FEATURE_TESTS: 'feature-tests',
} as const;

export const SECURITY_LEVELS = ['public', 'internal', 'confidential', 'restricted'] as const;

export const AGENT_TYPES = ['rag', 'contract', 'project', 'iot'] as const;
