import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Play, 
  Eye, 
  CheckCircle, 
  ArrowRight, 
  Shield, 
  Scan, 
  Network,
  Brain,
  Target,
  Clock
} from 'lucide-react';

interface ExperienceSelectorProps {
  onExperienceSelected: (experience: string) => void;
}

const ExperienceSelector: React.FC<ExperienceSelectorProps> = ({ onExperienceSelected }) => {
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);

  const experiences = [
    {
      id: 'enterprise-setup',
      title: 'STIG Configuration Setup',
      description: 'Connect your environment for STIG configuration search, AI verification, baseline capture, and drift detection.',
      icon: Shield,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      features: [
        'STIG configuration registry',
        'AI-powered verification',
        'Configuration baselines',
        'Drift detection monitoring'
      ],
      buttonText: 'Start Setup',
      estimatedTime: '10-15 minutes'
    },
    {
      id: 'quick-tour',
      title: 'Quick Platform Tour',
      description: 'Explore STIG configuration search, AI verification, and drift detection capabilities with sample data.',
      icon: Play,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      features: [
        'Interactive demo mode',
        'Sample STIG configurations',
        'Live drift detection preview'
      ],
      buttonText: 'Start Tour',
      estimatedTime: '5-10 minutes'
    },
    {
      id: 'executive-summary',
      title: 'Compliance Dashboard',
      description: 'High-level view of STIG compliance status, configuration drift, and baseline health across your environment.',
      icon: Eye,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      features: [
        'STIG compliance overview',
        'Configuration drift status',
        'Baseline health metrics'
      ],
      buttonText: 'View Dashboard',
      estimatedTime: 'Immediate access'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Experience
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Welcome to STIG-first compliance automation. Select how you'd like to explore 
            configuration management, AI verification, and drift detection.
          </p>
        </div>

        {/* Experience Cards */}
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {experiences.map((experience) => (
            <Card 
              key={experience.id}
              className={`
                ${experience.bgColor} ${experience.borderColor} border-2 
                hover:shadow-2xl transition-all duration-300 cursor-pointer
                ${selectedExperience === experience.id ? 'ring-4 ring-blue-500/20 scale-105' : 'scale-100'}
              `}
              onClick={() => setSelectedExperience(experience.id)}
            >
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${experience.color} flex items-center justify-center mb-4`}>
                  <experience.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                  {experience.title}
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {experience.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Features */}
                <div className="space-y-3">
                  {experience.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Time Estimate */}
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>{experience.estimatedTime}</span>
                </div>

                {/* Action Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExperienceSelected(experience.id);
                  }}
                  className={`
                    w-full bg-gradient-to-r ${experience.color} 
                    hover:opacity-90 text-white font-semibold
                    transition-all duration-200 group
                  `}
                >
                  <span>{experience.buttonText}</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Status */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full px-6 py-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                System Ready
              </span>
            </div>
            <div className="text-gray-400">•</div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              STIG registry & AI verification online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceSelector;