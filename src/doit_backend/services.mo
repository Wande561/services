import Types "./types";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Bool "mo:base/Bool";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";
//import Debug "mo:base/Debug";
import Nat "mo:base/Nat";

module ServicesModule {

  type ServiceCategory = Types.ServiceCategory;
  type Service = Types.Service;
  type ServicePricing = Types.ServicePricing;
  type PriceUnit = Types.PriceUnit;
  type ProviderProfile = Types.ProviderProfile;
  type AvailabilitySlot = Types.AvailabilitySlot;

  // ============================================================================
  // SERVICE CONSTANTS & CONFIGURATION
  // ============================================================================

  public let SUPPORTED_SERVICE_CATEGORIES : [ServiceCategory] = [
    #Plumbing,
    #HairStyling,
    #HouseCleaning,
    #Electrical,
    #Gardening,
    #PetGrooming,
    #Tutoring,
    #Construction,
    #PersonalTraining
  ];

  public let SERVICE_CATEGORY_NAMES : [(ServiceCategory, Text)] = [
    (#Plumbing, "Plumbing Services"),
    (#HairStyling, "Hair Styling & Beauty"),
    (#HouseCleaning, "House Cleaning Services"),
    (#Electrical, "Electrical Services"),
    (#Gardening, "Gardening & Landscaping"),
    (#PetGrooming, "Pet Grooming Services"),
    (#Tutoring, "Academic Tutoring"),
    (#Construction, "Construction & Building"),
    (#PersonalTraining, "Personal Training & Fitness")
  ];

  public let DEFAULT_SERVICE_PRICING : [(ServiceCategory, (Float, Float, PriceUnit))] = [
    (#Plumbing, (150.0, 500.0, #PerHour)),
    (#HairStyling, (80.0, 300.0, #PerSession)),
    (#HouseCleaning, (100.0, 400.0, #PerHour)),
    (#Electrical, (180.0, 600.0, #PerHour)),
    (#Gardening, (120.0, 350.0, #PerHour)),
    (#PetGrooming, (100.0, 250.0, #PerSession)),
    (#Tutoring, (150.0, 400.0, #PerHour)),
    (#Construction, (200.0, 800.0, #PerProject)),
    (#PersonalTraining, (150.0, 400.0, #PerSession))
  ];

  // ============================================================================
  // SERVICE DATA STRUCTURES
  // ============================================================================

  public class ServiceManager() {
    
    // Helper function for ServiceCategory hashing
    private func serviceCategoryHash(category: ServiceCategory) : Nat32 {
      switch(category) {
        case (#Plumbing) 1;
        case (#HairStyling) 2;
        case (#HouseCleaning) 3;
        case (#Electrical) 4;
        case (#Gardening) 5;
        case (#PetGrooming) 6;
        case (#Tutoring) 7;
        case (#Construction) 8;
        case (#PersonalTraining) 9;
      }
    };
    
    private var services = HashMap.HashMap<Text, Service>(10, Text.equal, Text.hash);
    private var servicesByProvider = HashMap.HashMap<Principal, [Text]>(10, Principal.equal, Principal.hash);
    private var servicesByCategory = HashMap.HashMap<ServiceCategory, [Text]>(10, 
      func(a: ServiceCategory, b: ServiceCategory) : Bool { a == b }, 
      serviceCategoryHash
    );
    private var nextServiceId : Nat = 1;

    // ============================================================================
    // SERVICE CREATION & MANAGEMENT
    // ============================================================================

    public func createService(
      providerId: Principal,
      title: Text,
      description: Text,
      category: ServiceCategory,
      pricing: ServicePricing,
      location: Text,
      images: [Text],
      availability: [AvailabilitySlot],
      requirements: [Text],
      duration: Int
    ) : async Result.Result<Service, Text> {
      
      if (Text.size(title) < 3) {
        return #err("Service title must be at least 3 characters");
      };

      if (Text.size(description) < 10) {
        return #err("Service description must be at least 10 characters");
      };

      if (pricing.minPrice <= 0.0 or pricing.maxPrice <= 0.0) {
        return #err("Pricing must be greater than 0");
      };

      if (pricing.minPrice > pricing.maxPrice) {
        return #err("Minimum price cannot be greater than maximum price");
      };

      if (duration <= 0) {
        return #err("Service duration must be greater than 0 minutes");
      };

      let serviceId = "service_" # Int.toText(Time.now()) # "_" # Nat.toText(nextServiceId);
      nextServiceId += 1;

      let newService : Service = {
        version = 1;
        id = serviceId;
        providerId = providerId;
        title = title;
        description = description;
        category = category;
        pricing = pricing;
        location = location;
        images = images;
        availability = availability;
        requirements = requirements;
        duration = duration;
        isActive = true;
        createdAt = Time.now();
        rating = 0.0;
        reviewCount = 0;
      };

      services.put(serviceId, newService);
      
      // Update provider services index
      switch (servicesByProvider.get(providerId)) {
        case null {
          servicesByProvider.put(providerId, [serviceId]);
        };
        case (?existing) {
          servicesByProvider.put(providerId, Array.append(existing, [serviceId]));
        };
      };

      // Update category services index
      switch (servicesByCategory.get(category)) {
        case null {
          servicesByCategory.put(category, [serviceId]);
        };
        case (?existing) {
          servicesByCategory.put(category, Array.append(existing, [serviceId]));
        };
      };

      #ok(newService)
    };

    public func updateService(
      serviceId: Text,
      providerId: Principal,
      updates: {
        title: ?Text;
        description: ?Text;
        pricing: ?ServicePricing;
        location: ?Text;
        images: ?[Text];
        availability: ?[AvailabilitySlot];
        requirements: ?[Text];
        duration: ?Int;
        isActive: ?Bool;
      }
    ) : async Result.Result<Service, Text> {
      
      switch (services.get(serviceId)) {
        case null {
          #err("Service not found")
        };
        case (?existingService) {
          if (existingService.providerId != providerId) {
            return #err("Unauthorized: You can only update your own services");
          };

          let updatedService : Service = {
            version = existingService.version + 1;
            id = existingService.id;
            providerId = existingService.providerId;
            title = Option.get(updates.title, existingService.title);
            description = Option.get(updates.description, existingService.description);
            category = existingService.category;
            pricing = Option.get(updates.pricing, existingService.pricing);
            location = Option.get(updates.location, existingService.location);
            images = Option.get(updates.images, existingService.images);
            availability = Option.get(updates.availability, existingService.availability);
            requirements = Option.get(updates.requirements, existingService.requirements);
            duration = Option.get(updates.duration, existingService.duration);
            isActive = Option.get(updates.isActive, existingService.isActive);
            createdAt = existingService.createdAt;
            rating = existingService.rating;
            reviewCount = existingService.reviewCount;
          };

          services.put(serviceId, updatedService);
          #ok(updatedService)
        };
      }
    };

    public func deleteService(serviceId: Text, providerId: Principal) : async Result.Result<Text, Text> {
      switch (services.get(serviceId)) {
        case null {
          #err("Service not found")
        };
        case (?existingService) {
          if (existingService.providerId != providerId) {
            return #err("Unauthorized: You can only delete your own services");
          };

          services.delete(serviceId);

          // Update provider services index
          switch (servicesByProvider.get(providerId)) {
            case null { };
            case (?providerServices) {
              let filtered = Array.filter<Text>(providerServices, func(id) = id != serviceId);
              servicesByProvider.put(providerId, filtered);
            };
          };

          // Update category services index
          let category = existingService.category;
          switch (servicesByCategory.get(category)) {
            case null { };
            case (?categoryServices) {
              let filtered = Array.filter<Text>(categoryServices, func(id) = id != serviceId);
              servicesByCategory.put(category, filtered);
            };
          };

          #ok("Service deleted successfully")
        };
      }
    };

    // ============================================================================
    // SERVICE QUERIES
    // ============================================================================

    public func getService(serviceId: Text) : ?Service {
      services.get(serviceId)
    };

    public func getAllServices() : [Service] {
      Iter.toArray(services.vals())
    };

    public func getActiveServices() : [Service] {
      let allServices = Iter.toArray(services.vals());
      Array.filter<Service>(allServices, func(service) = service.isActive)
    };

    public func getServicesByProvider(providerId: Principal) : [Service] {
      switch (servicesByProvider.get(providerId)) {
        case null { [] };
        case (?serviceIds) {
          let buffer = Buffer.Buffer<Service>(serviceIds.size());
          for (serviceId in serviceIds.vals()) {
            switch (services.get(serviceId)) {
              case (?service) { buffer.add(service); };
              case null { };
            };
          };
          Buffer.toArray(buffer)
        };
      }
    };

    public func getServicesByCategory(category: ServiceCategory) : [Service] {
      switch (servicesByCategory.get(category)) {
        case null { [] };
        case (?serviceIds) {
          let buffer = Buffer.Buffer<Service>(serviceIds.size());
          for (serviceId in serviceIds.vals()) {
            switch (services.get(serviceId)) {
              case (?service) { 
                if (service.isActive) {
                  buffer.add(service); 
                };
              };
              case null { };
            };
          };
          Buffer.toArray(buffer)
        };
      }
    };

    public func searchServices(searchQuery: Text, category: ?ServiceCategory, location: ?Text) : [Service] {
       let allServices = getActiveServices();
       let queryLower = Text.toLowercase(searchQuery);
  
       Array.filter<Service>(allServices, func(service) {
         let matchesQuery = if (Text.size(queryLower) == 0) {
           true
         } else {
           Text.contains(Text.toLowercase(service.title), #text queryLower) or
           Text.contains(Text.toLowercase(service.description), #text queryLower)
         };

         let matchesCategory = switch(category) {
           case null { true };
           case (?cat) { service.category == cat };
         };

         let matchesLocation = switch(location) {
           case null { true };
           case (?loc) { Text.contains(Text.toLowercase(service.location), #text(Text.toLowercase(loc))) };
         };

         matchesQuery and matchesCategory and matchesLocation
        });
    };


    // ============================================================================
    // SERVICE CATEGORY UTILITIES
    // ============================================================================

    public func getSupportedCategories() : [ServiceCategory] {
      SUPPORTED_SERVICE_CATEGORIES
    };

    public func getCategoryName(category: ServiceCategory) : Text {
      switch (Array.find<(ServiceCategory, Text)>(SERVICE_CATEGORY_NAMES, func(item) = item.0 == category)) {
        case (?found) { found.1 };
        case null { "Unknown Category" };
      }
    };

    public func getDefaultPricing(category: ServiceCategory) : ?ServicePricing {
      switch (Array.find<(ServiceCategory, (Float, Float, PriceUnit))>(DEFAULT_SERVICE_PRICING, func(item) = item.0 == category)) {
        case (?found) { 
          ?{
            category = category;
            minPrice = found.1.0;
            maxPrice = found.1.1;
            unit = found.1.2;
          }
        };
        case null { null };
      }
    };

    // ============================================================================
    // SERVICE STATISTICS
    // ============================================================================

    public func getServiceStats() : {
      totalServices: Nat;
      activeServices: Nat;
      servicesByCategory: [(ServiceCategory, Nat)];
      averageRating: Float;
    } {
      let allServices = Iter.toArray(services.vals());
      let activeServices = Array.filter<Service>(allServices, func(service) = service.isActive);
      
      let categoryStats = Buffer.Buffer<(ServiceCategory, Nat)>(SUPPORTED_SERVICE_CATEGORIES.size());
      for (category in SUPPORTED_SERVICE_CATEGORIES.vals()) {
        let categoryServices = getServicesByCategory(category);
        categoryStats.add((category, categoryServices.size()));
      };

      let totalRating = Array.foldLeft<Service, Float>(activeServices, 0.0, func(acc, service) = acc + service.rating);
      let averageRating = if (activeServices.size() > 0) {
        totalRating / Float.fromInt(activeServices.size())
      } else {
        0.0
      };

      {
        totalServices = allServices.size();
        activeServices = activeServices.size();
        servicesByCategory = Buffer.toArray(categoryStats);
        averageRating = averageRating;
      }
    };

    public func updateServiceRating(serviceId: Text, newRating: Float, reviewCount: Nat) : async Result.Result<(), Text> {
      switch (services.get(serviceId)) {
        case null {
          #err("Service not found")
        };
        case (?existingService) {
          let updatedService : Service = {
            existingService with 
            rating = newRating;
            reviewCount = reviewCount;
            version = existingService.version + 1;
          };
          services.put(serviceId, updatedService);
          #ok(())
        };
      }
    };

    // ============================================================================
    // SERVICE VALIDATION
    // ============================================================================

    public func validateServiceData(
      title: Text,
      description: Text,
      category: ServiceCategory,
      pricing: ServicePricing,
      duration: Int
    ) : Result.Result<(), [Text]> {
      let errors = Buffer.Buffer<Text>(0);

      if (Text.size(title) < 3) {
        errors.add("Service title must be at least 3 characters");
      };

      if (Text.size(title) > 100) {
        errors.add("Service title must be less than 100 characters");
      };

      if (Text.size(description) < 10) {
        errors.add("Service description must be at least 10 characters");
      };

      if (Text.size(description) > 1000) {
        errors.add("Service description must be less than 1000 characters");
      };

      if (pricing.minPrice <= 0.0) {
        errors.add("Minimum price must be greater than 0");
      };

      if (pricing.maxPrice <= 0.0) {
        errors.add("Maximum price must be greater than 0");
      };

      if (pricing.minPrice > pricing.maxPrice) {
        errors.add("Minimum price cannot be greater than maximum price");
      };

      if (duration <= 0) {
        errors.add("Service duration must be greater than 0 minutes");
      };

      if (duration > 1440) { // 24 hours in minutes
        errors.add("Service duration cannot exceed 24 hours");
      };

      let errorArray = Buffer.toArray(errors);
      if (errorArray.size() == 0) {
        #ok(())
      } else {
        #err(errorArray)
      }
    };

    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================

    public func bulkUpdateServiceStatus(serviceIds: [Text], providerId: Principal, isActive: Bool) : async [(Text, Result.Result<(), Text>)] {
      let results = Buffer.Buffer<(Text, Result.Result<(), Text>)>(serviceIds.size());
      
      for (serviceId in serviceIds.vals()) {
        let result = await updateService(serviceId, providerId, {
          title = null;
          description = null;
          pricing = null;
          location = null;
          images = null;
          availability = null;
          requirements = null;
          duration = null;
          isActive = ?isActive;
        });
        
        switch (result) {
          case (#ok(_)) { results.add((serviceId, #ok(()))); };
          case (#err(msg)) { results.add((serviceId, #err(msg))); };
        };
      };

      Buffer.toArray(results)
    };

    // ============================================================================
    // SERVICE EXPORT/IMPORT (for backup and migration)
    // ============================================================================

    public func exportServices() : [Service] {
      Iter.toArray(services.vals())
    };

    public func getServiceCount() : Nat {
      services.size()
    };

    public func getProviderServiceCount(providerId: Principal) : Nat {
      switch (servicesByProvider.get(providerId)) {
        case null { 0 };
        case (?serviceIds) { serviceIds.size() };
      }
    };

  };

}
