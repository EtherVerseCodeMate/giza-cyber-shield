import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdapterRequest {
  action: 'get_adapters' | 'configure_connection' | 'test_connection' | 'discover_assets'
  organizationId: string
  environmentType?: string
  connectionConfig?: any
  adapterId?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { action, organizationId, environmentType, connectionConfig, adapterId } = await req.json() as AdapterRequest

    console.log(`Polymorphic Engine - Action: ${action}, Org: ${organizationId}`)

    switch (action) {
      case 'get_adapters': {
        // Get available adapters for the organization and environment type
        const { data: adapters, error } = await supabaseClient
          .rpc('get_available_adapters', {
            org_id: organizationId,
            env_type: environmentType
          })

        if (error) {
          console.error('Error fetching adapters:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch adapters' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ adapters: adapters || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'configure_connection': {
        if (!adapterId || !connectionConfig) {
          return new Response(
            JSON.stringify({ error: 'Missing adapter ID or connection config' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create a new data source connection
        const { data: connection, error } = await supabaseClient
          .from('data_source_connections')
          .insert({
            organization_id: organizationId,
            connection_name: connectionConfig.name,
            environment_type: environmentType,
            adapter_id: adapterId,
            connection_config: connectionConfig,
            credentials_config: connectionConfig.credentials || {},
            created_by: (await supabaseClient.auth.getUser()).data.user?.id
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating connection:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to create connection' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ connection }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'test_connection': {
        // Simulate connection testing based on adapter type
        const { data: adapter } = await supabaseClient
          .from('integration_adapters')
          .select('*')
          .eq('id', adapterId)
          .single()

        if (!adapter) {
          return new Response(
            JSON.stringify({ error: 'Adapter not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Simulate different test results based on adapter type
        const testResult = {
          success: true,
          latency_ms: Math.floor(Math.random() * 200) + 50,
          discovered_services: [],
          adapter_version: '1.0.0',
          test_timestamp: new Date().toISOString()
        }

        switch (adapter.adapter_type) {
          case 'ssh':
            testResult.discovered_services = ['sshd', 'systemd', 'networkd']
            break
          case 'api':
            testResult.discovered_services = ['REST API', 'Authentication', 'Rate Limiting']
            break
          case 'snmp':
            testResult.discovered_services = ['SNMP Agent', 'MIB Support', 'Trap Collection']
            break
          case 'industrial':
            testResult.discovered_services = ['Modbus TCP', 'OPC UA', 'DNP3']
            break
          case 'container':
            testResult.discovered_services = ['Docker Engine', 'Kubernetes API', 'Container Runtime']
            break
          case 'agentless':
            testResult.discovered_services = ['Port Scanner', 'Service Detection', 'OS Fingerprinting']
            break
        }

        // Update connection with test results
        await supabaseClient
          .from('data_source_connections')
          .update({
            test_results: testResult,
            last_test: new Date().toISOString(),
            connection_status: testResult.success ? 'connected' : 'failed'
          })
          .eq('id', connectionConfig.connectionId)

        return new Response(
          JSON.stringify({ test_result: testResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'discover_assets': {
        // Simulate asset discovery
        const mockAssets = [
          {
            asset_identifier: `${environmentType}-001`,
            asset_type: 'server',
            asset_metadata: {
              hostname: `${environmentType}-server-001`,
              ip_address: '192.168.1.100',
              os: 'Linux Ubuntu 22.04',
              services: ['ssh', 'http', 'https']
            },
            discovery_method: 'polymorphic_scan',
            stig_applicability: ['RHEL_8_STIG', 'General_Purpose_OS_STIG']
          },
          {
            asset_identifier: `${environmentType}-002`,
            asset_type: 'network_device',
            asset_metadata: {
              hostname: `${environmentType}-switch-001`,
              ip_address: '192.168.1.1',
              device_type: 'managed_switch',
              firmware_version: '15.2.7'
            },
            discovery_method: 'snmp_discovery',
            stig_applicability: ['Network_Infrastructure_STIG']
          }
        ]

        // Insert discovered assets
        const { data: assets, error } = await supabaseClient
          .from('discovered_assets')
          .insert(
            mockAssets.map(asset => ({
              ...asset,
              organization_id: organizationId,
              connection_id: connectionConfig.connectionId
            }))
          )
          .select()

        if (error) {
          console.error('Error saving discovered assets:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to save discovered assets' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            discovered_assets: assets,
            discovery_summary: {
              total_assets: assets?.length || 0,
              asset_types: [...new Set(assets?.map(a => a.asset_type))],
              stig_frameworks: [...new Set(assets?.flatMap(a => a.stig_applicability || []))]
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error: any) {
    console.error('Polymorphic Engine error:', error)
    return new Response(
      JSON.stringify({
        error: 'Request processing failed',
        message: error.message || 'Unable to complete the requested operation.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})