# CityWalk - Travel Planning Tool

CityWalk is an interactive web application that helps users plan their travel routes efficiently. It allows users to create, save, and manage travel itineraries with multiple destinations, complete with time and distance calculations.

## Features

- **Interactive Route Planning**
  - Add multiple destinations
  - Drag and drop to reorder locations
  - Automatic route optimization
  - Real-time travel time and distance calculations

- **Location Management**
  - Search locations using Google Places API
  - Add and remove destinations
  - View detailed location information
  - Add notes to each location

- **Trip Saving & Management**
  - Save trips for future reference
  - Edit trip names
  - Delete saved trips
  - View saved trip history

- **Notes & Documentation**
  - Add notes to each location
  - Edit and delete notes
  - Rich text editing support
  - Location-specific documentation

- **Multilingual Support**
  - English interface
  - Chinese interface (中文)
  - Language switching on the fly

- **User Interface**
  - Clean, modern design
  - Responsive layout
  - Intuitive drag-and-drop interface
  - Mobile-friendly

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Google Maps API
  - Places API
  - Directions Service
  - Geometry Library
- Firebase Authentication (planned)
- Local Storage for data persistence

## Setup

1. Clone the repository
2. Create a `config.js` file with your Google Maps API key:

```javascript
const config = {
GOOGLE_MAPS_API_KEY: 'YOUR_API_KEY'
};
```
3. Open `index.html` in a web browser

## API Keys Required

- Google Maps API key with the following APIs enabled:
  - Places API
  - Directions API
  - Maps JavaScript API
  - Geocoding API

## Future Enhancements

- User authentication with Google and Apple
- Cloud data synchronization
- Route optimization algorithms
- Sharing capabilities
- Export to PDF/Print functionality
- Mobile app version

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For any questions or suggestions, please reach out through the following channels:
- Instagram: [@x1a0.l1u](https://www.instagram.com/x1a0.l1u/)
- WeChat: (Scan QR code in app)
