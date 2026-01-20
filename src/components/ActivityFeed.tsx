import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Shield, Brain, Eye, User, Database, FileText } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  time: string;
  icon: any;
  color: string;
  timestamp: string;
}

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization) {
      // Set placeholder data since audit_logs table doesn't exist
      const placeholderActivities: ActivityItem[] = [
        {
          id: '1',
          type: 'system',
          message: 'System monitoring active',
          time: 'just now',
          icon: Activity,
          color: 'text-gray-400',
          timestamp: new Date().toISOString()
        }
      ];
      setActivities(placeholderActivities);
      setLoading(false);
    }
  }, [currentOrganization]);

  if (loading) {
    return (
      <Card className="bg-black/40 border-green-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-400">
            <Activity className="h-5 w-5" />
            <span>Live Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">Loading activity feed...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length > 0 ? (
          activities.map((activity) => {
            const IconComponent = activity.icon;
            return (
              <div key={activity.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted/70 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'security' ? 'bg-red-500' :
                  activity.type === 'investigation' ? 'bg-yellow-500' :
                  activity.type === 'auth' ? 'bg-blue-500' :
                  activity.type === 'data' ? 'bg-cyan-500' :
                  activity.type === 'ai' ? 'bg-purple-500' :
                  activity.type === 'document' ? 'bg-green-500' :
                  'bg-gray-500'
                }`} />
                <IconComponent className={`h-4 w-4 ${activity.color}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                    <Badge variant="outline" className="text-xs">
                      {activity.type}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
            <p className="text-xs mt-1">System monitoring...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
