import React from 'react';
import { motion } from 'framer-motion';
import { Star, Users } from 'lucide-react';

interface Service {
  id: number;
  name: string;
  icon: string;
  providers: number;
  rating: number;
}

interface ServiceCardProps {
  service: Service;
  index: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-orange-500 transition-all duration-300 cursor-pointer group"
    >
      <div className="text-center">
        {/* Service Icon */}
        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
          {service.icon}
        </div>
        
        {/* Service Name */}
        <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-orange-500 transition-colors">
          {service.name}
        </h3>
        
        {/* Service Stats */}
        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{service.providers} providers</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span>{service.rating}</span>
          </div>
        </div>
        
        {/* Action Button */}
        <button className="w-full bg-gray-700 hover:bg-orange-500 text-white py-2 px-4 rounded-lg transition-colors duration-300 font-medium">
          View Providers
        </button>
      </div>
    </motion.div>
  );
};

export default ServiceCard;