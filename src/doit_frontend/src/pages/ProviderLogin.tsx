import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

interface ProviderFormData {
  email: string;
  password: string;
  name: string;
  phone: string;
  businessName: string;
  businessType: string;
  location: string;
  services: string[];
  experience: string;
  baseRate: string;
  description: string;
  idNumber: string;
  idType: string;
  businessLicense: string;
  insuranceNumber: string;
  backgroundCheck: boolean;
  termsAccepted: boolean;
}

const ProviderLogin: React.FC = () => {
  const navigate = useNavigate();
  const { 
    loginWithII, 
    isConnected, 
    user, 
    actor,
    registerProvider,
    getProviderProfile,
    isLoading,
    error
  } = useApp();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<ProviderFormData>({
    email: '',
    password: '',
    name: '',
    phone: '',
    businessName: '',
    businessType: 'Individual',
    location: '',
    services: [],
    experience: '',
    baseRate: '',
    description: '',
    idNumber: '',
    idType: 'nationalId',
    businessLicense: '',
    insuranceNumber: '',
    backgroundCheck: false,
    termsAccepted: false
  });

  const availableServices: string[] = [
    'Plumbing', 'Hair Styling', 'Cleaning', 'Electrical', 
    'Painting', 'Gardening', 'Carpentry', 'Tutoring',
    'Pet Care', 'Moving', 'Photography', 'Catering',
    'House Building', 'Personal Training'
  ];

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  const handleServiceToggle = (service: string) => {
    const updatedServices = formData.services.includes(service)
      ? formData.services.filter(s => s !== service)
      : [...formData.services, service];
    
    setFormData({
      ...formData,
      services: updatedServices
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        // For login, we use Internet Identity authentication
        await loginWithII();
        
        // Try to get provider profile to verify they exist
        try {
          const profile = await getProviderProfile();
          if ('ok' in profile) {
            alert('Login successful!');
            navigate('/provider-dashboard');
          } else {
            alert('Provider profile not found. Please register first.');
            setIsLogin(false);
          }
        } catch (profileError) {
          console.error('Profile fetch error:', profileError);
          alert('Login successful, but could not fetch profile.');
          navigate('/provider-dashboard');
        }
      } else {
        // Registration validation
        if (!formData.idNumber.trim()) {
          alert('ID number is required for verification.');
          return;
        }
        
        if (!formData.backgroundCheck) {
          alert('You must consent to a background check to become a provider.');
          return;
        }
        
        if (!formData.termsAccepted) {
          alert('You must accept the Terms of Service to proceed.');
          return;
        }
        
        if (formData.services.length === 0) {
          alert('Please select at least one service you can provide.');
          return;
        }

        if (!formData.baseRate.trim() || parseFloat(formData.baseRate) <= 0) {
          alert('Please enter a valid base rate.');
          return;
        }

        if (!formData.experience.trim()) {
          alert('Please select your years of experience.');
          return;
        }

        if (!formData.location.trim()) {
          alert('Please enter your location.');
          return;
        }

        // Register with the backend using the registerProvider function
        try {
          const registrationData = {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            idNumber: formData.idNumber,
            businessName: formData.businessName || formData.name, // Use name if no business name
            businessType: formData.businessType,
            location: formData.location,
            serviceCategories: formData.services, // Will be converted to backend format in registerProvider
            businessLicense: formData.businessLicense || undefined,
            insuranceDetails: formData.insuranceNumber || undefined,
            description: formData.description,
            experience: parseInt(formData.experience) || 0,
            consentBackgroundCheck: formData.backgroundCheck,
            agreeToTerms: formData.termsAccepted
          };

          const result = await registerProvider(registrationData);
          
          if ('ok' in result) {
            alert('Provider account created successfully! You can now login.');
            console.log('Provider registered:', result.ok);
            
            // Switch to login mode
            setIsLogin(true);
            // Clear sensitive form data
            setFormData({
              ...formData,
              password: '',
              idNumber: '',
              businessLicense: '',
              insuranceNumber: ''
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
      <div className="w-full max-w-2xl">
        <button 
          className="mb-6 text-orange-500 hover:text-orange-400 transition-colors flex items-center space-x-2"
          onClick={() => navigate('/')}
        >
          <span>←</span>
          <span>Back to Home</span>
        </button>
        
        <div className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Provider Login' : 'Become a Service Provider'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                      Full Names
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
                    <label htmlFor="businessName" className="block text-sm font-medium text-gray-300">
                      Business Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="businessType" className="block text-sm font-medium text-gray-300">
                      Business Type
                    </label>
                    <select
                      id="businessType"
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleInputChange}
                      required={!isLogin}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="Individual">Individual</option>
                      <option value="SoleProprietorship">Sole Proprietorship</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Company">Company</option>
                      <option value="Trust">Trust</option>
                    </select>
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
                      placeholder="e.g., Cape Town, Johannesburg"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            
            {!isLogin && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="experience" className="block text-sm font-medium text-gray-300">
                      Years of Experiences
                    </label>
                    <select
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      required={!isLogin}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="">Select years of experience</option>
                      <option value="9">Less than a year</option>
                      <option value="1">1 year</option>
                      <option value="2">2 years</option>
                      <option value="3">3 years</option>
                      <option value="4">4 years</option>
                      <option value="5">5 years</option>
                      <option value="6">6 years</option>
                      <option value="7">7 years</option>
                      <option value="8">8 years</option>
                      <option value="9">9 years</option>
                      <option value="10">10+ years</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="baseRate" className="block text-sm font-medium text-gray-300">
                    Base Rate (ZAR per hour)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      R
                    </span>
                    <input
                      type="number"
                      id="baseRate"
                      name="baseRate"
                      value={formData.baseRate}
                      onChange={handleInputChange}
                      placeholder="Enter your hourly rate"
                      step="0.01"
                      required={!isLogin}
                      className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      style={{
                        MozAppearance: 'textfield',
                        WebkitAppearance: 'none'
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  <p className="text-xs text-gray-400">Set your hourly rate in South African Rand</p>
                </div>

                {/* Identity Verification Section */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.625 2.655A9 9 0 0119 11a1 1 0 11-2 0 7 7 0 00-9.625-6.492 1 1 0 11-.75-1.853zM4.662 4.959A1 1 0 014.75 6.37 6.97 6.97 0 003 11a1 1 0 11-2 0 8.97 8.97 0 012.25-5.953 1 1 0 011.412-.088z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M5 11a5 5 0 1110 0 1 1 0 11-2 0 3 3 0 10-6 0 1 1 0 11-2 0z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 7a1 1 0 011 1v3a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Identity Verification (Required)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="idType" className="block text-sm font-medium text-gray-300">
                        ID Type
                      </label>
                      <select
                        id="idType"
                        name="idType"
                        value={formData.idType}
                        onChange={handleInputChange}
                        required={!isLogin}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="nationalId">National ID</option>
                        <option value="passport">Passport</option>
                        <option value="driversLicense">Driver's License</option>
                        <option value="socialSecurity">Social Security Card</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label htmlFor="idNumber" className="block text-sm font-medium text-gray-300">
                        ID Number
                      </label>
                      <input
                        type="text"
                        id="idNumber"
                        name="idNumber"
                        value={formData.idNumber}
                        onChange={handleInputChange}
                        required={!isLogin}
                        placeholder="Enter your ID number"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Business Verification Section */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                    </svg>
                    Business Credentials (Optional but Recommended)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="businessLicense" className="block text-sm font-medium text-gray-300">
                        Business License Number
                      </label>
                      <input
                        type="text"
                        id="businessLicense"
                        name="businessLicense"
                        value={formData.businessLicense}
                        onChange={handleInputChange}
                        placeholder="Enter business license number"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label htmlFor="insuranceNumber" className="block text-sm font-medium text-gray-300">
                        Insurance Policy Number
                      </label>
                      <input
                        type="text"
                        id="insuranceNumber"
                        name="insuranceNumber"
                        value={formData.insuranceNumber}
                        onChange={handleInputChange}
                        placeholder="Liability insurance number"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">
                    Services You Offer
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-800 rounded-md border border-gray-700">
                    {availableServices.map(service => (
                      <label key={service} className="flex items-center space-x-2 text-gray-300 hover:text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.services.includes(service)}
                          onChange={() => handleServiceToggle(service)}
                          className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                        />
                        <span className="text-sm">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-300">
                    Brief Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Tell clients about your expertise and what makes you stand out..."
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* Verification and Terms Section */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Verification & Agreement
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="backgroundCheck"
                        name="backgroundCheck"
                        checked={formData.backgroundCheck}
                        onChange={handleInputChange}
                        required={!isLogin}
                        className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2 mt-1"
                      />
                      <label htmlFor="backgroundCheck" className="text-sm text-gray-300">
                        <span className="font-medium">I consent to a background check</span>
                        <div className="text-xs text-gray-400 mt-1">
                          We will verify your identity and check for any criminal history to ensure client safety.
                        </div>
                      </label>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="termsAccepted"
                        name="termsAccepted"
                        checked={formData.termsAccepted}
                        onChange={handleInputChange}
                        required={!isLogin}
                        className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2 mt-1"
                      />
                      <label htmlFor="termsAccepted" className="text-sm text-gray-300">
                        <span className="font-medium">I agree to the Terms of Service and Provider Code of Conduct</span>
                        <div className="text-xs text-gray-400 mt-1">
                          By checking this box, you agree to provide honest services, maintain professional conduct, and follow all platform guidelines.
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mt-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm text-yellow-100 font-medium">Security Notice</p>
                        <p className="text-xs text-yellow-200 mt-1">
                          All information will be securely encrypted and verified. Providing false information may result in account suspension.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <button 
              type="submit" 
              disabled={isSubmitting || isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {(isSubmitting || isLoading)
                ? (isLogin ? 'Logging in...' : 'Creating Account...') 
                : (isLogin ? 'Login' : 'Create Provider Account')
              }
            </button>
          </form>
          
          <div className="mt-6 text-center">
            {isLogin ? (
              <p className="text-gray-400">
                Want to offer services?{' '}
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

export default ProviderLogin;
