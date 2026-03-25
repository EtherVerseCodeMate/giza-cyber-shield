import { motion } from 'framer-motion';
import { FileCheck, Eye, Shield } from 'lucide-react';

export const CoreBenefits = () => {
  const benefits = [
    {
      icon: FileCheck,
      title: 'Readiness Scan & Exposure Report',
      status: 'Live',
      statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      description: 'Probe exposed surfaces and map signals to a readiness posture you can defend in an assessor conversation.',
      gradient: 'from-cyan-500/15 to-blue-500/10',
      borderColor: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Eye,
      title: 'Assessor-Oriented Evidence Mapping',
      status: 'Prototype',
      statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'Translate findings into CMMC / NIST 800-171 evidence expectations with traceable, control-oriented outputs.',
      gradient: 'from-amber-500/15 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      icon: Shield,
      title: 'ADINKHEPRA Seal (When Certified)',
      status: 'Optional',
      statusColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      description: 'When you certify, bind evidence to a cryptographic attestation seal auditors can verify.',
      gradient: 'from-red-500/15 to-amber-500/10',
      borderColor: 'border-red-500/30',
      iconColor: 'text-red-400',
    },
  ];

  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00ffff] rounded-full filter blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Evidence-First <span className="text-[#00ffff]">Capabilities</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Built for regulated teams that need CMMC / NIST 800-171 evidence they can stand behind.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              viewport={{ once: true }}
              className={`relative bg-gradient-to-br ${benefit.gradient} border ${benefit.borderColor} rounded-xl p-8 backdrop-blur-sm hover:border-opacity-60 transition-all duration-300 group`}
            >
              {/* Status Badge */}
              <div className="absolute -top-3 right-6">
                <span className={`text-xs px-3 py-1 rounded-full border ${benefit.statusColor}`}>
                  {benefit.status}
                </span>
              </div>

              {/* Icon */}
              <div className="mb-6 pt-2">
                <benefit.icon className={`h-12 w-12 ${benefit.iconColor} group-hover:scale-110 transition-transform duration-300`} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
