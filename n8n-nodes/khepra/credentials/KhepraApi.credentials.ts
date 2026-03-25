import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class KhepraApi implements ICredentialType {
  name = 'khepraApi';
  displayName = 'Khepra API';
  documentationUrl = 'https://souhimbou.ai/docs/api';
  properties: INodeProperties[] = [
    {
      displayName: 'DEMARC API URL',
      name: 'apiUrl',
      type: 'string',
      default: 'https://api.souhimbou.ai',
      placeholder: 'https://api.souhimbou.ai',
      description: 'Base URL of your Khepra DEMARC API server',
    },
    {
      displayName: 'Authentication Method',
      name: 'authMethod',
      type: 'options',
      options: [
        {
          name: 'PQC Token (X-Khepra-PQC-Token)',
          value: 'pqcToken',
          description: 'ML-DSA-65 signed JWT — highest security',
        },
        {
          name: 'Supabase JWT (Bearer)',
          value: 'supabaseJwt',
          description: 'Supabase Auth JWT from email/Google/GitHub login',
        },
        {
          name: 'API Key (Bearer)',
          value: 'apiKey',
          description: 'Machine-bound API key from your Khepra license',
        },
      ],
      default: 'pqcToken',
    },
    {
      displayName: 'Token / API Key',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Your PQC token, Supabase JWT, or API key',
    },
    {
      displayName: 'Webhook Secret',
      name: 'webhookSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Secret for verifying Khepra → n8n webhook payloads (HMAC-SHA256)',
    },
  ];
}
