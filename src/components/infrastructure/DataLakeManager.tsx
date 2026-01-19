import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, Cloud, HardDrive, Zap, RefreshCw, AlertCircle, 
  CheckCircle, Settings, TrendingUp, BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataSource {
  id: string;
  name: string;
  type: 'PostgreSQL' | 'Elasticsearch' | 'MinIO' | 'Redis' | 'Kafka';
  status: 'connected' | 'disconnected' | 'error' | 'maintenance';
  size: string;
  records: number;
  lastSync: string;
  health: number;
  throughput: string;
}

interface StorageMetrics {
  totalStorage: string;
  usedStorage: string;
  availableStorage: string;
  dataIngestionRate: string;
  queryPerformance: string;
  compressionRatio: string;
}

export const DataLakeManager = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize with mock data representing the complete data lake stack
    const mockDataSources: DataSource[] = [
      {
        id: '1',
        name: 'PostgreSQL Primary',
        type: 'PostgreSQL',
        status: 'connected',
        size: '2.4 TB',
        records: 15420000,
        lastSync: '2024-01-13T15:45:00Z',
        health: 98,
        throughput: '850 MB/s'
      },
      {
        id: '2',
        name: 'Elasticsearch Cluster',
        type: 'Elasticsearch',
        status: 'connected',
        size: '8.7 TB',
        records: 125000000,
        lastSync: '2024-01-13T15:44:30Z',
        health: 95,
        throughput: '1.2 GB/s'
      },
      {
        id: '3',
        name: 'MinIO Object Storage',
        type: 'MinIO',
        status: 'connected',
        size: '45.2 TB',
        records: 580000,
        lastSync: '2024-01-13T15:43:15Z',
        health: 99,
        throughput: '2.8 GB/s'
      },
      {
        id: '4',
        name: 'Redis Cache Cluster',
        type: 'Redis',
        status: 'connected',
        size: '128 GB',
        records: 12500000,
        lastSync: '2024-01-13T15:45:10Z',
        health: 97,
        throughput: '450 MB/s'
      },
      {
        id: '5',
        name: 'Kafka Event Stream',
        type: 'Kafka',
        status: 'connected',
        size: '3.2 TB',
        records: 890000000,
        lastSync: '2024-01-13T15:44:45Z',
        health: 96,
        throughput: '15 GB/s'
      }
    ];

    const mockMetrics: StorageMetrics = {
      totalStorage: '59.7 TB',
      usedStorage: '44.2 TB',
      availableStorage: '15.5 TB',
      dataIngestionRate: '20.3 GB/s',
      queryPerformance: '< 50ms avg',
      compressionRatio: '3.2:1'
    };

    setDataSources(mockDataSources);
    setMetrics(mockMetrics);
    setLoading(false);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'disconnected': return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'maintenance': return <Settings className="h-4 w-4 text-warning" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-success text-success-foreground';
      case 'disconnected': return 'bg-muted text-muted-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PostgreSQL': return <Database className="h-5 w-5" />;
      case 'Elasticsearch': return <BarChart3 className="h-5 w-5" />;
      case 'MinIO': return <Cloud className="h-5 w-5" />;
      case 'Redis': return <Zap className="h-5 w-5" />;
      case 'Kafka': return <TrendingUp className="h-5 w-5" />;
      default: return <HardDrive className="h-5 w-5" />;
    }
  };

  const optimizeDataLake = async () => {
    setOptimizing(true);
    
    // Simulate optimization process
    setTimeout(() => {
      setOptimizing(false);
      toast({
        title: "Data Lake Optimized",
        description: "Storage compression and query performance have been improved",
        variant: "default"
      });
    }, 5000);
  };

  const syncDataSource = async (sourceId: string, sourceName: string) => {
    setDataSources(prev => 
      prev.map(ds => 
        ds.id === sourceId 
          ? { ...ds, lastSync: new Date().toISOString() }
          : ds
      )
    );
    
    toast({
      title: "Sync Complete",
      description: `${sourceName} has been synchronized`,
      variant: "default"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-foreground">Loading data lake configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Lake Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Storage</p>
                <p className="text-2xl font-bold text-primary">{metrics?.totalStorage}</p>
                <p className="text-xs text-muted-foreground">Used: {metrics?.usedStorage}</p>
              </div>
              <HardDrive className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ingestion Rate</p>
                <p className="text-2xl font-bold text-success">{metrics?.dataIngestionRate}</p>
                <p className="text-xs text-muted-foreground">Real-time processing</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Query Performance</p>
                <p className="text-2xl font-bold text-accent">{metrics?.queryPerformance}</p>
                <p className="text-xs text-muted-foreground">Average response time</p>
              </div>
              <Zap className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Utilization */}
      <Card className="card-cyber">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-primary" />
                <span>Data Lake Architecture</span>
              </CardTitle>
              <CardDescription>
                Multi-tiered storage architecture with PostgreSQL, Elasticsearch, and MinIO
              </CardDescription>
            </div>
            <Button 
              variant="cyber" 
              onClick={optimizeDataLake}
              disabled={optimizing}
            >
              {optimizing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Optimize
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Utilization</span>
                <span>74%</span>
              </div>
              <Progress value={74} className="h-2" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">Compression Ratio</span>
                <p className="font-medium text-foreground">{metrics?.compressionRatio}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Available Space</span>
                <p className="font-medium text-foreground">{metrics?.availableStorage}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Active Sources</span>
                <p className="font-medium text-foreground">{dataSources.filter(ds => ds.status === 'connected').length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources Tabs */}
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <Card className="card-cyber">
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                Manage data lake components and storage systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-4 border border-border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getTypeIcon(source.type)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-foreground">{source.name}</h4>
                            <Badge className={getStatusColor(source.status)}>
                              {getStatusIcon(source.status)}
                              <span className="ml-1">{source.status.toUpperCase()}</span>
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <span>Size: {source.size}</span>
                            <span>Records: {source.records.toLocaleString()}</span>
                            <span>Health: {source.health}%</span>
                            <span>Throughput: {source.throughput}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncDataSource(source.id, source.name)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3 mr-1" />
                          Config
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataSources.map((source) => (
              <Card key={source.id} className="card-cyber">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-sm">
                    {getTypeIcon(source.type)}
                    <span>{source.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Health Score</span>
                        <span>{source.health}%</span>
                      </div>
                      <Progress value={source.health} className="h-1" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Throughput: {source.throughput}</p>
                      <p>Records: {source.records.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};