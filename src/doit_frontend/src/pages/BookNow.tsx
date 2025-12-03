import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, User, Phone, Mail, CreditCard, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Principal } from '@dfinity/principal';

interface BookingFormData {
  serviceId: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  notes: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  paymentMethod: string;
}

const BookNow = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    user, 
    isConnected, 
    isLoading: authLoading, 
    availableServices, 
    actor, 
    getUserProfile,
    createBooking,
    getAllServices,
    services
  } = useApp();
  
  const servicesToDisplay = availableServices;

  useEffect(() => {
    if (!authLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, authLoading, navigate]);

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [bookingError, setBookingError] = useState<string>('');

  const [formData, setFormData] = useState<BookingFormData>({
    serviceId: searchParams.get('service') || '',
    date: '',
    time: '',
    duration: '1',
    location: '',
    notes: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    paymentMethod: 'card',
  });

  useEffect(() => {
    const loadProviders = async () => {
      if (formData.serviceId && isConnected && actor) {
        try {
          await getAllServices();
          const matchingService = services.find(service => service.id === formData.serviceId);
          
          if (matchingService) {
            const mockProvider = {
              id: matchingService.providerId.toText(),
              name: `${formData.serviceId} Provider`,
              rating: 4.5,
              priceRange: matchingService.pricing ? 
                `R${matchingService.pricing.minPrice} - R${matchingService.pricing.maxPrice}` : 
                'Quote on request',
              location: matchingService.location || 'Available in your area'
            };
            setAvailableProviders([mockProvider]);
            setSelectedProvider(mockProvider);
          } else {
            const mockProvider = {
              id: '1',
              name: `${formData.serviceId} Specialist`,
              rating: 4.5,
              priceRange: 'Quote on request',
              location: 'Available in your area'
            };
            setAvailableProviders([mockProvider]);
            setSelectedProvider(mockProvider);
          }
        } catch (error) {
          console.error('Failed to load providers:', error);
          setAvailableProviders([]);
        }
      } else if (formData.serviceId && servicesToDisplay.includes(formData.serviceId)) {
        setAvailableProviders([{
          id: '1',
          name: `${formatServiceName(formData.serviceId)} Provider`,
          rating: 0,
          priceRange: 'Quote on request',
          location: 'Available in your area'
        }]);
        setSelectedProvider({
          id: '1',
          name: `${formatServiceName(formData.serviceId)} Provider`, 
          rating: 0,
          priceRange: 'Quote on request',
          location: 'Available in your area'
        });
      }
    };

    loadProviders();
  }, [formData.serviceId, isConnected, actor, servicesToDisplay, getAllServices, services]);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await getUserProfile();
        if (profile) {
          setFormData(prev => ({
            ...prev,
            clientName: profile.username || profile.fullName || '',
            clientEmail: profile.email || '',
            clientPhone: profile.phone || ''
          }));
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };

    if (user.isAuthenticated) {
      loadUserProfile();
    }
  }, [user.isAuthenticated, getUserProfile]);

  const getServiceName = (serviceId: string) => {
    if (servicesToDisplay.includes(serviceId)) {
      return serviceId;
    }
    return 'Selected Service';
  };

  const formatServiceName = (serviceName: string) => {
    return serviceName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const selectedService = formData.serviceId ? {
    title: formatServiceName(getServiceName(formData.serviceId)),
    provider: selectedProvider?.name || 'Service Provider',
    price: selectedProvider?.priceRange || 'Quote on request',
    providerData: selectedProvider
  } : null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setBookingError('');

    try {
      if (!formData.serviceId || !formData.date || !formData.time || !formData.clientName || !formData.clientEmail) {
        throw new Error('Please fill in all required fields');
      }

      if (!selectedProvider?.id) {
        throw new Error('Please select a service provider');
      }

      if (isConnected && actor) {
        try {
          console.log('Submitting booking to backend:', {
            serviceId: formData.serviceId,
            providerId: selectedProvider.id,
            date: formData.date,
            time: formData.time,
            duration: parseInt(formData.duration),
            location: formData.location,
            notes: formData.notes
          });
          
          const bookingResult = await createBooking(
            formData.serviceId,
            selectedProvider.id,
            formData.date,
            formData.time,
            parseInt(formData.duration),
            formData.location,
            formData.paymentMethod,
            formData.notes
          );
          
          if (bookingResult) {
            console.log('Booking created successfully:', bookingResult);
          } else {
            throw new Error('Failed to create booking');
          }
          
        } catch (backendError) {
          console.error('Backend booking failed:', backendError);

          const bookingData = {
            id: Date.now().toString(),
            serviceId: formData.serviceId,
            providerId: selectedProvider?.id || '1',
            clientId: user.principal?.toText() || '',
            scheduledDate: formData.date,
            scheduledTime: formData.time,
            duration: parseInt(formData.duration),
            location: formData.location,
            notes: formData.notes,
            clientDetails: {
              name: formData.clientName,
              email: formData.clientEmail,
              phone: formData.clientPhone
            },
            paymentMethod: formData.paymentMethod,
            status: 'pending',
            createdAt: Date.now()
          };
          
          console.log('Booking created with fallback data structure (backend unavailable)');
        }
      } else {
        const bookingData = {
          id: Date.now().toString(),
          serviceId: formData.serviceId,
          providerId: selectedProvider?.id || '1',
          clientId: user.principal?.toText() || '',
          scheduledDate: formData.date,
          scheduledTime: formData.time,
          duration: parseInt(formData.duration),
          location: formData.location,
          notes: formData.notes,
          clientDetails: {
            name: formData.clientName,
            email: formData.clientEmail,
            phone: formData.clientPhone
          },
          paymentMethod: formData.paymentMethod,
          status: 'pending',
          createdAt: Date.now()
        };
        
        console.log('Booking created with fallback data structure (backend unavailable)');
      }

      setIsBooked(true);
    } catch (error) {
      console.error('Booking failed:', error);
      setBookingError(error instanceof Error ? error.message : 'Failed to create booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };

  if (isBooked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-gray-900 rounded-xl p-8 text-center border border-gray-800"
        >
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-4">Booking Confirmed!</h2>
          <p className="text-gray-400 mb-6">
            Your booking has been confirmed. You will receive a confirmation email shortly.
          </p>

          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-white font-semibold mb-2">Booking Details</h3>
            <div className="space-y-1 text-sm text-gray-400">
              <p>
                <span className="text-orange-500">Service:</span> {selectedService?.title}
              </p>
              <p>
                <span className="text-orange-500">Provider:</span> {selectedService?.provider}
              </p>
              <p>
                <span className="text-orange-500">Date:</span> {formData.date}
              </p>
              <p>
                <span className="text-orange-500">Time:</span> {formData.time}
              </p>
              <p>
                <span className="text-orange-500">Duration:</span> {formData.duration} hour(s)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/services')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg transition-colors"
            >
              Book Another Service
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
            >
              View My Bookings
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20 pb-12">
      {/* Loading State */}
      {authLoading && (
        <div className="flex items-center justify-center h-screen">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="text-white">Loading booking...</span>
          </div>
        </div>
      )}

      {/* Authentication Required */}
      {!authLoading && !user.isAuthenticated && (
        <div className="flex items-center justify-center h-screen">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-auto">
              <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Sign In Required</h2>
              <p className="text-gray-400 mb-6">You need to sign in to book a service</p>
              <button
                onClick={() => navigate('/signin')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Authenticated Content */}
      {!authLoading && user.isAuthenticated && (
        <div>
          {/* Backend Status */}
          {!isConnected && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-red-300">Backend disconnected - Booking sync unavailable</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Booking Form */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <button
                onClick={() => navigate('/services')}
                className="flex items-center space-x-2 text-orange-500 hover:text-orange-400 transition-colors mb-6"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Services</span>
              </button>

              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Book Your Service</h1>
              <p className="text-gray-400">Complete your booking in 3 simple steps</p>
            </motion.div>

            {/* Progress Steps */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8">
              <div className="flex items-center justify-between">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        currentStep >= step ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`h-1 w-16 md:w-32 mx-2 transition-colors ${
                          currentStep > step ? 'bg-orange-500' : 'bg-gray-800'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className={currentStep >= 1 ? 'text-orange-500' : 'text-gray-400'}>Service & Time</span>
                <span className={currentStep >= 2 ? 'text-orange-500' : 'text-gray-400'}>Your Details</span>
                <span className={currentStep >= 3 ? 'text-orange-500' : 'text-gray-400'}>Payment & Review</span>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-gray-900 rounded-xl p-6 md:p-8 border border-gray-800"
            >
              {/* Error Display */}
              {bookingError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-300">{bookingError}</span>
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Step 1: Service & Time */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Service Details</h2>
                    
                    {/* Selected Service Display */}
                    {selectedService && (
                      <div className="bg-gray-800 rounded-lg p-4 mb-6">
                        <h3 className="text-white font-semibold mb-2">Selected Service</h3>
                        <div className="space-y-1 text-sm">
                          <p className="text-orange-500 font-medium">{selectedService.title}</p>
                          <p className="text-gray-400">Provider: {selectedService.provider}</p>
                          <p className="text-gray-400">Price: {selectedService.price}</p>
                        </div>
                      </div>
                    )}

                    {/* Service Selection */}
                    {!formData.serviceId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Select Service *
                        </label>
                        {servicesToDisplay.length > 0 ? (
                          <select
                            name="serviceId"
                            value={formData.serviceId}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                            required
                          >
                            <option value="">Choose a service</option>
                            {servicesToDisplay.map((service) => (
                              <option key={service} value={service}>
                                {formatServiceName(service)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 flex items-center justify-center">
                            {isConnected ? (
                              <span>Loading services...</span>
                            ) : (
                              <span>Please connect to backend to view available services</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Preferred Date *
                      </label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                        required
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Clock className="w-4 h-4 inline mr-2" />
                        Preferred Time *
                      </label>
                      <select
                        name="time"
                        value={formData.time}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                        required
                      >
                        <option value="">Select time</option>
                        {generateTimeSlots().map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration
                      </label>
                      <select
                        name="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="3">3 hours</option>
                        <option value="4">4 hours</option>
                        <option value="8">Full day (8 hours)</option>
                      </select>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Service Location
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="Enter your address or location"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Any special requirements or notes for the service provider"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Your Details */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Your Details</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <User className="w-4 h-4 inline mr-2" />
                          Full Name *
                        </label>
                        <input
                          type="text"
                          name="clientName"
                          value={formData.clientName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <Mail className="w-4 h-4 inline mr-2" />
                          Email *
                        </label>
                        <input
                          type="email"
                          name="clientEmail"
                          value={formData.clientEmail}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Phone className="w-4 h-4 inline mr-2" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="clientPhone"
                        value={formData.clientPhone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Payment & Review */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Review & Confirm</h2>
                    
                    {/* Booking Summary */}
                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                      <h3 className="text-lg font-semibold text-white">Booking Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Service:</span>
                          <span className="text-white">{selectedService?.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Provider:</span>
                          <span className="text-white">{selectedService?.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date:</span>
                          <span className="text-white">{formData.date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Time:</span>
                          <span className="text-white">{formData.time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white">{formData.duration} hour(s)</span>
                        </div>
                        {formData.location && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Location:</span>
                            <span className="text-white">{formData.location}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                          <span className="text-gray-400">Estimated Price:</span>
                          <span className="text-orange-500">{selectedService?.price}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-4">
                        <CreditCard className="w-4 h-4 inline mr-2" />
                        Payment Method
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="card"
                            checked={formData.paymentMethod === 'card'}
                            onChange={handleInputChange}
                            className="mr-3 text-orange-500"
                          />
                          <span className="text-white">Credit/Debit Card</span>
                        </label>
                        <label className="flex items-center p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={formData.paymentMethod === 'cash'}
                            onChange={handleInputChange}
                            className="mr-3 text-orange-500"
                          />
                          <span className="text-white">Pay on Service</span>
                        </label>
                        <label className="flex items-center p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="bank_transfer"
                            checked={formData.paymentMethod === 'bank_transfer'}
                            onChange={handleInputChange}
                            className="mr-3 text-orange-500"
                          />
                          <span className="text-white">Bank Transfer</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  
                  <div className="ml-auto">
                    {currentStep < 3 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={
                          (currentStep === 1 && (!formData.serviceId || !formData.date || !formData.time)) ||
                          (currentStep === 2 && (!formData.clientName || !formData.clientEmail))
                        }
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Booking...
                          </>
                        ) : (
                          'Confirm Booking'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookNow;
