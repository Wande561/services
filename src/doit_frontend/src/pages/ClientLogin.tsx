import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

interface ClientFormData {
  email: string;
  password: string;
  name: string;
  phone: string;
  location: string;
  agreeToTerms: boolean;
}

const ClientLogin: React.FC = () => {
  const navigate = useNavigate();
  const { 
    loginWithII, 
    isConnected, 
    user, 
    actor,
    registerClient,
    getClientProfile,
    isLoading,
    error
  } = useApp();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<ClientFormData>({
    email: '',
    password: '',
    name: '',
    phone: '',
    location: '',
    agreeToTerms: false
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        // For login, we use Internet Identity authentication
        await loginWithII();
        
        // Try to get client profile to verify they exist
        try {
          const profile = await getClientProfile();
          if ('ok' in profile) {
            alert('Login successful!');
            navigate('/client-dashboard');
          } else {
            alert('Client profile not found. Please register first.');
            setIsLogin(false);
          }
        } catch (profileError) {
          console.error('Profile fetch error:', profileError);
          alert('Login successful, but could not fetch profile.');
          navigate('/client-dashboard');
        }
      } else {
        // Registration validation
        if (!formData.name.trim()) {
          alert('Full name is required.');
          return;
        }
        
        if (!formData.phone.trim()) {
          alert('Phone number is required.');
          return;
        }

        if (!formData.location.trim()) {
          alert('Location is required.');
          return;
        }

        if (!formData.agreeToTerms) {
          alert('You must accept the Terms of Service to proceed.');
          return;
        }

        // Register with the backend using the registerClient function
        try {
          const registrationData = {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            location: formData.location,
            agreeToTerms: formData.agreeToTerms
          };

          const result = await registerClient(registrationData);
          
          if ('ok' in result) {
            alert('Client account created successfully! You can now login.');
            console.log('Client registered:', result.ok);
            
            // Switch to login mode
            setIsLogin(true);
            // Clear sensitive form data
            setFormData({
              ...formData,
              password: ''
            });
          } else {
            console.error('Registration failed:', result.err);
            alert(`Registration failed: ${result.err}`);
          }
        } catch (backendError) {
          console.error('Backend registration error:', backendError);
          alert('Registration failed due to a backend error. Please try again.');
        }
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-800/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button 
          className="mb-6 text-orange-500 hover:text-orange-400 transition-colors flex items-center space-x-2"
          onClick={() => navigate('/')}
        >
          <span>←</span>
          <span>Back to Home</span>
        </button>
        
        <div className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Client Login' : 'Create Client Account'}
          </h2>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-red-100 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {(isLoading || isSubmitting) && (
            <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-blue-100 text-sm">
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required={!isLogin}
                    placeholder="e.g., +27 11 123 4567"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="location" className="block text-sm font-medium text-gray-300">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required={!isLogin}
                    placeholder="e.g., Cape Town, Johannesburg, Pretoria"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </>
            )}
            
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            
            {!isLogin && (
              <div className="border-t border-gray-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Terms & Agreement
                </h3>
                
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="agreeToTerms"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2 mt-1"
                  />
                  <label htmlFor="agreeToTerms" className="text-sm text-gray-300">
                    <span className="font-medium">I agree to the Terms of Service and Privacy Policy</span>
                    <div className="text-xs text-gray-400 mt-1">
                      By checking this box, you agree to our terms and conditions, privacy policy, and service guidelines.
                    </div>
                  </label>
                </div>
                
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm text-blue-100 font-medium">Welcome to DoIt Services</p>
                      <p className="text-xs text-blue-200 mt-1">
                        As a client, you'll have access to trusted South African service providers, secure booking, and quality assurance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isSubmitting || isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {(isSubmitting || isLoading)
                ? (isLogin ? 'Logging in...' : 'Creating Account...') 
                : (isLogin ? 'Login' : 'Create Client Account')
              }
            </button>
          </form>
          
          <div className="mt-6 text-center">
            {isLogin ? (
              <p className="text-gray-400">
                Don't have an account?{' '}
                <button 
                  type="button" 
                  className="text-orange-500 hover:text-orange-400 transition-colors font-medium"
                  onClick={() => setIsLogin(false)}
                >
                  Sign up here
                </button>
              </p>
            ) : (
              <p className="text-gray-400">
                Already have an account?{' '}
                <button 
                  type="button" 
                  className="text-orange-500 hover:text-orange-400 transition-colors font-medium"
                  onClick={() => setIsLogin(true)}
                >
                  Login here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;
