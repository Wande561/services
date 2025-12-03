import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Briefcase } from 'lucide-react';

type UserType = 'client' | 'provider';

interface UserTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserTypeModal: React.FC<UserTypeModalProps> = ({ isOpen, onClose }) => {
  const handleUserTypeSelect = (type: UserType) => {
    console.log(`Selected user type: ${type}`);
    // Here you would typically handle the user type selection
    // and redirect to appropriate registration/login flow
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Choose Your Role</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Description */}
              <p className="text-gray-300 mb-8 text-center">
                Are you looking for services or providing them?
              </p>
              
              {/* User Type Options */}
              <div className="space-y-4">
                {/* Client Option */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUserTypeSelect('client')}
                  className="w-full p-6 bg-gray-700 hover:bg-gray-600 rounded-xl border-2 border-transparent hover:border-orange-500 transition-all duration-300 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-500 rounded-lg group-hover:bg-orange-400 transition-colors">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-white mb-1">I'm a Client</h3>
                      <p className="text-gray-400 text-sm">Looking for services and providers</p>
                    </div>
                  </div>
                </motion.button>
                
                {/* Provider Option */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUserTypeSelect('provider')}
                  className="w-full p-6 bg-gray-700 hover:bg-gray-600 rounded-xl border-2 border-transparent hover:border-orange-500 transition-all duration-300 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-500 rounded-lg group-hover:bg-orange-400 transition-colors">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-white mb-1">I'm a Provider</h3>
                      <p className="text-gray-400 text-sm">Offering services to clients</p>
                    </div>
                  </div>
                </motion.button>
              </div>
              
              {/* Footer */}
              <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                  You can always change this later in your profile settings
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UserTypeModal;