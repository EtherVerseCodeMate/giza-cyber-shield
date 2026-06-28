import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MondayAPIResponse {
  data?: any;
  errors?: Array<{ message: string }>;
}

interface SyncRequest {
  organizationId: string;
  operation: 'create' | 'update' | 'sync_all';
  entityType: 'finding' | 'task' | 'asset' | 'feature';
  entityData?: any;
  entityId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const requestData: SyncRequest = await req.json();
    const { organizationId, operation, entityType, entityData, entityId } = requestData;

    // Get Monday.com configuration
    const { data: config, error: configError } = await supabaseClient
      .from('monday_integration_config')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !config) {
      throw new Error('Monday.com integration not configured');
    }

    const mondayApiKey = Deno.env.get('MONDAY_API_KEY');
    if (!mondayApiKey) {
      throw new Error('Monday.com API key not configured');
    }

    // Execute Monday.com API operations
    let result;
    switch (operation) {
      case 'create':
        result = await createMondayItem(mondayApiKey, config, entityType, entityData);
        break;
      case 'update':
        result = await updateMondayItem(mondayApiKey, config, entityType, entityId!, entityData);
        break;
      case 'sync_all':
        result = await syncAllEntities(supabaseClient, mondayApiKey, config, organizationId);
        break;
      default:
        throw new Error('Invalid operation');
    }

    // Log sync history
    await supabaseClient.from('monday_sync_history').insert({
      organization_id: organizationId,
      sync_type: 'push',
      entity_type: entityType,
      entity_id: entityId,
      monday_item_id: result?.itemId,
      monday_board_id: result?.boardId,
      operation,
      status: 'success',
      sync_data: { request: requestData, response: result },
    });

    // Update last sync timestamp
    await supabaseClient
      .from('monday_integration_config')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('organization_id', organizationId);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Monday.com sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function callMondayAPI(apiKey: string, query: string, variables?: any): Promise<MondayAPIResponse> {
  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  return await response.json();
}

async function createMondayItem(
  apiKey: string,
  config: any,
  entityType: string,
  entityData: any
): Promise<any> {
  const boardMapping = getBoardMapping(config, entityType);
  if (!boardMapping) {
    throw new Error(`No board mapping found for ${entityType}`);
  }

  const mutation = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item (
        board_id: $boardId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const columnValues = mapEntityToMondayColumns(entityType, entityData);
  
  const variables = {
    boardId: boardMapping,
    itemName: entityData.title || entityData.name || 'Untitled',
    columnValues: JSON.stringify(columnValues),
  };

  const result = await callMondayAPI(apiKey, mutation, variables);
  
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return {
    itemId: result.data?.create_item?.id,
    boardId: boardMapping,
  };
}

async function updateMondayItem(
  apiKey: string,
  config: any,
  entityType: string,
  entityId: string,
  entityData: any
): Promise<any> {
  // Get existing Monday.com item ID from mappings
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: mapping } = await supabaseClient
    .from('monday_item_mappings')
    .select('monday_item_id, monday_board_id')
    .eq('local_entity_id', entityId)
    .maybeSingle();

  if (!mapping) {
    // Create new item if mapping doesn't exist
    return await createMondayItem(apiKey, config, entityType, entityData);
  }

  const mutation = `
    mutation ($itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values (
        item_id: $itemId,
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const columnValues = mapEntityToMondayColumns(entityType, entityData);
  
  const variables = {
    itemId: mapping.monday_item_id,
    columnValues: JSON.stringify(columnValues),
  };

  const result = await callMondayAPI(apiKey, mutation, variables);
  
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return {
    itemId: mapping.monday_item_id,
    boardId: mapping.monday_board_id,
  };
}

async function syncAllEntities(
  supabaseClient: any,
  apiKey: string,
  config: any,
  organizationId: string
): Promise<any> {
  const results = {
    synced: 0,
    failed: 0,
    entities: [] as any[],
  };

  // Sync security findings
  const { data: findings } = await supabaseClient
    .from('security_alerts')
    .select('*')
    .eq('organization_id', organizationId)
    .limit(50);

  if (findings) {
    for (const finding of findings) {
      try {
        await createMondayItem(apiKey, config, 'finding', {
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
          description: finding.description,
        });
        results.synced++;
      } catch (error) {
        results.failed++;
      }
    }
  }

  // Sync remediation tasks
  const { data: tasks } = await supabaseClient
    .from('remediation_tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .limit(50);

  if (tasks) {
    for (const task of tasks) {
      try {
        await createMondayItem(apiKey, config, 'task', {
          title: task.task_title,
          priority: task.priority,
          status: task.status,
        });
        results.synced++;
      } catch (error) {
        results.failed++;
      }
    }
  }

  return results;
}

function getBoardMapping(config: any, entityType: string): string | null {
  const mappings: Record<string, string> = {
    'finding': config.board_mappings?.security_findings,
    'task': config.board_mappings?.remediation_pipeline,
    'asset': config.board_mappings?.asset_inventory,
    'feature': config.board_mappings?.mvp_development,
  };
  
  return mappings[entityType] || null;
}

function mapEntityToMondayColumns(entityType: string, entityData: any): any {
  switch (entityType) {
    case 'finding':
      return {
        status: { label: entityData.status || 'Open' },
        priority: { label: entityData.severity || 'Medium' },
        text: entityData.description || '',
      };
    case 'task':
      return {
        status: { label: entityData.status || 'Not Started' },
        priority: { label: entityData.priority || 'Medium' },
      };
    case 'asset':
      return {
        status: { label: entityData.status || 'Active' },
        text: entityData.platform || '',
      };
    case 'feature':
      return {
        status: { label: entityData.status || 'Backlog' },
        text: entityData.description || '',
      };
    default:
      return {};
  }
}
