// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiscoveredAsset {
  organization_id: string
  asset_id: string
  asset_name: string
  asset_type: string
  platform: string
  operating_system: string
  version: string
  ip_addresses: string[]
  discovery_method: string
  last_discovered: string
  metadata: any
}

// Industry-first Polymorphic Mapper: Translates any source schema to Khepra Standard
const transformSourceData = (source: string, data: any): Partial<DiscoveredAsset> => {
  switch (source) {
    case 'aws_sdk':
      return {
        asset_name: data.Tags?.find((t: any) => t.Key === 'Name')?.Value || data.InstanceId,
        asset_type: 'server',
        platform: 'aws',
        operating_system: data.PlatformDetails || 'Linux',
        version: data.InstanceType,
        ip_addresses: [data.PrivateIpAddress, data.PublicIpAddress].filter(Boolean),
        metadata: { ...data, provider: 'aws' }
      }
    case 'azure_api':
      return {
        asset_name: data.name,
        asset_type: 'server',
        platform: 'azure',
        operating_system: data.properties?.storageProfile?.osDisk?.osType || 'Unknown',
        version: data.properties?.hardwareProfile?.vmSize,
        ip_addresses: [data.properties?.networkProfile?.networkInterfaces?.[0]?.id],
        metadata: { ...data, provider: 'azure' }
      }
    case 'custom_payload':
      // Dynamic mapping logic - the true "Polymorphic" part
      return {
        asset_name: data.hostname || data.label || 'unknown-asset',
        asset_type: data.category || 'device',
        platform: data.env || 'on-premise',
        operating_system: data.os_info || 'other',
        version: data.ver || 'v1.0',
        ip_addresses: Array.isArray(data.ips) ? data.ips : [data.ip].filter(Boolean),
        metadata: data
      }
    default:
      return data // Pass-through
  }
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { action, organizationId, environmentType, sourceData, sourceProfile } = body

    console.log(`Polymorphic Engine [${action}] for Org [${organizationId}]`)

    switch (action) {
      case 'discover_assets': {
        if (!sourceData || !Array.isArray(sourceData)) {
          throw new Error('sourceData must be an array for discovery')
        }

        // Transform polymorphic data into internal schema
        const transformedAssets: DiscoveredAsset[] = sourceData.map(item => {
          const transformed = transformSourceData(sourceProfile || environmentType, item)
          return {
            organization_id: organizationId,
            asset_id: (item.id || item.InstanceId || crypto.randomUUID()).toString(),
            asset_name: transformed.asset_name || 'unknown',
            asset_type: transformed.asset_type || 'unknown',
            platform: transformed.platform || environmentType,
            operating_system: transformed.operating_system || 'unknown',
            version: transformed.version || 'v1.0',
            ip_addresses: transformed.ip_addresses || [],
            discovery_method: `polymorphic_${sourceProfile || 'generic'}`,
            last_discovered: new Date().toISOString(),
            metadata: transformed.metadata || item
          }
        })

        // Upsert results
        const { data, error } = await supabaseClient
          .from('discovered_assets')
          .upsert(transformedAssets, { onConflict: 'organization_id,asset_id' })
          .select()

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            count: data.length,
            assets: data,
            summary: `Successfully ingested ${data.length} assets via Polymorphic Registry`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_adapters': {
        const { data: adapters, error } = await supabaseClient
          .from('integration_adapters')
          .select('*')
          .eq('status', 'active')

        if (error) throw error

        return new Response(JSON.stringify({ adapters }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        throw new Error(`Action ${action} not implemented in current sprint`)
    }

  } catch (error: any) {
    console.error('Polymorphic Engine error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})