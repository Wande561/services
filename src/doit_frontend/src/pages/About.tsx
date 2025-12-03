import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target, Award, Heart, CheckCircle, Star } from 'lucide-react';

const About = () => {
  const stats = [
    { number: '10,000+', label: 'Active Users', icon: Users },
    { number: '5,000+', label: 'Service Providers', icon: Target },
    { number: '50,000+', label: 'Services Completed', icon: Award },
    { number: '4.8/5', label: 'Average Rating', icon: Star }
  ];

  const values = [
    {
      icon: Heart,
      title: 'Customer First',
      description: 'We prioritize customer satisfaction and ensure every service meets the highest standards.'
    },
    {
      icon: CheckCircle,
      title: 'Quality Assurance',
      description: 'All service providers are thoroughly vetted and continuously monitored for quality.'
    },
    {
      icon: Users,
      title: 'Community Driven',
      description: 'Building strong connections between service providers and customers in local communities.'
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'Committed to delivering exceptional service experiences that exceed expectations.'
    }
  ];

  const team = [
    {
      name: 'Mawande Hlangu',
      role: 'CEO & Founder',
      image: 'https://images.unsplash.com/photo-1531123414780-f74242c2b052?w=300&h=300&fit=crop&crop=face',
      description: 'Visionary leader in tech and service industries.'
    },
    {
      name: 'Thabo Mthembu',
      role: 'Head of Operations',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
      description: 'Operations specialist ensuring smooth platform experiences for all users.'
    },
    {
      name: 'Nomsa Khumalo',
      role: 'Customer Success',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face',
      description: 'Customer advocate dedicated to building lasting relationships and trust.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            About <span className="text-orange-500">ServiceConnect</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            We're revolutionizing how people connect with trusted service providers. 
            Our platform bridges the gap between those who need services and skilled professionals 
            who deliver exceptional results.
          </p>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
        >
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="text-center">
                <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-colors">
                  <IconComponent className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">{stat.number}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Mission Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-gray-800 rounded-2xl p-8 md:p-12 mb-16"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-8">
              To create a trusted ecosystem where service providers can showcase their expertise 
              and customers can easily find reliable, high-quality services. We believe in empowering 
              local businesses and making professional services accessible to everyone.
            </p>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">For Customers</h3>
                <p className="text-gray-300">
                  Find vetted professionals, compare services, read reviews, and book with confidence. 
                  We make it simple to get the help you need, when you need it.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">For Providers</h3>
                <p className="text-gray-300">
                  Grow your business, reach new customers, and build your reputation. 
                  Our platform provides the tools you need to succeed and thrive.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Values Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-white text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                  className="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-750 transition-colors"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{value.title}</h3>
                  <p className="text-gray-300 text-sm">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Team Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <h2 className="text-3xl font-bold text-white text-center mb-12">Meet Our Team</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="relative mb-4">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-32 h-32 rounded-full mx-auto object-cover"
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-orange-500/20 to-transparent"></div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                <p className="text-orange-500 text-sm font-medium mb-3">{member.role}</p>
                <p className="text-gray-300 text-sm">{member.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default About;